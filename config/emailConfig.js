import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();

const shouldSendMail = (email) => {
  if (!email) return false;
  return !email.trim().startsWith("#");
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

export const sendEmail = async ({ to, subject, html }) => {

  if (!shouldSendMail(to)) {
    console.log(`Email skipped for ${to}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html
  });
};

export const sendBulkEmail = async ({ toList, subject, html }) => {
  const filteredRecipients = toList.filter(shouldSendMail);

  if (!filteredRecipients.length) {
    console.log('No valid recipients');
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: filteredRecipients.join(','),
    subject,
    html
  });
};
