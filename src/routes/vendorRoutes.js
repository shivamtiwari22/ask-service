import express from "express";
import handleResponse from "../../utils/http-response";
import {
  changePassword,
  forgotPassword,
  getProfile,
  loginVendor,
  registerVendor,
  resendOTP,
  resendPhoneEmailOTP,
  resetPassword,
  updateVendorProfile,
  verifyOTP,
  verifyRegistrationOTP,
} from "../controller/vendor/AuthController.js";
import { userProfileUpload } from "../../utils/multer";
import {
  authenticateForgotPasswordToken,
  checkRoleAuth,
  userAuthenticateToken,
} from "../../middleware/auth.js";

const router = express.Router();

// register vendor
router.post("/register", registerVendor);

// resend otp
router.post("/resend-otp", resendOTP);

// verify otp
router.post("/verify-otp", verifyRegistrationOTP);

// login vendor
router.post("/login", loginVendor);

// update vendor profile
router.put(
  "/update-profile",
  userAuthenticateToken,
  checkRoleAuth(["Vendor"]),
  userProfileUpload,
  updateVendorProfile,
);

router.get(
  "/get-profile",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  getProfile,
);

// change password
router.put(
  "/change-password",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  changePassword,
);

// forgot password
router.post("/forgot-password", forgotPassword);

// resend phone email OTP
router.post("/resend-phone-email-otp", resendPhoneEmailOTP);

// verify forgot password otp
router.post("/verify-forgot-password-otp", verifyOTP);

// reset password
router.post("/reset-password", authenticateForgotPasswordToken, resetPassword);


router.get("/vendor-test", (req, resp) => {
  return handleResponse(200, "Vendor test successful", {}, resp);
});

export default router;
