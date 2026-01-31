import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import dbConnection from "./config/dbConnection.js";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import handleResponse from "./utils/http-response.js";
import logger from "./utils/logger.js";
import cookieParser from "cookie-parser";
import AdminRoutes from "./src/routes/AdminRoutes.js";

const app = express();
app.set("trust proxy", 1);
dotenv.config();

dbConnection();

app.use(cors());

app.use(express.json());
app.use(helmet());
app.use(xss());
app.use(mongoSanitize());
app.use(cookieParser());

process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED_REJECTION", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("UNCAUGHT_EXCEPTION", { error });
  process.exit(1);
});

const blockedIPs = new Map();

app.use((req, res, next) => {
  const ip = req.ip;

  if (blockedIPs.has(ip)) {
    const unblockTime = blockedIPs.get(ip);

    if (Date.now() < unblockTime) {
      return handleResponse(
        429,
        "Too many requests. You are blocked for 4 minutes.",
        {},
        res
      );
    } else {
      blockedIPs.delete(ip);
    }
  }

  next();
});

const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  handler: (req, res) => {
    const ip = req.ip;
    const blockDuration = 4 * 60 * 1000;

    blockedIPs.set(ip, Date.now() + blockDuration);

    return handleResponse(
      429,
      "Rate limit exceeded. You are temporarily blocked for 4 minutes.",
      {},
      res
    );
  },
});

app.use(limit);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use("", express.static(path.join(__dirname, "")));

app.use("/api/admin", AdminRoutes);
// app.use("/api/user", UserRoutes);
app.get("/download", async (req, res) => {
  const fileUrl = req.query.url;

  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();

  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", response.headers.get("content-type"));

  res.send(Buffer.from(buffer));
});

app.get("/", (req, res) => {
  res.send("API is running..");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
