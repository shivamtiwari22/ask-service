import mongoose from "mongoose";

const VendorReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    review: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    
      likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likes_count: {
      type: Number,
      default: 0,
    },

  },
  { timestamps: true },
);

VendorReviewSchema.index(
  { user: 1, vendor: 1, service_request_id: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

const VendorReview = mongoose.model("VendorReview", VendorReviewSchema);

export default VendorReview;
