import { sendEmail } from "../../../config/emailConfig.js";
import handleResponse from "../../../utils/http-response.js";
import {
  comparePassword,
  generateOTP,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import { createReference, generatePassword } from "../../../utils/helperFunction.js";
import Role from "../../models/RoleModel.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import ServiceRequest from "../../models/ServiceRequestModel.js";
import User from "../../models/UserModel.js";
import moment from "moment";


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
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// service created by user (without login)
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
      address_1,
      address_2,
      city,
      state,
      country,
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
      address_1,
      address_2,
      city,
      state,
      country,
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
      const loginVia = [];

      if (existingUser.email === contact_details.email) {
        loginVia.push("email");
      }

      if (existingUser.phone === contact_details.phone) {
        loginVia.push("phone");
      }

      return handleResponse(
        200,
        "User already exists. Please login to continue.",
        {
          requires_login: true,
          login_via: loginVia,
          user_hint: {
            email: existingUser.email
              ? existingUser.email.replace(/(.{2}).+(@.+)/, "$1****$2")
              : null,
            phone: existingUser.phone
              ? existingUser.phone.replace(/(\d{2})\d{6}(\d{2})/, "$1******$2")
              : null,
          },
        },
        resp
      );
    }

    const email_otp = generateOTP();
    const phone_otp = generateOTP();
    const generatedPassword = generatePassword(10);

    const role = await Role.findOne({ name: "User" });

    const newUser = await User.create({
      name: contact_details.name || "Guest User",
      email: contact_details.email,
      phone: contact_details.phone,
      password: await hashPassword(generatedPassword),
      role: role ? role._id : null,
      email: contact_details.email,
      phone: contact_details.phone,
      is_email_verified: false,
      is_phone_verified: false,
      otp_for: "SIGNUP",
      status: "ACTIVE",
      otp: email_otp,
      otp_phone: phone_otp,
      otp_expires_at: moment().add(1, "minutes").toDate(),
    })

    const request = await ServiceRequest.create({
      ...payload,
      user: newUser._id,
    });

    setImmediate(async () => {
      await sendEmail({
        to: contact_details.email,
        subject: "Email OTP for Ask Service",
        html: `<p>Your email OTP is <b>${email_otp}</b>.</p>`,
      });

      console.log(`Generated password for ${contact_details.phone}: ${generatedPassword}`);
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