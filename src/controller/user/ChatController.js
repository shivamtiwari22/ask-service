import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import handleResponse from "../../../utils/http-response.js";
import Message from "../../models/MessageModel.js";
import User from "../../models/UserModel.js";
import Chat from "../../models/ChatModel.js";
import VendorReview from "../../models/VendorReviewModel.js";
import pushNotification from "../../../config/pushNotification.js";
import Notification from "../../models/NotificationModel.js";
import UserNotification from "../../models/userNotificationModel.js";
import VendorNotification from "../../models/vendorNotificationModel.js";
import { sendEmail } from "../../../config/emailConfig.js";
import newMessageMail from "../../../config/email/newMessageMail.js";

const toImageUrl = (path) => {
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  const base = (process.env.IMAGE_URL || "").replace(/\/+$/, "");
  const key = String(path).replace(/^\/+/, "");
  return `${base}/${key}`;
};

ffmpeg.setFfmpegPath(ffmpegPath);

const AUDIO_CONVERT_EXT = [".webm", ".m4a", ".ogg", ".opus", ".wav", ".aac"];

async function convertToMp3IfNeeded(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // if not required extension, return same file

  if (!AUDIO_CONVERT_EXT.includes(ext)) {
    return filePath;
  }

  const dir = path.dirname(filePath);
  const filename = path.basename(filePath, ext);
  const mp3Path = path.join(dir, `${filename}.mp3`);

  // if already converted exists
  if (fs.existsSync(mp3Path)) return mp3Path;

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .toFormat("mp3")
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .on("end", () => resolve(mp3Path))
      .on("error", (err) => reject(err))
      .save(mp3Path);
  });
}

class ChatController {
  static allUsers = async (req, resp) => {
    try {
      const userId = req.user._id;
      const base_url = `${req.protocol}://${req.get("host")}`;

      // const bookings = await Booking.find({
      //   $or: [{ seller_id: userId }, { created_by: userId }],
      // });

      // // Extract unique user IDs
      // const userIds = bookings.reduce((acc, booking) => {
      //   if (booking.seller_id.toString() !== userId.toString()) {
      //     acc.add(booking.seller_id);
      //   }
      //   if (booking.created_by.toString() !== userId.toString()) {
      //     acc.add(booking.created_by);
      //   }
      //   return acc;
      // }, new Set());

      const users = await User.find(
        {
          // id: { $in: Array.from(userIds) },
          _id: { $ne: req.user._id },
          deletedAt: null,
        },
        "_id first_name last_name username profile_pic",
      );

      return handleResponse(200, "users fetched successsfully", users, resp);
    } catch (err) {
      return handleResponse(500, err.message, {}, resp);
    }
  };

  static accessChat = async (req, res) => {
    const { userId, quote_id } = req.body;
    try {
      if (!userId) {
        return handleResponse(
          400,
          "UserId body not sent with request",
          {},
          res,
        );
      }

      var isChat = await Chat.find({
        isGroupChat: false,
        $and: [
          { users: { $elemMatch: { $eq: req.user._id } } },
          { users: { $elemMatch: { $eq: userId } } },
        ],
      }).lean();

      for (const item of isChat) {
        item.latestMessage = await Message.findById(item.latestMessage).lean();
        if (item.latestMessage) {
          item.latestMessage.sender = await User.findById(
            item.latestMessage.sender,
            "_id first_name last_name username profile_pic",
          );
          item.latestMessage.sender.profile_pic = item.latestMessage.sender
            .profile_pic
            ? toImageUrl(item.latestMessage.sender.profile_pic)
            : null;
          if (item.latestMessage.media_url) {
            item.latestMessage.media_url = toImageUrl(
              item.latestMessage.media_url,
            );
          }
        }
      }

      if (isChat.length > 0) {
        if (quote_id) {
          await Chat.findByIdAndUpdate(isChat[0]._id, {
            quote_id: quote_id,
          });
          isChat[0].quote_id = quote_id;
        }

        for (const chat of isChat) {
          chat.users = await User.find(
            { _id: { $in: chat.users }, deletedAt: null },
            "id first_name last_name username profile_pic kyc_status",
          )
            .populate("role")
            .lean();

          for (const user of chat.users) {
            let totalReviews = 0;
            let averageRating = 0;

            // ✅ Only for vendor role
            if (user.role?.name === "Vendor") {
              const reviews = await VendorReview.find({
                vendor: user._id,
              }).lean();

              user.totalReviews = reviews.length;

              user.averageRating =
                totalReviews > 0
                  ? (
                      reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                      totalReviews
                    ).toFixed(1)
                  : 0;
            }
          }

          // Format profile_pic URL for each user
          chat.users = chat.users.map((user) => ({
            ...user,
            profile_pic: user.profile_pic
              ? toImageUrl(user.profile_pic)
              : null,

            itsMe: user._id.toString() === req.user._id.toString(),
          }));
        }

        handleResponse(200, "chat access", isChat[0], res);
      } else {
        var chatData = {
          chatName: "sender",
          isGroupChat: false,
          users: [req.user._id, userId],
          quote_id: quote_id,
        };

        try {
          const createdChat = await Chat.create(chatData);
          const FullChat = await Chat.findById(createdChat._id);

          FullChat.users = await User.find(
            { _id: { $in: FullChat.users }, deletedAt: null },
            "id first_name last_name username profile_pic kyc_status",
          )
            .populate("role")
            .lean();

          for (const user of FullChat.users) {
            let totalReviews = 0;
            let averageRating = 0;

            // ✅ Only for vendor role
            if (user.role?.name === "Vendor") {
              const reviews = await VendorReview.find({
                vendor: user._id,
              }).lean();

              user.totalReviews = reviews.length;

              user.averageRating =
                totalReviews > 0
                  ? (
                      reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                      totalReviews
                    ).toFixed(1)
                  : 0;

              ((user.profile_pic = user.profile_pic
                ? toImageUrl(user.profile_pic)
                : null),
                (user.itsMe = user._id.toString() === req.user._id.toString()));
            }
          }

          return handleResponse(200, "chat access", FullChat, res);
        } catch (error) {
          console.log(error);

          return handleResponse(500, error, {}, res);
        }
      }
    } catch (e) {
      console.log(e);

      return handleResponse(500, e, {}, res);
    }
  };

