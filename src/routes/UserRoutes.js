import express from "express";
import {
  createVendorReview,
  getMyServiceRequests,
  getUserServiceCategories,
  initiateServiceRequest,
  loginAndAttachServiceRequest,
  resendServiceRequestOTP,
  vendorRequestServiceLead,
  verifyServiceRequestAndCreateUser,
} from "../controller/user/ServiceFlowController.js";
import {
  createVendorReviewValidation,
  initiateServiceRequestValidation,
  loginAndAttachServiceRequestValidation,
  resendServiceRequestOTPValidation,
  verifyServiceRequestOTPValidation,
} from "../../middleware/validation.js";
import {
  authenticateToken,
  optionalAuthenticateToken,
} from "../../middleware/auth.js";

const router = express.Router();

router.get("/service-categories", getUserServiceCategories);
router.post(
  "/service-requests/initiate",
  optionalAuthenticateToken,
  initiateServiceRequestValidation,
  initiateServiceRequest
);
router.post(
  "/service-requests/resend-otp",
  resendServiceRequestOTPValidation,
  resendServiceRequestOTP
);
router.post(
  "/service-requests/verify-otp",
  verifyServiceRequestOTPValidation,
  verifyServiceRequestAndCreateUser
);
router.post(
  "/service-requests/login-and-submit",
  loginAndAttachServiceRequestValidation,
  loginAndAttachServiceRequest
);
router.get("/service-requests/my", authenticateToken, getMyServiceRequests);
router.post(
  "/service-requests/:id/vendor-request",
  authenticateToken,
  vendorRequestServiceLead
);

router.post(
  "/vendor-reviews",
  authenticateToken,
  createVendorReviewValidation,
  createVendorReview
);

export default router;
