import mongoose from "mongoose";
import handleResponse from "../../../utils/http-response.js";
import Transaction from "../../models/TransactionModel.js";
import User from "../../models/UserModel.js";
import CreditPackage from "../../models/CreditPackageModel.js";
import Global from "../../models/GlobalModel.js";
import {
  streamCreditPurchaseInvoice,
  formatTransactionDateTime,
  toTransactionId,
} from "../../../utils/creditPurchaseInvoice.js";

function applyDateFilter(filter, { period, from_date, to_date }) {
  let startDate;
  let endDate;

  if (period) {
    const now = new Date();
    endDate = new Date(now);
    startDate = new Date(now);
    const p = String(period).toLowerCase();
    if (p === "last_30_days" || p === "last 30 days") {
      startDate.setDate(now.getDate() - 30);
    } else if (p === "last_3_months" || p === "last 3 months") {
      startDate.setMonth(now.getMonth() - 3);
    } else if (p === "last_6_months" || p === "last 6 months") {
      startDate.setMonth(now.getMonth() - 6);
    }
  }

  if (from_date && to_date) {
    startDate = new Date(from_date);
    endDate = new Date(to_date);
  }

  if (startDate && endDate) {
    filter.createdAt = { $gte: startDate, $lte: endDate };
  }
}

export const getCreditPurchases = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      vendor_id,
      status,
      period,
      from_date,
      to_date,
    } = req.query;

    const filter = {
      $or: [{ reference_type: "credit_purchase" }, { type: "credit" }],
    };

    if (vendor_id) {
      if (!mongoose.Types.ObjectId.isValid(vendor_id)) {
        return handleResponse(400, "Invalid vendor_id", {}, res);
      }
      filter.user_id = vendor_id;
    }

    if (status && String(status).toLowerCase() !== "all") {
      filter.status = String(status).toLowerCase();
    }

    applyDateFilter(filter, { period, from_date, to_date });

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const vendorIds = await User.find({
        $or: [
          { first_name: { $regex: term, $options: "i" } },
          { last_name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
          { business_name: { $regex: term, $options: "i" } },
        ],
      }).distinct("_id");

      filter.$and = [
        {
          $or: [
            { transaction_number: { $regex: term, $options: "i" } },
            { description: { $regex: term, $options: "i" } },
            { user_id: { $in: vendorIds } },
          ],
        },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate(
          "user_id",
          "first_name last_name email business_name phone",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
    const list = transactions.map((t) => {
      const vendor = t.user_id || {};
      return {
        _id: t._id,
        transaction_id: toTransactionId(
          t.transaction_number,
          t._id,
          t.createdAt,
        ),
        vendor: {
          _id: vendor._id || t.user_id,
          first_name: vendor.first_name || null,
          last_name: vendor.last_name || null,
          email: vendor.email || null,
          business_name: vendor.business_name || null,
          phone: vendor.phone || null,
        },
        date_time: formatTransactionDateTime(t.createdAt),
        payment_method:
          t.payment_method || (t.plat_form === "manual" ? null : t.plat_form),
        amount_paid: t.amount_paid != null ? t.amount_paid : null,
        currency: t.currency || "EUR",
        credit_added:
          t.type === "credit" && t.amount != null
            ? `+${t.amount} crédits`
            : null,
        status: t.status
          ? t.status.charAt(0).toUpperCase() + t.status.slice(1)
          : "Pending",
        description: t.description,
        invoice_url: baseUrl
          ? `${baseUrl}/api/admin/credit-purchases/${t._id}/invoice`
          : null,
      };
    });

    return handleResponse(
      200,
      "Credit purchases fetched successfully",
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        purchases: list,
      },
      res,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

export const getAdminCreditPurchaseInvoice = async (req, res) => {
  try {
    const transactionId = req.params.transactionId || req.params.id;

    if (!transactionId) {
      return handleResponse(400, "transactionId is required", {}, res);
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return handleResponse(404, "Invoice transaction not found", {}, res);
    }

    const tx = await Transaction.findOne({
      _id: transactionId,
      $or: [{ reference_type: "credit_purchase" }, { type: "credit" }],
    }).lean();

    if (!tx) {
      return handleResponse(404, "Invoice transaction not found", {}, res);
    }

    const [vendor, global, creditPackage] = await Promise.all([
      User.findById(tx.user_id).lean(),
      Global.findOne().lean(),
      tx.reference_id ? CreditPackage.findById(tx.reference_id).lean() : null,
    ]);

    streamCreditPurchaseInvoice({
      res,
      tx,
      vendor,
      global,
      creditPackage,
    });
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};
