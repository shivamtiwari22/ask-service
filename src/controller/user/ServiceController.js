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
import moment from "moment";
import mongoose from "mongoose";
import crypto from "crypto";

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
        "User already exists. Please login.",
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
      resp,
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
