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
import pushNotification from "../../../config/pushNotification.js";
import { getServiceIds, hasServices, vendorOwnsService, buildVendorLeadStatus, buildAvailableLeadDisplayStatus, maskVendorLeadContactDetails, resolveLeadServiceCategories } from "../../../utils/helperFunction.js";
import { attachLeadStarFieldsToLead } from "../../../utils/questionPoints.js";
import Stripe from "stripe";
import notifications from "../../../config/notification.js";
import Notification from "../../models/NotificationModel.js";
import VendorNotification from "../../models/vendorNotificationModel.js";
import UserNotification from "../../models/userNotificationModel.js";
import BusinessInformation from "../../models/BusinessInformationModel.js";
import mongoose from "mongoose";
import Global from "../../models/GlobalModel.js";

const LOW_CREDIT_THRESHOLD = 10;

async function fetchVendorDashboardSummary(vendorId, user) {
  const serviceCategoryIds = getServiceIds(user.service);
  if (!hasServices(user.service)) {
    return {
      availableLeadsCount: 0,
      purchasedLeadsCount: 0,
      creditBalance: 0,
      quotesSentCount: 0,
      kyc_status: "Service not updated",
      canPurchaseLeads: false,
    };
  }

  const activeServiceRequest = await ServiceRequest.find({
    deletedAt: null,
    status: "ACTIVE",
  }).distinct("_id");

  const [purchasedLeadIds, purchasedLeadsCount, wallet, quotesSentCount] =
    await Promise.all([
      VendorLeadUnlock.find({ vendor_id: vendorId }).distinct(
        "service_request_id",
      ),
      VendorLeadUnlock.countDocuments({
        vendor_id: vendorId,
        service_request_id: { $in: activeServiceRequest },
      }),
      VendorCreditWallet.findOne({ user_id: vendorId }).lean(),
      VendorQuote.countDocuments({ vendor_id: vendorId }),
    ]);

  const parentGroups = await buildVendorParentCategoryGroups(serviceCategoryIds);
  const leadCategoryFilter = parentGroups.length
    ? buildLeadFilterForParentGroups(parentGroups)
    : { service_category: { $in: [] } };

  const availableLeadsCount = await ServiceRequest.countDocuments({
    deletedAt: null,
    status: "ACTIVE",
    ...leadCategoryFilter,
    _id: { $nin: purchasedLeadIds },
  });


  


  return {
    availableLeadsCount,
    purchasedLeadsCount,
    creditBalance: wallet?.amount ?? 0,
    quotesSentCount,
    kyc_status: user.kyc_status || "PENDING",
    canPurchaseLeads: user.kyc_status === "ACTIVE",
  };
}

async function loadVendorQuotesForLeads(vendorId, leadObjectIds) {
  if (!vendorId || !leadObjectIds.length) return new Map();

  const quotes = await VendorQuote.find({
    vendor_id: vendorId,
    service_request_id: { $in: leadObjectIds },
  })
    .select("_id service_request_id status")
    .lean();

  return new Map(
    quotes.map((q) => [q.service_request_id.toString(), q]),
  );
}

async function enrichLeadsForVendor(leads, vendorId) {
  if (!leads.length) return [];

  const leadObjectIds = leads.map((l) => l._id);
  const [unlockedIds, vendorQuotesByLeadId, quoteCounts] = await Promise.all([
    vendorId
      ? VendorLeadUnlock.find({
          vendor_id: vendorId,
          service_request_id: { $in: leadObjectIds },
        }).distinct("service_request_id")
      : Promise.resolve([]),
    loadVendorQuotesForLeads(vendorId, leadObjectIds),
    VendorQuote.aggregate([
      { $match: { service_request_id: { $in: leadObjectIds }, status: "SENT" } },
      { $group: { _id: "$service_request_id", count: { $sum: 1 } } },
    ]),
  ]);

  const unlockedIdSet = new Set(
    unlockedIds?.map((id) => id.toString()) || [],
  );
  const quotesCountMap = new Map(
    quoteCounts.map((q) => [q._id.toString(), q.count]),
  );

  return leads.map((lead) => {
    const leadId = lead._id.toString();
    const unlocked = unlockedIdSet.has(leadId);
    const vendorQuote = vendorQuotesByLeadId.get(leadId);
    const creditsToUnlock =
    lead?.computed_point == null || lead?.computed_point < 1
    ? lead.contact_details?.client_type == "Individual"
      ? (lead.child_category?.credit || lead.service_category?.credit || 3)
      : (lead.child_category?.company_credit || lead.service_category?.company_credit || 3)
    : lead?.computed_point ;
    const quotesCount = quotesCountMap.get(leadId) || 0;
    const statusMeta = buildVendorLeadStatus(unlocked, vendorQuote);

    const baseLead = {
      ...lead,
      ...statusMeta,
      ...attachLeadStarFieldsToLead(lead),
      unlocked,
      creditsToUnlock,
      quotes_count: quotesCount,
    };

    if (unlocked) return baseLead;

    return {
      ...baseLead,
      contact_details: maskVendorLeadContactDetails(lead.contact_details),
    };
  });
}

