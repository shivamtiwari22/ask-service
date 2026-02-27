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
    email: {
      type: String,
    },
    is_email_verified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      default: null,
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
      type: Date,
      default: null,
    },
    email_verification_token: {
      type: String,
      default: null,
    },
    otp_for: {
      type: String,
      enum: [
        "SIGNUP",
        "FORGOT_PASSWORD",
        "VERIFY_EMAIL",
        "VERIFY_PHONE",
        "LOGIN",
      ],
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
    kyc_status: {
      type: String,
      enum: ["ACTIVE", "PENDING", "REJECTED"],
      default: "ACTIVE",
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
    password_updateAt: {
      type: Date,
    },
    verified_at : {
      type: Date,
    } ,
    address: {
      type: String,
    },

    postal_code: {
      type: String,
    },
    city: {
      type: String,
    },

    business_address: {
      type: String,
    },

    vat_number: {
      type: String,
    },

    company_registration_number: {
      type: String,
    },

    years_of_activity: {
      type: String,
    },

    company_size: {
      type: String,
    },

    about_company: {
      type: String,
    },

    website_link: {
      type: String,
    },

    device_id : {
      type: String,
    }
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
