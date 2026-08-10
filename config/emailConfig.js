import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();

const shouldSendMail = (email) => {
  if (!email) return false;
  return !email.trim().startsWith("#");
};

/** Build RFC From header with a visible sender name (e.g. "Ask Service" <noreply@...>). */
const formatFromAddress = (fromAddress) => {
  const address = String(
    fromAddress || process.env.EMAIL_FROM || process.env.EMAIL_USER || "",
  ).trim();
  if (!address) return undefined;

  // Already includes a display name
  if (address.includes("<") && address.includes(">")) return address;

  const name = String(process.env.EMAIL_FROM_NAME || "Ask Service").trim();
  const safeName = name.replace(/"/g, "");
  return `"${safeName}" <${address}>`;
};

let transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendEmail = async ({ to, subject, html, replyTo, from }) => {
  if (!shouldSendMail(to)) {
    console.log(`Email skipped for ${to}`);
    return;
  }

  await transporter.sendMail({
    from: formatFromAddress(from),
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
};

export const sendBulkEmail = async ({ toList, subject, html, from }) => {
  const filteredRecipients = toList.filter(shouldSendMail);

  if (!filteredRecipients.length) {
    console.log("No valid recipients");
    return;
  }

  await transporter.sendMail({
    from: formatFromAddress(from),
    to: filteredRecipients.join(","),
    subject,
    html,
  });
};
