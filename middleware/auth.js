import { JWT_SECRET } from "../config/jwtConfig.js";
import User from "../src/models/UserModel.js";
import { verifyToken } from "../utils/auth.js";
import handleResponse from "../utils/http-response.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return handleResponse(401, "No token provided", {}, res);
    }

    const decoded = verifyToken(token, JWT_SECRET);

    if (decoded.purpose !== "access") {
      return handleResponse(401, "Invalid token", {}, res);
    }

    const user = await User.findById(decoded._id).select("-password").populate("role");

    if (!user) {
      return handleResponse(404, "User not found", {}, res);
    }

    if (user.deletedAt) {
      return handleResponse(
        401,
        "Account scheduled for deletion. Please login again to restore it.",
        {},
        res,
      );
    }

    if (
      user.token_invalid_before &&
      decoded.iat &&
      decoded.iat * 1000 < new Date(user.token_invalid_before).getTime()
    ) {
      return handleResponse(401, "Token has been revoked", {}, res);
    }

    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return handleResponse(401, "Token has expired", {}, res);
    }
    return handleResponse(401, "Invalid token", {}, res);
  }
};

export const userAuthenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return handleResponse(401, "No token provided", {}, res);
    }

    const decoded = verifyToken(token, JWT_SECRET);

    const user = await User.findById(decoded._id).select("-password").populate("role");

    if (!user) {
      
      return handleResponse(404, "User not found", {}, res);

    }

    if (user.deletedAt) {
      return handleResponse(
        401,
        "Account scheduled for deletion. Please login again to restore it.",
        {},
        res,
      );
    }

    if (
      user.token_invalid_before &&
      decoded.iat &&
      decoded.iat * 1000 < new Date(user.token_invalid_before).getTime()
    ) {
      return handleResponse(401, "Token has been revoked", {}, res);
    }

    if (user.status != "ACTIVE") {
      return handleResponse(401, "User is not active", {}, res);
    }

    if (decoded.purpose !== "access") {
      return handleResponse(401, "Invalid token", {}, res);
    }

    const isVendor = Boolean(user.is_vendor) || user.role?.name === "Vendor";
    const requireClientPhone = process.env.REQUIRE_CLIENT_PHONE_VERIFIED === "true";
    if (!isVendor && requireClientPhone && user.is_phone_verified !== true) {
      return handleResponse(403, "Phone verification required", {
        flow: "PHONE_VERIFICATION_REQUIRED",
      }, res);
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("error : ", error);
    if (error.name === "TokenExpiredError") {
      return handleResponse(401, "Token has expired", {}, res);
    }
    return handleResponse(401, "Invalid token", {}, res);
  }
};

export const checkRoleAuth = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.role) {
        return handleResponse(401, "Unauthorized", {}, res);
      }

      const roleName = user.role?.name;
      if (!roleName || !allowedRoles.includes(roleName)) {
        return handleResponse(
          403,
          "You are not allowed to access this resource",
          {},
          res,
        );
      }

      next();
    } catch (err) {
      return handleResponse(500, err?.message, {}, res);
    }
  };
};

export const authenticateForgotPasswordToken = (
  allowedHeader = "forgot-password",
) => {
  return async (req, res, next) => {
    try {
      const token = req.cookies[allowedHeader];

      if (!token) {
        return handleResponse(401, "No token provided", {}, res);
      }

      const decoded = verifyToken(token, JWT_SECRET);

      if (decoded.purpose !== "forgot_password") {
        return handleResponse(401, "Invalid token", {}, res);
      }

      const user = await User.findById(decoded._id).select("-password").populate("role");

      if (!user) {
        return handleResponse(404, "User not found", {}, res);
      }

      req.user = user;

      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return handleResponse(401, "Token has expired", {}, res);
      }
      return handleResponse(401, "Invalid token", {}, res);
    }
  };
};

export const optionalAuthenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token, JWT_SECRET);
    if (decoded.purpose !== "access") {
      return next();
    }
    const user = await User.findById(decoded._id).select("-password").populate("role");

    if (!user) {
      return next();
    }

    if (user.deletedAt) {
      return next();
    }

    if (user.status !== "ACTIVE") {
      return next();
    }

    req.user = user;
    return next();
  } catch (error) {
    return next();
  }
};
