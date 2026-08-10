import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: "auto", // Required for Cloudflare R2
  endpoint: `https://${(process.env.S3_ENDPOINT || "").replace(/^https?:\/\//i, "")}`,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export default s3;