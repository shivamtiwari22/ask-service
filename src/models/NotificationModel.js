import mongoose from "mongoose";
import moment from "moment";


const RoleModelSchema = mongoose.Schema(
  {
    id: Number,
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
      default: null,
    },
    notification_type: {
      type: String,
      enum: [
        "ROOM_INVITE",
        "COMMUNITY_INVITE",
        "CHALLENGE_INVITE",
        "FOLLOW_NOTIFICATION",
        "LIKE_NOTIFICATION",
        "COMMENT_NOTIFICATION",
        "Notice"
      ],
    },
    url: {
      type: String,
      default: null,
    },
    data: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

RoleModelSchema.path("createdAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});

RoleModelSchema.path("updatedAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});




const Notification = mongoose.model("Notification", RoleModelSchema);

export default Notification;
