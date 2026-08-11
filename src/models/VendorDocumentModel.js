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
    file_name: {
      type: String,
      default: null,
    },
    name: {
      type: String,
    },
    
    required: {
      type: Boolean,
      default: false,
    },

    status : {
        type  : String ,
        enum : ["Pending","Verified","Rejected"] ,
        default : "Pending"
    },
    rejection_reason: {
      type: String,
      default: null,
      trim: true,
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
