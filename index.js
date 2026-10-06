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
import UserRoutes from "./src/routes/UserRoutes.js";
import VendorRoutes from "./src/routes/vendorRoutes.js";
import "./cron/serviceRequestExpiryCron.js";
import "./cron/accountPermanentDeleteCron.js";
import "./cron/accountDeletionReminderCron.js";
import { Server } from "socket.io";
import http from "http";
import Message from "./src/models/MessageModel.js";
import Chat from "./src/models/ChatModel.js";
import User from "./src/models/UserModel.js";
import initBucket from "./utils/initBucket.js";
import { verifyToken } from "./utils/auth.js";
import mongoose from "mongoose";

const app = express();
app.set("trust proxy", 1);
dotenv.config();

initBucket();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  ...(process.env.CORS_ORIGIN || "").split(","),
]
  .map((value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      return new URL(raw).origin;
    } catch {
      return raw.replace(/\/$/, "");
    }
  })
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
const server = http.createServer(app);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
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
        res,
      );
    } else {
      blockedIPs.delete(ip);
    }
  }

  next();
});

const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler: (req, res) => {
    const ip = req.ip;
    const blockDuration = 4 * 60 * 1000;

    blockedIPs.set(ip, Date.now() + blockDuration);

    return handleResponse(
      429,
      "Rate limit exceeded. You are temporarily blocked for 4 minutes.",
      {},
      res,
    );
  },
});

app.use(limit);

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: (req, res) => {
    return handleResponse(429, "Too many attempts. Try again later.", {}, res);
  },
});

const authPaths = [
  "/api/user/login",
  "/api/user/signup",
  "/api/user/verify-email",
  "/api/user/verify-phone",
  "/api/user/verify-phone-login",
  "/api/user/verify-signup-login",
  "/api/user/forgot-password",
  "/api/user/verify-forgot-password-otp",
  "/api/user/login-phone-email",
  "/api/user/login/email-otp",
  "/api/vendor/login",
  "/api/vendor/register",
  "/api/vendor/verify-otp",
  "/api/vendor/forgot-password",
  "/api/vendor/verify-forgot-password-otp",
  "/api/admin/login",
  "/api/admin/forgot-password",
  "/api/admin/verify-otp",
];
for (const authPath of authPaths) {
  app.use(authPath, authLimit);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api/admin", AdminRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/vendor", VendorRoutes);
const healthCheck = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error("DB not connected");
    await mongoose.connection.db.admin().ping();
    return res.status(200).json({ ok: true, db: "up" });
  } catch {
    return res.status(503).json({ ok: false, db: "down" });
  }
};
app.get("/health", healthCheck);
app.get("/healthz", healthCheck);
app.get("/api/healthz", healthCheck);

app.get("/", (req, res) => {
  res.send("API is running..");
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  return handleResponse(500, "Internal Server Error", {}, res);
});

const PORT = process.env.PORT || process.env.port || 3200;

await dbConnection();

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});
const onlineUsers = new Set();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== "string") return next(new Error("Unauthorized"));
    const decoded = verifyToken(token);
    if (decoded.purpose !== "access") return next(new Error("Unauthorized"));
    const user = await User.findById(decoded._id).select("_id status deletedAt");
    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      return next(new Error("Unauthorized"));
    }
    socket.userId = String(user._id);
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
});

async function socketCanAccessChat(chatId, userId) {
  if (!chatId) return false;
  const chat = await Chat.findById(chatId).select("users");
  if (!chat) return false;
  return (chat.users || []).some((id) => String(id) === String(userId));
}

io.on("connection", (socket) => {
  const currentUserId = socket.userId;

  socket.on("setup", () => {
    socket.join(currentUserId);
    socket.emit("connected");
    onlineUsers.add(currentUserId);
    socket.emit("online:users", Array.from(onlineUsers));
    io.emit("user:online", currentUserId);
  });

  socket.on("join chat", async (room) => {
    if (!room) return;
    const chat = await Chat.findOne({ _id: room, users: currentUserId }).select("_id");
    if (!chat) return;
    socket.join(String(room));
  });

  socket.on("typing", async (room) => {
    if (!(await socketCanAccessChat(room, currentUserId))) return;
    socket.in(String(room)).emit("typing");
  });
  socket.on("stop typing", async (room) => {
    if (!(await socketCanAccessChat(room, currentUserId))) return;
    socket.in(String(room)).emit("stop typing");
  });

  socket.on("new message", async (newMessageRecieved) => {
    const chat = newMessageRecieved?.chat;
    const chatId = chat?._id || chat?.id || chat;
    if (!(await socketCanAccessChat(chatId, currentUserId))) return;
    const senderId = String(newMessageRecieved?.sender?.id || newMessageRecieved?.sender?._id || "");
    if (senderId && senderId !== currentUserId) return;
    (chat?.users || []).forEach((user) => {
      const userId = user?._id || user?.id || user;
      if (String(userId) === currentUserId) return;
      socket.in(String(userId)).emit("message recieved", newMessageRecieved);
    });
  });

  socket.on("message:seen", async ({ messageId, chatId }) => {
    if (!messageId || !chatId) return;
    const chat = await Chat.findOne({ _id: chatId, users: currentUserId }).select("_id");
    if (!chat) return;
    await Message.updateOne(
      { _id: messageId, chat: chatId },
      { $addToSet: { readBy: currentUserId } },
    );
    socket.in(chatId).emit("message:seen:update", {
      messageId,
      userId: currentUserId,
      chatId,
    });
  });

  socket.on("message:reaction", async ({ messageId, emoji, chatId }) => {
    if (!messageId || !chatId) return;
    const chat = await Chat.findOne({ _id: chatId, users: currentUserId }).select("_id");
    if (!chat) return;
    await Message.updateOne(
      { _id: messageId, chat: chatId },
      { $pull: { reactions: { user: currentUserId } } },
    );
    if (!emoji) {
      socket.in(chatId).emit("message:reaction:update", {
        messageId,
        emoji: null,
        userId: currentUserId,
      });
      return;
    }
    await Message.updateOne(
      { _id: messageId, chat: chatId },
      { $push: { reactions: { emoji, user: currentUserId } } },
    );
    socket.in(chatId).emit("message:reaction:update", {
      messageId,
      emoji,
      userId: currentUserId,
    });
  });

  socket.on("disconnect", () => {
    const room = io.sockets.adapter.rooms.get(currentUserId);
    const remainingSockets = room ? room.size : 0;
    if (remainingSockets === 0) {
      onlineUsers.delete(currentUserId);
      io.emit("user:offline", currentUserId);
    }
  });
});
