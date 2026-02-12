import User from "../../models/UserModel.js";
import handleResponse from "../../../utils/http-response.js";
import {
  comparePassword,
  generateOTP,
  generateOneMinToken,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import Role from "../../models/RoleModel.js";
import moment from "moment";
import crypto from "crypto";
import { sendEmail } from "../../../config/emailConfig.js";
import { cookieOptions } from "../../../utils/helperFunction.js";
import VendorCreditWallet from "../../models/VendorCreditWalletModel.js";

// SIGNUP
export const signup = async (req, resp) => {
  try {
    const { first_name, last_name, phone, email, password } = req.body;

    if (!phone || !password) {
      return handleResponse(400, "Phone and password are required", {}, resp);
    }

    const existingUser = await User.findOne({
      $or: [{ phone }, ...(email ? [{ email }] : [])],
    });

    if (existingUser) {
      return handleResponse(409, "User already exists", {}, resp);
    }

    const role = await Role.findOne({ name: "User" });

    const phoneOtp = generateOTP();
    const emailToken = email ? crypto.randomBytes(32).toString("hex") : null;

    await User.create({
      first_name,
      last_name,
      phone,
      email: email || null,
      password: await hashPassword(password),
      role: role._id,
      status: "ACTIVE",
      is_phone_verified: false,
      is_email_verified: false,
      phone_otp: phoneOtp,
      phone_otp_expiry: moment().add(5, "minutes").toDate(),
      email_verification_token: emailToken,
    });

    await VendorCreditWallet.create({
      user_id: user._id,
    });

    if (email) {
      const link = `${process.env.BASE_URL}/api/user/verify-email?token=${emailToken}`;

      await sendEmail({
        to: email,
        subject: "Verify your email",
        html: `<p>Click below to verify your email:</p>
               <a href="${link}">${link}</a>`,
      });
    }

    return handleResponse(
      201,
      "Signup successful. Verify phone to continue.",
      { flow: "PHONE_VERIFICATION_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// VERIFY PHONE
export const verifyPhone = async (req, resp) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return handleResponse(400, "Phone and OTP are required", {}, resp);
    }

    const user = await User.findOne({ phone });
    if (!user) return handleResponse(404, "User not found", {}, resp);

    if (
      !user.phone_otp ||
      !user.phone_otp_expiry ||
      moment().isAfter(user.phone_otp_expiry)
    ) {
      return handleResponse(400, "OTP expired", {}, resp);
    }

    if (user.phone_otp !== otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }

    user.is_phone_verified = true;
    user.phone_otp = null;
    user.phone_otp_expiry = null;

    await user.save();

    return handleResponse(200, "Phone verified successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

//  VERIFY EMAIL (LINK BASED)
export const verifyEmail = async (req, resp) => {
  try {
    const { token } = req.query;

    if (!token) {
      return handleResponse(400, "Invalid verification link", {}, resp);
    }

    const user = await User.findOne({
      email_verification_token: token,
    });

    if (!user) {
      return handleResponse(400, "Invalid or expired link", {}, resp);
    }

    user.is_email_verified = true;
    user.email_verification_token = null;

    await user.save();

    return handleResponse(200, "Email verified successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// REQUEST EMAIL LOGIN OTP
export const requestEmailLoginOTP = async (req, resp) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return handleResponse(404, "User not found", {}, resp);

    if (!user.is_phone_verified)
      return handleResponse(
        403,
        "Phone verification required",
        { flow: "PHONE_VERIFICATION_REQUIRED" },
        resp,
      );

    if (!user.is_email_verified)
      return handleResponse(
        403,
        "Email not verified",
        { flow: "EMAIL_VERIFICATION_REQUIRED" },
        resp,
      );

    const otp = generateOTP();

    user.email_login_otp = otp;
    user.email_login_otp_expiry = moment().add(5, "minutes").toDate();
    await user.save();

    await sendEmail({
      to: email,
      subject: "Login OTP",
      html: `<p>Your login OTP is <b>${otp}</b></p>`,
    });

    return handleResponse(
      200,
      "OTP sent to email",
      { flow: "OTP_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// LOGIN API
export const login = async (req, resp) => {
  try {
    const { identifier, password } = req.body;

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

    // Phone must exist
    if (!user.phone) {
      const token = generateToken(user.toObject());
      return handleResponse(
        403,
        "Phone number required to access account",
        { flow: "PHONE_REQUIRED", user: user.toObject(), token },
        resp,
      );
    }

    // Phone must be verified
    if (!user.is_phone_verified) {
      const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
      await user.save();

      return handleResponse(
        403,
        "Phone verification required",
        { flow: "PHONE_VERIFICATION_REQUIRED" },
        resp,
      );
    }

    const isEmailLogin = user.email === identifier;

    if (isEmailLogin && !user.is_email_verified) {
      const newToken = crypto.randomBytes(32).toString("hex");

      user.email_verification_token = newToken;
      await user.save();

      return handleResponse(
        403,
        "Email verification required",
        { flow: "EMAIL_VERIFICATION_REQUIRED" },
        resp,
      );
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return handleResponse(401, "Invalid credentials", {}, resp);
    }

    const token = generateToken(user.toObject());

    return handleResponse(
      200,
      "Login successful",
      { flow: "LOGIN_SUCCESS", token, user },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// RESEND PHONE OTP
export const resendPhoneOTP = async (req, resp) => {
  try {
    const { phone, type } = req.body;

    if (!phone) {
      return handleResponse(400, "Phone is required", {}, resp);
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (user.is_phone_verified) {
      return handleResponse(400, "Phone already verified", {}, resp);
    }

    const otp = generateOTP();

    user.otp_phone = otp;
    user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
    user.otp_for = type;

    await user.save();

    return handleResponse(
      200,
      "Phone OTP resent successfully",
      { flow: "PHONE_VERIFICATION_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// RESEND EMAIL VERIFICATION LINK
export const resendEmailVerification = async (req, resp) => {
  try {
    const { email } = req.body;

    if (!email) {
      return handleResponse(400, "Email is required", {}, resp);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (!user.email) {
      return handleResponse(400, "No email found for this user", {}, resp);
    }

    if (user.is_email_verified) {
      return handleResponse(400, "Email already verified", {}, resp);
    }

    const newToken = crypto.randomBytes(32).toString("hex");

    user.email_verification_token = newToken;
    await user.save();

    const link = `${process.env.BASE_URL}/api/user/verify-email?token=${newToken}`;

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `<p>Click below to verify your email:</p>
             <a href="${link}">${link}</a>`,
    });

    return handleResponse(
      200,
      "Verification link resent successfully",
      { flow: "EMAIL_VERIFICATION_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// VERIFY PHONE + AUTO LOGIN
export const verifyPhoneAndLogin = async (req, resp) => {
  try {
    const { phone, otp, type } = req.body;

    if (!phone || !otp) {
      return handleResponse(400, "Phone and OTP are required", {}, resp);
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "VERIFY_PHONE") {
      return handleResponse(400, "Invalid type", {}, resp);
    }

    if (
      !user.otp_phone ||
      !user.otp_phone_expiry_at ||
      moment().isAfter(user.otp_phone_expiry_at)
    ) {
      return handleResponse(400, "OTP expired", {}, resp);
    }

    if (user.otp_phone !== otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }

    user.is_phone_verified = true;
    user.otp_phone = null;
    user.otp_phone_expiry_at = null;
    user.otp_for = null;

    await user.save();

    // resend email verification if email exists but not verified
    if (user.email && !user.is_email_verified) {
      const newToken = crypto.randomBytes(32).toString("hex");
      user.email_verification_token = newToken;
      await user.save();

      const link = `${process.env.BASE_URL}/api/user/verify-email?token=${newToken}`;

      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<p>Click below to verify your email:</p>
               <a href="${link}">${link}</a>`,
      });
    }

    const token = generateToken(user.toObject());

    return handleResponse(
      200,
      "Phone verified and login successful",
      { flow: "LOGIN_SUCCESS", token, user },
      resp,
    );
  } catch (err) {
    console.log("verifyPhoneAndLogin error : ", err);
    return handleResponse(500, err.message, {}, resp);
  }
};

// UPDATE PROFILE
export const updateUserProfile = async (req, resp) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return handleResponse(401, "Unauthorized", {}, resp);
    }

    const { first_name, last_name, email, phone, profile_pic } = req.body;

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

      await sendEmail({
        to: email,
        subject: "Verify your email",
        html: `<p>Click below to verify your email:</p>
               <a href="${link}">${link}</a>`,
      });
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