function buildServiceCategoryStatus(leads) {
  let hasPendingQuote = false;
  let hasAcceptedQuote = false;
  let hasNewLead = false;
  let hasClosedQuote = false;

  for (const lead of leads) {
    switch (lead.lead_status) {
      case "pending":
        hasPendingQuote = true;
        break;
      case "new":
        hasNewLead = true;
        break;
      case "accepted":
        hasAcceptedQuote = true;
        break;
      case "ignored":
      case "withdrawn":
        hasClosedQuote = true;
        break;
    }
  }

  if (hasPendingQuote) {
    return { status: "pending", status_label: "PENDING" };
  }
  if (hasNewLead) {
    return { status: "new", status_label: "NEW" };
  }
  if (hasAcceptedQuote) {
    return { status: "accepted", status_label: "ACCEPTED" };
  }
  if (hasClosedQuote) {
    return { status: "ignored", status_label: "IGNORED" };
  }

  return { status: null, status_label: null };
}

async function buildVendorParentCategoryGroups(vendorServiceIds) {
  const categories = await ServiceCategory.find({
    _id: { $in: vendorServiceIds },
    deletedAt: null,
  })
    .select("title credit company_credit image description parent_category")
    .populate({
      path: "parent_category",
      select: "title credit company_credit image description",
      match: { deletedAt: null, status: "ACTIVE" },
    })
    .lean();

  const groups = new Map();
  const parentOrder = [];

  for (const category of categories) {
    const parentRef = category.parent_category;
    const parentId = parentRef
      ? (parentRef._id || parentRef).toString()
      : category._id.toString();

    if (!groups.has(parentId)) {
      parentOrder.push(parentId);
      groups.set(parentId, {
        parentId,
        parentDoc:
          parentRef && typeof parentRef === "object" ? parentRef : category,
        childIds: new Set(),
      });
    }

    const group = groups.get(parentId);
    group.childIds.add(category._id.toString());

    if (parentRef && typeof parentRef === "object") {
      group.parentDoc = parentRef;
    }
  }

  return parentOrder.map((parentId) => {
    const group = groups.get(parentId);
    return {
      parentId,
      parentDoc: group.parentDoc,
      childIds: [...group.childIds],
    };
  });
}

function buildLeadFilterForParentGroups(parentGroups) {
  const childIds = new Set();
  const parentIds = new Set();

  for (const group of parentGroups) {
    parentIds.add(group.parentId);
    group.childIds.forEach((id) => childIds.add(id));
  }

  const childIdList = [...childIds];
  const parentIdList = [...parentIds];

  return {
    $or: [
      { child_category: { $in: childIdList } },
      { service_category: { $in: childIdList } },
      {
        service_category: { $in: parentIdList },
        $or: [
          { child_category: { $in: childIdList } },
          { child_category: null },
        ],
      },
    ],
  };
}

function buildChildToParentMap(parentGroups) {
  const map = new Map();
  for (const group of parentGroups) {
    map.set(group.parentId, group.parentId);
    for (const childId of group.childIds) {
      map.set(childId, group.parentId);
    }
  }
  return map;
}

function resolveLeadParentGroupId(lead, childToParentMap) {
  const childId =
    lead.child_category?._id?.toString() || lead.child_category?.toString();
  if (childId && childToParentMap.has(childId)) {
    return childToParentMap.get(childId);
  }

  const serviceCategoryId =
    lead.service_category?._id?.toString() || lead.service_category?.toString();
  if (serviceCategoryId && childToParentMap.has(serviceCategoryId)) {
    return childToParentMap.get(serviceCategoryId);
  }

  return null;
}

function findParentGroup(parentGroups, categoryId) {
  const target = String(categoryId);
  return parentGroups.find(
    (group) =>
      group.parentId === target || group.childIds.includes(target),
  );
}

function generateTransactionNumber(id, date) {
  const year = new Date(date || Date.now()).getFullYear();
  const num = parseInt(id.toString().slice(-5), 16) % 100000;
  return `TXN-${year}-${String(num).padStart(5, "0")}`;
}

function formatFrenchInvoiceDate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  // Example: "24 mars 2026"
  return d
    .toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .replace(/\./g, "");
}

function buildInvoiceNumber(tx) {
  if (tx?.transaction_number) {
    return tx.transaction_number.replace(/^TXN-/, "INV-");
  }
  const d = tx?.createdAt ? new Date(tx.createdAt) : new Date();
  const year = d.getFullYear();
  const serial =
    tx?._id && tx._id.toString
      ? parseInt(tx._id.toString().slice(-4), 16) % 10000
      : 0;
  return `INV-${year}-${String(serial).padStart(4, "0")}`;
}

