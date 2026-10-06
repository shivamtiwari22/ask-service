import mongoose from "mongoose";
import moment from "moment";

const RoleModelSchema = mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: { type: String, trim: true },
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
  media_url: { type: String },
  type: { type: String, enum: ["text", "media"], default: "text" },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  reactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

RoleModelSchema.virtual("id").get(function () {
  return this._id;
});

RoleModelSchema.path("createdAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});

RoleModelSchema.path("updatedAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});

RoleModelSchema.index({ chat: 1, createdAt: -1 });

const Message = mongoose.model("Message", RoleModelSchema);

export default Message;
