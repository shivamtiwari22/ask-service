import User from "../../models/UserModel.js";
import handleResponse from "../../../utils/http-response.js";
import {
  comparePassword,
  generateOTP,
  generateToken,
} from "../../../utils/auth.js";

// signup
export const signup = async (req, resp) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { first_name, last_name, email, phone } = req.body;

    if (!email && !phone) {
      return handleResponse(400, "Email or phone required", {}, resp);
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return handleResponse(
        200,
        "User already exists",
        { flow: "LOGIN_REQUIRED" },
        resp,
      );
    }

    const role = await Role.findOne({ name: "User" });

    const emailOtp = email ? generateOTP() : null;
    const phoneOtp = phone ? generateOTP() : null;

    const [user] = await User.create(
      [
        {
          first_name,
          last_name,
          email,
          phone,
          role: role._id,
          password: await hashPassword(generatePassword(10)),
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
      "Signup successful. Verification required.",
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

// verify signup
export const verifySignup = async (req, resp) => {
  try {
    const {
      email,
      phone,
      otp_email,
      otp_phone,
      type = "SIGNUP",
    } = req.body;

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
      else if (user.otp !== otp_email)
        errors.email = "Invalid Email OTP";
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
      else if (user.otp_phone !== otp_phone)
        errors.phone = "Invalid Phone OTP";
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
        resp
      );
    }

    user.otp_for = null;
    await user.save();

    // 🔐 CONDITIONAL LOGIN
    if (type === "SIGNUP_LOGIN") {
      const token = generateToken(user);
      return handleResponse(
        200,
        "Verification successful",
        {
          flow: "LOGIN_SUCCESS",
          token,
          user,
        },
        resp
      );
    }

    // 🧾 SIGNUP-ONLY FLOW
    return handleResponse(
      200,
      "Verification successful",
      {
        flow: "SIGNUP_VERIFIED",
        email_verified: user.is_email_verified,
        phone_verified: user.is_phone_verified,
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// login with password
export const loginWithPassword = async (req, resp) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return handleResponse(401, "Invalid credentials", {}, resp);
    }

    const token = generateToken(user);

    return handleResponse(200, "Login successful", { token, user }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// request login otp
export const requestLoginOTP = async (req, resp) => {
  try {
    const { identifier } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otp_for = "LOGIN";
    user.otp_expires_at = moment().add(5, "minutes").toDate();
    await user.save();

    // send email or SMS here

    return handleResponse(
      200,
      "OTP sent for login",
      { flow: "OTP_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// verify login otp
export const verifyLoginOTP = async (req, resp) => {
  try {
  } catch (err) {
    const { identifier, otp } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (moment().isAfter(user.otp_expires_at)) {
      return handleResponse(400, "OTP expired", {}, resp);
    }

    if (user.otp !== otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }

    user.otp = null;
    user.otp_expires_at = null;
    user.otp_for = null;
    await user.save();

    const token = generateToken(user);

    return handleResponse(200, "Login successful", { token, user }, resp);
  }
};

// resend otp
export const resendOTP = async (req, resp) => {
  try {
    const { email, phone, type } = req.body;

    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const otp = generateOTP();

    if (type === "email" && user.email) {
      user.otp = otp;
      user.otp_expires_at = moment().add(1, "minutes").toDate();
    }

    if (type === "phone" && user.phone) {
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
    }

    user.otp_for = "SIGNUP";
    await user.save();

    return handleResponse(
      200,
      "OTP resent successfully",
      { flow: "OTP_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};
