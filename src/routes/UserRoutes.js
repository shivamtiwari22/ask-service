import express from "express";
import handleResponse from "../../utils/http-response.js";
import {
  getUserServiceCategories,
  initiateServiceRequest,
  verifySignupLogin,
} from "../controller/user/ServiceController.js";
import {
  checkRoleAuth,
  optionalAuthenticateToken,
  userAuthenticateToken,
} from "../../middleware/auth.js";

import {
  login,
  requestEmailLoginOTP,
  resendEmailVerification,
  resendPhoneOTP,
  signup,
  updateUserProfile,
  verifyEmail,
  verifyPhone,
  verifyPhoneAndLogin,
} from "../controller/user/AuthController.js";
import { userProfileUpload } from "../../utils/multer.js";

const router = express.Router();

// ==============================SERVICE==============================
// get service category list for users
router.get("/service-categories", getUserServiceCategories);

// service created by user (without login)
router.post(
  "/service-request",
  optionalAuthenticateToken,
  initiateServiceRequest,
);

// verify signup login
router.post("/verify-signup-login", verifySignupLogin);

// ==============================AUTH=================================
// signup
router.post("/signup", signup);

// verify phone
router.post("/verify-phone", verifyPhone);

// verify phone and login
router.post("/verify-phone-login", verifyPhoneAndLogin);

// resend phone otp
router.post("/resend-phone-otp", resendPhoneOTP);

// resend email verification link
router.post("/resend-email-verification", resendEmailVerification);

// verify email
router.get("/verify-email", verifyEmail);

// login
router.post("/login", login);

// request email login otp
router.post("/login/email-otp", requestEmailLoginOTP);

// update profile
router.put(
  "/update-profile",
  userProfileUpload,
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  updateUserProfile,
);

router.get("/test", (req, res) => {
  return handleResponse(200, "User route is working fine", {}, res);
});

export default router;
