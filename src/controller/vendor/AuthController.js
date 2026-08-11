import moment from "moment";
import {
  comparePassword,
  generateOTP,
  generateOneMinToken,
  generate15minToken,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import handleResponse from "../../../utils/http-response.js";
import Role from "../../models/RoleModel.js";
import User from "../../models/UserModel.js";
import ServiceRequest from "../../models/ServiceRequestModel.js";
import normalizePath from "../../../utils/imageNormalizer.js";
import VendorCreditWallet from "../../models/VendorCreditWalletModel.js";
import ServiceCategory, {
  formatServiceCategoryImageUrl,
} from "../../models/ServiceCategoryModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";
import extractFiles from "../../../utils/extractNestedFiles.js";
import s3 from "../../../config/s3.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  cookieOptions,
  documentUploadCookieOptions,
  getServiceIds,
  hasServices,
  sanitizeObjectIdArray,
  sanitizeStringArray,
  vendorOwnsService,
  buildVendorLeadStatus,
  buildAvailableLeadDisplayStatus,
  maskVendorLeadContactDetails,
  normalizeFrenchPhone,
} from "../../../utils/helperFunction.js";
import {
  buildSoftDeletePayload,
  handleSoftDeletedAccountOnAuth,
  isAccountWithinDeletionGracePeriod,
  consumeShowWelcomeMsg,
} from "../../../utils/accountDeletion.js";
import { attachLeadStarFieldsToLead } from "../../../utils/questionPoints.js";
import Global from "../../models/GlobalModel.js";
import VendorDocument from "../../models/VendorDocumentModel.js";
import BusinessInformation from "../../models/BusinessInformationModel.js";
import VendorNotification from "../../models/vendorNotificationModel.js";
import VendorReview from "../../models/VendorReviewModel.js";
import Transaction from "../../models/TransactionModel.js";
import VendorLeadUnlock from "../../models/VendorLeadUnlockModel.js";
import VendorQuote from "../../models/VendorQuoteModel.js";
import { sendEmail } from "../../../config/emailConfig.js";
import bcrypt from "bcryptjs";
import { Parser as Json2CsvParser } from "json2csv";
import PDFDocument from "pdfkit";
import { drawPdfTable } from "../../../utils/pdfTable.js";
import verificationMail from "../../../config/email/verificationMail.js";
import vendorDocumentUploadedMail from "../../../config/email/vendorDocumentUploadedMail.js";
import {
  buildDocumentVerifiedByCategoryMap,
  getLeadDocumentCategoryId,
} from "../../../utils/vendorDocumentVerification.js";
import axios from "axios";
import { ifError } from "assert";

// register vendor
export const registerVendor = async (req, resp) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      business_name,
      fcm_token,
      service,
      siret,
      areas
    } = req.body;

    const normalizedPhone = phone ? normalizeFrenchPhone(phone) : null;

    const existingEmail = await User.findOne({ email });

    if (existingEmail)
      return handleResponse(
        400,
        "User already exists with this email",
        {},
        resp,
      );

    if (normalizedPhone) {
      const existingPhone = await User.findOne({ phone: normalizedPhone });
      if (existingPhone)
        return handleResponse(
          400,
          "User already exists with this phone",
          {},
          resp,
        );
    }

    const serviceIds = sanitizeObjectIdArray(service);
    if (!serviceIds.length) {
      return handleResponse(400, "At least one service is required", {}, resp);
    }

    const foundCount = await ServiceCategory.countDocuments({
      _id: { $in: serviceIds },
      deletedAt: null,
    });
    if (foundCount !== serviceIds.length) {
      return handleResponse(404, "One or more services not found", {}, resp);
    }

    const areaList = sanitizeStringArray(areas);
    if (!areaList.length) {
      return handleResponse(400, "At least one area is required", {}, resp);
    }

    const siretValue =
      siret !== undefined && siret !== null && String(siret).trim()
        ? String(siret).trim()
        : null;
  

    const hashedPassword = await hashPassword(password);
    let role = await Role.findOne({ name: "Vendor" });
    if (!role) {
      role = await Role.create({ name: "Vendor" });
    }

    const payload = {
      first_name,
      last_name,
      email,
      phone: normalizedPhone,
      password: hashedPassword,
      role: role._id,
      status: "ACTIVE",
      kyc_status: "PENDING",
      otp: generateOTP(),
      otp_phone: generateOTP(),
      otp_expires_at: moment().add(1, "minutes").toDate(),
      otp_phone_expiry_at: moment().add(1, "minutes").toDate(),
      otp_for: "SIGNUP",
      is_phone_verified: false,
      is_email_verified: false,
      is_vendor: true,
      fcm_token: fcm_token ? [fcm_token] : [],
      business_name,
      service: serviceIds,
      siret: siretValue,
      areas: areaList,
    };
    const user = await User.create(payload);

    await VendorCreditWallet.create({
      user_id: user._id,
      amount: 0,
    });

        await VendorNotification.create({
      user_id: user._id,
    });

    try {
      await sendEmail({
        to: user.email,
        subject: "Vérifiez votre adresse e-mail",
        html: await verificationMail(user.first_name, user.otp, {
          forVendor: true,
        }),
      });
    } catch (e) {
      console.log(e);
    }

    if (!user) return handleResponse(400, "Failed to create user", {}, resp);

    return handleResponse(201, "Vendor registered successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const NewPassword = async (req, res) => {
  const { password, confirm_password } = req.body;
  try {
    const requiredFields = [
      { field: "password", value: password },
      { field: "confirm_password", value: confirm_password },
    ];

    if (password == confirm_password) {
      const salt = await bcrypt.genSalt(10);
      const hasPassword = await bcrypt.hash(password, salt);

      await User.findByIdAndUpdate(req.user._id, {
        $set: {
          password: hasPassword,
        },
      });

      return handleResponse(200, "Password Changed Successfully", {}, res);
    } else {
      return handleResponse(
        400,
        "New password & confirm password does not match",
        {},
        res,
      );
    }
  } catch (e) {
    console.log(e);
    return handleResponse(500, e.message, {}, res);
  }
};

