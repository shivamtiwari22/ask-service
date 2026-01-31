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

export const passwordChangeValidatrion=[
    body("old_password").isLength({ min: 8 }).withMessage("Old password must be at least 8 characters"),
    body("new_password").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
    handleValidationErrors,
]

export const forgotPasswordValidation=[
    body("email").isEmail().withMessage("Invalid email"),
    handleValidationErrors,
]


export const resendOTPValidation=[
    body("email").isEmail().withMessage("Invalid email"),
    body("otp_for").isIn(["SIGNUP", "FORGOT_PASSWORD", "VERIFY_EMAIL", "VERIFY_PHONE"]).withMessage("Invalid OTP for"),
    handleValidationErrors,
]

export const verifyOTPValidation=[
    body("email").isEmail().withMessage("Invalid email"),
    body("otp").isLength({ min: 4 }).withMessage("OTP must be 4 digits"),
    body("otp_for").isIn(["SIGNUP", "FORGOT_PASSWORD", "VERIFY_EMAIL", "VERIFY_PHONE"]).withMessage("Invalid OTP for"),
    handleValidationErrors,
]

export const resetPasswordValidation=[
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    handleValidationErrors,
]