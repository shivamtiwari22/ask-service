import mongoose from "mongoose";
import moment from "moment";
import { translateNotificationText } from "../../utils/i18n.js";


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
    for : {
       type : String ,
        enum : ["Vendor", "User"],
    } ,
    image: {
      type: String,
      default: null,
    },
    notification_type: {
      type: String,
      enum: [
      
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

RoleModelSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.title = translateNotificationText(this.title);
  }
  if (this.isModified("body")) {
    this.body = translateNotificationText(this.body);
  }
  next();
});

RoleModelSchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    if (doc?.title) doc.title = translateNotificationText(doc.title);
    if (doc?.body) doc.body = translateNotificationText(doc.body);
  });
  next();
});


const Notification = mongoose.model("Notification", RoleModelSchema);


export default Notification;
