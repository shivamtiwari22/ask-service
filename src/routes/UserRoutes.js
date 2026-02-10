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
} from "../../middleware/auth.js";
import { loginWithPassword, requestLoginOTP, resendOTP, signup, verifyLoginOTP, verifySignup } from "../controller/user/AuthController.js";

const router = express.Router();

// ==============================SERVICE==============================
// get service category list for users
router.get("/service-categories", getUserServiceCategories);

// service created by user (without login)
router.post("/service-request",optionalAuthenticateToken,initiateServiceRequest);

// verify signup login
router.post("/verify-signup-login", verifySignupLogin);


// ==============================AUTH=================================
// signup
router.post("/signup", signup);

// verify signup
router.post("/verify-signup", verifySignup);

// login with password
router.post("/login/password", loginWithPassword);

// request login otp
router.post("/login/otp/request", requestLoginOTP);

// verify login otp
router.post("/login/otp/verify", verifyLoginOTP);

// resend otp
router.post("/resend-otp", resendOTP);



router.get("/test", (req, res) => {
  return handleResponse(200, "User route is working fine", {}, res);
});

export default router;
