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
import {
  createServiceCategoryValidation,
  createServiceDocumentRequirementValidation,
  createTestimonialMasterValidation,
  createTokenMasterValidation,
  forgotPasswordValidation,
  passwordChangeValidatrion,
  resendOTPValidation,
  resetPasswordValidation,
  updateServiceCategoryValidation,
  updateServiceDocumentRequirementValidation,
  updateTestimonialMasterValidation,
  updateTokenMasterValidation,
  validateLoginAdmin,
  verifyOTPValidation,
} from "../../middleware/validation.js";
import {
  serviceCategoryUpload,
  userProfileUpload,
} from "../../utils/multer.js";
import {
  authenticateForgotPasswordToken,
  authenticateToken,
  checkRoleAuth,
} from "../../middleware/auth.js";
import {
  createServiceCategory,
  deleteServiceCategory,
  getAllServiceCategories,
  getServiceCategoryById,
  restoreServiceCategory,
  updateServiceCategory,
} from "../controller/admin/ServiceCategoryController.js";
import {
  createServiceDocumentRequirement,
  createTestimonialMaster,
  createTokenMaster,
  deleteServiceDocumentRequirement,
  deleteTestimonialMaster,
  deleteTokenMaster,
  getAllServiceDocumentRequirements,
  getAllTestimonialMasters,
  getAllTokenMasters,
  getTestimonialMasterById,
  getTokenMasterById,
  restoreDeletedServiceDocumentRequirement,
  restoreDeletedTestimonialMaster,
  restoreDeletedTokenMaster,
  updateServiceDocumentRequirement,
  updateTestimonialMaster,
  updateTokenMaster,
} from "../controller/admin/MasterController.js";

const router = express.Router();

// auth
router.post("/login", validateLoginAdmin, adminLogin);
router.put(
  "/update-profile",
  userProfileUpload,
  authenticateToken,
  checkRoleAuth(["Admin"]),
  updateAdminProfile,
);
router.get("/get-profile", authenticateToken, getAdminProfile);
router.put(
  "/change-password",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  passwordChangeValidatrion,
  changeAdminPassword,
);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/resend-otp", resendOTPValidation, resendOTP);
router.post("/verify-otp", verifyOTPValidation, verifyOTP);
router.post(
  "/reset-password",
  resetPasswordValidation,
  authenticateForgotPasswordToken,
  resetPassword,
);
router.get(
  "/get-all-role-options",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllRoleOptions,
);
router.get(
  "/get-all-users",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllUsers,
);

// service category master
router.post(
  "/service-categories",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  serviceCategoryUpload,
  createServiceCategoryValidation,
  createServiceCategory,
);
router.get(
  "/service-categories",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllServiceCategories,
);
router.get(
  "/service-categories/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getServiceCategoryById,
);
router.put(
  "/service-categories/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  serviceCategoryUpload,
  updateServiceCategoryValidation,
  updateServiceCategory,
);
router.delete(
  "/service-categories/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  deleteServiceCategory,
);
router.put(
  "/service-categories/:id/restore",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  restoreServiceCategory,
);

// token master
router.post(
  "/token-masters",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  createTokenMasterValidation,
  createTokenMaster,
);
router.get(
  "/token-masters",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllTokenMasters,
);
router.get(
  "/token-masters/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getTokenMasterById,
);
router.put(
  "/token-masters/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  updateTokenMasterValidation,
  updateTokenMaster,
);
router.delete(
  "/token-masters/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  deleteTokenMaster,
);
router.put(
  "/token-masters/:id/restore",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  restoreDeletedTokenMaster,
);

// testimonial master
router.post(
  "/testimonial-masters",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  createTestimonialMasterValidation,
  createTestimonialMaster,
);
router.get(
  "/testimonial-masters",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllTestimonialMasters,
);
router.get(
  "/testimonial-masters/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getTestimonialMasterById,
);
router.put(
  "/testimonial-masters/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  updateTestimonialMasterValidation,
  updateTestimonialMaster,
);
router.delete(
  "/testimonial-masters/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  deleteTestimonialMaster,
);
router.put(
  "/testimonial-masters/:id/restore",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  restoreDeletedTestimonialMaster,
);

// service document / license requirement master
router.post(
  "/service-document-requirements",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  createServiceDocumentRequirementValidation,
  createServiceDocumentRequirement,
);
router.get(
  "/service-document-requirements",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllServiceDocumentRequirements,
);
router.get(
  "/service-document-requirements/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  getAllServiceDocumentRequirements,
);
router.put(
  "/service-document-requirements/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  updateServiceDocumentRequirementValidation,
  updateServiceDocumentRequirement,
);
router.delete(
  "/service-document-requirements/:id",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  deleteServiceDocumentRequirement,
);

router.put(
  "/service-document-requirements/:id/restore",
  authenticateToken,
  checkRoleAuth(["Admin"]),
  restoreDeletedServiceDocumentRequirement,
);

export default router;
