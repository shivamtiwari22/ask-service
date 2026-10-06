import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { JWT_EXPIRY, JWT_SECRET } from "../config/jwtConfig.js";

// Generate JWT token
const ACCESS_EXPIRY = JWT_EXPIRY || "1d";

function subjectId(payload) {
  const id = payload?._id || payload?.id;
  if (!id) throw new Error("Token subject is required");
  return String(id);
}

function signToken(payload, purpose, expiresIn) {
  return jwt.sign({ _id: subjectId(payload), purpose }, JWT_SECRET, { expiresIn });
}

export const generateToken = (payload) => signToken(payload, "access", ACCESS_EXPIRY);

export const generateOneMinToken = (payload) =>
  signToken(payload, "forgot_password", "10m");

export const generate15minToken = (payload) =>
  signToken(payload, "document_upload", "15m");

export const generateSetPasswordToken = (userId) =>
  signToken({ _id: userId }, "SET_PASSWORD", "24h");

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Hash password
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

//Generate OTP
export const generateOTP = () => {
  return crypto.randomInt(1000, 10000).toString();
};

export const authPayloadFromUser = (user) => ({
  _id: String(user?._id || user?.id || ""),
});

export const isValidOtpInput = (otp) => {
  if (otp == null) return false;
  const value = String(otp).trim();
  return /^\d{4,8}$/.test(value);
};

export const otpMatches = (stored, provided) => {
  if (!isValidOtpInput(provided)) return false;
  if (stored == null || stored === "") return false;
  return String(stored).trim() === String(provided).trim();
};

export const isOtpExpired = (expiresAt) => {
  if (!expiresAt) return true;
  const ts = new Date(expiresAt).getTime();
  return Number.isNaN(ts) || ts < Date.now();
};

export function toPublicUser(user) {
  if (!user) return user;
  const data = typeof user.toObject === "function" ? user.toObject() : { ...user };
  for (const field of [
    "password", "otp", "otp_phone", "otp_expires_at", "otp_phone_expiry_at",
    "otp_for", "otp_attempts", "email_verification_token", "phone_otp", "phone_otp_expiry",
  ]) {
    delete data[field];
  }
  return data;
}

export function contactQuery({ email, phone } = {}) {
  const clauses = [];
  if (typeof email === "string" && email.trim()) clauses.push({ email: email.trim() });
  if (typeof phone === "string" && phone.trim()) clauses.push({ phone: phone.trim() });
  if (!clauses.length) return null;
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function recordFailedOtp(user) {
  user.otp_attempts = Number(user.otp_attempts || 0) + 1;
  const locked = user.otp_attempts >= 5;
  if (locked) {
    user.otp = null;
    user.otp_phone = null;
    user.otp_expires_at = null;
    user.otp_phone_expiry_at = null;
    user.otp_for = null;
    user.otp_attempts = 0;
  }
  await user.save();
  return locked;
}
