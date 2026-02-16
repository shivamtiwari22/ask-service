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
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";
import extractFiles from "../../../utils/extractNestedFiles.js";
import {
  cookieOptions,
  documentUploadCookieOptions,
} from "../../../utils/helperFunction.js";

// register vendor
export const registerVendor = async (req, resp) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;

    const existingEmail = await User.findOne({ email });

    if (existingEmail)
      return handleResponse(
        400,
        "User already exists with this email",
        {},
        resp,
      );

    const existingPhone = await User.findOne({ phone });
    if (existingPhone)
      return handleResponse(
        400,
        "User already exists with this phone",
        {},
        resp,
      );

    const hashedPassword = await hashPassword(password);
    const role = await Role.findOne({ name: "Vendor" });

    const payload = {
      first_name,
      last_name,
      email,
      phone,
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
    };
    const user = await User.create(payload);

    await VendorCreditWallet.create({
      user_id: user._id,
      amount: 0,
    });

    if (!user) return handleResponse(400, "Failed to create user", {}, resp);

    return handleResponse(
      201,
      "Vendor registered successfully",
      { user },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
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
      user.otp_expires_at = moment().add(1, "minutes").toDate();
    } else {
      user.otp_phone = generateOTP();
      user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
    }

    user.otp_for = type;
    await user.save();
    return handleResponse(
      200,
      "OTP sent successfully",
      { otp: user.otp },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// verify otp
export const verifyRegistrationOTP = async (req, resp) => {
  try {
    const { email, phone, otp_phone, otp_email, type } = req.body;

    const user = await User.findOne({ email, phone });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "SIGNUP") {
      return handleResponse(400, "Invalid type", {}, resp);
    }
    let emailVerified = user.is_email_verified;
    let phoneVerified = user.is_phone_verified;

    if (!emailVerified) {
      if (user.otp != otp_email) {
        return handleResponse(401, "Invalid Email OTP", {}, resp);
      }
      if (moment(user.otp_expires_at).isBefore(moment())) {
        return handleResponse(401, "Email Verification OTP expired", {}, resp);
      }

      user.otp = null;
      user.otp_expires_at = null;
      user.is_email_verified = true;
      user.is_email_verified = true;
      emailVerified = true;
    }

    if (!phoneVerified) {
      if (user.otp_phone != otp_phone) {
        return handleResponse(401, "Invalid Phone OTP", {}, resp);
      }
      if (moment(user.otp_phone_expiry_at).isBefore(moment())) {
        return handleResponse(401, "Phone Verification OTP expired", {}, resp);
      }
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
    };

    return handleResponse(200, "OTP verified successfully", fialResponse, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// login vendor
export const loginVendor = async (req, resp) => {
  try {
    const { identifier, password, identifierType, type } = req.body;
    if (!identifier || !identifierType || !type) {
      return handleResponse(
        400,
        "Identifier, password, identifier type and type are required",
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

    let emailVerified = user.is_email_verified;
    let phoneVerified = user.is_phone_verified;

    if (type == "OTP") {
      if (emailVerified && phoneVerified && user.status == "ACTIVE") {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(1, "minutes").toDate();
        user.otp_for = "LOGIN";
        await user.save();

        const fialResponse = {
          flow: "OTP_LOGIN",
          emailVerified,
          phoneVerified,
          userData: user.toObject(),
        };
        return handleResponse(
          200,
          "OTP Send Successfully for login",
          fialResponse,
          resp,
        );
      }

      if (!emailVerified) {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(1, "minutes").toDate();
      }
      if (!phoneVerified) {
        user.otp_phone = generateOTP();
        user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
      }
      user.otp_for = "SIGNUP";

      if (user.status !== "ACTIVE") {
        return handleResponse(401, "Your account is not active", {}, resp);
      }

      await user.save();

      const fialResponse = {
        emailVerified,
        phoneVerified,
        userData: user.toObject(),
        flow: "EMAIL_AND_PHONE_VERIFICATION_LOGIN",
      };

      return handleResponse(
        200,
        "OTP Send Successfully for verification",
        fialResponse,
        resp,
      );
    } else {
      const isPasswordMatch = await comparePassword(password, user.password);
      if (!isPasswordMatch) {
        return handleResponse(401, "Invalid password", {}, resp);
      }
      if (emailVerified && phoneVerified && user.status == "ACTIVE") {
        const token = generateToken(user.toObject());

        const fialResponse = {
          flow: "PASSWORD_LOGIN",
          emailVerified,
          phoneVerified,
          userData: user.toObject(),
          token,
        };
        return handleResponse(200, "Login Successful", fialResponse, resp);
      }

      if (!user.service) {
        const token = generate15minToken(user.toObject());
        await resp.cookie("forgot-password", token, cookieOptions);
        return handleResponse(
          401,
          "Please select a service",
          { flow: "SERVICE_SELECTION" },
          resp,
        );
      }
      if (user.status !== "ACTIVE") {
        return handleResponse(401, "Your account is not active", {}, resp);
      }

      if (!emailVerified) {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(1, "minutes").toDate();
      }
      if (!phoneVerified) {
        user.otp_phone = generateOTP();
        user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
      }
      user.otp_for = "SIGNUP";
      await user.save();
      const fialResponse = {
        emailVerified,
        phoneVerified,
        userData: user.toObject(),
        flow: "EMAIL_AND_PHONE_VERIFICATION_LOGIN",
      };

      return handleResponse(
        200,
        "OTP Send Successfully for verification",
        fialResponse,
        resp,
      );
    }
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update Vendor Profile
export const updateVendorProfile = async (req, resp) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return handleResponse(401, "Unauthorized", {}, resp);
    }

    const { first_name, last_name, email, phone, profile_pic, service } =
      req.body;

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

      const newToken = crypto.randomBytes(32).toString("hex");
      user.email_verification_token = newToken;

      const link = `${process.env.BASE_URL}/api/user/verify-email?token=${newToken}`;

      // await sendEmail({
      //   to: email,
      //   subject: "Verify your email",
      //   html: `<p>Click below to verify your email:</p>
      //          <a href="${link}">${link}</a>`,
      // });
    }

    if (phone !== undefined && phone !== user.phone) {
      const existingPhone = await User.findOne({
        phone,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        return handleResponse(409, "Phone already in use", {}, resp);
      }

      user.phone = phone;
      user.is_phone_verified = false;

      const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
    }

    if (service !== undefined) {
      const service = await ServiceRequest.findById(service);
      if (!service) {
        return handleResponse(404, "Service not found", {}, resp);
      }
      user.service = service._id;
    }

    user.profile_pic =
      req.files?.profile_pic?.[0]?.path || normalizePath(profile_pic) || null;

    await user.save();

    return handleResponse(
      200,
      "Profile updated successfully",
      {
        flow: "PROFILE_UPDATED",
        email_verified: user.is_email_verified,
        phone_verified: user.is_phone_verified,
      },
      resp,
    );
  } catch (err) {
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
    await user.save();
    return handleResponse(200, "Password changed successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get profile
export const getProfile = async (req, resp) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return handleResponse(404, "User not found", {}, resp);
    return handleResponse(200, "Profile fetched successfully", user, resp);
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
      "OTP sent successfully",
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
    return handleResponse(200, "OTP sent successfully", {}, resp);
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
      return handleResponse(401, "Invalid OTP", {}, resp);
    }
    user.otp = null;
    user.otp_expires_at = null;
    user.otp_for = null;
    await user.save();

    const token = generateOneMinToken(user.toObject());
    await resp.cookie("forgot-password", token, cookieOptions);
    return handleResponse(200, "OTP verified successfully", { token }, resp);
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

// get all services
export const getAllServices = async (req, resp) => {
  try {
    const services = await ServiceCategory.find({
      status: "ACTIVE",
      parent_category: null,
    }).select("title image");

    return handleResponse(200, "Services fetched successfully", services, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update user's service data
export const updateUserServiceData = async (req, resp) => {
  try {
    const { service } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    user.service = service;
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
    const service = await ServiceCategory.findById(user.service);
    if (!service) {
      return handleResponse(404, "Service not found", {}, resp);
    }
    const documents = await ServiceDocumentRequirement.find({
      service_category: service._id,
    });
    return handleResponse(
      200,
      "Documents fetched successfully",
      documents,
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// upload document required for service
export const updateDocumentRequiredForService = async (req, resp) => {
  try {
    const files = extractFiles(req.files);
    const user = await User.findById(req.user._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }
    const documentRequired = await ServiceDocumentRequirement.findById(
      user.service,
    );

    const vendorUploadedDocument = documentRequired?.map((item) => {
      const document = Object.keys(files).find(
        (key) => key === item?._id?.toString(),
      );
      return {
        user_id: req.user._id,
        document_id: item?._id,
        file: document?.path || null,
        name: item?.name || null,
        required: item?.is_required || false,
        type: item?.type || null,
      };
    });

    await VendorDocument.insertMany(vendorUploadedDocument);

    return handleResponse(200, "Documents updated successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};
