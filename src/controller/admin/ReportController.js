import handleResponse from "../../../utils/http-response.js";
import mongoose from "mongoose";
import Report from "../../models/ReportModel.js";
import User from "../../models/UserModel.js";
import Role from "../../models/RoleModel.js";

const VALID_STATUSES = ["PENDING", "RESOLVED", "REJECTED"];

const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * GET /admin/reported-vendors
 * All vendor reports (users reporting vendors), with reporter + reported vendor details.
 */
export const getAllReportedVendors = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status, search } = req.query;

    const vendorRole = await Role.findOne({ name: RegExp("^Vendor$", "i") }).lean();
    if (!vendorRole) {
      return handleResponse(404, "Vendor role not found", {}, res);
    }

    const filter = {};
    if (status && VALID_STATUSES.includes(String(status).toUpperCase())) {
      filter.status = String(status).toUpperCase();
    }

    const vendorIds = await User.find({ role: vendorRole._id }).distinct("_id");
    if (!vendorIds.length) {
      return handleResponse(
        200,
        "Reported vendors fetched successfully",
        {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          counts: { PENDING: 0, RESOLVED: 0, REJECTED: 0 },
        },
        res,
      );
    }

    filter.reported_user = { $in: vendorIds };

    if (search?.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingVendors = await User.find({
        role: vendorRole._id,
        $or: [
          { first_name: rx },
          { last_name: rx },
          { email: rx },
          { business_name: rx },
        ],
      })
        .distinct("_id")
        .lean();
      const matchingIds = matchingVendors.map((id) =>
        id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id),
      );
      filter.$or = [
        { reason: rx },
        { description: rx },
        { reported_user: { $in: matchingIds } },
      ];
    }

    const [total, items, countAgg] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter)
        .populate({
          path: "reporter",
          select: "first_name last_name email phone profile_pic",
        })
        .populate({
          path: "reported_user",
          select:
            "first_name last_name email phone profile_pic business_name kyc_status service",
          populate: { path: "service", select: "title" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.aggregate([
        { $match: { reported_user: { $in: vendorIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = { PENDING: 0, RESOLVED: 0, REJECTED: 0 };
    for (const row of countAgg) {
      if (row._id && counts[row._id] !== undefined) {
        counts[row._id] = row.count;
      }
    }

    const list = items.map((r) => ({
      _id: r._id,
      status: r.status,
      reason: r.reason,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      reporter: r.reporter
        ? {
            _id: r.reporter._id,
            first_name: r.reporter.first_name,
            last_name: r.reporter.last_name,
            email: r.reporter.email,
            phone: r.reporter.phone,
            profile_pic: r.reporter.profile_pic,
          }
        : null,
      reported_vendor: r.reported_user
        ? {
            _id: r.reported_user._id,
            first_name: r.reported_user.first_name,
            last_name: r.reported_user.last_name,
            email: r.reported_user.email,
            phone: r.reported_user.phone,
            profile_pic: r.reported_user.profile_pic,
            business_name: r.reported_user.business_name,
            kyc_status: r.reported_user.kyc_status,
            service: r.reported_user.service,
          }
        : null,
    }));

    return handleResponse(
      200,
      "Reported vendors fetched successfully",
      {
        items: list,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
        counts,
      },
      res,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};

/**
 * PATCH /admin/reports/:reportId/status
 * Body: { status: "PENDING" | "RESOLVED" | "REJECTED" }
 */
export const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return handleResponse(400, "Invalid report id", {}, res);
    }

    const next = status != null ? String(status).toUpperCase() : "";
    if (!VALID_STATUSES.includes(next)) {
      return handleResponse(
        400,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        {},
        res,
      );
    }

    const report = await Report.findByIdAndUpdate(
      reportId,
      { $set: { status: next } },
      { new: true },
    )
      .populate({
        path: "reporter",
        select: "first_name last_name email phone",
      })
      .populate({
        path: "reported_user",
        select: "first_name last_name email business_name kyc_status service",
        populate: { path: "service", select: "title" },
      })
      .lean();

    if (!report) {
      return handleResponse(404, "Report not found", {}, res);
    }

    return handleResponse(200, "Report status updated successfully", report, res);
  } catch (err) {
    return handleResponse(500, err.message, {}, res);
  }
};
