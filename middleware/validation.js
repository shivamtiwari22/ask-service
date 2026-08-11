import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import handleResponse from "../utils/http-response.js";
import { sanitizeObjectIdArray } from "../utils/helperFunction.js";

const validateServiceCategoryIds = (value, { optional = false } = {}) => {
  if (optional && (value === undefined || value === null || value === "")) {
    return true;
  }

  const ids = sanitizeObjectIdArray(value);
  if (!ids.length) {
    throw new Error("At least one service category is required");
  }

  for (const id of ids) {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      throw new Error("Invalid service category id");
    }
  }

  return true;
};

const QUESTION_OPTION_TYPES = ["dropdown", "radio", "checkbox"];

const questionTypeHasOptions = (type) =>
  QUESTION_OPTION_TYPES.includes(String(type || ""));

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
  body("display_order")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("display_order must be an integer >= 1"),
  body("displayOrder")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("displayOrder must be an integer >= 1"),
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
  body("display_order")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("display_order must be an integer >= 1"),
  body("displayOrder")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("displayOrder must be an integer >= 1"),
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
  body("name").notEmpty().trim().withMessage("Name is required"),
  body("credits")
    .isInt({ min: 1 })
    .withMessage("Credits must be at least 1"),
  body("bonus_credits")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Bonus credits must be 0 or greater"),
  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be 0 or greater"),
  body("currency").optional().isString().trim().withMessage("Currency must be string"),
  body("per_credit_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Per credit price must be 0 or greater"),
  body("is_most_popular").optional().isBoolean().withMessage("is_most_popular must be boolean"),
  body("sort_order").optional().isInt({ min: 0 }).withMessage("sort_order must be non-negative integer"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

export const updateTokenMasterValidation = [
  body("name").optional().notEmpty().trim().withMessage("Name cannot be empty"),
  body("credits")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Credits must be at least 1"),
  body("bonus_credits")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Bonus credits must be 0 or greater"),
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be 0 or greater"),
  body("currency").optional().isString().trim().withMessage("Currency must be string"),
  body("per_credit_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Per credit price must be 0 or greater"),
  body("is_most_popular").optional().isBoolean().withMessage("is_most_popular must be boolean"),
  body("sort_order").optional().isInt({ min: 0 }).withMessage("sort_order must be non-negative integer"),
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
  body("service_category").custom((value) =>
    validateServiceCategoryIds(value),
  ),
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
  body("display_order")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("display_order must be an integer >= 1"),
  body("displayOrder")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("displayOrder must be an integer >= 1"),
  handleValidationErrors,
];

export const updateServiceDocumentRequirementValidation = [
  body("service_category")
    .optional()
    .custom((value) => validateServiceCategoryIds(value, { optional: true })),
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
  body("display_order")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("display_order must be an integer >= 1"),
  body("displayOrder")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("displayOrder must be an integer >= 1"),
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

export const createFaqValidation = [
  body("question").notEmpty().trim().withMessage("Question is required"),
  body("answer").notEmpty().trim().withMessage("Answer is required"),
  body("type")
    .optional()
    .isIn(["general", "clients", "providers", "registration-verification", "credits-leads", "support"])
    .withMessage("Invalid FAQ type"),
  body("status").optional().isBoolean().withMessage("Status must be boolean"),
  body("display_order")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("display_order must be an integer >= 1"),
  body("displayOrder")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("displayOrder must be an integer >= 1"),
  handleValidationErrors,
];

export const updateFaqValidation = [
  body("question").optional().notEmpty().trim().withMessage("Question cannot be empty"),
  body("answer").optional().notEmpty().trim().withMessage("Answer cannot be empty"),
  body("type")
    .optional()
    .isIn(["general", "clients", "providers", "registration-verification", "credits-leads", "support"])
    .withMessage("Invalid FAQ type"),
  body("status").optional().isBoolean().withMessage("Status must be boolean"),
  body("display_order")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("display_order must be an integer >= 1"),
  body("displayOrder")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("displayOrder must be an integer >= 1"),
  handleValidationErrors,
];

export const createQuestionValidation = [
  body("label").notEmpty().trim().withMessage("Label is required"),
  body("key").notEmpty().trim().withMessage("Key is required"),
  body("type")
    .notEmpty()
    .isIn([
      "text",
      "textarea",
      "number",
      "dropdown",
      "radio",
      "checkbox",
      "date",
      "file",
      "datetime",
      "time"
    ])
    .withMessage("Invalid question type"),
  body("service_id").optional().isMongoId().withMessage("Invalid service id"),
  body("service_ids")
    .optional()
    .custom((value) => validateServiceCategoryIds(value, { optional: true })),
  body().custom((_, { req }) => {
    const hasSingle =
      req.body.service_id &&
      mongoose.Types.ObjectId.isValid(String(req.body.service_id));
    const ids = sanitizeObjectIdArray(req.body.service_ids);
    if (!hasSingle && !ids.length) {
      throw new Error("At least one service category is required");
    }
    return true;
  }),
  body("step").notEmpty().isInt({ min: 1 }).withMessage("Step must be >= 1"),
  body("order").optional().isInt({ min: 0 }).withMessage("Order must be >= 0"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  body("is_multiple")
    .optional()
    .isBoolean()
    .withMessage("is_multiple must be boolean"),
  body("is_required")
    .optional()
    .isBoolean()
    .withMessage("is_required must be boolean"),
  body("options")
    .optional()
    .isArray()
    .withMessage("Options must be an array"),
  body("options.*.label")
    .optional()
    .isString()
    .withMessage("Option label must be string"),
  body("options.*.value")
    .optional()
    .isString()
    .withMessage("Option value must be string"),
  body("point")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Point must be a number >= 0"),
  body("options.*.point")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Option point must be a number >= 0"),
  body().custom((_, { req }) => {
    const type = req.body.type;
    if (questionTypeHasOptions(type)) {
      const options = req.body.options;
      if (!Array.isArray(options) || !options.length) {
        throw new Error("Options are required for this question type");
      }
      for (const opt of options) {
        if (opt.point === undefined || opt.point === null || opt.point === "") {
          throw new Error("Each option must have a point value");
        }
      }
      return true;
    }

    if (req.body.point === undefined || req.body.point === null || req.body.point === "") {
      throw new Error("Point is required for this question type");
    }
    return true;
  }),
  handleValidationErrors,
];

export const updateQuestionValidation = [
  body("label").optional().notEmpty().trim().withMessage("Label cannot be empty"),
  body("key").optional().notEmpty().trim().withMessage("Key cannot be empty"),
  body("type")
    .optional()
    .isIn([
      "text",
      "textarea",
      "number",
      "dropdown",
      "radio",
      "checkbox",
      "date",
      "file",
      "datetime",
      "time",
    ])
    .withMessage("Invalid question type"),
  body("service_id").optional().isMongoId().withMessage("Invalid service id"),
  body("step").optional().isInt({ min: 1 }).withMessage("Step must be >= 1"),
  body("order").optional().isInt({ min: 0 }).withMessage("Order must be >= 0"),
  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Invalid status"),
  body("is_multiple")
    .optional()
    .isBoolean()
    .withMessage("is_multiple must be boolean"),
  body("is_required")
    .optional()
    .isBoolean()
    .withMessage("is_required must be boolean"),
  body("options")
    .optional()
    .isArray()
    .withMessage("Options must be an array"),
  body("options.*.label")
    .optional()
    .isString()
    .withMessage("Option label must be string"),
  body("options.*.value")
    .optional()
    .isString()
    .withMessage("Option value must be string"),
  body("point")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Point must be a number >= 0"),
  body("options.*.point")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Option point must be a number >= 0"),
  body().custom((_, { req }) => {
    const type = req.body.type;
    if (Array.isArray(req.body.options) && req.body.options.length) {
      for (const opt of req.body.options) {
        if (opt.point === undefined || opt.point === null || opt.point === "") {
          throw new Error("Each option must have a point value");
        }
      }
    }

    if (type && questionTypeHasOptions(type)) {
      if (req.body.options !== undefined) {
        if (!Array.isArray(req.body.options) || !req.body.options.length) {
          throw new Error("Options are required for this question type");
        }
      }
      return true;
    }

    if (type && req.body.point === undefined) {
      throw new Error("Point is required for this question type");
    }
    return true;
  }),
  handleValidationErrors,
];

