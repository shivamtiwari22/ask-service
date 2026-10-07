import mongoose from "mongoose";

const VendorCreditWalletModel = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: {},
    retainNullValues: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

VendorCreditWalletModel.index(
  { user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $type: "objectId" } } },
);

const VendorCreditWallet = mongoose.model(
  "VendorCreditWallet",
  VendorCreditWalletModel,
);
export default VendorCreditWallet;