function formatEuroFR(value) {
  const num = Number(value || 0);
  const fixed = num.toFixed(2);
  const withComma = fixed.replace(".", ".");
  return `${withComma} €`;
}

function paymentStatusToFrench(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "paid" || s === "success") return "Payé";
  if (s === "failed") return "Échoué";
  if (s === "refunded") return "Remboursé";
  if (!s) return "En attente";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function drawDashedSeparator(doc, y, x1, x2) {
  const left = x1 ?? doc.page.margins.left;
  const right = x2 ?? doc.page.width - doc.page.margins.right;
  doc.save();
  doc.strokeColor("#CFCFCF");
  // pdfkit supports dash/undash in most versions; if not, fall back to solid line.
  if (typeof doc.dash === "function") {
    doc.dash(4, { space: 4 });
    doc.moveTo(left, y).lineTo(right, y).stroke();
    if (typeof doc.undash === "function") doc.undash();
  } else {
    doc.moveTo(left, y).lineTo(right, y).stroke();
  }
  doc.restore();
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

    const summary = await fetchVendorDashboardSummary(vendorId, user);

    return handleResponse(200, "Dashboard fetched successfully", summary, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * GET /available-leads-by-service-category
 * Available leads grouped by vendor service category, with dashboard summary.
 */
export const getAvailableLeadsByServiceCategory = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const user = await User.findById(vendorId).select("kyc_status service").lean();
    if (!user) return handleResponse(404, "User not found", {}, res);

    const { city, state, country, sort, service, unlocked, paginate_service } =
      req.query;
    const DEFAULT_CATEGORY_LEADS_LIMIT = 6;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const hasLimitQuery =
      req.query.limit !== undefined && req.query.limit !== "";
    const limit = hasLimitQuery
      ? Math.min(
          100,
          Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_CATEGORY_LEADS_LIMIT),
        )
      : DEFAULT_CATEGORY_LEADS_LIMIT;
    const skip = (page - 1) * limit;
    const vendorServiceIds = getServiceIds(user.service);
    const summaryPromise = fetchVendorDashboardSummary(vendorId, user);

    if (!vendorServiceIds.length) {
      const summary = await summaryPromise;
      return handleResponse(
        200,
        "Leads by service category fetched",
        {
          summary,
          data: [],
          total_categories: 0,
          total_leads: 0,
        },
        res,
      );
    }

    let parentGroups = await buildVendorParentCategoryGroups(vendorServiceIds);

    if (service) {
      if (!vendorOwnsService(user.service, service)) {
        return handleResponse(
          403,
          "Service non attribué à votre compte",
          {},
          res,
        );
      }
      const matchedGroup = findParentGroup(parentGroups, service);
      parentGroups = matchedGroup ? [matchedGroup] : [];
    }

    if (!parentGroups.length) {
      const summary = await summaryPromise;
      return handleResponse(
        200,
        "Leads by service category fetched",
        {
          summary,
          data: [],
          total_categories: 0,
          total_leads: 0,
        },
        res,
      );
    }

    const filter = {
      deletedAt: null,
      status: "ACTIVE",
      ...buildLeadFilterForParentGroups(parentGroups),
    };
    if (city) filter.city = city;
    if (state) filter.state = state;
    if (country) filter.country = country;

    if (vendorId && unlocked !== undefined && unlocked !== "") {
      const unlockedLeadIds = await VendorLeadUnlock.find({
        vendor_id: vendorId,
      }).distinct("service_request_id");
      const u = String(unlocked).toLowerCase();
      if (u === "true") {
        filter._id = { $in: unlockedLeadIds };
      } else if (u === "false" && unlockedLeadIds.length > 0) {
        filter._id = { $nin: unlockedLeadIds };
      }
    }

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const sortByCreditInMemory =
      sort === "high_to_low" || sort === "low_to_high";

    let allLeads = await ServiceRequest.find(filter)
      .populate({
        path: "service_category",
        select: "title credit company_credit",
      })
      .populate({
        path: "child_category",
        select: "title credit company_credit",
      })
      .sort(sortByCreditInMemory ? { createdAt: -1 } : sortOption)
      .lean();

    if (sortByCreditInMemory) {
      const getLeadCredit = (lead) =>
        lead.child_category?.credit ||
        lead.service_category?.credit ||
        0;

      if (sort === "high_to_low") {
        allLeads.sort((a, b) => getLeadCredit(b) - getLeadCredit(a));
      } else {
        allLeads.sort((a, b) => getLeadCredit(a) - getLeadCredit(b));
      }
    }

    const enrichedLeads = await enrichLeadsForVendor(allLeads, vendorId);
    const childToParentMap = buildChildToParentMap(parentGroups);

    const leadsByParent = new Map();
    for (const group of parentGroups) {
      leadsByParent.set(group.parentId, []);
    }

    for (const lead of enrichedLeads) {
      const parentId = resolveLeadParentGroupId(lead, childToParentMap);
      if (!parentId || !leadsByParent.has(parentId)) continue;
      leadsByParent.get(parentId).push(lead);
    }

    let paginateParentId = paginate_service ? String(paginate_service) : null;
    if (paginateParentId) {
      if (!vendorOwnsService(user.service, paginateParentId)) {
        return handleResponse(
          403,
          "Service non attribué à votre compte",
          {},
          res,
        );
      }
      const matchedGroup = findParentGroup(parentGroups, paginateParentId);
      if (!matchedGroup) {
        return handleResponse(
          400,
          "paginate_service must match a visible service category",
          {},
          res,
        );
      }
      paginateParentId = matchedGroup.parentId;
    }

    const data = parentGroups.map((group) => {
      const allCategoryLeads = leadsByParent.get(group.parentId) || [];
      const categoryStatus = buildServiceCategoryStatus(allCategoryLeads);
      const totalCategoryLeads = allCategoryLeads.length;
      const shouldFullPaginate = paginateParentId === group.parentId;
      const leads = shouldFullPaginate
        ? allCategoryLeads.slice(skip, skip + limit)
        : allCategoryLeads.slice(0, limit);

      const { parent_category, ...serviceCategory } = group.parentDoc || {};

      return {
        parent_service_category: serviceCategory,
        leads_count: totalCategoryLeads,
        status: categoryStatus.status,
        status_label: categoryStatus.status_label,
        leads,
        pagination: {
          page: shouldFullPaginate ? page : 1,
          limit,
          total: totalCategoryLeads,
          totalPages: Math.ceil(totalCategoryLeads / limit) || 0,
        },
      };
    });

    const summary = await summaryPromise;

    const responsePayload = {
      summary,
      data,
      total_categories: data.length,
      total_leads: enrichedLeads.length,
    };

    if (paginateParentId) {
      responsePayload.pagination = {
        page,
        limit,
        paginate_service: paginateParentId,
      };
    }

    return handleResponse(
      200,
      "Leads by service category fetched successfully",
      responsePayload,
      res,
    );
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

    const leadCategoryId = lead.service_category?._id?.toString();
    if (
      hasServices(user.service) &&
      leadCategoryId &&
      !vendorOwnsService(user.service, leadCategoryId)
    ) {
      return handleResponse(
        403,
        "This lead is not in your service categories",
        {},
        res,
      );
    }

    if (lead.user.toString() === vendorId.toString()) {
      return handleResponse(403, "You cannot unlock your own lead", {}, res);
    }

    const alreadyUnlocked = await VendorLeadUnlock.findOne({
      vendor_id: vendorId,
      service_request_id: leadId,
    });


    if (alreadyUnlocked) {
      return handleResponse(409, "You have already unlocked this lead", { unlocked: true }, res);
    }

    const creditsRequired = lead.computed_point == null || lead.computed_point < 1
    ? lead.contact_details.client_type == "Individual"
    ? (lead.service_category?.credit || 3)
    : (lead.service_category?.company_credit || 3)
    : lead.computed_point ;
    const wallet = await VendorCreditWallet.findOne({ user_id: vendorId });
    if (!wallet) return handleResponse(500, "Credit wallet not found", {}, res);
    if (wallet.amount < creditsRequired) {
      const lowBalanceTitle = "Solde de points faible";
      const lowBalanceBody = `Votre solde de points est faible (${wallet.amount})`;
      const vendor = await User.findById(vendorId).select("fcm_token").lean();

      const prefs = await VendorNotification.findOne({
        user_id: vendorId,
      }).lean();

      if (prefs?.email_notifications?.low_credit_balance) {
        await Notification.create({
          user_id: vendorId,
          title: lowBalanceTitle,
          body: lowBalanceBody,
          for: "Vendor"
        });
      }

      const canPush = prefs?.push_notifications?.low_credits ?? false;
      if (vendor?.fcm_token && canPush) {
        await pushNotification(vendor.fcm_token, lowBalanceTitle, lowBalanceBody);
      }

      return handleResponse(402, "Insufficient points. Please buy more points.", { required: creditsRequired, balance: wallet.amount }, res);
    }

    wallet.amount -= creditsRequired;
    await wallet.save();

    const balanceAfter = wallet.amount;
    const serviceTitle = lead.service_category?.title || "Lead";
    const description = `Prospect débloqué ${serviceTitle} in ${lead.city || ""}`;

    const [unlockRecord, tx] = await Promise.all([
      VendorLeadUnlock.create({
        vendor_id: vendorId,
        service_request_id: leadId,
        credits_spent: creditsRequired,
      }),
      Transaction.create({
        user_id: vendorId,
        amount: creditsRequired,
        amount_paid: creditsRequired,
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

    if (balanceAfter <= LOW_CREDIT_THRESHOLD) {
      const lowBalanceTitle = "Solde de points faible";
      const lowBalanceBody = `Vos points restants sont ${balanceAfter}. Rechargez pour ne pas manquer de nouveaux prospects.`;
      const vendor = await User.findById(vendorId).select("fcm_token").lean();

      const prefs = await VendorNotification.findOne({
        user_id: vendorId,
      }).lean();

      if (prefs?.email_notifications?.low_credit_balance) {
        await Notification.create({
          user_id: vendorId,
          title: lowBalanceTitle,
          body: lowBalanceBody,
          for: "Vendor"
        });
      }

      const canPush = prefs?.push_notifications?.low_credits ?? false;
      if (vendor?.fcm_token && canPush) {
        await pushNotification(vendor.fcm_token, lowBalanceTitle, lowBalanceBody);
      }
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


// export const getLeadById = async (req, res) => {
//   try {
//     const vendorId = req.user._id;
//     const leadId = req.params.leadId;
//     const BASE_URL = process.env.IMAGE_URL;

//     const vendor = await User.findById(vendorId).select("service").lean();
//     if (!vendor) return handleResponse(404, "User not found", {}, res);

//     const lead = await ServiceRequest.findById(leadId)
//       .populate({ path: "service_category", select: "title credit company_credit" })
//       .populate({ path: "user", select: "first_name last_name email phone createdAt profile_pic" })
//       .lean();


//     if (lead?.user?.profile_pic && !lead.user.profile_pic.startsWith("http")) {
//       lead.user.profile_pic = `${BASE_URL}${lead.user.profile_pic}`;
//     }


//     if (!lead || lead.deletedAt || lead.status !== "ACTIVE") {
//       return handleResponse(404, "Lead not found or no longer available", {}, res);
//     }

//     const leadCategoryId = lead.service_category?._id?.toString();
//     if (
//       hasServices(vendor.service) &&
//       leadCategoryId &&
//       !vendorOwnsService(vendor.service, leadCategoryId)
//     ) {
//       return handleResponse(
//         403,
//         "This lead is not in your service categories",
//         {},
//         res,
//       );
//     }

//     const quote = await VendorQuote.findOne({ vendor_id: vendorId, service_request_id: leadId });
//     lead.canQuote = quote ? false : true;
//     lead.quote_id = quote?._id || null;


//     const unlocked = await VendorLeadUnlock.findOne({
//       vendor_id: vendorId,
//       service_request_id: leadId,
//     });
    

//     if (!unlocked) {
//       const masked = { ...lead };
//       if (masked.contact_details) {
//         masked.contact_details = {
//           first_name: masked.contact_details.first_name?.[0] + "***" || "***",
//           last_name: masked.contact_details.last_name?.[0] + "***" || "***",
//           phone: (masked.contact_details.phone || "").slice(0, 3) + " *******",
//           email: (masked.contact_details.email || "").replace(/(.{2})(.*)(@.*)/, "$1*******$3"),
//         };
//       }
//       if (masked.user) {
//         masked.user.phone = (masked.user.phone || "").slice(0, 3) + " *******";
//         masked.user.email = (masked.user.email || "").replace(/(.{2})(.*)(@.*)/, "$1*******$3");
//       }
//       masked.unlocked = false;
//       masked.creditsToUnlock = lead.contact_details.client_type == "Individual" ? (lead.service_category?.credit || 3) : (lead.service_category?.company_credit || 3);
//       return handleResponse(200, "Lead details", masked, res);
//     }

//     const response = { ...lead, unlocked: true };
//     return handleResponse(200, "Lead details", response, res);
//   } catch (err) {
//     return handleResponse(500, err.message, {}, res);
//   }
// };



export const getLeadById = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const leadId = req.params.leadId;
    const BASE_URL = process.env.IMAGE_URL;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return handleResponse(404, "Lead not found or no longer available", {}, res);
    }

    const vendor = await User.findById(vendorId).select("service").lean();
    if (!vendor) return handleResponse(404, "User not found", {}, res);

    const lead = await ServiceRequest.findById(leadId)
      .populate({
        path: "service_category",
        select: "title credit company_credit image description parent_category",
        populate: {
          path: "parent_category",
          select: "title credit company_credit image description",
          match: { deletedAt: null, status: "ACTIVE" },
        },
      })
      .populate({
        path: "child_category",
        select: "title credit company_credit image description parent_category",
        populate: {
          path: "parent_category",
          select: "title credit company_credit image description",
          match: { deletedAt: null, status: "ACTIVE" },
        },
      })
      .populate({ path: "user", select: "first_name last_name email phone createdAt profile_pic" })
      .lean();

   

    if (!lead || lead.deletedAt || lead.status !== "ACTIVE") {
      return handleResponse(404, "Lead not found or no longer available", {}, res);
    }

    const { service_category: serviceCategory, parent_service_category } =
      resolveLeadServiceCategories(lead);

    const leadCategoryId =
      serviceCategory?._id?.toString() ||
      lead.child_category?._id?.toString() ||
      lead.child_category?.toString() ||
      lead.service_category?._id?.toString();
    if (
      hasServices(vendor.service) &&
      leadCategoryId &&
      !vendorOwnsService(vendor.service, leadCategoryId)
    ) {
      return handleResponse(
        403,
        "This lead is not in your service categories",
        {},
        res,
      );
    }

    const [vendorQuote, unlocked, quotesCount, prosConsultedCount, globalSettings] =
      await Promise.all([
        VendorQuote.findOne({ vendor_id: vendorId, service_request_id: leadId })
          .select("_id status")
          .lean(),
        VendorLeadUnlock.findOne({
          vendor_id: vendorId,
          service_request_id: leadId,
        }).lean(),
        VendorQuote.countDocuments({ service_request_id: leadId, status: "SENT" }),
        VendorLeadUnlock.countDocuments({ service_request_id: leadId }),
        Global.findOne().select("quote_limit").lean(),
      ]);

    const isUnlocked = Boolean(unlocked);
    const strongQuotesThreshold = globalSettings?.quote_limit ?? 5;

    const leadStatusMeta = buildAvailableLeadDisplayStatus({
      unlocked: isUnlocked,
      vendorQuote,
      quotesCount,
      prosConsultedCount,
      strongQuotesThreshold,
    });

    const response = {
      ...lead,
      service_category: serviceCategory,
      parent_service_category,
      child_category: lead.child_category || null,
      request_status: lead.status,
      ...leadStatusMeta,
      ...attachLeadStarFieldsToLead(lead),
      canQuote: !vendorQuote,
      unlocked: isUnlocked,
      creditsToUnlock:
      lead?.computed_point == null || lead?.computed_point < 1
    ? lead.contact_details?.client_type === "Individual"
      ? serviceCategory?.credit ?? 3
      : serviceCategory?.company_credit ?? 3
    : lead?.computed_point ,
      quotes_count: quotesCount,
    };

    if (lead?.user?.profile_pic && !lead.user.profile_pic.startsWith("http")) {
      response.user = {
        ...response.user,
        profile_pic: `${BASE_URL}${lead.user.profile_pic}`,
      };
    }

    if (!isUnlocked) {
      response.contact_details = maskVendorLeadContactDetails(lead.contact_details);
      if (response.user) {
        response.user = {
          ...response.user,
          phone: (response.user.phone || "").slice(0, 3) + " *******",
          email: (response.user.email || "").replace(
            /(.{2})(.*)(@.*)/,
            "$1*******$3",
          ),
        };
      }
    }

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
    const attachmentPath = Array.isArray(req.files?.attachment) && attachmentFile?.attachment?.length > 0 ? attachmentFile.attachment[0].path : null;

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

    const vendor = await User.findById(vendorId).select("service").lean();
    if (
      vendor &&
      hasServices(vendor.service) &&
      lead.service_category &&
      !vendorOwnsService(vendor.service, lead.service_category)
    ) {
      return handleResponse(
        403,
        "This lead is not in your service categories",
        {},
        res,
      );
    }

    const existingQuote = await VendorQuote.findOne({
      vendor_id: vendorId,
      service_request_id: leadId,
      status: "SENT",
    });
    if (existingQuote) {
      return handleResponse(409, "You have already submitted a quote for this lead", {}, res);
    }

    const global = await Global.findOne();
    const MAX_QUOTES_PER_REQUEST = global?.quote_limit ?? 5;
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


    const user = await User.findById(lead.user);

    if (user) {
      const title = "Devis reçu 💰";
      const body = "Vous avez reçu un nouveau devis d'un prestataire. Consultez-le maintenant.";

      const prefs = await UserNotification.findOne({
        user_id: user._id,
      }).lean();

      // Treat `email_notifications` toggle as enabling normal in-app notifications.
      const canInApp = prefs?.email_notifications?.new_quotes ?? true;
      const canPush = prefs?.push_notifications?.new_quotes ?? true;

      if (canInApp) {
        await Notification.create({
          user_id: user._id,
          title,
          body,
          for: "User"
        });
      }

      if (canPush && user?.fcm_token) {
        await pushNotification(user.fcm_token, title, body);
      }
    }

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

    for (const item of packages) {
      item.vat_rate = process.env.VAT_RATE;
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
      plat_form: "stripe",
      amount_paid: pkg ? pkg.price * process.env.VAT_RATE/100 + pkg.price : 0,
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
      transaction: {
        id: tx._id,
        transaction_number: tx.transaction_number || null,
      },
    }, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * GET /credits/invoice/:transactionId
 * Return invoice PDF for vendor credit purchase.
 */
export const getCreditPurchaseInvoice = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return handleResponse(400, "transactionId is required", {}, res);
    }

    const txFilter = {
      _id: transactionId
    };


    const tx = await Transaction.findOne(txFilter).lean();
    if (!tx) {
      return handleResponse(404, "Invoice transaction not found", {}, res);
    }

    const vendorId = tx?.user_id;
    const [vendor, global, creditPackage] = await Promise.all([
      User.findById(vendorId).lean(),
      Global.findOne().lean(),
      tx?.reference_id ? CreditPackage.findById(tx.reference_id).lean() : null,
    ]);

    const totalHt = Number(creditPackage.price || 0);
    const tvaRate = Number(global?.tva_rate || 0.2);
    const tvaAmount = Number((totalHt * tvaRate).toFixed(2));
    const totalTtc = Number((totalHt + tvaAmount).toFixed(2));
    const creditsAdded = Number(tx.amount || 0);
    const pricePerCredit = creditPackage?.per_credit_price || 0.2;
    const invoiceNumber = buildInvoiceNumber(tx);
    const issueDate = formatFrenchInvoiceDate(tx.createdAt) || "-";
    const currency = tx.currency || "EUR";
    const packageName = creditPackage?.name || "Credits";
    const paymentMethod = tx.plat_form || "card";
    const paymentStatus = tx.status || "completed";
    const clientName = vendor?.business_name || "Vendor";
    const clientAddress = [vendor?.address, vendor?.postal_code, vendor?.city]
      .filter(Boolean)
      .join(", ");
    const clientSiret = vendor?.company_registration_number || "-";
    const platformName = global?.platformName || "Ask Service";
    const platformEmail = global?.email || "contact@askservice.com";
    const platformVat = global?.vat_number || "FRXX123456789";
    const money = (value) => `${Number(value || 0).toFixed(2)} ${currency}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${invoiceNumber}.pdf"`,
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentLeft = 40;
    const contentRight = pageWidth - 40;
    const contentWidth = contentRight - contentLeft;
    const primaryColor = "#111827";
    const mutedColor = "#6B7280";
    const lightBorder = "#E5E7EB";
    const lightFill = "#F9FAFB";

    const formatEuro = (value) => {
      const number = Number(value || 0);
      return `${number.toFixed(2).replace(".", ".")} ${currency}`;
    };

    const drawSectionBox = (x, y, w, h, title) => {
      doc
        .roundedRect(x, y, w, h, 6)
        .fillAndStroke("#FFFFFF", lightBorder);
      doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text(title, x + 12, y + 10);
    };

    doc.rect(0, 0, pageWidth, 96).fill(primaryColor);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(24).text("FACTURE", contentLeft, 30);
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`N° ${invoiceNumber}`, contentLeft, 63)
      .text(`Date d'emission: ${issueDate}`, contentLeft + 180, 63);

    doc.fillColor(primaryColor);
    let y = 120;

    const colGap = 16;
    const boxWidth = (contentWidth - colGap) / 2;
    const boxHeight = 112;
    drawSectionBox(contentLeft, y, boxWidth, boxHeight, "PLATEFORME");
    drawSectionBox(contentLeft + boxWidth + colGap, y, boxWidth, boxHeight, "CLIENT");

    doc.font("Helvetica").fontSize(10).fillColor(primaryColor);
    doc
      .text(platformName, contentLeft + 12, y + 32)
      .fillColor(mutedColor)
      .text(`Email: ${platformEmail}`, contentLeft + 12, y + 50, { width: boxWidth - 24 })
      .text(`TVA: ${platformVat}`, contentLeft + 12, y + 66, { width: boxWidth - 24 });

    doc.fillColor(primaryColor);
    doc
      .text(clientName, contentLeft + boxWidth + colGap + 12, y + 32, { width: boxWidth - 24 })
      .fillColor(mutedColor)
      .text(`Adresse: ${clientAddress || "-"}`, contentLeft + boxWidth + colGap + 12, y + 50, {
        width: boxWidth - 24,
      })
      .text(`SIRET: ${clientSiret}`, contentLeft + boxWidth + colGap + 12, y + 82, {
        width: boxWidth - 24,
      });

    y += boxHeight + 24;

    // Table container
    const tableX = contentLeft;
    const tableY = y;
    const tableW = contentWidth;
    const headerH = 30;
    const rowH = 40;

    doc.roundedRect(tableX, tableY, tableW, headerH + rowH, 6).stroke(lightBorder);
    doc.roundedRect(tableX, tableY, tableW, headerH, 6).fill(lightFill);
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9);

    const c1 = tableX + 12;
    const c2 = tableX + tableW * 0.58;
    const c3 = tableX + tableW * 0.70;
    const c4 = tableX + tableW * 0.82;
    doc.text("DESCRIPTION", c1, tableY + 10);
    doc.text("QTE", c2, tableY + 10);
    doc.text("PRIX HT", c3, tableY + 10);
    doc.text("TOTAL HT", c4, tableY + 10);

    const rowY = tableY + headerH + 12;
    doc.font("Helvetica").fontSize(10).fillColor(primaryColor);
    doc.text(`Pack ${creditsAdded} credits (${packageName})`, c1, rowY, {
      width: c2 - c1 - 12,
    });
    doc.text("1", c2, rowY);
    doc.text(formatEuro(totalHt), c3, rowY);
    doc.text(formatEuro(totalHt), c4, rowY);

    y = tableY + headerH + rowH + 22;

    // Totals panel
    const totalsW = 220;
    const totalsX = contentRight - totalsW;
    const totalsY = y;
    doc.roundedRect(totalsX, totalsY, totalsW, 94, 6).fillAndStroke("#FFFFFF", lightBorder);
    doc.font("Helvetica").fontSize(10).fillColor(primaryColor);
    doc.text("Total HT", totalsX + 12, totalsY + 14);
    doc.text(formatEuro(totalHt), totalsX + totalsW - 90, totalsY + 14, { width: 78, align: "right" });
    doc.text(`TVA (${Math.round(tvaRate * 100)}%)`, totalsX + 12, totalsY + 37);
    doc.text(formatEuro(tvaAmount), totalsX + totalsW - 90, totalsY + 37, {
      width: 78,
      align: "right",
    });
    doc.moveTo(totalsX + 12, totalsY + 59).lineTo(totalsX + totalsW - 12, totalsY + 59).stroke(lightBorder);
    doc.font("Helvetica-Bold");
    doc.text("Total TTC", totalsX + 12, totalsY + 68);
    doc.text(formatEuro(totalTtc), totalsX + totalsW - 90, totalsY + 68, { width: 78, align: "right" });

    // Details and payment blocks
    const metaY = totalsY + 114;
    drawSectionBox(contentLeft, metaY, boxWidth, 88, "DETAILS");
    drawSectionBox(contentLeft + boxWidth + colGap, metaY, boxWidth, 88, "PAIEMENT");

    doc.font("Helvetica").fontSize(10).fillColor(mutedColor);
    doc
      .text(`Credits ajoutes: ${creditsAdded}`, contentLeft + 12, metaY + 34)
      .text(`Prix / credit: ${formatEuro(pricePerCredit)}`, contentLeft + 12, metaY + 52)
      .text(`Transaction: ${tx.transaction_number || tx._id?.toString() || "-"}`, contentLeft + 12, metaY + 70, {
        width: boxWidth - 24,
      });

    doc.fillColor(mutedColor);
    doc
      .text(`Methode: ${String(paymentMethod).toUpperCase()}`, contentLeft + boxWidth + colGap + 12, metaY + 34)
      .text(
        `Statut: ${paymentStatus.charAt(0).toUpperCase()}${paymentStatus.slice(1)}`,
        contentLeft + boxWidth + colGap + 12,
        metaY + 52,
      )
      .text(`Devise: ${currency}`, contentLeft + boxWidth + colGap + 12, metaY + 70);

    // Footer
    doc
      .fillColor("#9CA3AF")
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Cette facture est generee automatiquement pour l'achat de credits.",
        contentLeft,
        pageHeight - 44,
        { width: contentWidth, align: "center" },
      );

    doc.end();
    return;
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




export const AllQuotes = async (req, res) => {
  try {
    const userId = req.user._id;

    const quote = await VendorQuote.find({
      vendor_id: userId
    });


    return handleResponse(
      200,
      "Quotes",
      quote,
      res,
    );

  } catch (err) {

    return handleResponse(500, err.message, {}, res);

  }


}


export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Service Payment",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],

      mode: "payment",

      success_url: `${process.env.FRONTEND_URL}/vendor/credits?stripe_payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/vendor/credits?stripe_payment_status=fail`,
      metadata: {
        user_id: userId.toString(),
      },
    });

    return handleResponse(
      200,
      "Payment URL created",
      {
        payment_url: session.url, // ✅ THIS IS WHAT YOU WANT
        session_id: session.id,
      },
      res
    );
  } catch (err) {
    console.log(err);

    return handleResponse(
      500,
      "Internal server",
      err.message,
      res
    );
  }
};

export const verifyPaymentFromStripe = async (req, res) => {
  try {
    const { session_id } = req.params;

    if (!session_id) {
      return handleResponse(400, "Session ID required", {}, res);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 🔥 fetch session from stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return handleResponse(404, "Session not found", {}, res);
    }

    // 🔥 check payment status
    if (session.payment_status === "paid") {
      // await Payment.findOneAndUpdate(
      //   { session_id },
      //   { status: "SUCCESS" }
      // );

      return handleResponse(200, "Payment verified", {
        status: "SUCCESS",
      }, res);
    } else {
      return handleResponse(400, "Payment not completed", {
        status: session.payment_status,
      }, res);
    }
  } catch (err) {
    console.log(err);

    return handleResponse(
      500,
      err.message, {}
      ,
      res
    );
  }
};