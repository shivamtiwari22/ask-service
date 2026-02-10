import { sendEmail } from "../../../config/emailConfig.js";
import handleResponse from "../../../utils/http-response.js";
import {
  comparePassword,
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
import moment from "moment";
import mongoose from "mongoose";

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

    const { email, phone } = contact_details || {};

    if (!email && !phone) {
      await session.abortTransaction();
      return handleResponse(400, "Email or phone is required", {}, resp);
    }

    // ===== CATEGORY VALIDATION =====
    const parentCategory = await ServiceCategory.findOne({
      _id: service_category,
      deletedAt: null,
      status: "ACTIVE",
    });

    if (!parentCategory) {
      await session.abortTransaction();
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
        await session.abortTransaction();
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
      address_1,
      address_2,
      city,
      state,
      country,
      pincode: pincode || null,
      contact_details,
      status: "ACTIVE",
    };

    // ===== LOGGED-IN USER =====
    if (req.user) {
      const [request] = await ServiceRequest.create(
        [{ ...payload, user: req.user._id }],
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

    // ===== EXISTING USER =====
    let user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (user) {
      const emailRequired = !!user.email && !user.is_email_verified;
      const phoneRequired = !!user.phone && !user.is_phone_verified;

      // Fully verified → login
      if (!emailRequired && !phoneRequired) {
        await session.abortTransaction();
        return handleResponse(
          200,
          "User already exists. Please login.",
          { flow: "LOGIN_REQUIRED" },
          resp,
        );
      }

      if (emailRequired) {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(1, "minutes").toDate();
      }

      if (phoneRequired) {
        user.otp_phone = generateOTP();
        user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
      }

      user.otp_for = "SIGNUP";
      await user.save({ session });
      await session.commitTransaction();

      if (emailRequired) {
        await sendEmail({
          to: user.email,
          subject: "Email OTP",
          html: `<p>Your email OTP is <b>${user.otp}</b></p>`,
        });
      }

      return handleResponse(
        200,
        "Verification required",
        {
          flow: "VERIFICATION_REQUIRED",
          verification: {
            email_required: emailRequired,
            phone_required: phoneRequired,
          },
        },
        resp,
      );
    }

    // ===== NEW USER =====
    const role = await Role.findOne({ name: "User" });

    const emailOtp = email ? generateOTP() : null;
    const phoneOtp = phone ? generateOTP() : null;

    const [newUser] = await User.create(
      [
        {
          first_name: contact_details.first_name || "Guest User",
          last_name: contact_details.last_name,
          email,
          phone,
          password: await hashPassword(generatePassword(10)),
          role: role._id,
          status: "ACTIVE",
          otp_for: "SIGNUP",
          otp: emailOtp,
          otp_phone: phoneOtp,
          otp_expires_at: emailOtp ? moment().add(1, "minutes").toDate() : null,
          otp_phone_expiry_at: phoneOtp
            ? moment().add(1, "minutes").toDate()
            : null,
        },
      ],
      { session },
    );

    await ServiceRequest.create([{ ...payload, user: newUser._id }], {
      session,
    });

    await session.commitTransaction();

    if (emailOtp) {
      await sendEmail({
        to: email,
        subject: "Email OTP",
        html: `<p>Your email OTP is <b>${emailOtp}</b></p>`,
      });
    }

    return handleResponse(
      201,
      "Verification required",
      {
        flow: "VERIFICATION_REQUIRED",
        verification: {
          email_required: !!email,
          phone_required: !!phone,
        },
      },
      resp,
    );
  } catch (err) {
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