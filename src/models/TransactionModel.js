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
    payment_method : {
      type :String 
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
    },
    amount_paid: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: "EUR",
    },
    description: {
      type: String,
      default: null,
    },
  
    balance_after: {
      type: Number,
      default: null,
    },

    reference_type: {
      type: String,
      enum: ["lead_unlock", "credit_purchase", "adjustment"],
      default: null,
    },
    reference_id: {
      type: mongoose.Schema.Types.ObjectId,
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