  static fetchChats = async (req, res) => {
    const { search } = req.query;

    let userIds = [req.user._id];

    if (search) {
      const users = await User.find({
        $or: [
          { first_name: { $regex: search, $options: "i" } },
          { last_name: { $regex: search, $options: "i" } },
        ],
      });

      userIds.push(...users.map((u) => u._id));
    }

    try {
      const chats = await Chat.find({
        users: { $in: userIds },
        isGroupChat: false,
      })
        .populate({
          path: "quote_id",
          populate: {
            path: "service_request_id",
            populate: [
              {
                path: "service_category",
              },
              {
                path: "child_category",
              },
            ],
          },
        })
        // .sort({ createdAt: -1 })
        .lean();

      console.log(chats);

      for (const item of chats) {
        item.latestMessage = await Message.findById(item.latestMessage).lean();
        if (item.latestMessage) {
          item.latestMessage.sender = await User.findById(
            item.latestMessage.sender,
            "_id first_name last_name username profile_pic business_name",
          );

          if (item.latestMessage.sender) {
            item.latestMessage.sender.profile_pic = toImageUrl(
              item?.latestMessage?.sender?.profile_pic,
            );
          }
          if (item.latestMessage.media_url) {
            item.latestMessage.media_url = toImageUrl(
              item.latestMessage.media_url,
            );
          }
        }

        item.users = await User.find(
          { _id: { $in: item.users }, deletedAt: null },
          "_id first_name last_name username profile_pic kyc_status business_name",
        )
          .populate("role")
          .lean();

        for (const user of item.users) {
          let totalReviews = 0;
          let averageRating = 0;

          // ✅ Only for vendor role
          if (user.role?.name === "Vendor") {
            const reviews = await VendorReview.find({
              vendor: user._id,
            }).lean();

            user.totalReviews = reviews.length;
            totalReviews = reviews.length;

            user.averageRating =
              totalReviews > 0
                ? (
                    reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                    totalReviews
                  ).toFixed(1)
                : 0;
          }
        }

        item.users = item.users.map((user) => ({
          ...user,
          profile_pic: toImageUrl(user?.profile_pic)
        }));

        item.users = item.users.map((u) => ({
          ...u,
          itsMe: u._id.toString() === req.user._id.toString(),
        }));

        // Find the unread count for the requesting user
        const unreadCount = item.unreadCounts.find(
          (uc) => uc.user.toString() === req.user._id.toString(),
        );
        item.unreadCount = unreadCount ? unreadCount.count : 0;
      }

      chats.sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) {
          return b.unreadCount - a.unreadCount; // unread first
        }
        return new Date(b.updatedAt) - new Date(a.updatedAt); // then latest
      });

      return handleResponse(200, "chat fetched", chats, res);
    } catch (err) {
      console.log(err);

      return handleResponse(500, err.message, {}, res);
    }
  };

  static allMessages = async (req, res) => {
    let { index = 1, limit = 20 } = req.query;

    let page = parseInt(index);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    try {
      const messages = await Message.find({ chat: req.params.chatId })
        .lean()
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit);

      for (const item of messages) {
        item.sender = await User.findById(
          item.sender,
          "id first_name last_name username profile_pic",
        );

        if (item.sender) {
          item.sender.profile_pic = toImageUrl(item.sender?.profile_pic);
        }

        item.readBy = await User.find(
          { _id: { $in: item.readBy }, deletedAt: null },
          "id first_name last_name username profile_pic",
        ).lean();

        const formatImage = (path) => toImageUrl(path);

        item.readBy = item.readBy.map((user) => ({
          ...user,
          profile_pic: user?.profile_pic
            ? formatImage(user?.profile_pic)
            : null,
        }));

        if (item.media_url) {
          item.media_url = toImageUrl(item.media_url);
        }

        item.chat = await Chat.findById(item.chat);

        item.reactionCounts = item?.reactions?.reduce((acc, r) => {
          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
          return acc;
        }, {});
      }

      await readMessages(req.user._id, req.params.chatId);

      const lastIndex = page;
      const totalMsg = await Message.countDocuments({
        chat: req.params.chatId,
      });
      const totalPages = Math.ceil(totalMsg / parseInt(limit));

      return handleResponse(
        200,
        "all messages",
        { messages, lastIndex, totalMsg, totalPages },
        res,
      );
    } catch (e) {
      console.log(e);
      return handleResponse(500, e, e.message, res);
    }
  };

  static sendMessage = async (req, res) => {
    const files = req.files;

    const { content, chatId } = req.body;

    if (!chatId) {
      console.log("Invalid data passed into request");
      return handleResponse(400, "Chat Id is required", {}, res);
    }

    let media;
    if (files) {
      if (files.media && files.media.length > 0) {
        let filePath = files.media[0].path.replace(/\\/g, "/");
        const convertedPath = await convertToMp3IfNeeded(filePath);

        // Store storage key only; resolve URL when returning messages
        media = convertedPath.replace(/\\/g, "/");
      }
    }

    var newMessage = {
      sender: req.user._id,
      content: content,
      chat: chatId,
      media_url: media,
      type: media ? "media" : "text",
    };

    try {
      var message = await Message.create(newMessage);

      message.sender = await User.findById(
        message.sender,
        "_id first_name last_name username profile_pic",
      );

      message.chat = await Chat.findById(message.chat);

      if (message.chat) {
        message.chat.users = await User.find(
          { _id: { $in: message.chat.users }, deletedAt: null },
          "id first_name last_name username profile_pic",
        ).lean();

        // Format profile_pic URL for each user
        message.chat.users = message.chat.users.map((user) => ({
          ...user,
          profile_pic: user.profile_pic
            ? toImageUrl(user.profile_pic)
            : null,
        }));
      }

      const chat = await Chat.findById(chatId);
      chat.latestMessage = message._id;

      chat.unreadCounts = chat.unreadCounts || [];

      // Increment unread count for all users except the sender
      chat.users.forEach((userId) => {
        if (userId.toString() !== req.user._id.toString()) {
          const userUnread = chat.unreadCounts.find(
            (uc) => uc.user?.toString() === userId?.toString(),
          );
          if (userUnread) {
            userUnread.count += 1;
          } else {
            chat.unreadCounts.push({ user: userId, count: 1 });
          }
        }
      });

      await chat.save();

      //  await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message._id });

      // get receiver users (except sender)
      const receiverIds = chat.users.filter(
        (userId) => userId.toString() !== req.user._id.toString(),
      );

      // fetch their FCM tokens
      const users = await User.findOne(
        { _id: { $in: receiverIds }, fcm_token: { $ne: null } },
        "fcm_token first_name last_name",
      );

      // send push
      if (users?.fcm_token) {
        await pushNotification(
          users.fcm_token,
          "Nouveau message",
          content || "📎 Message media",
        );
      }

      // In-app notification + email for each receiver (User ↔ Vendor)
      if (receiverIds.length) {
        const receivers = await User.find({ _id: { $in: receiverIds } })
          .select("_id role email first_name last_name")
          .populate({ path: "role", select: "name" })
          .lean();

        const notificationDocs = receivers.map((receiver) => {
          const roleName = receiver.role?.name;
          return {
            user_id: receiver._id,
            title: "Nouveau message",
            body: content || "📎 Message media",
            for: roleName === "Vendor" ? "Vendor" : "User",
          };
        });

        if (notificationDocs.length) {
          await Notification.insertMany(notificationDocs);
        }

        const senderName = [message.sender?.first_name, message.sender?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Quelqu'un";
        const isMedia = Boolean(media) || !content;
        const messagePreview = content
          ? String(content).slice(0, 280)
          : "📎 Message media";

        await Promise.all(
          receivers.map(async (receiver) => {
            if (!receiver?.email) return;

            try {
              const isVendor = receiver.role?.name === "Vendor";
              const prefs = isVendor
                ? await VendorNotification.findOne({
                    user_id: receiver._id,
                  }).lean()
                : await UserNotification.findOne({
                    user_id: receiver._id,
                  }).lean();

              const canEmail = prefs?.email_notifications?.messages ?? true;
              if (!canEmail) return;

              const receiverName =
                receiver.first_name ||
                receiver.last_name ||
                (isVendor ? "Prestataire" : "Client");

              await sendEmail({
                to: receiver.email,
                subject: `Nouveau message de ${senderName}`,
                html: await newMessageMail({
                  name: receiverName,
                  senderName,
                  messagePreview,
                  isMedia,
                  chatId,
                }),
              });
            } catch (mailErr) {
              console.log(
                "New message email failed:",
                mailErr?.message || mailErr,
              );
            }
          }),
        );
      }

      return handleResponse(200, "msg sent", message, res);
    } catch (e) {
      console.log(e);

      return handleResponse(500, e.message, {}, res);
    }
  };

  static reactToMessage = async (req, res) => {
    const { messageId, emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ message: "Message not found" });

    const existing = message.reactions.find(
      (r) => r.user.toString() === userId.toString(),
    );

    if (!existing) {
      // ➕ add reaction
      message.reactions.push({ user: userId, emoji });
    } else if (existing.emoji === emoji) {
      // ❌ remove reaction (toggle off)
      message.reactions = message.reactions.filter(
        (r) => r.user.toString() !== userId.toString(),
      );
    } else {
      // 🔄 change reaction
      existing.emoji = emoji;
    }

    await message.save();

    const populated = await message;

    return handleResponse(200, "reacted", { populated }, res);
  };

  // Mark all chat messages as seen by this user
  static MarkAllMessagesSeen = async (req, res) => {
    try {
      const { chatId } = req.params;

      await Message.updateMany(
        {
          chat: chatId,
        },
        { $addToSet: { readBy: req.user._id } },
      );

      return handleResponse(200, "Messages marked as seen", {}, res);
    } catch (err) {
      console.error(err);
      return handleResponse(500, "error", { err }, res);
    }
  };

  static MarkMessagesSeen = async (req, res) => {
    try {
      const { id } = req.params;

      const msg = await Message.updateOne(
        { _id: id },
        { $addToSet: { readBy: req.user._id } },
      );

      return handleResponse(200, "Messages marked as seen", {}, res);
    } catch (err) {
      console.error(err);
      return handleResponse(500, "error", { err }, res);
    }
  };

  static singleChat = async (req, res) => {
    try {
      const chat = await Chat.findById(req.params.id).lean();

      if (!chat) {
        return handleResponse(404, "Chat not found", {}, res);
      }

      // -------- latest message ----------
      if (chat.latestMessage) {
        chat.latestMessage = await Message.findById(chat.latestMessage).lean();

        if (chat.latestMessage) {
          chat.latestMessage.sender = await User.findById(
            chat.latestMessage.sender,
            "_id first_name last_name username profile_pic",
          ).lean();
          if (chat.latestMessage.sender) {
            chat.latestMessage.sender.profile_pic = toImageUrl(
              chat.latestMessage.sender.profile_pic,
            );
          }
          if (chat.latestMessage.media_url) {
            chat.latestMessage.media_url = toImageUrl(
              chat.latestMessage.media_url,
            );
          }
        }
      }

      // -------- users ----------
      chat.users = await User.find(
        { id: { $in: chat.users }, deletedAt: null },
        "id first_name last_name username profile_pic",
      ).lean();

      chat.users = chat.users.map((u) => ({
        ...u,
        profile_pic: toImageUrl(u.profile_pic),
        itsMe: u._id.toString() === req.user._id.toString(),
      }));

      // -------- unread count ----------
      const unreadCount = chat.unreadCounts?.find(
        (uc) => uc.user.toString() === req.user._id.toString(),
      );

      chat.unreadCount = unreadCount ? unreadCount.count : 0;

      return handleResponse(200, "chat fetched", chat, res);
    } catch (err) {
      return handleResponse(500, err.message, {}, res);
    }
  };
}

const readMessages = async (userId, chatId) => {
  const chat = await Chat.findById(chatId);

  // Reset the unread count for the user
  chat.unreadCounts = chat.unreadCounts.map((unreadCount) => {
    if (unreadCount.user?.toString() === userId?.toString()) {
      return {
        user: unreadCount.user,
        count: 0,
      };
    }
    return unreadCount;
  });

  await chat.save();
};

export default ChatController;
