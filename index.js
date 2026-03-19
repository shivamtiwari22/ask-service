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
import "./cron/serviceRequestExpiryCron.js"
import {Server} from "socket.io"
import http from "http";
import Message from "./src/models/MessageModel.js";


const app = express();
app.set("trust proxy", 1);
dotenv.config();

dbConnection();

// app.use(cors());
app.use(cors({
  origin: "*"
}));

app.use(express.json());
const server = http.createServer(app);
app.use(helmet({
    crossOriginResourcePolicy: false, // ✅ disable blocking
}));
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





// socket 
const io = new Server(server);
var users = {};
io.on("connection", (socket) => {
  console.log("connected to skip socket");
  
  console.log(socket.id);

  socket.on("setup", (userData) => {
    socket.join(userData.id);
    console.log(userData);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    console.log("chat",newMessageRecieved);
    
    var chat = newMessageRecieved.chat;
    
    if (!chat.users)  console.log("chat.users not defined");
    
    chat.users.forEach((user) => {
      console.log(user);
      if (user === newMessageRecieved.sender.id) return;
      
      console.log("done");
      
      socket.in(user).emit("message recieved", newMessageRecieved);
    });
  });



socket.on("message:seen", async ({ messageId, chatId, userId }) => {

  await Message.updateOne(
    { id: messageId },
    { $addToSet: { readBy: userId} }
  );

  socket.in(chatId).emit("message:seen:update", {
    messageId,
    userId
  });

});




// for message reaction 
socket.on(
  "message:reaction",
  async ({ messageId, emoji, userId, chatId }) => {
    // 1️⃣ remove existing reaction by same user (if any)
    await Message.updateOne(
      { id: messageId },
      { $pull: { reactions: { user: userId } } }
    );

    // 2️⃣ if user clicked emoji again, stop here (means un-react)
    if (!emoji) {
      socket.in(chatId).emit("message:reaction:update", {
        messageId,
        emoji: null,
        userId
      });
      return;
    }

    // 3️⃣ add new reaction
    await Message.updateOne(
      { id: messageId },
      { $push: { reactions: { emoji, user: userId } } }
    );

    // 4️⃣ broadcast to all users in chat
    socket.in(chatId).emit("message:reaction:update", {
      messageId,
      emoji,
      userId
    });
  }
);








  socket.off("setup", () => {
    console.log("USER DISCONNECTED");
    socket.leave(userData.id);
  });
 

  socket.on("disconnect", (userData) => {
    console.log("USER DISCONNECTED");
    socket.leave(userData.id);
  });
 
  // socket.on("disconnect", () => {
  //   console.log("socket disconnected", socket.id);
  //   delete users[socket.id];
  //   io.emit("users-list", users);
  // });



});
