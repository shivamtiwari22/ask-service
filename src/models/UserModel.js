import mongoose from "mongoose";
import { sanitizeObjectId } from "../../utils/helperFunction.js";

const UserSchema = mongoose.Schema(
  {
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
      required: true,
    },
    profile_pic: {
      type: String,
      default: null,
      get: (val) => {
        if (!val) return null;
        if (val.startsWith("http")) return val;
        return process.env.IMAGE_URL + val;
      },
    },
    // user_type: {
    //   type: String,
    //   enum: ["Individual", "Company"],
    //   default: null,
    // },
    email: {
      type: String,
      required: true,
    },
    is_email_verified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
    },
    is_phone_verified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
    otp_phone: {
      type: String,
      default: null,
    },
    otp_expires_at: {
      type: Date,
      default: null,
    },
    otp_phone_expiry_at: {
      type: String,
      default: null,
    },
    otp_for: {
      type: String,
      enum: ["SIGNUP", "FORGOT_PASSWORD", "VERIFY_EMAIL", "VERIFY_PHONE","LOGIN"],
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "PENDING", "BLOCKED"],
      default: "PENDING",
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      set: sanitizeObjectId,
    },
  },
  {
    timestamps: {},
    retainNullValues: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ updatedAt: 1 });
UserSchema.index({ deletedAt: 1 });

const User = mongoose.model("User", UserSchema);
export default User;
