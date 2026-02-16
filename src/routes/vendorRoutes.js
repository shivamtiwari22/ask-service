import express from "express";
import handleResponse from "../../utils/http-response";
import {
  changePassword,
  forgotPassword,
  getAllServices,
  getDocumentRequiredForService,
  getProfile,
  loginVendor,
  registerVendor,
  resendOTP,
  resendPhoneEmailOTP,
  resetPassword,
  updateDocumentRequiredForService,
  updateUserServiceData,
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
router.post("/reset-password", authenticateForgotPasswordToken("forgot-password"), resetPassword);

// get all services
router.get("/get-all-services",   getAllServices);

// get all services document required
router.get("/get-all-services-document-required", userAuthenticateToken, checkRoleAuth(["Vendor"]), getDocumentRequiredForService);

// update user's service data
router.put("/update-service-data", authenticateForgotPasswordToken("service-selection-document-upload"), checkRoleAuth(["Vendor"]), updateUserServiceData);

// upload service selection document
router.get("/upload-service-selection-document", authenticateForgotPasswordToken("service-selection-document-upload"), updateDocumentRequiredForService);



router.get("/vendor-test", (req, resp) => {
  return handleResponse(200, "Vendor test successful", {}, resp);
});

export default router;
