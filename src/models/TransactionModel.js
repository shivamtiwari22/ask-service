import mongoose from "mongoose";

const TransactionModel = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
    },
    transaction_number: {
      type: String,
      default: null,
    },
    plat_form: {
      type: String,
      enum: ["stripe", "paypal", "razorpay", "manual"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
    },
    description: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {},
    retainNullValues: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

const Transaction = mongoose.model("Transaction", TransactionModel);
export default Transaction;
