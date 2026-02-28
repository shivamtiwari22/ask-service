import handleResponse from "../../../utils/http-response.js";
import User from "../../models/UserModel.js";
import ServiceRequest from "../../models/ServiceRequestModel.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import VendorCreditWallet from "../../models/VendorCreditWalletModel.js";
import VendorLeadUnlock from "../../models/VendorLeadUnlockModel.js";
import VendorQuote from "../../models/VendorQuoteModel.js";
import CreditPackage from "../../models/CreditPackageModel.js";
import Transaction from "../../models/TransactionModel.js";
import normalizePath from "../../../utils/imageNormalizer.js";
import { Parser as Json2CsvParser } from "json2csv";
import PDFDocument from "pdfkit";
import { drawPdfTable } from "../../../utils/pdfTable.js";

function generateTransactionNumber(id, date) {
  const year = new Date(date || Date.now()).getFullYear();
  const num = parseInt(id.toString().slice(-5), 16) % 100000;
  return `TXN-${year}-${String(num).padStart(5, "0")}`;
}

/**
 * GET /dashboard
 * Vendor dashboard stats: available leads, purchased leads, credit balance, quotes sent, kyc status
 */
export const getDashboardStats = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const user = await User.findById(vendorId).select("kyc_status service").lean();
    if (!user) return handleResponse(404, "User not found", {}, res);

    const serviceCategoryId = user.service;
    if (!serviceCategoryId) {
      return handleResponse(200, "Dashboard fetched", {
        availableLeadsCount: 0,
        purchasedLeadsCount: 0,
        creditBalance: 0,
        quotesSentCount: 0,
        // kyc_status: user.kyc_status || "PENDING",
        kyc_status : "Service not updated" ,
        canPurchaseLeads: false,
      }, res);
    }

    const [availableLeadsCount, purchasedLeadsCount, wallet, quotesSentCount] = await Promise.all([
      ServiceRequest.countDocuments({
        service_category: serviceCategoryId,
        deletedAt: null,
        status: "ACTIVE",
      }),
      VendorLeadUnlock.countDocuments({ vendor_id: vendorId }),
      VendorCreditWallet.findOne({ user_id: vendorId }).lean(),
      VendorQuote.countDocuments({ vendor_id: vendorId, status: "SENT" }),
    ]);

    const creditBalance = wallet?.amount ?? 0;
    const canPurchaseLeads = user.kyc_status === "ACTIVE";

    return handleResponse(200, "Dashboard fetched successfully", {
      availableLeadsCount,
      purchasedLeadsCount,
      creditBalance,
      quotesSentCount,
      kyc_status: user.kyc_status || "PENDING",
      canPurchaseLeads,
    }, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * POST /leads/:leadId/unlock
 * Unlock (purchase) a lead. Requires KYC ACTIVE and sufficient credits.
 */
export const unlockLead = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const leadId = req.params.leadId;

    const user = await User.findById(vendorId).select("kyc_status service");
    if (!user) return handleResponse(404, "User not found", {}, res);
    if (user.kyc_status !== "ACTIVE") {
      return handleResponse(403, "Your documents are under review. You cannot purchase leads at this time.", {}, res);
    }

    const lead = await ServiceRequest.findById(leadId)
      .populate({ path: "service_category", select: "title credit" })
      .lean();
    if (!lead || lead.deletedAt || lead.status !== "ACTIVE") {
      return handleResponse(404, "Lead not found or no longer available", {}, res);
    }
    if (lead.service_category._id.toString() !== user.service?.toString()) {
      return handleResponse(403, "This lead is not for your service category", {}, res);
    }

    const alreadyUnlocked = await VendorLeadUnlock.findOne({
      vendor_id: vendorId,
      service_request_id: leadId,
    });
    if (alreadyUnlocked) {
      return handleResponse(409, "You have already unlocked this lead", { unlocked: true }, res);
    }

    const creditsRequired = lead.service_category?.credit ?? 3;
    const wallet = await VendorCreditWallet.findOne({ user_id: vendorId });
    if (!wallet) return handleResponse(500, "Credit wallet not found", {}, res);
    if (wallet.amount < creditsRequired) {
      return handleResponse(402, "Insufficient credits. Please buy more credits.", { required: creditsRequired, balance: wallet.amount }, res);
    }

    wallet.amount -= creditsRequired;
    await wallet.save();

    const balanceAfter = wallet.amount;
    const serviceTitle = lead.service_category?.title || "Lead";
    const description = `Unlocked Lead ${serviceTitle} in ${lead.city || ""}`;

    const [unlockRecord, tx] = await Promise.all([
      VendorLeadUnlock.create({
        vendor_id: vendorId,
        service_request_id: leadId,
        credits_spent: creditsRequired,
      }),
      Transaction.create({
        user_id: vendorId,
        // amount: creditsRequired,
        amount_paid: creditsRequired ,
        type: "debit",
        status: "completed",
        description,
        balance_after: balanceAfter,
        reference_type: "lead_unlock",
        reference_id: leadId,
        plat_form: "manual",
      }),
    ]);
    if (tx && tx._id) {
      await Transaction.updateOne(
        { _id: tx._id },
        { $set: { transaction_number: generateTransactionNumber(tx._id, tx.createdAt) } }
      );
    }

    const fullLead = await ServiceRequest.findById(leadId)
      .populate({ path: "service_category", select: "title credit" })
      .populate({ path: "user", select: "first_name last_name email phone" })
      .lean();

    return handleResponse(200, "Lead unlocked successfully", {
      lead: fullLead,
      creditsSpent: creditsRequired,
      balanceAfter,
    }, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * GET /leads/:leadId
 * Get single lead. Full details if unlocked by this vendor, otherwise masked.
 */
export const getLeadById = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const leadId = req.params.leadId;

    const lead = await ServiceRequest.findById(leadId)
      .populate({ path: "service_category", select: "title credit" })
      .populate({ path: "user", select: "first_name last_name email phone createdAt" })
      .lean();

    if (!lead || lead.deletedAt || lead.status !== "ACTIVE") {
      return handleResponse(404, "Lead not found or no longer available", {}, res);
    }

    const unlocked = await VendorLeadUnlock.findOne({
      vendor_id: vendorId,
      service_request_id: leadId,
    });

    if (!unlocked) {
      const masked = { ...lead };
      if (masked.contact_details) {
        masked.contact_details = {
          first_name: masked.contact_details.first_name?.[0] + "***" || "***",
          last_name: masked.contact_details.last_name?.[0] + "***" || "***",
          phone: (masked.contact_details.phone || "").slice(0, 3) + " *******",
          email: (masked.contact_details.email || "").replace(/(.{2})(.*)(@.*)/, "$1*******$3"),
        };
      }
      if (masked.user) {
        masked.user.phone = (masked.user.phone || "").slice(0, 3) + " *******";
        masked.user.email = (masked.user.email || "").replace(/(.{2})(.*)(@.*)/, "$1*******$3");
      }
      masked.unlocked = false;
      masked.creditsToUnlock = lead.service_category?.credit ?? 3;
      return handleResponse(200, "Lead details", masked, res);
    }

    const response = { ...lead, unlocked: true };
    return handleResponse(200, "Lead details", response, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * POST /leads/:leadId/quotes
 * Submit a quote for a lead. Vendor must have unlocked the lead first.
 */
export const submitQuote = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const leadId = req.params.leadId;
    const attachmentFile = req.files;
    const attachmentPath =     Array.isArray(req.files?.attachment) && attachmentFile?.attachment?.length > 0 ? attachmentFile.attachment[0].path : null;
    
    const {
      quote_price,
      service_description,
      available_start_date,
      quote_valid_days = 7,
    } = req.body;

    if (!quote_price || !service_description || !available_start_date) {
      return handleResponse(400, "quote_price, service_description and available_start_date are required", {}, res);
    }

    const price = parseFloat(quote_price);
    if (isNaN(price) || price < 0) {
      return handleResponse(400, "Invalid quote price", {}, res);
    }

    const unlocked = await VendorLeadUnlock.findOne({
      vendor_id: vendorId,
      service_request_id: leadId,
    });
    if (!unlocked) {
      return handleResponse(403, "You must unlock this lead before submitting a quote", {}, res);
    }

    const lead = await ServiceRequest.findById(leadId);
    if (!lead || lead.deletedAt || lead.status !== "ACTIVE") {
      return handleResponse(404, "Lead not found or no longer available", {}, res);
    }

    const existingQuote = await VendorQuote.findOne({
      vendor_id: vendorId,
      service_request_id: leadId,
      status: "SENT",
    });
    if (existingQuote) {
      return handleResponse(409, "You have already submitted a quote for this lead", {}, res);
    }

    const MAX_QUOTES_PER_REQUEST = 5;
    const quotesCount = await VendorQuote.countDocuments({
      service_request_id: leadId,
      status: "SENT",
    });
    if (quotesCount >= MAX_QUOTES_PER_REQUEST) {
      return handleResponse(
        400,
        `Maximum ${MAX_QUOTES_PER_REQUEST} quotes have already been submitted for this request. No more quotes can be accepted.`,
        { maxQuotes: MAX_QUOTES_PER_REQUEST, currentCount: quotesCount },
        res,
      );
    }

    const startDate = new Date(available_start_date);
    if (isNaN(startDate.getTime())) {
      return handleResponse(400, "Invalid available_start_date", {}, res);
    }

    const quote = await VendorQuote.create({
      vendor_id: vendorId,
      service_request_id: leadId,
      quote_price: price,
      currency: "EUR",
      service_description: service_description.trim(),
      available_start_date: startDate,
      quote_valid_days: parseInt(quote_valid_days, 10) || 7,
      attachment_url: attachmentPath,
      status: "SENT",
    });

    const populated = await VendorQuote.findById(quote._id)
      .populate({ path: "service_request_id", select: "reference_no status" })
      .lean();

    return handleResponse(201, "Quote submitted successfully", populated, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

// Default packages from Figma (used when DB has none)
const DEFAULT_CREDIT_PACKAGES = [
  { name: "Starter", credits: 50, bonus_credits: 0, price: 19.99, currency: "EUR", per_credit_price: 0.4, is_most_popular: false, sort_order: 1 },
  { name: "Professional", credits: 150, bonus_credits: 15, price: 49.99, currency: "EUR", per_credit_price: 0.33, is_most_popular: true, sort_order: 2 },
  { name: "Business", credits: 300, bonus_credits: 30, price: 89.99, currency: "EUR", per_credit_price: 0.3, is_most_popular: false, sort_order: 3 },
  { name: "Enterprise", credits: 500, bonus_credits: 50, price: 139.99, currency: "EUR", per_credit_price: 0.28, is_most_popular: false, sort_order: 4 },
];

/**
 * GET /credits/packages
 * List active credit packages for purchase.
 */
export const getCreditPackages = async (req, res) => {
  try {
    let packages = await CreditPackage.find({
      status: "ACTIVE",
      deletedAt: null,
    })
      .sort({ price: 1 })
      .lean();

    if (packages.length === 0) {
      packages = DEFAULT_CREDIT_PACKAGES.map((p) => ({ ...p, _id: null }));
    }

    return handleResponse(200, "Credit packages fetched successfully", packages, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * GET /credits/balance
 * Get current credit balance.
 */
export const getCreditBalance = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const wallet = await VendorCreditWallet.findOne({ user_id: vendorId }).lean();
    const balance = wallet?.amount ?? 0;
    return handleResponse(200, "Balance fetched successfully", { creditBalance: balance }, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

const PACKAGE_KEY_MAP = {
  starter: DEFAULT_CREDIT_PACKAGES[0],
  professional: DEFAULT_CREDIT_PACKAGES[1],
  business: DEFAULT_CREDIT_PACKAGES[2],
  enterprise: DEFAULT_CREDIT_PACKAGES[3],
};



export const purchaseCredits = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { package_id, package_key } = req.body;

    if (!package_id && !package_key) {
      return handleResponse(400, "package_id or package_key is required", {}, res);
    }

    let pkg = null;
    if (package_id) {
      pkg = await CreditPackage.findOne({
        _id: package_id,
        status: "ACTIVE",
        deletedAt: null,
      }).lean();
    }
    if (!pkg && package_key) {
      pkg = PACKAGE_KEY_MAP[package_key.toLowerCase()] || null;
    }
    if (!pkg) {
      return handleResponse(400, "package_id or package_key is required", {}, res);
    }
    if (!pkg._id && package_key) {
      pkg = { ...pkg, _id: package_key };
    }

    const totalCredits = (pkg.credits || 0) + (pkg.bonus_credits || 0);
    if (totalCredits <= 0) return handleResponse(400, "Invalid package", {}, res);

    let wallet = await VendorCreditWallet.findOne({ user_id: vendorId });
    if (!wallet) {
      wallet = await VendorCreditWallet.create({ user_id: vendorId, amount: 0 });
    }

    const previousBalance = wallet.amount;
    wallet.amount += totalCredits;
    await wallet.save();

    const description = `Purchased ${pkg.name}`;
    const tx = await Transaction.create({
      user_id: vendorId,
      amount: totalCredits,
      type: "credit",
      status: "completed",
      description,
      balance_after: wallet.amount,
      reference_type: "credit_purchase",
      reference_id: pkg._id && typeof pkg._id === "object" ? pkg._id : undefined,
      plat_form: "manual",
      amount_paid: pkg.price,
      currency: pkg.currency || "EUR",
      payment_method: req.body.payment_method || null,
    });
    if (tx && tx._id) {
      await Transaction.updateOne(
        { _id: tx._id },
        { $set: { transaction_number: generateTransactionNumber(tx._id, tx.createdAt) } }
      );
    }

    return handleResponse(200, "Credits purchased successfully", {
      creditsAdded: totalCredits,
      creditBalance: wallet.amount,
      package: { name: pkg.name, credits: pkg.credits, bonus_credits: pkg.bonus_credits },
    }, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};



export const getTransactionsList = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const {
      period,
      from_date,
      to_date,
      type,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { user_id: vendorId };

    if (type === "purchase" || type === "credit") filter.type = "credit";
    else if (type === "deduction" || type === "debit") filter.type = "debit";

    let startDate, endDate;
    if (period === "last_30_days" || period === "Last 30 days") {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === "last_3_months") {
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
    } else if (period === "last_6_months") {
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
    }
    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    }
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Transaction.countDocuments(filter),
    ]);

    const list = transactions.map((t) => ({
      _id: t._id,
      type: t.type === "credit" ? "Purchase" : "Deduction",
      description: t.description,
      credits: t.type === "credit" ? `+${t.amount}` : `-${t.amount}`,
      balanceAfter: t.balance_after,
      date: t.createdAt,
    }));

    return handleResponse(200, "Transactions fetched successfully", {
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: limitNum,
      transactions: list,
    }, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

export const exportTransactionsListCsv = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { period, from_date, to_date, type } = req.query;

    const filter = { user_id: vendorId };

    if (type === "purchase" || type === "credit") filter.type = "credit";
    else if (type === "deduction" || type === "debit") filter.type = "debit";

    let startDate;
    let endDate;
    if (period === "last_30_days" || period === "Last 30 days") {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === "last_3_months") {
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
    } else if (period === "last_6_months") {
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
    }
    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    }
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 }).lean();

    const rows = transactions.map((t) => ({
      id: t._id?.toString(),
      type: t.type === "credit" ? "Purchase" : "Deduction",
      description: t.description || "",
      credits: t.type === "credit" ? `+${t.amount}` : `-${t.amount}`,
      balanceAfter: t.balance_after ?? "",
      date: t.createdAt ? new Date(t.createdAt).toISOString() : "",
    }));

    const parser = new Json2CsvParser({
      fields: ["id", "type", "description", "credits", "balanceAfter", "date"],
    });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="transactions-list.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

export const exportTransactionsListPdf = async (req, res) => {
  try {
    const vendorId = "6992b5256e13a6e65469ca5a";
    const { period, from_date, to_date, type } = req.query;

    const filter = { user_id: vendorId };

    if (type === "purchase" || type === "credit") filter.type = "credit";
    else if (type === "deduction" || type === "debit") filter.type = "debit";

    let startDate;
    let endDate;
    if (period === "last_30_days" || period === "Last 30 days") {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === "last_3_months") {
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
    } else if (period === "last_6_months") {
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
    }
    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    }
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 }).lean();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="transactions-list.pdf"');

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).font("Helvetica-Bold").text("Transactions List", { align: "center" });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(10);

    const headers = ["Date", "Type", "Description", "Credits", "Balance After"];
    const columnWidths = [95, 72, 220, 68, 77];
    const rows = transactions.map((t) => {
      const date = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 19).replace("T", " ") : "";
      const typeLabel = t.type === "credit" ? "Purchase" : "Deduction";
      const credits = t.type === "credit" ? `+${t.amount}` : `-${t.amount}`;
      const description = (t.description || "").replace(/\s+/g, " ").trim();
      const balanceAfter = t.balance_after != null ? String(t.balance_after) : "";
      return [date, typeLabel, description, credits, balanceAfter];
    });

    drawPdfTable(doc, { headers, rows, columnWidths });

    doc.end();
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};
