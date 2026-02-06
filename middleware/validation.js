import { body, validationResult } from "express-validator";
import handleResponse from "../utils/http-response.js";

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessage = errors.array()[0];
    return handleResponse(400, errorMessage.msg, {}, res);
  }
  next();
};

export const validateLoginAdmin = [
  body("email").isEmail().withMessage("Invalid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  handleValidationErrors,
];

export const passwordChangeValidatrion = [
  body("old_password")
    .isLength({ min: 8 })
    .withMessage("Old password must be at least 8 characters"),
  body("new_password")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters"),
  handleValidationErrors,
];

export const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Invalid email"),
  handleValidationErrors,
];

export const resendOTPValidation = [
  body("email").isEmail().withMessage("Invalid email"),
  body("otp_for")
    .isIn(["SIGNUP", "FORGOT_PASSWORD", "VERIFY_EMAIL", "VERIFY_PHONE"])
    .withMessage("Invalid OTP for"),
  handleValidationErrors,
];

export const verifyOTPValidation = [
  body("email").isEmail().withMessage("Invalid email"),
  body("otp").isLength({ min: 4 }).withMessage("OTP must be 4 digits"),
  body("otp_for")
    .isIn(["SIGNUP", "FORGOT_PASSWORD", "VERIFY_EMAIL", "VERIFY_PHONE"])
    .withMessage("Invalid OTP for"),
  handleValidationErrors,
];

export const resetPasswordValidation = [
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  handleValidationErrors,
];

export const createServiceCategoryValidation = [
  body("title").notEmpty().withMessage("Title is required"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  body("parent_category")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("Invalid parent category id"),
  body("options")
    .optional()
    .isArray()
    .withMessage("Options must be an array"),
  body("options.*.label")
    .optional()
    .isString()
    .withMessage("Option label must be string"),
  body("options.*.status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid option status"),
  handleValidationErrors,
];

export const updateServiceCategoryValidation = [
  body("title").optional().notEmpty().withMessage("Title cannot be empty"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  body("parent_category")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("Invalid parent category id"),
  body("options")
    .optional()
    .isArray()
    .withMessage("Options must be an array"),
  body("options.*.label")
    .optional()
    .isString()
    .withMessage("Option label must be string"),
  body("options.*.status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid option status"),
  handleValidationErrors,
];

export const createTokenMasterValidation = [
  body("title").notEmpty().withMessage("Title is required"),
  body("token_value")
    .isFloat({ min: 0 })
    .withMessage("Token value must be greater than or equal to 0"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const updateTokenMasterValidation = [
  body("title").optional().notEmpty().withMessage("Title cannot be empty"),
  body("token_value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Token value must be greater than or equal to 0"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const createTestimonialMasterValidation = [
  body("name").notEmpty().withMessage("Name is required"),
  body("message").notEmpty().withMessage("Message is required"),
  body("rating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const updateTestimonialMasterValidation = [
  body("name").optional().notEmpty().withMessage("Name cannot be empty"),
  body("message").optional().notEmpty().withMessage("Message cannot be empty"),
  body("rating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const createServiceDocumentRequirementValidation = [
  body("service_category")
    .notEmpty()
    .withMessage("Service category is required")
    .isMongoId()
    .withMessage("Invalid service category id"),
  body("name").notEmpty().withMessage("Name is required"),
  body("type")
    .optional()
    .isIn(["DOCUMENT", "LICENSE"])
    .withMessage("Invalid type"),
  body("is_required")
    .optional()
    .isBoolean()
    .withMessage("is_required must be boolean"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const updateServiceDocumentRequirementValidation = [
  body("service_category")
    .optional()
    .isMongoId()
    .withMessage("Invalid service category id"),
  body("name").optional().notEmpty().withMessage("Name cannot be empty"),
  body("type")
    .optional()
    .isIn(["DOCUMENT", "LICENSE"])
    .withMessage("Invalid type"),
  body("is_required")
    .optional()
    .isBoolean()
    .withMessage("is_required must be boolean"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const initiateServiceRequestValidation = [
  body("service_category")
    .notEmpty()
    .withMessage("Service category is required")
    .isMongoId()
    .withMessage("Invalid service category id"),
  body("child_category")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("Invalid child category id"),
  body("frequency")
    .isIn(["One-time service", "Daily", "Weekly", "Bi-weekly", "Monthly"])
    .withMessage("Invalid frequency"),
  body("selected_options")
    .optional()
    .isArray()
    .withMessage("selected_options must be an array"),
  body("address").notEmpty().withMessage("Address is required"),
  body("contact_details.first_name")
    .notEmpty()
    .withMessage("First name is required"),
  body("contact_details.last_name")
    .notEmpty()
    .withMessage("Last name is required"),
  body("contact_details.client_type")
    .isIn(["Individual", "Company"])
    .withMessage("Invalid client type"),
  body("contact_details.phone")
    .notEmpty()
    .withMessage("Phone is required"),
  body("contact_details.email")
    .isEmail()
    .withMessage("Valid email is required"),
  handleValidationErrors,
];

export const resendServiceRequestOTPValidation = [
  body("request_id")
    .notEmpty()
    .withMessage("Request id is required")
    .isMongoId()
    .withMessage("Invalid request id"),
  handleValidationErrors,
];

export const verifyServiceRequestOTPValidation = [
  body("request_id")
    .notEmpty()
    .withMessage("Request id is required")
    .isMongoId()
    .withMessage("Invalid request id"),
  body("email_otp")
    .isLength({ min: 4, max: 4 })
    .withMessage("Email OTP must be 4 digits"),
  body("phone_otp")
    .isLength({ min: 4, max: 4 })
    .withMessage("Phone OTP must be 4 digits"),
  handleValidationErrors,
];

export const loginAndAttachServiceRequestValidation = [
  body("request_id")
    .notEmpty()
    .withMessage("Request id is required")
    .isMongoId()
    .withMessage("Invalid request id"),
  body("email_or_phone")
    .notEmpty()
    .withMessage("Email or phone is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  handleValidationErrors,
];

export const createVendorReviewValidation = [
  body("vendor")
    .notEmpty()
    .withMessage("Vendor is required")
    .isMongoId()
    .withMessage("Invalid vendor id"),
  body("rating")
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("review").optional().isString().withMessage("Review must be a string"),
  handleValidationErrors,
];
