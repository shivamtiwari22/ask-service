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
import { Server } from "socket.io";
import http from "http";
import Message from "./src/models/MessageModel.js";
import initBucket from "./utils/initBucket.js";

const app = express();
app.set("trust proxy", 1);
dotenv.config();

dbConnection();
initBucket();

// app.use(cors());
app.use(
  cors({
    origin: "*",
  }),
);

app.use(express.json());
const server = http.createServer(app);
app.use(
  helmet({
    crossOriginResourcePolicy: false, // ✅ disable blocking
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
  max: 10000,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use("", express.static(path.join(__dirname, "")));

app.use("/api/admin", AdminRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/vendor", VendorRoutes);
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
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const io = new Server(server);
const onlineUsers = new Set()
io.on("connection", (socket) => {
  let currentUser = null; 

  socket.on("setup", (userData) => {
    currentUser = userData;
    socket.join(userData.id);
    socket.emit("connected");

 onlineUsers.add(userData.id);

    socket.emit("online:users", Array.from(onlineUsers));
    io.emit("user:online", userData.id);
    // console.log("User online:", userData.id);
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    // console.log("User Joined Room:", room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    const chat = newMessageRecieved.chat;
    if (!chat?.users) return;
    chat.users.forEach((user) => {
      if (user === newMessageRecieved.sender.id) return;
      socket.in(user).emit("message recieved", newMessageRecieved);
    });
  });

socket.on("message:seen", async ({ messageId, chatId, userId }) => {
  await Message.updateOne(
    { _id: messageId },             // ← _id is what MongoDB actually uses
    { $addToSet: { readBy: userId } }
  );
  socket.in(chatId).emit("message:seen:update", {
    messageId,
    userId,
    chatId,                         // ← add this so frontend cache patch works reliably
  });
});

  socket.on(
    "message:reaction",
    async ({ messageId, emoji, userId, chatId }) => {
      await Message.updateOne(
        { id: messageId },
        { $pull: { reactions: { user: userId } } },
      );
      if (!emoji) {
        socket
          .in(chatId)
          .emit("message:reaction:update", { messageId, emoji: null, userId });
        return;
      }
      await Message.updateOne(
        { id: messageId },
        { $push: { reactions: { emoji, user: userId } } },
      );
      socket
        .in(chatId)
        .emit("message:reaction:update", { messageId, emoji, userId });
    },
  );

  // ✅ Fix: disconnect gives a reason string, NOT userData
  socket.on("disconnect", () => {
    if (!currentUser) return;
    // console.log("User disconnected:", currentUser.id);

    const room = io.sockets.adapter.rooms.get(currentUser.id);
    const remainingSockets = room ? room.size : 0;

    if (remainingSockets === 0) {
      // No more connections → truly offline
      io.emit("user:offline", currentUser.id);
    }
  });
});
