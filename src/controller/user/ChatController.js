import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import handleResponse from "../../../utils/http-response.js";
import Message from "../../models/MessageModel.js";
import User from "../../models/UserModel.js";
import Chat from "../../models/ChatModel.js";
import VendorReview from "../../models/VendorReviewModel.js";

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
    const base_url = `${req.protocol}://${req.get("host")}`;
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
            ? `${base_url}/${item.latestMessage.sender.profile_pic}`
            : null;
        }
      }

      if (isChat.length > 0) {
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
              ? `${base_url}/${user.profile_pic}`
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
          );

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
    const base_url = `${req.protocol}://${req.get("host")}`;

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
        .populate("quote_id")
        .sort({ createdAt: -1 })
        .lean();

      console.log(chats);

      for (const item of chats) {
        item.latestMessage = await Message.findById(item.latestMessage).lean();
        if (item.latestMessage) {
          item.latestMessage.sender = await User.findById(
            item.latestMessage.sender,
            "_id first_name last_name username profile_pic",
          );

          item.latestMessage.sender.profile_pic = item.latestMessage.sender
            .profile_pic
            ? `${base_url}/${item.latestMessage.sender.profile_pic}`
            : null;
        }

        item.users = await User.find(
          { _id: { $in: item.users }, deletedAt: null },
          "_id first_name last_name username profile_pic",
        ).lean();

        item.users = item.users.map((user) => ({
          ...user,
          profile_pic: user.profile_pic
            ? `${base_url}/${user.profile_pic}`
            : null,
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

      return handleResponse(200, "chat fetched", chats, res);
    } catch (err) {
      return handleResponse(500, err.message, {}, res);
    }
  };

  static allMessages = async (req, res) => {
    let { index = 0, limit = 20 } = req.query;

    const base_url = `${req.protocol}://${req.get("host")}`;

    try {
      const messages = await Message.find({ chat: req.params.chatId })
        .lean()
        .sort({ _id: -1 })
        .skip(parseInt(index))
        .limit(parseInt(limit)); // Limit the number of results;

      for (const item of messages) {
        item.sender = await User.findById(
          item.sender,
          "id first_name last_name username profile_pic",
        );
        item.sender.profile_pic = item.sender.profile_pic
          ? `${base_url}/${item.sender.profile_pic}`
          : null;

        item.readBy = await User.find(
          { id: { $in: item.readBy }, deletedAt: null },
          "id first_name last_name username profile_pic",
        ).lean();

        item.chat = await Chat.findById(item.chat);

        item.reactionCounts = item?.reactions?.reduce((acc, r) => {
          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
          return acc;
        }, {});
      }

      await readMessages(req.user._id, req.params.chatId);

      const lastIndex = parseInt(index) + messages.length;

      return handleResponse(200, "all messages", { messages, lastIndex }, res);
    } catch (e) {
      console.log(e);
      return handleResponse(500, e, {}, res);
    }
  };

  static sendMessage = async (req, res) => {
    const base_url = process.env.IMAGE_URL;
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

        media = `${base_url}/${convertedPath.replace(/\\/g, "/")}`;
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
          { id: { $in: message.chat.users }, deletedAt: null },
          "id first_name last_name username profile_pic",
        ).lean();

        // Format profile_pic URL for each user
        message.chat.users = message.chat.users.map((user) => ({
          ...user,
          profile_pic: user.profile_pic
            ? `${base_url}/${user.profile_pic}`
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
        }
      }

      // -------- users ----------
      chat.users = await User.find(
        { id: { $in: chat.users }, deletedAt: null },
        "id first_name last_name username profile_pic",
      ).lean();

      chat.users = chat.users.map((u) => ({
        ...u,
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
