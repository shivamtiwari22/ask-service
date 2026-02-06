import mongoose from "mongoose";

const TokenMasterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    token_value: {
      type: Number,
      required: true,
      min: 0,
    },
    price:{
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

TokenMasterSchema.index(
  { title: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);
TokenMasterSchema.index({ status: 1 });

const TokenMaster = mongoose.model("TokenMaster", TokenMasterSchema);

export default TokenMaster;
