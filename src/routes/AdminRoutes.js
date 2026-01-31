import express from "express";
import {
  adminLogin,
  changeAdminPassword,
  forgotPassword,
  getAdminProfile,
  getAllRoleOptions,
  getAllUsers,
  resendOTP,
  resetPassword,
  updateAdminProfile,
  verifyOTP,
} from "../controller/admin/AuthController.js";
import { forgotPasswordValidation, passwordChangeValidatrion, resendOTPValidation, resetPasswordValidation, validateLoginAdmin, verifyOTPValidation } from "../../middleware/validation.js";
import { userProfileUpload } from "../../utils/multer.js";
import { authenticateForgotPasswordToken, authenticateToken } from "../../middleware/auth.js";

const router = express.Router();
// login
router.post("/login", validateLoginAdmin, adminLogin);

// update profile
router.put("/update-profile",userProfileUpload,authenticateToken, updateAdminProfile);

// get admin profile
router.get("/get-profile", authenticateToken, getAdminProfile)

// login user's password change
router.put("/change-password", authenticateToken,passwordChangeValidatrion, changeAdminPassword);

// forgot password
router.post("/forgot-password",forgotPasswordValidation, forgotPassword);

// resend OTP
router.post("/resend-otp",resendOTPValidation,resendOTP);

// verify OTP
router.post("/verify-otp",verifyOTPValidation,verifyOTP);

// reset password
router.post("/reset-password",resetPasswordValidation,authenticateForgotPasswordToken,resetPassword);

// get all role options
router.get("/get-all-role-options",authenticateToken,getAllRoleOptions);

router.get("/get-all-users",authenticateToken,getAllUsers);

export default router;
