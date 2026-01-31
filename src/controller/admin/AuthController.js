import {comparePassword,generateOTP,generateOneMinToken,generateToken,hashPassword,} from "../../../utils/auth.js";
import handleResponse from "../../../utils/http-response.js";
import User from "../../models/UserModel.js";
import Role from "../../models/RoleModel.js";
import normalizePath from "../../../utils/imageNormalizer.js";
import moment from "moment";
import { cookieOptions } from "../../../utils/helperFunction.js";

// login admin panel
export const adminLogin = async (req, resp) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate("role");
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }
    const isPasswordCorrect = await comparePassword(password, user.password);

    if (!isPasswordCorrect) {
      return handleResponse(401, "Invalid password", {}, resp);
    }

    if (user.role.name.includes(["User", "Vendor"])) {
      return handleResponse(
        401,
        "You are not authorized to access this resource",
        {},
        resp
      );
    }

    if (user.status !== "ACTIVE") {
      return handleResponse(401, "Your account is not active", {}, resp);
    }

    const token = generateToken({ _id: user._id.toString() });

    return handleResponse(
      200,
      "Login successful",
      { accessToken: token },
      resp
    );
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// update profile
export const updateAdminProfile = async (req, resp) => {
  try {
    const { profile_pic } = req.files;
    const body = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const payload = {
      ...body,
      profile_pic:
        Array.isArray(profile_pic) && profile_pic?.length > 0
          ? profile_pic[0].path
          : body.profile_pic
          ? normalizePath(body.profile_pic)
          : null,
    };
    const updateUser = await User.findByIdAndUpdate(
      user?._id,
      {
        $set: payload,
      },
      { new: true }
    );

    if (!updateUser)
      return handleResponse(400, "Failed to update profile", {}, resp);
    return handleResponse(
      200,
      "Profile updated successfully",
      updateUser,
      resp
    );
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// get admin profile
export const getAdminProfile = async (req, resp) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -otp -otp_expires_at -otp_for")
      .populate("role", "name status");
    if (!user) return handleResponse(404, "User not found", {}, resp);
    return handleResponse(200, "Profile fetched successfully", user, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// change login user's password
export const changeAdminPassword = async (req, resp) => {
  try {
    const { old_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return handleResponse(404, "User not found", {}, resp);
    const isPasswordCorrect = await comparePassword(
      old_password,
      user.password
    );
    if (!isPasswordCorrect)
      return handleResponse(401, "Invalid password", {}, resp);
    const hashedPassword = await hashPassword(new_password);
    const updateUser = await User.findByIdAndUpdate(
      user?._id,
      { password: hashedPassword },
      { new: true }
    );
    if (!updateUser)
      return handleResponse(400, "Failed to change password", {}, resp);
    return handleResponse(200, "Password changed successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// forgot password
export const forgotPassword = async (req, resp) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return handleResponse(404, "User not found", {}, resp);
    const otp = generateOTP();
    const otp_expires_at = moment().add(1, "minutes").toDate();
    const otp_for = "FORGOT_PASSWORD";
    const updateUser = await User.findByIdAndUpdate(
      user?._id,
      { otp, otp_expires_at, otp_for },
      { new: true }
    );

    if (!updateUser)
      return handleResponse(400, "Failed to generate OTP", {}, resp);

    setImmediate(async () => {
      await sendEmail({
        to: user?.email,
        subject: "OTP for forgot password",
        html: `<p>Your OTP for forgot password is ${otp}</p>`,
      });
    });

    return handleResponse(200, "OTP generated successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// verify otp
export const verifyOTP = async (req, resp) => {
  try {
    const { email, otp, otp_for } = req.body;
    const user = await User.findOne({ email });
    if (!user) return handleResponse(404, "User not found", {}, resp);

    if (user.otp != otp) return handleResponse(401, "Invalid OTP", {}, resp);

    if (moment(user.otp_expires_at).isBefore(moment()))
      return handleResponse(401, "OTP expired", {}, resp);

    if (user.otp_for !== otp_for)
      return handleResponse(401, "Invalid OTP for", {}, resp);

    user.otp = null;
    user.otp_expires_at = null;
    user.otp_for = null;
    await user.save();

    const token = generateOneMinToken({ _id: user._id.toString() });
    await resp.cookie("forgot-password", token, cookieOptions);

    return handleResponse(200, "OTP verified successfully", { token }, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// reset password
export const resetPassword = async (req, resp) => {
  try {
    const { password } = req.body;

    const user = await User.findOne({ _id: req.user._id });
    if (!user) return handleResponse(404, "User not found", {}, resp);
    const hashedPassword = await hashPassword(password);
    const updateUser = await User.findByIdAndUpdate(
      user._id,
      { password: hashedPassword },
      { new: true }
    );
    if (!updateUser)
      return handleResponse(400, "Failed to reset password", {}, resp);
    resp.clearCookie("forgot-password");

    return handleResponse(200, "Password reset successfully", updateUser, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// resend OTP
export const resendOTP = async (req, resp) => {
  try {
    const { email, otp_for } = req.body;
    const user = await User.findOne({ email });
    if (!user) return handleResponse(404, "User not found", {}, resp);
    const otp = generateOTP();
    const otp_expires_at = moment().add(1, "minutes").toDate();

    const updateUser = await User.findByIdAndUpdate(
      user._id,
      { otp, otp_expires_at, otp_for },
      { new: true }
    );
    if (!updateUser)
      return handleResponse(400, "Failed to generate OTP", {}, resp);
    setImmediate(async () => {
      await sendEmail({
        to: user?.email,
        subject: "OTP for forgot password",
        html: `<p>Your OTP for forgot password is ${otp}</p>`,
      });
    });
    return handleResponse(200, "OTP generated successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// get all roles
export const getAllRoleOptions = async (req, resp) => {
  try {
    const roles = await Role.find({ name: { $ne: "Admin" } }).select("name");
    if (!roles) return handleResponse(404, "Roles not found", {}, resp);
    return handleResponse(200, "Roles fetched successfully", roles, resp);
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};

// get all users
export const getAllUsers = async (req, resp) => {
  try {
    const { search, role, status, isDeleted } = req.query;
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const skip = (page - 1) * limit;
    const roleData = await Role.findOne({ name: RegExp("admin", "i") });

    const query = { role: { $ne: roleData._id } };

    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: "i" } },
        { last_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      query.role = role;
    }
    if (status) {
      query.status = status;
    }
    if (isDeleted) {
      query.deletedAt = { $ne: null };
    }

    if (!page || !limit) {
      const [users, total] = await Promise.all([
        User.find(query)
          .select("-password -otp -otp_expires_at -otp_for")
          .populate("role"),
        User.countDocuments(query),
      ]);

      const finalResponse = {
        data: users,
        pagination: {
          total,
          limit: 0,
          currentPage: 0,
          totalPages: 0,
        },
      };

      return handleResponse(
        200,
        "Users fetched successfully",
        finalResponse,
        resp
      );
    }
    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -otp -otp_expires_at -otp_for")
        .populate("role")
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    const finalResponse = {
      data: users,
      pagination: {
        total,
        limit,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };

    return handleResponse(
      200,
      "Users fetched successfully",
      finalResponse,
      resp
    );
  } catch (err) {
    return handleResponse(500, err?.message, {}, resp);
  }
};
