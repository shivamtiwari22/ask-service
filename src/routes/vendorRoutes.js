import express from "express";
import handleResponse from "../../utils/http-response.js";
import {
  changePassword,
  forgotPassword,
  getAllServices,
  getDocumentRequiredForService,
  getProfile,
  loginVendor,
  registerVendor,
  resendOTP,
  resendPhoneEmailOTP ,
  resetPassword,
  updateDocumentRequiredForService ,
  updateUserServiceData ,
  updateVendorProfile ,
  verifyOTP ,
  verifyRegistrationOTP ,
  availableLeads ,
  singleService ,
  getBusinessInfo ,
  createUpdateBusinessInfo ,
  deleteAccount ,
  saveNotificationPreferences ,
  getNotificationPreferences ,
  VerificationDocument ,
  allReviews ,
  getTransactions ,
  NewPassword ,
  GoogleLogin
} from "../controller/vendor/AuthController.js";
import {
  getDashboardStats,
  unlockLead,
  getLeadById,
  submitQuote,
  getCreditPackages,
  getCreditBalance,
  purchaseCredits,
  getTransactionsList,
} from "../controller/vendor/DashboardController.js";
import { serviceDocumentUpload, userProfileUpload, quoteDocumentUpload, chatMediaUpload } from "../../utils/multer.js";
import {
  authenticateForgotPasswordToken,
  checkRoleAuth,
  userAuthenticateToken,
} from "../../middleware/auth.js";
import ChatController from "../controller/user/ChatController.js";
import firebaseAuthenticateToken from "../../middleware/google-verification-middleware.js";

const router = express.Router();

// register vendor
router.post("/register", registerVendor);

router.post("/google-login", firebaseAuthenticateToken, GoogleLogin )


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
  checkRoleAuth(["Vendor"]),
  getProfile,
);

// change password
router.put(
  "/change-password",
  userAuthenticateToken,
  checkRoleAuth(["Vendor"]),
  changePassword,
);


router.put(
  "/delete-account",
  userAuthenticateToken,
  checkRoleAuth(["Vendor"]),
  deleteAccount,
);


router.put(
  "/new-password",
  userAuthenticateToken,
  checkRoleAuth(["Vendor"]),
  NewPassword,
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
router.put("/update-service-data", userAuthenticateToken , checkRoleAuth(["Vendor"]) , updateUserServiceData);

// upload verification documents (fieldname = document_id per file)
router.post("/upload-service-selection-document", userAuthenticateToken, checkRoleAuth(["Vendor"]), serviceDocumentUpload, updateDocumentRequiredForService);

router.get("/dashboard", userAuthenticateToken, checkRoleAuth(["Vendor"]), getDashboardStats);

router.get("/available-leads", userAuthenticateToken , checkRoleAuth(["Vendor"]) , availableLeads);
router.get("/service/:id", userAuthenticateToken , checkRoleAuth(["Vendor"]) , singleService);
router.get("/leads/:leadId", userAuthenticateToken, checkRoleAuth(["Vendor"]), getLeadById);
router.post("/leads/:leadId/unlock", userAuthenticateToken, checkRoleAuth(["Vendor"]), unlockLead);
router.post("/leads/:leadId/quotes", userAuthenticateToken, checkRoleAuth(["Vendor"]), quoteDocumentUpload, submitQuote);

router.get("/credits/packages", userAuthenticateToken, checkRoleAuth(["Vendor"]), getCreditPackages);
router.get("/credits/balance", userAuthenticateToken, checkRoleAuth(["Vendor"]), getCreditBalance);
router.post("/credits/purchase", userAuthenticateToken, checkRoleAuth(["Vendor"]), purchaseCredits);

router.get("/transactions", userAuthenticateToken, checkRoleAuth(["Vendor"]), getTransactionsList);


router.get("/business-information", userAuthenticateToken , checkRoleAuth(["Vendor"]) , getBusinessInfo);
router.put("/business-information", userAuthenticateToken , checkRoleAuth(["Vendor"]) , createUpdateBusinessInfo);

router.get("/notification", userAuthenticateToken , checkRoleAuth(["Vendor"]) , getNotificationPreferences);
router.put("/notification", userAuthenticateToken , checkRoleAuth(["Vendor"]) , saveNotificationPreferences);
router.get("/verification-documents", userAuthenticateToken , checkRoleAuth(["Vendor"]) , VerificationDocument);

router.get("/all-review", userAuthenticateToken , checkRoleAuth(["Vendor"]) , allReviews);
router.get("/all-transaction", userAuthenticateToken , checkRoleAuth(["Vendor"]) , getTransactions);


router.get("/fetch-chats", userAuthenticateToken , checkRoleAuth(["Vendor"])  ,ChatController.fetchChats)
router.post("/access-chat", userAuthenticateToken , checkRoleAuth(["Vendor"])  ,ChatController.accessChat)
router.get("/all-messages/:chatId", userAuthenticateToken , checkRoleAuth(["Vendor"])  ,ChatController.allMessages)
router.post("/send-msg", userAuthenticateToken , checkRoleAuth(["Vendor"]) , chatMediaUpload , ChatController.sendMessage)




router.get("/", (req, resp) => {
  return handleResponse(200, "Vendor test successful", {}, resp);
});

export default router;
