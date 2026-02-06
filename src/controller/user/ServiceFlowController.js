import { sendEmail } from "../../../config/emailConfig.js";
import handleResponse from "../../../utils/http-response.js";
import {
  comparePassword,
  generateOTP,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import { generatePassword } from "../../../utils/helperFunction.js";
import Role from "../../models/RoleModel.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import ServiceRequest from "../../models/ServiceRequestModel.js";
import User from "../../models/UserModel.js";
import VendorReview from "../../models/VendorReviewModel.js";

const createReference = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${random}`;
};

const sendPhoneOTP = async ({ phone, otp }) => {
  console.log(`OTP to phone ${phone}: ${otp}`);
};

const sendGeneratedPasswordToPhone = async ({ phone, password }) => {
  console.log(`Generated password for ${phone}: ${password}`);
};

export const getUserServiceCategories = async (req, resp) => {
  try {
    const categories = await ServiceCategory.find({
      deletedAt: null,
      status: "ACTIVE",
      parent_category: null,
    }).lean();

    const parents = await Promise.all(
      categories.map(async (parent) => {
        const child_categories = await ServiceCategory.find({
          deletedAt: null,
          status: "ACTIVE",
          parent_category: parent._id,
        })
          .select("title description image options")
          .lean();

        return { ...parent, child_categories };
      })
    );

    return handleResponse(200, "Service categories fetched successfully", parents, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const initiateServiceRequest = async (req, resp) => {
  try {
    const {
      service_category,
      child_category,
      manual_child_category,
      frequency,
      selected_options,
      preferred_start_date,
      preferred_time_of_day,
      note,
      address,
      pincode,
      contact_details,
    } = req.body;

    const parentCategory = await ServiceCategory.findOne({
      _id: service_category,
      deletedAt: null,
      status: "ACTIVE",
    });

    if (!parentCategory) {
      return handleResponse(404, "Service category not found", {}, resp);
    }

    if (child_category) {
      const childCategoryData = await ServiceCategory.findOne({
        _id: child_category,
        parent_category: service_category,
        deletedAt: null,
        status: "ACTIVE",
      });
      if (!childCategoryData) {
        return handleResponse(400, "Invalid child category", {}, resp);
      }
    }

    const payload = {
      reference_no: createReference(),
      service_category,
      child_category: child_category || null,
      manual_child_category: manual_child_category || null,
      frequency,
      selected_options: Array.isArray(selected_options) ? selected_options : [],
      preferred_start_date: preferred_start_date || null,
      preferred_time_of_day: preferred_time_of_day || null,
      note: note || null,
      address,
      pincode: pincode || null,
      contact_details,
      status: req.user ? "SUBMITTED" : "PENDING_VERIFICATION",
    };

    if (req.user) {
      const request = await ServiceRequest.create({ ...payload, user: req.user._id });
      return handleResponse(
        201,
        "Service request created successfully",
        { request, accessToken: null },
        resp
      );
    }

    const existingUser = await User.findOne({
      $or: [
        { email: contact_details.email },
        { phone: contact_details.phone },
      ],
    }).populate("role");

    if (existingUser) {
      const request = await ServiceRequest.create({
        ...payload,
        user: existingUser._id,
        status: "SUBMITTED",
      });

      return handleResponse(
        200,
        "User already exists. Please login to continue.",
        {
          request_id: request._id,
          reference_no: request.reference_no,
          requires_login: true,
          user_hint: {
            email: existingUser.email,
            phone: existingUser.phone,
          },
        },
        resp
      );
    }

    const email_otp = generateOTP();
    const phone_otp = generateOTP();
    const generatedPassword = generatePassword(10);

    const request = await ServiceRequest.create({
      ...payload,
      otp_meta: {
        email_otp,
        phone_otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        verified_email: false,
        verified_phone: false,
      },
      generated_password: generatedPassword,
    });

    setImmediate(async () => {
      await sendEmail({
        to: contact_details.email,
        subject: "Email OTP for Ask Service",
        html: `<p>Your email OTP is <b>${email_otp}</b>. Valid for 10 minutes.</p>`,
      });
      await sendPhoneOTP({ phone: contact_details.phone, otp: phone_otp });
    });

    return handleResponse(
      201,
      "OTP sent on email and phone. Verify to continue.",
      {
        request_id: request._id,
        reference_no: request.reference_no,
        requires_verification: true,
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const resendServiceRequestOTP = async (req, resp) => {
  try {
    const { request_id } = req.body;

    const request = await ServiceRequest.findById(request_id);
    if (!request || request.deletedAt) {
      return handleResponse(404, "Service request not found", {}, resp);
    }

    if (request.status !== "PENDING_VERIFICATION") {
      return handleResponse(400, "Request is already verified/submitted", {}, resp);
    }

    const email_otp = generateOTP();
    const phone_otp = generateOTP();

    request.otp_meta = {
      ...request.otp_meta,
      email_otp,
      phone_otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      verified_email: false,
      verified_phone: false,
    };
    await request.save();

    setImmediate(async () => {
      await sendEmail({
        to: request.contact_details.email,
        subject: "Email OTP for Ask Service",
        html: `<p>Your email OTP is <b>${email_otp}</b>. Valid for 10 minutes.</p>`,
      });
      await sendPhoneOTP({ phone: request.contact_details.phone, otp: phone_otp });
    });

    return handleResponse(200, "OTP resent successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const verifyServiceRequestAndCreateUser = async (req, resp) => {
  try {
    const { request_id, email_otp, phone_otp } = req.body;

    const request = await ServiceRequest.findById(request_id);
    if (!request || request.deletedAt) {
      return handleResponse(404, "Service request not found", {}, resp);
    }

    if (request.status !== "PENDING_VERIFICATION") {
      return handleResponse(400, "Request is already processed", {}, resp);
    }

    if (!request.otp_meta?.expires_at || new Date() > request.otp_meta.expires_at) {
      return handleResponse(400, "OTP expired", {}, resp);
    }

    if (request.otp_meta.email_otp !== email_otp) {
      return handleResponse(400, "Invalid email OTP", {}, resp);
    }

    if (request.otp_meta.phone_otp !== phone_otp) {
      return handleResponse(400, "Invalid phone OTP", {}, resp);
    }

    const userRole = await Role.findOne({ name: "User" });
    if (!userRole) {
      return handleResponse(404, "User role not found", {}, resp);
    }

    const existingUser = await User.findOne({
      $or: [
        { email: request.contact_details.email },
        { phone: request.contact_details.phone },
      ],
    });

    let user;
    if (existingUser) {
      user = await User.findByIdAndUpdate(
        existingUser._id,
        {
          $set: {
            first_name: request.contact_details.first_name,
            last_name: request.contact_details.last_name,
            phone: request.contact_details.phone,
            is_email_verified: true,
            is_phone_verified: true,
            status: "ACTIVE",
          },
        },
        { new: true }
      );
    } else {
      const rawPassword = request.generated_password || generatePassword(10);
      const password = await hashPassword(rawPassword);
      user = await User.create({
        first_name: request.contact_details.first_name,
        last_name: request.contact_details.last_name,
        email: request.contact_details.email,
        phone: request.contact_details.phone,
        password,
        role: userRole._id,
        status: "ACTIVE",
        is_email_verified: true,
        is_phone_verified: true,
      });

      setImmediate(async () => {
        await sendEmail({
          to: request.contact_details.email,
          subject: "Your Ask Service account is ready",
          html: `<p>Your temporary password is <b>${rawPassword}</b></p>`,
        });
        await sendGeneratedPasswordToPhone({
          phone: request.contact_details.phone,
          password: rawPassword,
        });
      });
    }

    request.user = user._id;
    request.status = "SUBMITTED";
    request.otp_meta = {
      email_otp: null,
      phone_otp: null,
      expires_at: null,
      verified_email: true,
      verified_phone: true,
    };
    await request.save();

    const token = generateToken({ _id: user._id.toString() });

    return handleResponse(
      200,
      "Service request submitted successfully",
      {
        request_id: request._id,
        reference_no: request.reference_no,
        accessToken: token,
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const loginAndAttachServiceRequest = async (req, resp) => {
  try {
    const { request_id, email_or_phone, password } = req.body;

    const request = await ServiceRequest.findById(request_id);
    if (!request || request.deletedAt) {
      return handleResponse(404, "Service request not found", {}, resp);
    }

    const user = await User.findOne({
      $or: [{ email: email_or_phone }, { phone: email_or_phone }],
    }).populate("role");

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const isPasswordCorrect = await comparePassword(password, user.password);
    if (!isPasswordCorrect) {
      return handleResponse(401, "Invalid password", {}, resp);
    }

    if (user.status !== "ACTIVE") {
      return handleResponse(401, "Your account is not active", {}, resp);
    }

    request.user = user._id;
    request.status = "SUBMITTED";
    await request.save();

    const token = generateToken({ _id: user._id.toString() });

    return handleResponse(
      200,
      "Login successful and request submitted",
      {
        request_id: request._id,
        reference_no: request.reference_no,
        accessToken: token,
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const getMyServiceRequests = async (req, resp) => {
  try {
    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "10");
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      ServiceRequest.find({ user: req.user._id, deletedAt: null })
        .populate("service_category", "title")
        .populate("child_category", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ServiceRequest.countDocuments({ user: req.user._id, deletedAt: null }),
    ]);

    return handleResponse(
      200,
      "Service requests fetched successfully",
      {
        list: requests,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const vendorRequestServiceLead = async (req, resp) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest || serviceRequest.deletedAt) {
      return handleResponse(404, "Service request not found", {}, resp);
    }

    if (serviceRequest.status !== "SUBMITTED") {
      return handleResponse(400, "Service request is not open", {}, resp);
    }

    const roleName = req.user?.role?.name;
    if (roleName !== "Vendor") {
      return handleResponse(403, "Only vendor can request this lead", {}, resp);
    }

    const alreadyRequested = serviceRequest.vendor_requests.some(
      (entry) => String(entry.vendor) === String(req.user._id)
    );
    if (alreadyRequested) {
      return handleResponse(400, "You already requested this lead", {}, resp);
    }

    if (serviceRequest.vendor_requests.length >= 5) {
      return handleResponse(400, "Maximum 5 vendors can request one service", {}, resp);
    }

    serviceRequest.vendor_requests.push({ vendor: req.user._id });
    await serviceRequest.save();

    return handleResponse(200, "Lead requested successfully", serviceRequest, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const createVendorReview = async (req, resp) => {
  try {
    const { vendor, rating, review } = req.body;

    const vendorUser = await User.findById(vendor).populate("role");
    if (!vendorUser || vendorUser?.role?.name !== "Vendor") {
      return handleResponse(404, "Vendor not found", {}, resp);
    }

    const exists = await VendorReview.findOne({ user: req.user._id, vendor, deletedAt: null });
    if (exists) {
      return handleResponse(409, "You can review a vendor only once", {}, resp);
    }

    const vendorReview = await VendorReview.create({
      user: req.user._id,
      vendor,
      rating,
      review,
    });

    return handleResponse(201, "Vendor review submitted successfully", vendorReview, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};
