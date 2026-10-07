import crypto from "crypto";

const OTP_HASH_PREFIX = "otp1$";

function otpSecret() {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET_KEY;
  if (!secret) throw new Error("OTP_HASH_SECRET or JWT_SECRET_KEY must be set");
  return secret;
}

export const isHashedOtp = (value) =>
  typeof value === "string" && value.startsWith(OTP_HASH_PREFIX);

// A 4-digit code has only 10,000 values, so a plain digest is trivially reversible; a keyed HMAC is not without the secret.
export const hashOtp = (code) =>
  OTP_HASH_PREFIX +
  crypto.createHmac("sha256", otpSecret()).update(String(code).trim()).digest("hex");

export const hashOtpField = (value) => {
  if (value == null || value === "") return value;
  const str = String(value).trim();
  if (isHashedOtp(str)) return str;
  return hashOtp(str);
};

export const isValidOtpInput = (otp) => {
  if (otp == null || typeof otp === "object") return false;
  return /^\d{4,8}$/.test(String(otp).trim());
};

export const otpMatches = (stored, provided) => {
  if (!isValidOtpInput(provided)) return false;
  if (!isHashedOtp(stored)) return false;
  const expected = Buffer.from(stored);
  const actual = Buffer.from(hashOtp(String(provided).trim()));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};
