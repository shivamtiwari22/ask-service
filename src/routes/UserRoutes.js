import express from "express";
import handleResponse from "../../utils/http-response.js";
import {
  acceptQuote,
  closeServiceRequest,
  getCreatedServiceRequests,
  getQuoteDetails,
  getQuotesForServiceRequest,
  getUserServiceCategories,
  ignoreQuote,
  initiateServiceRequest,
  verifySignupLogin,
  submitReview ,
  vendorDetails ,
  toggleReviewLike ,
  reportUser
} from "../controller/user/ServiceController.js";
import {
  authenticateForgotPasswordToken,
  checkRoleAuth,
  optionalAuthenticateToken,
  userAuthenticateToken,
} from "../../middleware/auth.js";

import {
  changePassword,
  forgotPassword,
  getProfile,
  login,
  requestEmailLoginOTP,
  resendEmailVerification,
  resendPhoneEmailOTP,
  resendPhoneOTP,
  resetPassword,
  signup,
  updateUserProfile,
  verifyEmail,
  verifyOTP,
  verifyPhone,
  verifyPhoneAndLogin,
    saveNotificationPreferences ,
  getNotificationPreferences ,
  PostContactUs ,
  loginPhoneEmail ,
  NewPassword ,
  deleteAccount
} from "../controller/user/AuthController.js";
import { chatMediaUpload, userProfileUpload } from "../../utils/multer.js";
import ChatController from "../controller/user/ChatController.js";
import { getFaqsForUser } from "../controller/admin/FaqsController.js";

const router = express.Router();

// ==============================SERVICE==============================
// get service category list for users
router.get("/service-categories", getUserServiceCategories);

// get FAQs for users (active only, optional type filter)
router.get("/faqs", getFaqsForUser);

// service created by user (without login)
router.post(
  "/service-request",
  optionalAuthenticateToken,
  initiateServiceRequest,
);

// verify signup login
router.post("/verify-signup-login", verifySignupLogin);

// get created services
router.get(
  "/get-created-services",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  getCreatedServiceRequests,
);

// close service request (body: reason, optional reason_comment for "Other reason")
router.put(
  "/close-service-request/:id",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  closeServiceRequest,
);

// quotes for a service request (modal "Quotes for House Cleaning")
router.get(
  "/service-requests/:id/quotes",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  getQuotesForServiceRequest,
);
// single quote details (modal "View details")
router.get(
  "/service-requests/:id/quotes/:quoteId",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  getQuoteDetails,
);
// ignore quote
router.post(
  "/service-requests/:id/quotes/:quoteId/ignore",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  ignoreQuote,
);
// accept quote
router.post(
  "/service-requests/:id/quotes/:quoteId/accept",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  acceptQuote,
);

// ==============================AUTH=================================


// signup
router.post("/signup", signup);
router.post("/login", login);

// verify phone
router.post("/verify-phone", verifyPhone);
router.post("/verify-email", verifyEmail);

router.post("/login-phone-email", loginPhoneEmail);


router.post("/resend-phone-otp", resendPhoneOTP);
router.post("/resend-email-verification", resendEmailVerification);


// verify phone and login
router.post("/verify-phone-login", verifyPhoneAndLogin);

// resend phone otp

router.post("/post-contact-us", PostContactUs);

// resend email verification link

// verify email

// login

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

// change password
router.put(
  "/change-password",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  changePassword,
);


router.put(
  "/delete-account",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  deleteAccount,
);

router.put(
  "/new-password",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  NewPassword,
);


// get profile
router.get(
  "/get-profile",
  userAuthenticateToken,
  checkRoleAuth(["User"]),
  getProfile,
);

router.get("/notification", userAuthenticateToken , checkRoleAuth(["User"]) , getNotificationPreferences);
router.put("/notification", userAuthenticateToken , checkRoleAuth(["User"]) , saveNotificationPreferences);

router.post("/submit-review", userAuthenticateToken , checkRoleAuth(["User"]) , submitReview);
router.put("/like-review/:id", userAuthenticateToken , checkRoleAuth(["User"]) ,toggleReviewLike );

router.get("/vendor-details/:id", userAuthenticateToken , checkRoleAuth(["User"]) , vendorDetails);
router.post("/report-vendor", userAuthenticateToken , checkRoleAuth(["User"]) , reportUser);


// forgot password
router.post("/forgot-password", forgotPassword);

// resend phone email OTP
router.post("/resend-phone-email-otp", resendPhoneEmailOTP);

// verify forgot password otp
router.post("/verify-forgot-password-otp", verifyOTP);

// reset password
router.post("/reset-password", authenticateForgotPasswordToken("forgot-password"), resetPassword);

router.get("/test", (req, res) => { return handleResponse(200, "User route is working fine", {}, res); }) ;



// chat 

router.get("/fetch-chats", userAuthenticateToken , checkRoleAuth(["User"])  ,ChatController.fetchChats)
router.post("/access-chat", userAuthenticateToken , checkRoleAuth(["User"])  ,ChatController.accessChat)
router.get("/all-messages/:chatId", userAuthenticateToken , checkRoleAuth(["User"])  ,ChatController.allMessages)
router.post("/send-msg", userAuthenticateToken , checkRoleAuth(["User"]) , chatMediaUpload , ChatController.sendMessage)

router.post("/react-message", userAuthenticateToken , checkRoleAuth(["User"])  , ChatController.reactToMessage)
router.put("/read-all-message/:chatId", userAuthenticateToken , checkRoleAuth(["User"])  , ChatController.MarkAllMessagesSeen)
router.put("/read-message/:id", userAuthenticateToken , checkRoleAuth(["User"])  , ChatController.MarkMessagesSeen)
router.get("/single-chat/:id", userAuthenticateToken , checkRoleAuth(["User"])  , ChatController.singleChat)



export default router;
