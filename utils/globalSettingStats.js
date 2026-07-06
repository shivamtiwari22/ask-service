import Role from "../src/models/RoleModel.js";
import User from "../src/models/UserModel.js";
import ServiceRequest from "../src/models/ServiceRequestModel.js";
import VendorReview from "../src/models/VendorReviewModel.js";
import VendorQuote from "../src/models/VendorQuoteModel.js";

export async function fetchGlobalPlatformStats() {
  const [vendorRole, total_service_requests, reviewAgg, quoteTimeAgg] =
    await Promise.all([
      Role.findOne({ name: /^Vendor$/i }).select("_id").lean(),
      ServiceRequest.countDocuments({ deletedAt: null }),
      VendorReview.aggregate([
        { $match: { status: "ACTIVE" } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]),
      VendorQuote.aggregate([
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$service_request_id",
            firstQuoteAt: { $first: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: "servicerequests",
            localField: "_id",
            foreignField: "_id",
            as: "request",
          },
        },
        { $unwind: "$request" },
        { $match: { "request.deletedAt": null } },
        {
          $project: {
            diffMs: { $subtract: ["$firstQuoteAt", "$request.createdAt"] },
          },
        },
        { $match: { diffMs: { $gte: 0 } } },
        {
          $group: {
            _id: null,
            avgMs: { $avg: "$diffMs" },
          },
        },
      ]),
    ]);

  let total_active_vendors = 0;
  if (vendorRole?._id) {
    total_active_vendors = await User.countDocuments({
      role: vendorRole._id,
      status: "ACTIVE",
      kyc_status: "ACTIVE",
    });
  }

  const avgRating = reviewAgg[0]?.avgRating ?? 0;
  const reviewCount = reviewAgg[0]?.count ?? 0;
  const satisfaction = reviewCount
    ? Math.round((avgRating / 5) * 100)
    : 0;
  const average_customer_satisfaction_score = reviewCount
    ? Math.round(avgRating * 10) / 10
    : 0;

  const avgMs = quoteTimeAgg[0]?.avgMs ?? 0;
  const average_time_to_receive_a_quote = avgMs
    ? Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10
    : 0;

  return {
    total_active_vendors,
    total_service_requests,
    satisfaction,
    average_customer_satisfaction_score,
    average_time_to_receive_a_quote,
  };
}
