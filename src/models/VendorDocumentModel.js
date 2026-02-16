import mongoose from "mongoose";

const VendorDocumentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    document_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceDocumentRequirement",
      required: true,
    },
    file: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    retainNullValues: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

const VendorDocument = mongoose.model("VendorDocument", VendorDocumentSchema);
export default VendorDocument;
