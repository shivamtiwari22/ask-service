import mongoose from "mongoose";

const TransactionModel = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    email_notifications: {
      new_leads_available: { type: Boolean, default: true },
      quote_accepted: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      low_credit_balance: { type: Boolean, default: true },
      platform_updates: { type: Boolean, default: false },
    },

    push_notifications: {
      new_leads: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      low_credits: { type: Boolean, default: true },
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

const VendorNotification = mongoose.model("VendorNotification", TransactionModel);

export default VendorNotification;
