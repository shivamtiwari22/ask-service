import mongoose from "mongoose";
import moment from "moment";

const RoleModelSchema = mongoose.Schema({
  chatName: { type: String, trim: true },
  isGroupChat: { type: Boolean, default: false },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  latestMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
  },
  groupAdmin: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  unreadCounts: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      count: { type: Number, default: 0 },
    },
  ],
  
  quote_id : {
    type: mongoose.Schema.Types.ObjectId,
     ref : "VendorQuote" ,
     default : null
  }
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

const Chat = mongoose.model("Chat", RoleModelSchema);

export default Chat;
