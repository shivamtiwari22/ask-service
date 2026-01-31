import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_EXPIRY, JWT_SECRET } from "../config/jwtConfig.js";

// Generate JWT token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

export const generateOneMinToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1m" });
};

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
  return Math.floor(1000 + Math.random() * 9000).toString();
};
