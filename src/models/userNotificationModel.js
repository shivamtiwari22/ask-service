import mongoose from "mongoose";

const TransactionModel = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email_notifications: {
      new_quotes: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      product_updates: { type: Boolean, default: false },
    },

    push_notifications: {
      new_quotes: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
    },
    sms_notifications: {
      important_updates: { type: Boolean, default: false },
    },

  },
  {
    timestamps: {},
    retainNullValues: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);


const UserNotification = mongoose.model("UserNotification", TransactionModel);
export default UserNotification;
