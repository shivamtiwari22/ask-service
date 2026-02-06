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

    const user = await User.findById(decoded._id).populate("role");

    if (!user) {
      return handleResponse(404, "User not found", {}, res);
    }

    if (
      user.status != "ACTIVE" &&
      !["User", "Vendor"].includes(user.role.name)
    ) {
      return handleResponse(401, "User is not active", {}, res);
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

    const user = await User.findById(decoded._id);

    if (!user) {
      return handleResponse(404, "User not found", {}, res);
    }

    // if (user.role != "User") {
    //     return handleResponse(401, "Not allowed to access this", {}, res)
    // }

    if (user.status != "ACTIVE") {
      return handleResponse(401, "User is not active", {}, res);
    }

    if (user.email_verified == false) {
      return handleResponse(401, "Email is not verified", {}, res);
    }

    if (user.phone_verified == false) {
      return handleResponse(401, "Phone is not verified", {}, res);
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

      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          403,
          "You are not allowed to access this resource",
          {},
          res
        );
      }

      next();
    } catch (err) {
      return handleResponse(500, err?.message, {}, res);
    }
  };
};

export const authenticateForgotPasswordToken = async (req, res, next) => {
  try {
    const token = req.cookies["forgot-password"];

    if (!token) {
      return handleResponse(401, "No token provided", {}, res);
    }

    const decoded = verifyToken(token, JWT_SECRET);

    const user = await User.findById(decoded._id).populate("role");

    if (!user) {
      return handleResponse(404, "User not found", {}, res);
    }

    if (
      user.status != "ACTIVE" &&
      !["User", "Vendor"].includes(user.role.name)
    ) {
      return handleResponse(401, "User is not active", {}, res);
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


export const optionalAuthenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token, JWT_SECRET);
    const user = await User.findById(decoded._id).populate("role");

    if (!user) {
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
