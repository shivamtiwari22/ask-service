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
import { userProfileUpload } from "../../utils/multer.js";
import {
  authenticateForgotPasswordToken,
  authenticateToken,
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
router.put("/update-profile", userProfileUpload, authenticateToken, updateAdminProfile);
router.get("/get-profile", authenticateToken, getAdminProfile);
router.put(
  "/change-password",
  authenticateToken,
  passwordChangeValidatrion,
  changeAdminPassword
);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/resend-otp", resendOTPValidation, resendOTP);
router.post("/verify-otp", verifyOTPValidation, verifyOTP);
router.post(
  "/reset-password",
  resetPasswordValidation,
  authenticateForgotPasswordToken,
  resetPassword
);
router.get("/get-all-role-options", authenticateToken, getAllRoleOptions);
router.get("/get-all-users", authenticateToken, getAllUsers);

// service category master
router.post(
  "/service-categories",
  authenticateToken,
  createServiceCategoryValidation,
  createServiceCategory
);
router.get("/service-categories", authenticateToken, getAllServiceCategories);
router.get("/service-categories/:id", authenticateToken, getServiceCategoryById);
router.put(
  "/service-categories/:id",
  authenticateToken,
  updateServiceCategoryValidation,
  updateServiceCategory
);
router.delete("/service-categories/:id", authenticateToken, deleteServiceCategory);
router.put(
  "/service-categories/:id/restore",
  authenticateToken,
  restoreServiceCategory
);

// token master
router.post(
  "/token-masters",
  authenticateToken,
  createTokenMasterValidation,
  createTokenMaster
);
router.get("/token-masters", authenticateToken, getAllTokenMasters);
router.put(
  "/token-masters/:id",
  authenticateToken,
  updateTokenMasterValidation,
  updateTokenMaster
);
router.delete("/token-masters/:id", authenticateToken, deleteTokenMaster);
router.put(
  "/token-masters/:id/restore",
  authenticateToken,
  restoreDeletedTokenMaster
);

// testimonial master
router.post(
  "/testimonial-masters",
  authenticateToken,
  createTestimonialMasterValidation,
  createTestimonialMaster
);
router.get("/testimonial-masters", authenticateToken, getAllTestimonialMasters);
router.put(
  "/testimonial-masters/:id",
  authenticateToken,
  updateTestimonialMasterValidation,
  updateTestimonialMaster
);
router.delete("/testimonial-masters/:id", authenticateToken, deleteTestimonialMaster);
router.put(
  "/testimonial-masters/:id/restore",
  authenticateToken,
  restoreDeletedTestimonialMaster
);

// service document / license requirement master
router.post(
  "/service-document-requirements",
  authenticateToken,
  createServiceDocumentRequirementValidation,
  createServiceDocumentRequirement
);
router.get(
  "/service-document-requirements",
  authenticateToken,
  getAllServiceDocumentRequirements
);
router.put(
  "/service-document-requirements/:id",
  authenticateToken,
  updateServiceDocumentRequirementValidation,
  updateServiceDocumentRequirement
);
router.delete(
  "/service-document-requirements/:id",
  authenticateToken,
  deleteServiceDocumentRequirement
);

router.put(
  "/service-document-requirements/:id/restore",
  authenticateToken,
  restoreDeletedServiceDocumentRequirement
);

export default router;
