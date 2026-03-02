import { sendEmail } from "../../../config/emailConfig.js";
import handleResponse from "../../../utils/http-response.js";
import {
  generateOTP,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import {
  createReference,
  generatePassword,
} from "../../../utils/helperFunction.js";
import Role from "../../models/RoleModel.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import ServiceRequest from "../../models/ServiceRequestModel.js";
import User from "../../models/UserModel.js";
import VendorQuote from "../../models/VendorQuoteModel.js";
import VendorReview from "../../models/VendorReviewModel.js";
import BusinessInformation from "../../models/BusinessInformationModel.js";
import moment from "moment";
import mongoose from "mongoose";
import crypto from "crypto";
import Report from "../../models/ReportModel.js";

// get service category list for users
export const getUserServiceCategories = async (req, resp) => {
  try {
    const data = await ServiceCategory.aggregate([
      {
        $match: {
          deletedAt: null,
          status: "ACTIVE",
          parent_category: null,
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          options: {
            $map: {
              input: {
                $filter: {
                  input: "$options",
                  as: "opt",
                  cond: { $eq: ["$$opt.status", "ACTIVE"] },
                },
              },
              as: "opt",
              in: {
                label: "$$opt.label",
                status: "$$opt.status",
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "servicecategories",
          let: { parentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parent_category", "$$parentId"] },
                    { $eq: ["$deletedAt", null] },
                    { $eq: ["$status", "ACTIVE"] },
                  ],
                },
              },
            },
            {
              $project: {
                title: 1,
                description: 1,
                image: 1,
                options: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$options",
                        as: "opt",
                        cond: { $eq: ["$$opt.status", "ACTIVE"] },
                      },
                    },
                    as: "opt",
                    in: {
                      label: "$$opt.label",
                      status: "$$opt.status",
                    },
                  },
                },
              },
            },
          ],
          as: "child_categories",
        },
      },
    ]);

    return handleResponse(
      200,
      "Service categories fetched successfully",
      data,
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// service created by user (without login)
export const initiateServiceRequest = async (req, resp) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      service_category,
      child_category,
      manual_child_category,
      frequency,
      selected_options,
      preferred_start_date,
      preferred_time_of_day,
      note,
      address_1,
      address_2,
      city,
      state,
      country,
      pincode,
      contact_details,
    } = req.body;

    if (!contact_details) {
      await session.abortTransaction();
      return handleResponse(400, "Contact details are required", {}, resp);
    }

    const { phone, email, first_name, last_name } = contact_details;

    // ================= REQUIRED VALIDATION =================
    if (!phone || !first_name || !last_name) {
      await session.abortTransaction();
      return handleResponse(
        400,
        "Phone, first name and last name are required",
        {},
        resp,
      );
    }

    if (
      !service_category ||
      !frequency ||
      !address_1 ||
      !city ||
      !state ||
      !country
    ) {
      await session.abortTransaction();
      return handleResponse(400, "Missing required service fields", {}, resp);
    }

    // ================= CATEGORY VALIDATION =================
    const parentCategory = await ServiceCategory.findOne({
      _id: service_category,
      deletedAt: null,
      status: "ACTIVE",
    });

    if (!parentCategory) {
      await session.abortTransaction();
      return handleResponse(404, "Invalid service category", {}, resp);
    }

    if (child_category) {
      const child = await ServiceCategory.findOne({
        _id: child_category,
        parent_category: service_category,
        deletedAt: null,
        status: "ACTIVE",
      });

      if (!child) {
        await session.abortTransaction();
        return handleResponse(400, "Invalid child category", {}, resp);
      }
    }

    // ================= LOGGED-IN USER =================
    if (req.user) {
      const [request] = await ServiceRequest.create(
        [
          {
            reference_no: createReference(),
            service_category,
            child_category: child_category || null,
            manual_child_category: manual_child_category || null,
            frequency,
            selected_options: Array.isArray(selected_options)
              ? selected_options
              : [],
            preferred_start_date: preferred_start_date || null,
            preferred_time_of_day: preferred_time_of_day || null,
            note: note || null,
            address_1,
            address_2,
            city,
            state,
            country,
            pincode: pincode || null,
            contact_details,
            user: req.user._id,
            status: "ACTIVE",
          },
        ],
        { session },
      );

      await session.commitTransaction();

      return handleResponse(
        201,
        "Service request created",
        { flow: "REQUEST_CREATED", request },
        resp,
      );
    }

    // ================= FIND USER BY PHONE =================
    const existingUser = await User.findOne({ phone });

    // ================= EMAIL COLLISION CHECK =================
    if (email) {
      const emailOwner = await User.findOne({ email });

      if (
        emailOwner &&
        (!existingUser ||
          emailOwner._id.toString() !== existingUser._id.toString())
      ) {
        await session.abortTransaction();
        return handleResponse(
          400,
          "Email already associated with another account",
          {},
          resp,
        );
      }
    }

    // ================= EXISTING USER =================
    if (existingUser) {
      if (!existingUser.is_phone_verified) {
        existingUser.phone_otp = generateOTP();
        existingUser.phone_otp_expiry = moment().add(5, "minutes").toDate();
        await existingUser.save({ session });

        await session.commitTransaction();

        return handleResponse(
          403,
          "Phone verification required",
          { flow: "PHONE_VERIFICATION_REQUIRED" },
          resp,
        );
      }

      await session.abortTransaction();

      return handleResponse(
        200,
        "User already exists with phone. Please login.",
        { flow: "LOGIN_REQUIRED" },
        resp,
      );
    }

    // ================= NEW USER =================
    const role = await Role.findOne({ name: "User" });

    const phoneOtp = generateOTP();
    const emailToken = email ? crypto.randomBytes(32).toString("hex") : null;

    const [newUser] = await User.create(
      [
        {
          first_name,
          last_name,
          phone,
          email: email || null,
          password: await hashPassword(generatePassword(8)),
          role: role._id,
          is_phone_verified: false,
          is_email_verified: false,
          otp_phone: phoneOtp,
          otp_phone_expiry_at: moment().add(5, "minutes").toDate(),
          otp_for: "VERIFY_PHONE",
          email_verification_token: emailToken,
          status: "ACTIVE",
        },
      ],
      { session },
    );

    const [request] = await ServiceRequest.create(
      [
        {
          reference_no: createReference(),
          service_category,
          child_category: child_category || null,
          manual_child_category: manual_child_category || null,
          frequency,
          selected_options: Array.isArray(selected_options)
            ? selected_options
            : [],
          preferred_start_date: preferred_start_date || null,
          preferred_time_of_day: preferred_time_of_day || null,
          note: note || null,
          address_1,
          address_2,
          city,
          state,
          country,
          pincode: pincode || null,
          contact_details,
          user: newUser._id,
          status: "ACTIVE",
        },
      ],
      { session },
    );

    await session.commitTransaction();

    // if (email && emailToken) {
    //   setImmediate(async () => {
    //     const link = `${process.env.BASE_URL}/api/user/verify-email?token=${emailToken}`;
    //     await sendEmail({
    //       to: email,
    //       subject: "Verify your email",
    //       html: `<p>Click below to verify your email:</p>
    //              <a href="${link}">${link}</a>`,
    //     });
    //   });
    // }

    return handleResponse(
      201,
      "Phone verification required",
      { flow: "PHONE_VERIFICATION_REQUIRED", request },
      resp ,
    );
  } catch (err) {
    console.log("Service request error:", err);
    await session.abortTransaction();
    return handleResponse(500, err.message, {}, resp);
  } finally {
    session.endSession();
  }
};

