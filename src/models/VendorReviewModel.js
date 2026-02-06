import mongoose from "mongoose";

const VendorReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

VendorReviewSchema.index(
  { user: 1, vendor: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

const VendorReview = mongoose.model("VendorReview", VendorReviewSchema);

export default VendorReview;
