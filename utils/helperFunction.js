import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generatePassword(length = 8) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+{}[]<>?,.";

  const allChars = upper + lower + numbers + special;

  let password = "";

  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 1; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export async function generateQR(data) {
  try {
    const qrData = typeof data === "string" ? data : JSON.stringify(data);
    const qr = await QRCode.toDataURL(qrData);
    const base64Data = qr.split(",")[1];

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}.png`;

    const filePath = path.join(__dirname, "./../public/qr-code", fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    const relativePath = `public/qr-code/${fileName}`;

    return relativePath;
  } catch (err) {
    console.error("QR Generation Error:", err);
    return null;
  }
}

export async function generateReceiptNumber() {
  const prefix = "RCPT";
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}-${Date.now()}`;
}

export const roundAmount = (value) => {
  if (!value || isNaN(value)) return 0;
  return Math.round(Number(value));
};

export const sanitizeObjectId = (value) =>
  value === "" || value === "undefined" || typeof value === "undefined"
    ? null
    : value;

export const cookieOptions = {
  maxAge: 60 * 1000,
  httpOnly: true,
  secure: false,
  sameSite: "lax",
};

export const documentUploadCookieOptions = {
  maxAge: 15 * 60 * 1000,
  httpOnly: true,
  secure: false,
  sameSite: "lax"
};

export const createReference = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${random}`;
};

const sendGeneratedPasswordToPhone = async ({ phone, password }) => {
  console.log(`Generated password for ${phone}: ${password}`);
};

export const getIdentifierQuery = ({ email, phone }) => {
  if (email) return { email };
  if (phone) return { phone };
  throw new Error("Email or phone required");
};

export const isVendor = (user) => user?.role?.name === "Vendor";