// verify signup login
export const verifySignupLogin = async (req, resp) => {
  try {
    const { email, phone, otp_email, otp_phone } = req.body;

    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const errors = {};

    // ===== EMAIL =====
    if (user.email && !user.is_email_verified) {
      if (!otp_email) errors.email = "Email OTP required";
      else if (moment().isAfter(user.otp_expires_at))
        errors.email = "Email OTP expired";
      else if (user.otp !== otp_email) errors.email = "Invalid Email OTP";
      else {
        user.is_email_verified = true;
        user.otp = null;
        user.otp_expires_at = null;
      }
    }

    // ===== PHONE =====
    if (user.phone && !user.is_phone_verified) {
      if (!otp_phone) errors.phone = "Phone OTP required";
      else if (moment().isAfter(user.otp_phone_expiry_at))
        errors.phone = "Phone OTP expired";
      else if (user.otp_phone !== otp_phone) errors.phone = "Invalid Phone OTP";
      else {
        user.is_phone_verified = true;
        user.otp_phone = null;
        user.otp_phone_expiry_at = null;
      }
    }

    if (Object.keys(errors).length > 0) {
      await user.save();
      return handleResponse(
        400,
        "Verification incomplete",
        {
          flow: "VERIFICATION_REQUIRED",
          errors,
          email_verified: user.is_email_verified,
          phone_verified: user.is_phone_verified,
        },
        resp,
      );
    }

    user.otp_for = null;
    await user.save();

    const token = generateToken(user);

    return handleResponse(
      200,
      "Verification successful",
      {
        flow: "LOGIN_SUCCESS",
        token,
        user,
      },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get created service requests (My Requests list) – filter by user, add quote count and status label
export const getCreatedServiceRequests = async (req, resp) => {
  try {
    const userId = req.user?._id;
    if (!userId) return handleResponse(401, "Unauthorized", {}, resp);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, service, status, fromDate, toDate } = req.query;

    const query = { user: userId, deletedAt: null };

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { reference_no: { $regex: search, $options: "i" } },
          { note: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (service) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ service_category: service }, { child_category: service }],
      });
    }

    if (status) query.status = status;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const isPaginateDisabled = page === 0 && limit === 0;
    const skipNum = isPaginateDisabled ? 0 : skip;
    const limitNum = isPaginateDisabled ? 0 : Math.min(100, Math.max(1, limit));

    const [requests, total] = await Promise.all([
      ServiceRequest.find(query)
        .populate("service_category", "title description image options")
        .populate("child_category", "title description image options")
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum || undefined)
        .lean(),
      ServiceRequest.countDocuments(query),
    ]);

    const requestIds = requests.map((r) => r._id);
    const quoteCounts = await VendorQuote.aggregate([
      { $match: { service_request_id: { $in: requestIds }, status: "SENT" } },
      { $group: { _id: "$service_request_id", count: { $sum: 1 } } },
    ]);
    const countByRequest = new Map(quoteCounts.map((q) => [q._id.toString(), q.count]));

    const data = requests.map((r) => {
      const quotesCount = countByRequest.get(r._id.toString()) || 0;
      return {
        ...r,
        request_id: r.reference_no,
        quotes_count: quotesCount,
        status_label: quotesCount > 0 ? "Quotes received" : "Waiting for quotes",
        location: [r.city, r.pincode].filter(Boolean).join(", ") || r.address_1,
      };
    });

    const pagination = isPaginateDisabled
      ? null
      : { total, page, limit: limitNum, totalPages: Math.ceil(total / limitNum) };

    return handleResponse(200, "Service requests fetched successfully", { data, pagination }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// Close request reasons (Figma modal)
const CLOSE_REASONS = [
  "No longer need the service",
  "Found a provider elsewhere",
  "Quotes are too expensive",
  "Changed my mind",
  "Other reason",
];

// close service request (with reason for "Close this request?" modal)
export const closeServiceRequest = async (req, resp) => {
  try {
    const { id } = req.params;
    const { reason, reason_comment } = req.body;

    const serviceRequest = await ServiceRequest.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!serviceRequest)
      return handleResponse(404, "Service request not found", {}, resp);

    if (serviceRequest.status !== "ACTIVE")
      return handleResponse(400, "Service request is not active", {}, resp);

    const reasonText = reason || null;
    if (reasonText && !CLOSE_REASONS.includes(reasonText) && reasonText !== "Other reason") {
      return handleResponse(400, "Invalid reason. Use one of: " + CLOSE_REASONS.join(", "), {}, resp);
    }

    serviceRequest.status = "CANCELLED";
    serviceRequest.reason = reasonText === "Other reason" && reason_comment ? reason_comment : reasonText;
    await serviceRequest.save();
    return handleResponse(200, "Service request closed successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get list of quotes for a service request (Quotes for House Cleaning modal)
export const getQuotesForServiceRequest = async (req, resp) => {
  try {
    const userId = req.user._id;
    const requestId = req.params.id;
    const { sort = "price_low_to_high" } = req.query;

    const serviceRequest = await ServiceRequest.findOne({
      _id: requestId,
      user: userId,
      deletedAt: null,
    })
      .populate("service_category", "title")
      .lean();

    if (!serviceRequest)
      return handleResponse(404, "Service request not found", {}, resp);

    let sortOption = { quote_price: 1 };
    if (sort === "price_high_to_low") sortOption = { quote_price: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "oldest") sortOption = { createdAt: 1 };

    const quotes = await VendorQuote.find({
      service_request_id: requestId,
      status: "SENT",
    })
      .populate("vendor_id", "first_name last_name profile_pic")
      .sort(sortOption)
      .lean();

    const vendorIds = [...new Set(quotes.map((q) => q.vendor_id?._id?.toString()).filter(Boolean))];
    const reviewStats = await VendorReview.aggregate([
      { $match: { vendor: { $in: vendorIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: "ACTIVE" } },
      { $group: { _id: "$vendor", rating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const statsByVendor = new Map(reviewStats.map((s) => [s._id.toString(), s]));

    const businessList = await BusinessInformation.find({ user_id: { $in: vendorIds } }).lean();
    const businessByVendor = new Map(businessList.map((b) => [b.user_id.toString(), b]));

    const requestCreated = serviceRequest.createdAt ? new Date(serviceRequest.createdAt).getTime() : 0;
    const list = quotes.map((q) => {
      const vendor = q.vendor_id;
      const vid = vendor?._id?.toString();
      const stats = statsByVendor.get(vid) || {};
      const business = businessByVendor.get(vid);
      const quoteCreated = q.createdAt ? new Date(q.createdAt).getTime() : 0;
      const respondedInHours = requestCreated ? ((quoteCreated - requestCreated) / (1000 * 60 * 60)).toFixed(1) : null;
      return {
        _id: q._id,
        quote_id: q._id,
        vendor_id: vid,
        provider_name: business?.business_name || (vendor ? `${vendor.first_name || ""} ${vendor.last_name || ""}`.trim() : "Vendor"),
        rating: stats.rating ? Number(stats.rating.toFixed(1)) : null,
        reviews_count: stats.count || 0,
        service_description: q.service_description,
        responded_in_hours: respondedInHours,
        price: q.quote_price,
        currency: q.currency || "EUR",
        price_display: `${q.currency || "EUR"}${q.quote_price} per visit`,
        available_start_date: q.available_start_date,
        status : q.status ,
        preferred_time_of_day : serviceRequest?.preferred_time_of_day
      };
    });

    return handleResponse(200, "Quotes fetched successfully", {
      request: {
        _id: serviceRequest._id,
        request_id: serviceRequest.reference_no,
        service_title: serviceRequest.service_category?.title,
        date: serviceRequest.createdAt,
        location: [serviceRequest.city, serviceRequest.pincode].filter(Boolean).join(", ") || serviceRequest.address_1,
        quotes_count: list.length,
      },
      quotes: list,
    }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get single quote details (View details modal – provider, rating, description, included/not included, availability)
export const getQuoteDetails = async (req, resp) => {
  try {
    const userId = req.user._id;
    const { id: requestId, quoteId } = req.params;

    const serviceRequest = await ServiceRequest.findOne({
      _id: requestId,
      user: userId,
      deletedAt: null,
    })
      .populate("service_category", "title")
      .lean();

    if (!serviceRequest)
      return handleResponse(404, "Service request not found", {}, resp);

    const quote = await VendorQuote.findOne({
      _id: quoteId,
      service_request_id: requestId,
      status: "SENT",
    })
      .populate("vendor_id", "first_name last_name profile_pic email")
      .lean();

    if (!quote) return handleResponse(404, "Quote not found", {}, resp);

    const vendorId = quote.vendor_id?._id || quote.vendor_id;
    const [stats, business] = await Promise.all([
      VendorReview.aggregate([
        { $match: { vendor: vendorId, status: "ACTIVE" } },
        { $group: { _id: null, rating: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]),
      BusinessInformation.findOne({ user_id: vendorId }).lean(),
    ]);

    const rating = stats[0]?.rating ? Number(stats[0].rating.toFixed(1)) : null;
    const reviewsCount = stats[0]?.count || 0;
    const vendor = quote.vendor_id;
    const providerName = business?.business_name || (vendor ? `${vendor.first_name || ""} ${vendor.last_name || ""}`.trim() : "Vendor");

    const baseUrl = process.env.IMAGE_URL || "";
    const attachmentUrl = quote.attachment_url
      ? (baseUrl + (quote.attachment_url.startsWith("/") ? quote.attachment_url : quote.attachment_url))
      : null;

    return handleResponse(200, "Quote details fetched successfully", {
      quote: {
        _id: quote._id,
        quote_price: quote.quote_price,
        currency: quote.currency || "EUR",
        service_description: quote.service_description,
        available_start_date: quote.available_start_date,
        quote_valid_days: quote.quote_valid_days,
        attachment_url: attachmentUrl,
      },
      vendor: {
        _id: vendor._id,
        provider_name: providerName,
        rating,
        reviews_count: reviewsCount,
        years_in_business: business?.years_of_activity || null,
      },
      request: {
        request_id: serviceRequest.reference_no,
        service_title: serviceRequest.service_category?.title,
      },
    }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// ignore quote (user declines / "Ignore quote" button)
export const ignoreQuote = async (req, resp) => {
  try {
    const userId = req.user._id;
    const { id: requestId, quoteId } = req.params;

    const serviceRequest = await ServiceRequest.findOne({ _id: requestId, user: userId });
    if (!serviceRequest) return handleResponse(404, "Service request not found", {}, resp);

    const quote = await VendorQuote.findOne({
      _id: quoteId,
      service_request_id: requestId,
      status: "SENT",
    });
    if (!quote) return handleResponse(404, "Quote not found", {}, resp);

    quote.status = "IGNORED";
    await quote.save();

    return handleResponse(200, "Quote ignored successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// accept quote (user accepts a quote)
export const acceptQuote = async (req, resp) => {
  try {
    const userId = req.user._id;
    const { id: requestId, quoteId } = req.params;

    const serviceRequest = await ServiceRequest.findOne({ _id: requestId, user: userId });
    if (!serviceRequest) return handleResponse(404, "Service request not found", {}, resp);

    const quote = await VendorQuote.findOne({
      _id: quoteId,
      service_request_id: requestId,
      status: "SENT",
    });
    if (!quote) return handleResponse(404, "Quote not found", {}, resp);

    quote.status = "ACCEPTED";
    await quote.save();

    return handleResponse(200, "Quote accepted successfully", { quote_id: quote._id }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const submitReview = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { service_request_id, vendor, rating, review } = req.body;

    // Basic validation
    if (!service_request_id || !vendor || !rating) {
      return handleResponse(
        400,
        "service_request_id, vendor and rating are required",
        {},
        res
      );
    }

    if (rating < 1 || rating > 5) {
      return handleResponse(
        400,
        "Rating must be between 1 and 5",
        {},
        res
      );
    }

    // Check if already reviewed
    const existingReview = await VendorReview.findOne({
      user: customerId,
      service_request_id,
      vendor,
    });

    if (existingReview) {
      return handleResponse(
        409,
        "You have already submitted a review for this service",
        {},
        res
      );
    }

    // Optional: Check if service exists
    const serviceRequest = await ServiceRequest.findById(service_request_id);
    if (!serviceRequest) {
      return handleResponse(404, "Service request not found", {}, res);
    }

    const newReview = await VendorReview.create({
      user: customerId,
      service_request_id,
      vendor,
      rating,
      review,
    });

    const populated = await VendorReview.findById(newReview._id)
      .populate("user", "first_name last_name profile_pic")
      .populate("vendor", "first_name last_name")
      .populate("service_request_id", "reference_no")
      .lean();

    return handleResponse(
      201,
      "Review submitted successfully",
      populated,
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};


  export const vendorDetails = async (req, resp) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const vendor = await User.findById(id).select("-password -otp -otp_phone");
    if (!vendor) return handleResponse(404, "Vendor not found", {}, resp);


    const businessInformation = await BusinessInformation.findOne({user_id:vendor._id});

       const reviews = await VendorReview.find({
          vendor: vendor._id,
        })
          .populate("user", "first_name last_name profile_pic email")
          .sort({ createdAt: -1 })
          .lean();
    
        const totalReviews = reviews.length;
    
        // Calculate average rating
        const averageRating =
          totalReviews > 0
            ? (
                reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
              ).toFixed(1)
            : 0;
    
        // Rating distribution
        const ratingDistribution = {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        };
    
        reviews.forEach((review) => {
          if (review.rating >= 1 && review.rating <= 5) {
            ratingDistribution[review.rating]++;
          }
        });
    

      let review = {
            averageRating: Number(averageRating),
        totalReviews,
        ratingDistribution,
        reviews,
      }

    return handleResponse(200, "Vendor Detail", { vendor , review}, resp);

  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const toggleReviewLike = async (req, res) => {
  try {
    const userId = req.user._id;
    const reviewId = req.params.id;

    const review = await VendorReview.findById(reviewId);

    if (!review) {
      return handleResponse(404, "Review not found", {}, res);
    }

    const alreadyLiked = review.likes.includes(userId);

    if (alreadyLiked) {
      // 🔹 Unlike
      review.likes = review.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
      review.likes_count = review.likes.length;

      await review.save();

      return handleResponse(
        200,
        "Review unliked successfully",
        { liked: false, likes_count: review.likes_count },
        res
      );
    }

    // 🔹 Like
    review.likes.push(userId);
    review.likes_count = review.likes.length;

    await review.save();

    return handleResponse(
      200,
      "Review liked successfully",
      { liked: true, likes_count: review.likes_count },
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const reportUser = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { reported_user, reason, description } = req.body;

    if (reporterId.toString() === reported_user) {
      return handleResponse(400, "You cannot report yourself", {}, res);
    }

    const existingReport = await Report.findOne({
      reporter: reporterId,
      reported_user,
    });

    if (existingReport) {
      return handleResponse(
        400,
        "You have already reported this user",
        {},
        res
      );
    }

    const report = await Report.create({
      reporter: reporterId,
      reported_user,
      reason,
      description,
    });

    return handleResponse(
      201,
      "vendor reported successfully",
      report,
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};