// resend otp
export const resendOTP = async (req, resp) => {
  try {
    const { identifier, identifierType, type } = req.body;

    if (!identifier || !identifierType || !type) {
      return handleResponse(
        400,
        "Identifier, identifier type and type are required",
        {},
        resp,
      );
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (identifierType === "EMAIL") {
      user.otp = generateOTP();
      user.otp_expires_at = moment().add(2, "minutes").toDate();

      console.log("us");

      try {
        await sendEmail({
          to: user.email,
          subject: "Vérifiez votre adresse e-mail",
          html: await verificationMail(user.first_name, user.otp, {
          forVendor: true,
        }),
        });
      } catch (e) {
        console.log(e);
      }
    } else {
      user.otp_phone = generateOTP();
      user.otp_phone_expiry_at = moment().add(2, "minutes").toDate();

      try {
        
        let msg = `Votre code de vérification est ${user.otp_phone}. Saisissez-le pour vérifier votre numéro de téléphone.`;

        const response = await axios.post(
          "https://rest.clicksend.com/v3/sms/send",
          {
            messages: [
              {
                source: "nodejs",
                from: "AskService",
                body: msg,
                to: user.phone?.startsWith("+")
                  ? user.phone
                  : `+${user.phone}`,
              },
            ],
          },
          {
            auth: {
              username: process.env.SMS_USERNAME,
              password: process.env.SMS_API,
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        console.log("SMS Response:", response.data);
      } catch (e) {
        console.log(e);
      }
    }

    user.otp_for = type;
    await user.save();
    return handleResponse(200, "Code sent successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// verify otp
export const verifyRegistrationOTP = async (req, resp) => {
  try {
    const { email, phone, otp_phone, otp_email, type } = req.body;
   

    let user;

    if (email) {
      user = await User.findOne({ email }).populate("role");
    } else if (phone) {
      user = await User.findOne({ phone: normalizeFrenchPhone(phone) }).populate(
        "role",
      );
    }

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "SIGNUP") {
      return handleResponse(400, "Invalid type", {}, resp);
    }
    let emailVerified = user.is_email_verified;
    let phoneVerified = user.is_phone_verified;

    if (otp_email) {
   

      if (user.otp != otp_email) {
        return handleResponse(401, "Invalid Email OTP", {}, resp);
      }
      // if (moment(user.otp_expires_at).isBefore(moment())) {
      //   return handleResponse(401, "Email Verification OTP expired", {}, resp);
      // }

      user.otp = null;
      user.otp_expires_at = null;
      user.is_email_verified = true;
      user.is_email_verified = true;
      emailVerified = true;
    }

    if (otp_phone) {
      if (user.otp_phone != otp_phone) {
        return handleResponse(401, "Invalid Phone OTP", {}, resp);
      }
      // if (moment(user.otp_phone_expiry_at).isBefore(moment())) {
      //   return handleResponse(401, "Phone Verification OTP expired", {}, resp);
      // }
      user.otp_phone = null;
      user.otp_phone_expiry_at = null;
      user.is_phone_verified = true;
      phoneVerified = true;
    }

    if (emailVerified && phoneVerified) {
      user.otp_for = null;
    }

    await user.save();

    if (emailVerified && phoneVerified) {
      const token = generate15minToken(user.toObject());
      await resp.cookie(
        "service-selection-document-upload",
        token,
        documentUploadCookieOptions,
      );
    }

    const fialResponse = {
      emailVerified,
      phoneVerified,
      userData: user.toObject(),
      token: generateToken(user.toObject()),
    };

    return handleResponse(
      200,
      "Code verified successfully",
      fialResponse,
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// login vendor
export const loginVendor = async (req, resp) => {
  try {
    const { identifier, password, fcm_token } = req.body;

    if (!identifier || !password) {
      return handleResponse(
        400,
        "Identifier and password are required",
        {},
        resp,
      );
    }

    const user = await User.findOne({
      $or: [{ phone: identifier }, { email: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const role = await Role.findById(user.role).select("id name");
    if (!role || role.name !== "Vendor") {
      return handleResponse(403, "Not a vendor account", {}, resp);
    }

    const isEmailLogin = user.email === identifier;

    if (isEmailLogin && !user.is_email_verified) {
      const otp = generateOTP();
      user.otp = otp;
      user.otp_for = "VERIFY_EMAIL";
      await user.save();

      await sendEmail({
        to: user.email,
        subject: "Code de vérification",
        html: await verificationMail(user.first_name, otp, { forVendor: true }),
      });

      return handleResponse(
        403,
        "Email verification required",
        { flow: "EMAIL_VERIFICATION_REQUIRED", role },
        resp,
      );
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return handleResponse(401, "Invalid credentials", {}, resp);
    }

    const softDeleteCheck = await handleSoftDeletedAccountOnAuth(user);
    if (!softDeleteCheck.ok) {
      return handleResponse(
        403,
        "Account has been permanently deleted",
        {},
        resp,
      );
    }
    const activeUser = softDeleteCheck.user;

    if (activeUser.status !== "ACTIVE") {
      return handleResponse(401, "Your account is not active", {}, resp);
    }

    if (fcm_token) {
      if (!Array.isArray(activeUser.fcm_token)) activeUser.fcm_token = [];
      if (!activeUser.fcm_token.includes(fcm_token)) {
        activeUser.fcm_token.push(fcm_token);
      }
      await activeUser.save();
    }

    const token = generateToken(activeUser.toObject());

    return handleResponse(
      200,
      softDeleteCheck.restored
        ? "Account restored successfully"
        : "Login successful",
      {
        flow: "LOGIN_SUCCESS",
        token,
        user: activeUser,
        role,
        account_restored: softDeleteCheck.restored,
      },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

/**
 * ACTIVE if every required ACTIVE document for the vendor's services is Verified.
 * Otherwise PENDING (missing upload, Pending, or Rejected).
 */
async function resolveVendorKycFromServiceDocuments(userId, serviceIds) {
  const ids = getServiceIds(serviceIds);
  if (!ids.length) return "PENDING";

  const requiredDocs = await ServiceDocumentRequirement.find({
    service_category: { $in: ids },
    status: "ACTIVE",
    deletedAt: null,
    is_required: true,
  })
    .select("_id")
    .lean();

  // No required docs for these services → nothing pending
  if (!requiredDocs.length) return "ACTIVE";

  const vendorDocs = await VendorDocument.find({
    user_id: userId,
    document_id: { $in: requiredDocs.map((d) => d._id) },
  })
    .select("document_id status")
    .lean();

  const verifiedIds = new Set(
    vendorDocs
      .filter((d) => d.status === "Verified")
      .map((d) => d.document_id.toString()),
  );

  const allVerified = requiredDocs.every((req) =>
    verifiedIds.has(req._id.toString()),
  );

  return allVerified ? "ACTIVE" : "PENDING";
}

// update Vendor Profile
export const updateVendorProfile = async (req, resp) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return handleResponse(401, "Unauthorized", {}, resp);
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      profile_pic,
      service,
      business_name,
      postal_code,
      address,
      city,
      vat_number,
      company_registration_number,
      years_of_activity,
      company_size,
      about_company,
      website_link,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;

    if (email !== undefined && email !== user.email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingEmail) {
        return handleResponse(409, "Email already in use", {}, resp);
      }

      user.email = email;
      user.is_email_verified = false;

      // user.otp = generateOTP();
      // user.otp_for = "VERIFY_EMAIL";

      // await sendEmail({
      //   to: email,
      //   subject: "Verification OTP",
      //   html: await verificationMail(user.first_name, user.otp),
      // });
    }

    if (phone !== undefined && phone !== user.phone) {

    const normalizedPhone = phone ? normalizeFrenchPhone(phone) : null;


      const existingPhone = await User.findOne({
        phone: normalizedPhone,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        return handleResponse(409, "Phone already in use", {}, resp);
      }

      user.phone = normalizedPhone;
      user.is_phone_verified = false;

      const otp = generateOTP();
      user.otp_phone = otp;
      // user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      // user.otp_for = "VERIFY_PHONE";

      try {
        let msg = `Votre code de vérification est ${otp}. Saisissez-le pour vérifier votre numéro de téléphone.`;


        const response = await axios.post(
          "https://rest.clicksend.com/v3/sms/send",
          {
            messages: [
              {
                source: "nodejs",
                from: "AskService",
                body: msg,
                to: `+${normalizedPhone}`,
              },
            ],
          },
          {
            auth: {
              username: process.env.SMS_USERNAME,
              password: process.env.SMS_API,
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        console.log("SMS Response:", response.data);
      } catch (e) {
        console.log(e);
      }
    }

    if (service !== undefined) {
      const serviceIds = sanitizeObjectIdArray(service);
      if (serviceIds.length) {
        const foundCount = await ServiceCategory.countDocuments({
          _id: { $in: serviceIds },
        });
        if (foundCount !== serviceIds.length) {
          return handleResponse(404, "One or more services not found", {}, resp);
        }
        user.service = serviceIds;
      } else {
        user.service = [];
      }
      // Do not recalculate / reset kyc_status when services change.
      // Per-category document gaps are exposed on leads as document_verified.
    }

    
      if (req.files &&  Array.isArray(req.files?.profile_pic) && req.files?.profile_pic.length > 0) { 
         user.profile_pic = req.files?.profile_pic?.[0]?.path || normalizePath(profile_pic) || null;
    }


    if (business_name !== undefined) user.business_name = business_name;
    if (address !== undefined) user.address = address;
    if (postal_code !== undefined) user.postal_code = postal_code;
    if (city !== undefined) user.city = city;
    if (vat_number !== undefined) user.vat_number = vat_number;
    if (company_registration_number !== undefined)
      user.company_registration_number = company_registration_number;
    if (years_of_activity !== undefined)
      user.years_of_activity = years_of_activity;
    if (company_size !== undefined) user.company_size = company_size;
    if (about_company !== undefined) user.about_company = about_company;
    if (website_link !== undefined) user.website_link = website_link;

    await user.save();

    return handleResponse(
      200,
      "Profile updated successfully",
      {
        flow: "PROFILE_UPDATED",
        email_verified: user.is_email_verified,
        phone_verified: user.is_phone_verified,
        kyc_status: user.kyc_status,
      },
      resp,
    );
  } catch (err) {
    console.log(err);
    
    return handleResponse(500, err.message, {}, resp);
  }
};

// change password
export const changePassword = async (req, resp) => {
  try {
    const { old_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }
    const isMatch = await comparePassword(old_password, user.password);

    if (!isMatch) {
      return handleResponse(401, "Invalid old password", {}, resp);
    }

    const hashedPassword = await hashPassword(new_password);
    user.password = hashedPassword;
    user.password_updateAt = new Date();
    await user.save();

    return handleResponse(200, "Password changed successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const deleteAccount = async (req, resp) => {
  try {
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return handleResponse(400, "Deletion reason is required", {}, resp);
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (user.deletedAt) {
      return handleResponse(
        200,
        "Account already scheduled for deletion",
        {
          restore_until: user.deletion_scheduled_at,
        },
        resp,
      );
    }

    const softDeletePayload = buildSoftDeletePayload(reason);
    Object.assign(user, softDeletePayload);
    // status intentionally unchanged
    await user.save();

    return handleResponse(
      200,
      "Account scheduled for deletion. Login within 15 days to restore it.",
      {
        deletedAt: softDeletePayload.deletedAt,
        restore_until: softDeletePayload.deletion_scheduled_at,
      },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get profile
export const getProfile = async (req, resp) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -otp -otp_phone")
      .populate("service", "id title description");

    if (!user) return handleResponse(404, "User not found", {}, resp);

    const show_welcome_msg = await consumeShowWelcomeMsg(user._id);
    const profile = user.toObject();
    profile.show_welcome_msg = show_welcome_msg;

    return handleResponse(200, "Profile fetched successfully", profile, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// forgot password
export const forgotPassword = async (req, resp) => {
  try {
    const { email, phone, type } = req.body;
    if (!email && !phone)
      return handleResponse(400, "Email or phone is required", {}, resp);

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) return handleResponse(404, "User not found", {}, resp);

    user.otp = generateOTP();
    user.otp_expires_at = moment().add(1, "minutes").toDate();
    user.otp_for = type;
    await user.save();
    return handleResponse(
      200,
      "Code sent successfully",
      { otp: user.otp },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// resend phone email OTP
export const resendPhoneEmailOTP = async (req, resp) => {
  try {
    const { phone, email, type } = req.body;
    if (!phone && !email) {
      return handleResponse(400, "Phone or email is required", {}, resp);
    }
    const user = await User.findOne({ $or: [{ phone }, { email }] });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }
    user.otp = generateOTP();
    user.otp_expires_at = moment().add(1, "minutes").toDate();
    user.otp_for = type;
    await user.save();
    return handleResponse(200, "Code sent successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// verify forgot password otp
export const verifyOTP = async (req, resp) => {
  try {
    const { email, phone, otp, type } = req.body;

    if (!email && !phone) {
      return handleResponse(400, "Email or phone is required", {}, resp);
    }

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "FORGOT_PASSWORD") {
      return handleResponse(400, "Invalid type", {}, resp);
    }

    if (user.otp != otp) {
      return handleResponse(401, "Invalid Code", {}, resp);
    }
    user.otp = null;
    user.otp_expires_at = null;
    user.otp_for = null;
    await user.save();

    const token = generateOneMinToken(user.toObject());
    await resp.cookie("forgot-password", token, cookieOptions);
    return handleResponse(200, "Code verified successfully", { token }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// reset password
export const resetPassword = async (req, resp) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return handleResponse(404, "User not found", {}, resp);
    user.password = await hashPassword(password);

    await user.save();

    return handleResponse(200, "Password reset successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};



export const getAllServices = async (req, resp) => {
  try {
    const services = await ServiceCategory.find({
      status: "ACTIVE",
      parent_category: null,
      deletedAt : null
    })
      .select("title image display_order")
      .sort({ display_order: 1, title: 1 });
    return handleResponse(200, "Services fetched successfully", services, resp);
    
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};



// get all services grouped by parent category
export const getAllServicesGroupedByParentCategory = async (req, resp) => {
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
        $addFields: {
          display_order: { $ifNull: ["$display_order", 999] },
        },
      },
      { $sort: { display_order: 1, title: 1 } },
      {
        $project: {
          title: 1,
          description: 1,
          image: 1,
          display_order: 1,
          options: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ["$options", []] },
                  as: "opt",
                  cond: { $eq: ["$$opt.status", "ACTIVE"] },
                },
              },
              as: "opt",
              in: {
                _id: "$$opt._id",
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
              $addFields: {
                display_order: { $ifNull: ["$display_order", 999] },
              },
            },
            { $sort: { display_order: 1, title: 1 } },
            {
              $project: {
                title: 1,
                description: 1,
                image: 1,
                credit: 1,
                company_credit: 1,
                display_order: 1,
                options: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $ifNull: ["$options", []] },
                        as: "opt",
                        cond: { $eq: ["$$opt.status", "ACTIVE"] },
                      },
                    },
                    as: "opt",
                    in: {
                      _id: "$$opt._id",
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

    const groupedServices = data.map((parent) => ({
      ...parent,
      image: formatServiceCategoryImageUrl(parent.image),
      child_categories: (parent.child_categories || []).map((child) => ({
        ...child,
        image: formatServiceCategoryImageUrl(child.image),
      })),
    }));

    return handleResponse(
      200,
      "Services fetched successfully",
      groupedServices,
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update user's service data
export const updateUserServiceData = async (req, resp) => {
  try {
    const { service } = req.body;
    const user = await User.findById(req?.user?._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const serviceIds = sanitizeObjectIdArray(service);
    if (!serviceIds.length) {
      return handleResponse(400, "At least one service is required", {}, resp);
    }

    const foundCount = await ServiceCategory.countDocuments({
      _id: { $in: serviceIds },
    });
    if (foundCount !== serviceIds.length) {
      return handleResponse(404, "One or more services not found", {}, resp);
    }

    user.service = serviceIds;
    await user.save();
    return handleResponse(200, "Service data updated successfully", user, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get service required document
export const getDocumentRequiredForService = async (req, resp) => {
  try {
    const user = req.user;
    const serviceIds = getServiceIds(user.service);
    if (!serviceIds.length) {
      return handleResponse(400, "Please select a service first", {}, resp);
    }

    const filter = {
      status: "ACTIVE",
      deletedAt: null,
    };

    const { service_category } = req.query;
    if (service_category) {
      const allowed = serviceIds.some(
        (id) => id.toString() === String(service_category),
      );
      if (!allowed) {
        return handleResponse(
          403,
          "Service non attribué à votre compte",
          {},
          resp,
        );
      }
      filter.service_category = service_category;
    } else {
      filter.service_category = { $in: serviceIds };
    }

    const documents = await ServiceDocumentRequirement.find(filter)
      .populate("service_category", "title")
      .sort({ display_order: 1, createdAt: 1 });

    return handleResponse(
      200,
      "Documents fetched successfully",
      { documents },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// upload document required for service (per document type by document_id)
export const updateDocumentRequiredForService = async (req, resp) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select(
      "service first_name last_name email",
    );
    if (!user) return handleResponse(404, "User not found", {}, resp);
    const serviceIds = getServiceIds(user.service);
    if (!serviceIds.length) {
      return handleResponse(400, "Please select a service first", {}, resp);
    }

    const requirements = await ServiceDocumentRequirement.find({
      service_category: { $in: serviceIds },
      status: "ACTIVE",
      deletedAt: null,
    }).lean();

    const requirementIds = new Set(requirements.map((r) => r._id.toString()));
    const requirementMap = new Map(
      requirements.map((r) => [r._id.toString(), r]),
    );

    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();
    if (!files.length) {
      return handleResponse(
        400,
        "No files uploaded. Send files with fieldname = document_id (ServiceDocumentRequirement _id).",
        {},
        resp,
      );
    }

    const normalizedPath = (p) => (p ? p.replace(/\\/g, "/") : null);
    const updated = [];

    console.log(files);

    for (const file of files) {
      const documentId = file.fieldname || file.document_id;
      const path = file.path ?? null;
      const originalname = file.originalname || null;

      if (!documentId || !path) continue;
      if (!requirementIds.has(documentId.toString())) {
        continue;
      }

      const requirement = requirementMap.get(documentId.toString());
      const docPayload = {
        user_id: userId,
        document_id: requirement._id,
        file: path,
        file_name: originalname || requirement.name,
        name: requirement.name,
        required: requirement.is_required || false,
        status: "Pending",
        rejection_reason: null,
      };

      const vendorDoc = await VendorDocument.findOneAndUpdate(
        { user_id: userId, document_id: requirement._id },
        { $set: docPayload },
        { new: true, upsert: true },
      );
      updated.push({
        document_id: vendorDoc.document_id,
        name: vendorDoc.name,
        status: vendorDoc.status,
        file_name: vendorDoc.file_name,
      });
    }

    if (updated.length) {
      try {
        const global = await Global.findOne().select(
          "email platformName marketplace_name",
        );
        let adminEmail =
          process.env.ADMIN_EMAIL ||
          global?.email ||
          process.env.EMAIL_USER ||
          process.env.EMAIL_FROM;

        const adminRole = await Role.findOne({ name: "Admin" });
        if (adminRole) {
          const admin = await User.findOne({ role: adminRole._id }).select(
            "email",
          );
          if (admin?.email) adminEmail = admin.email;
        }

        if (adminEmail) {
          const brandName =
            global?.platformName || global?.marketplace_name || "Ask Service";
          const vendorName =
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Prestataire";

          await sendEmail({
            to: adminEmail,
            subject: `[${brandName}] Documents prestataire à vérifier — ${vendorName}`,
            replyTo: user.email || undefined,
            html: await vendorDocumentUploadedMail({
              vendorName,
              vendorEmail: user.email,
              documents: updated,
              uploadedAt: new Date().toLocaleString("fr-FR"),
            }),
            from: process.env.CONTACT_EMAIL || process.env.EMAIL_FROM,
          });
        } else {
          console.log(
            "Vendor document upload admin email skipped: no admin email configured",
          );
        }
      } catch (mailErr) {
        console.log(
          "Vendor document upload admin email failed:",
          mailErr?.message || mailErr,
        );
      }
    }

    return handleResponse(
      200,
      "Documents updated successfully",
      { uploaded: updated },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

function splitServiceCategoryWithParent(serviceCategory) {
  if (!serviceCategory) {
    return { service_category: null, parent_service_category: null };
  }
  const { parent_category, ...category } = serviceCategory;
  return {
    service_category: category,
    parent_service_category: parent_category || null,
  };
}

const availableLeadsServiceCategoryPopulate = {
  path: "service_category",
  select: "title credit company_credit image description parent_category",
  populate: {
    path: "parent_category",
    select: "title image description",
    match: { deletedAt: null, status: "ACTIVE" },
  },
};





export const availableLeads = async (req, resp) => {
  try {
    const vendorId = req?.user?._id;
    const { city, state, country, sort, service, unlocked } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    let filter = {
      deletedAt: null,
      status: "ACTIVE",
    };

    const vendorServiceIds = getServiceIds(req?.user?.service);
    if (!service && !vendorServiceIds.length) {
      return handleResponse(
        200,
        "leads",
        { items: [], total: 0, page, limit, totalPages: 0 },
        resp,
      );
    }

    if (service) {
      if (vendorServiceIds.length && !vendorOwnsService(req.user.service, service)) {
        return handleResponse(
          403,
          "Service non attribué à votre compte",
          {},
          resp,
        );
      }
      filter.service_category = service;
    } else if (vendorServiceIds.length) {
      filter.service_category = { $in: vendorServiceIds };
    }
    if (city) filter.city = city;
    if (state) filter.state = state;
    if (country) filter.country = country;

    // ?unlocked=true → only leads this vendor has unlocked; ?unlocked=false → only locked leads
    if (vendorId && unlocked !== undefined && unlocked !== "") {
      const unlockedLeadIds = await VendorLeadUnlock.find({
        vendor_id: vendorId,
      }).distinct("service_request_id");
      const u = String(unlocked).toLowerCase();
      if (u === "true") {
        filter._id = { $in: unlockedLeadIds };
      } else if (u === "false") {
        if (unlockedLeadIds.length > 0) {
          filter._id = { $nin: unlockedLeadIds };
        }
      }
    }

    let sortOption = {};

    if (sort === "newest") {
      sortOption.createdAt = -1;
    }

    if (sort === "oldest") {
      sortOption.createdAt = 1;
    }

    // default sort
    if (!sort) {
      sortOption.createdAt = -1;
    }

    const sortByCreditInMemory =
      sort === "high_to_low" || sort === "low_to_high";

    let leads;
    let total;

    if (sortByCreditInMemory) {
      const allLeads = await ServiceRequest.find(filter)
        .populate(availableLeadsServiceCategoryPopulate)
        .sort({ createdAt: -1 })
        .lean();

      if (sort === "high_to_low") {
        allLeads.sort(
          (a, b) =>
            (b.service_category?.credit || 0) - (a.service_category?.credit || 0),
        );
      } else {
        allLeads.sort(
          (a, b) =>
            (a.service_category?.credit || 0) - (b.service_category?.credit || 0),
        );
      }

      total = allLeads.length;
      leads = allLeads.slice(skip, skip + limit);
    } else {
      total = await ServiceRequest.countDocuments(filter);
      leads = await ServiceRequest.find(filter)
        .populate(availableLeadsServiceCategoryPopulate)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const leadObjectIds = leads.map((l) => l._id);
    const [unlockedLeadIds, vendorQuotes, quoteCounts, prosConsultedCounts, globalSettings] =
      await Promise.all([
      vendorId
        ? VendorLeadUnlock.find({
            vendor_id: vendorId,
            service_request_id: { $in: leadObjectIds },
          }).distinct("service_request_id")
        : Promise.resolve([]),
      vendorId
        ? VendorQuote.find({
            vendor_id: vendorId,
            service_request_id: { $in: leadObjectIds },
          })
            .select("_id service_request_id status")
            .lean()
        : Promise.resolve([]),
      VendorQuote.aggregate([
        { $match: { service_request_id: { $in: leadObjectIds }, status: "SENT" } },
        { $group: { _id: "$service_request_id", count: { $sum: 1 } } },
      ]),
      VendorLeadUnlock.aggregate([
        { $match: { service_request_id: { $in: leadObjectIds } } },
        { $group: { _id: "$service_request_id", count: { $sum: 1 } } },
      ]),
      Global.findOne().select("quote_limit").lean(),
    ]);

    const unlockedIds = new Set(
      unlockedLeadIds?.map((id) => id.toString()) || [],
    );
    const vendorQuotesByLeadId = new Map(
      vendorQuotes.map((q) => [q.service_request_id.toString(), q]),
    );
    const quotesCountMap = new Map(
      quoteCounts.map((q) => [q._id.toString(), q.count]),
    );
    const prosConsultedCountMap = new Map(
      prosConsultedCounts.map((q) => [q._id.toString(), q.count]),
    );
    const strongQuotesThreshold = globalSettings?.quote_limit ?? 5;

    const categoryIdsForDocs = leads.map((lead) => getLeadDocumentCategoryId(lead));
    const documentVerifiedMap = await buildDocumentVerifiedByCategoryMap(
      vendorId,
      categoryIdsForDocs,
    );

    const leadsWithMasking = leads.map((lead) => {
      const leadId = lead._id.toString();
      const unlocked = unlockedIds.has(leadId);
      const { service_category, parent_service_category } =
        splitServiceCategoryWithParent(lead.service_category);
      const creditsToUnlock =
      lead?.computed_point == null || lead?.computed_point < 1
      ? lead.contact_details?.client_type == "Individual"
          ? service_category?.credit || 3
          : service_category?.company_credit || 3
        : lead?.computed_point ;

      const quotesCount = quotesCountMap.get(leadId) || 0;
      const prosConsultedCount = prosConsultedCountMap.get(leadId) || 0;
      const leadStatusMeta = buildAvailableLeadDisplayStatus({
        unlocked,
        vendorQuote: vendorQuotesByLeadId.get(leadId),
        quotesCount,
        prosConsultedCount,
        strongQuotesThreshold,
      });

      const categoryId = getLeadDocumentCategoryId(lead);
      const document_verified = categoryId
        ? (documentVerifiedMap.get(categoryId) ?? true)
        : true;

      const baseLead = {
        ...lead,
        service_category,
        parent_service_category,
        request_status: lead.status,
        ...leadStatusMeta,
        ...attachLeadStarFieldsToLead(lead),
        unlocked,
        creditsToUnlock,
        quotes_count: quotesCount,
        document_verified,
      };

      if (unlocked) return baseLead;

      return {
        ...baseLead,
        contact_details: maskVendorLeadContactDetails(lead.contact_details),
      };
    });

    const totalPages = Math.ceil(total / limit) || 0;

    return handleResponse(
      200,
      "leads",
      {
        items: leadsWithMasking,
        total,
        page,
        limit,
        totalPages,
      },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};




export const singleService = async (req, resp) => {
  try {
    const leads = await ServiceRequest.findById(req.params.id)
      .populate({
        path: "service_category",
        select: "title credit",
      })
      .lean();

    if (!leads) {
      return handleResponse(404, "service not found", {}, resp);
    }

    return handleResponse(200, "service", leads, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const createUpdateBusinessInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      business_name,
      owner_name,
      service_category,
      email,
      phone,
      business_address,
      postcode,
      city,
      vat_number,
      company_registration_number,
      years_of_activity,
      company_size,
      about_company,
      website_link,
    } = req.body;

    if (!business_name || !business_address || !postcode || !city) {
      return handleResponse(400, "Required fields are missing", {}, res);
    }

    if (service_category !== undefined) {
      const serviceIds = sanitizeObjectIdArray(service_category);
      if (serviceIds.length) {
        const foundCount = await ServiceCategory.countDocuments({
          _id: { $in: serviceIds },
        });
        if (foundCount !== serviceIds.length) {
          return handleResponse(404, "One or more services not found", {}, res);
        }
        await User.findByIdAndUpdate(userId, { service: serviceIds });
      } else {
        await User.findByIdAndUpdate(userId, { service: [] });
      }
    }

    const business = await BusinessInformation.findOneAndUpdate(
      { user_id: userId },
      {
        business_name,
        owner_name,
        service_category,
        email,
        phone,
        business_address,
        postcode,
        city,
        vat_number,
        company_registration_number,
        years_of_activity,
        company_size,
        about_company,
        website_link,
      },
      { new: true, upsert: true },
    );

    return handleResponse(
      200,
      "Business information saved successfully",
      business,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const getBusinessInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const business = await BusinessInformation.findOne({
      user_id: userId,
      deletedAt: null,
    })
      .populate({
        path: "user_id",
        select: "-password -otp",
        populate: {
          path: "service",
          model: "ServiceCategory",
          select: "title credit description image",
        },
      })
      .lean();

    if (!business) {
      return handleResponse(404, "Business information not found", {}, res);
    }

    return handleResponse(
      200,
      "Business information fetched successfully",
      business,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const saveNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const preferences = await VendorNotification.findOneAndUpdate(
      { user_id: userId },
      { ...req.body },
      { new: true, upsert: true },
    );

    return handleResponse(
      200,
      "Notification preferences saved successfully",
      preferences,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const GoogleLogin = async (req, res) => {
  try {
    const users = req.user;
    const { role } = req.body;

    if (!users) {
      return handleResponse(401, "Unauthorized user", {}, res);
    }

    

    let firstName = "First";
    let lastName = "Last";

    if (users.name) {
      const name = users.name.split(" ");
      firstName = name[0];
      lastName = name[1] || "Last";
    }

    const requiredFields = [
      { field: "first_name", value: firstName },
      { field: "last_name", value: lastName },
      { field: "email", value: users.email },
      { field: "device_id", value: users.uid },
    ];

    // const validationErrors = validateFields(requiredFields);
    // if (validationErrors.length > 0) {
    //   return handleResponse(
    //     400,
    //     "Validation error",
    //     { errors: validationErrors },
    //     res
    //   );
    // }

    let user = await User.findOne({
      email: users.email,
    });

    //   const role = await Role.findOne({ user_id: user.id });

    const password = Math.floor(
      1000000000 * Math.random() * 9000000000,
    ).toString();

    const salt = await bcrypt.genSalt(10);
    const hasPassword = await bcrypt.hash(password, salt);
    if (!user) {
      user = new User({
        first_name: firstName,
        last_name: lastName,
        email: users.email,
        device_id: users.uid,
        password: hasPassword,
        is_email_verified: true,
      });
      await user.save();
    }

    const softDeleteCheck = await handleSoftDeletedAccountOnAuth(user);
    if (!softDeleteCheck.ok) {
      return handleResponse(
        403,
        "Account has been permanently deleted",
        {},
        res,
      );
    }
    user = softDeleteCheck.user;

    if (!user.is_phone_verified) {
      const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(20, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
      await user.save();

      return handleResponse(
        403,
        "Phone verification required",
        { flow: "PHONE_VERIFICATION_REQUIRED" },
        res,
      );
    }

    const token = jwt.sign(
      {
        userID: user._id,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" },
    );

    return handleResponse(
      200,
      softDeleteCheck.restored
        ? "Account restored successfully"
        : "Login successful",
      { token, account_restored: softDeleteCheck.restored },
      res,
    );
  } catch (e) {
    console.log("e", e);

    return handleResponse(500, e.message, {}, res);
  }
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    let preferences = await VendorNotification.findOne({
      user_id: userId,
    }).lean();

    // If not exists → create default
    if (!preferences) {
      preferences = await VendorNotification.create({
        user_id: userId,
      });
    }

    return handleResponse(
      200,
      "Notification preferences fetched successfully",
      preferences,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const VerificationDocument = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("service").lean();
    if (!user) return handleResponse(404, "User not found", {}, res);

    const serviceIds = getServiceIds(user.service);
    if (!serviceIds.length) {
      return handleResponse(200, "Documents fetched successfully", { documents: [] }, res);
    }

    const generatePresignedUrl = async (filePath, expiry = 60 * 60) => {
      if (!filePath) return null;
      if (/^https?:\/\//i.test(filePath)) return filePath;
      const key = String(filePath).replace(/^\/+/, "").replace(/\\/g, "/");
      const privateBucket = process.env.S3_BUCKET_PRIVATE || "private";
      const objectKey = key.startsWith("private/")
        ? key.replace(/^private\//, "")
        : key;
      return getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: privateBucket, Key: objectKey }),
        { expiresIn: expiry },
      );
    };

    const requirements = await ServiceDocumentRequirement.find({
      service_category: { $in: serviceIds },
      status: "ACTIVE",
      deletedAt: null,
    })
      .populate("service_category", "title")
      .sort({ display_order: 1, createdAt: 1 })
      .lean();

    const vendorDocs = await VendorDocument.find({ user_id: userId }).lean();
    const docByRequirement = new Map(
      vendorDocs.map((d) => [d.document_id.toString(), d]),
    );

    const documents = await Promise.all(
      requirements.map(async (reqItem) => {
        const uploaded = docByRequirement.get(reqItem._id.toString());
        const status = uploaded ? uploaded.status : "Not uploaded";
        return {
          document_id: reqItem._id,
          service_category: reqItem.service_category,
          name: reqItem.name,
          description: reqItem.description || null,
          allowed_formats: reqItem.allowed_formats || "PDF, JPG, PNG (Max 5MB)",
          type: reqItem.type,
          is_required: reqItem.is_required,
          status,
          file: uploaded
            ? {
                path: uploaded.file,
                file_name: uploaded.file_name || uploaded.name,
                url: uploaded.file
                  ? await generatePresignedUrl(uploaded.file)
                  : null,
              }
            : null,
          uploadedAt: uploaded?.updatedAt || null,
        };
      }),
    );

    return handleResponse(
      200,
      "Documents fetched successfully",
      { documents },
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const allReviews = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all reviews
    const reviews = await VendorReview.find({
      vendor: userId,
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

    return handleResponse(
      200,
      "Reviews fetched successfully",
      {
        averageRating: Number(averageRating),
        totalReviews,
        ratingDistribution,
        reviews,
      },
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

// Format date as "DD mois YYYY, HH:MM" for Payment History (French locale)
function formatTransactionDateTime(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const datePart = d
    .toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${datePart}, ${hours}:${minutes}`;
}

// Mask payment method e.g. "Visa 4532" -> "Visa **** 4532"
function maskPaymentMethod(method) {
  if (!method || typeof method !== "string") return null;
  const trimmed = method.trim();
  if (trimmed.length <= 4) return "**** " + trimmed;
  const last4 = trimmed.slice(-4);
  const brand = trimmed.slice(0, -4).replace(/\d/g, "").trim() || "Card";
  return `${brand} **** ${last4}`;
}

// Generate transaction ID for display (TXN-YYYY-NNNNN)
function toTransactionId(transaction_number, _id, createdAt) {
  if (transaction_number) return transaction_number;
  if (!_id || !createdAt) return null;
  const year = new Date(createdAt).getFullYear();
  const num = parseInt(_id.toString().slice(-5), 16) % 100000;
  return `TXN-${year}-${String(num).padStart(5, "0")}`;
}

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      from_date,
      to_date,
      status,
      period, // last_30_days | last_3_months | last_6_months
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { user_id: userId };

    // Status filter: all | completed | failed | refunded
    if (status && status.toLowerCase() !== "all") {
      filter.status = status.toLowerCase();
    }

    let startDate, endDate;
    if (period) {
      const now = new Date();
      endDate = new Date(now);
      startDate = new Date(now);
      const p = (typeof period === "string" ? period : "").toLowerCase();
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

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const baseUrl = process.env.BASE_URL || "";
    const list = transactions.map((t) => ({
      _id: t._id,
      transaction_id: toTransactionId(t.transaction_number, t._id, t.createdAt),
      date_time: formatTransactionDateTime(t.createdAt),
      payment_method:
       t.payment_method ||
        (t.plat_form === "manual" ? null : t.plat_form),
      amount_paid: t.amount_paid != null ? t.amount_paid : null,
      currency: t.currency || "EUR",
      credit_added:
        t.type === "credit" && t.amount != null ? `+${t.amount} crédits` : null,
      status: t.status
        ? t.status.charAt(0).toUpperCase() + t.status.slice(1)
        : "Pending",
      receipt_url: baseUrl
        ? `${baseUrl}/api/vendor/transactions/${t._id}/receipt`
        : null,
      description: t.description,
    }));

    return handleResponse(
      200,
      "Transactions fetched successfully",
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        transactions: list,
      },
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const exportTransactionsCsv = async (req, res) => {
  try {
    const userId = req.user._id;
    const { from_date, to_date, status, period } = req.query;

    const filter = { user_id: userId };

    if (status && status.toLowerCase() !== "all") {
      filter.status = status.toLowerCase();
    }

    let startDate;
    let endDate;
    if (period) {
      const now = new Date();
      endDate = new Date(now);
      startDate = new Date(now);
      const p = (typeof period === "string" ? period : "").toLowerCase();
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

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const rows = transactions.map((t) => ({
      id: t._id?.toString(),
      transaction_id: toTransactionId(t.transaction_number, t._id, t.createdAt),
      date_time: formatTransactionDateTime(t.createdAt),
      payment_method:
       t.payment_method ||
        (t.plat_form === "manual" ? null : t.plat_form),
      amount_paid: t.amount_paid != null ? t.amount_paid : "",
      currency: t.currency || "EUR",
      credit_added:
        t.type === "credit" && t.amount != null ? `+${t.amount} credits` : "",
      status: t.status
        ? t.status.charAt(0).toUpperCase() + t.status.slice(1)
        : "Pending",
      description: t.description || "",
    }));

    const parser = new Json2CsvParser({
      fields: [
        "id",
        "transaction_id",
        "date_time",
        "payment_method",
        "amount_paid",
        "currency",
        "credit_added",
        "status",
        "description",
      ],
    });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="transactions.csv"',
    );
    return res.status(200).send(csv);
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

/** Split table rows across pages so PDFKit does not draw past the page bottom. */
function paginateTransactionPdfRows(doc, allRows, headerHeight, rowHeight) {
  if (allRows.length === 0) return [[]];
  const bottom = doc.page.margins?.bottom ?? 40;
  const top = doc.page.margins?.top ?? 40;
  const safety = 14;

  const availableFirst = doc.page.height - doc.y - bottom - safety;
  const rowsFirst = Math.max(
    1,
    Math.floor((availableFirst - headerHeight) / rowHeight),
  );

  const availableRest = doc.page.height - top - bottom - safety;
  const rowsRest = Math.max(
    1,
    Math.floor((availableRest - headerHeight) / rowHeight),
  );

  const chunks = [];
  let offset = 0;
  const n1 = Math.min(rowsFirst, allRows.length);
  chunks.push(allRows.slice(0, n1));
  offset = n1;
  while (offset < allRows.length) {
    const take = Math.min(rowsRest, allRows.length - offset);
    chunks.push(allRows.slice(offset, offset + take));
    offset += take;
  }
  return chunks;
}

export const exportTransactionsPdf = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const { from_date, to_date, status, period } = req.query;

    const filter = { user_id: userId };

    if (status && status.toLowerCase() !== "all") {
      filter.status = status.toLowerCase();
    }

    let startDate;
    let endDate;
    if (period) {
      const now = new Date();
      endDate = new Date(now);
      startDate = new Date(now);
      const p = (typeof period === "string" ? period : "").toLowerCase();
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

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="transactions.pdf"',
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Transactions", { align: "center" });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(10);

    if (transactions.length === 0) {
      doc.fontSize(11).text("No transactions found for this period.", {
        align: "center",
      });
      doc.end();
      return;
    }

    const headers = [
      "Transaction ID",
      "Date/Time",
      "Payment",
      "Amount",
      "Currency",
      "Credits",
      "Status",
    ];
    // Sum 532 (A4 content width @ 40pt margins). Currency column widened so "Currency" fits in header.
    const columnWidths = [88, 78, 62, 58, 54, 72, 120];
    const rows = transactions.map((t) => [
      toTransactionId(t.transaction_number, t._id, t.createdAt) || "",
      formatTransactionDateTime(t.createdAt) || "",
      t.payment_method ||
        (t.plat_form === "manual" ? "" : t.plat_form) ||
        "",
      t.amount_paid != null ? String(t.amount_paid) : "",
      t.currency || "EUR",
      t.type === "credit" && t.amount != null ? `+${t.amount} credits` : "",
      t.status
        ? t.status.charAt(0).toUpperCase() + t.status.slice(1)
        : "Pending",
    ]);

    const headerHeight = 24;
    const rowHeight = 20;
    const rowChunks = paginateTransactionPdfRows(
      doc,
      rows,
      headerHeight,
      rowHeight,
    );

    rowChunks.forEach((chunk, pageIndex) => {
      if (pageIndex > 0) {
        doc.addPage();
        doc.font("Helvetica").fontSize(10);
      }
      drawPdfTable(doc, {
        headers,
        rows: chunk,
        columnWidths,
        headerHeight,
        rowHeight,
      });
    });

    doc.end();
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};
