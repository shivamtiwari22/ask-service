import mongoose from "mongoose";
import { sanitizeObjectIdArray } from "../../utils/helperFunction.js";

const ServiceDocumentRequirementSchema = new mongoose.Schema(
  {
    service_category: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory" }],
      required: true,
      set: sanitizeObjectIdArray,
      get: (val) => {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    allowed_formats: {
      type: String,
      default: "PDF, JPG, PNG (Max 5MB)",
      trim: true,
    },
    type: {
      type: String,
      enum: ["DOCUMENT", "LICENSE"],
      default: "DOCUMENT",
    },
    is_required: {
      type: Boolean,
      default: false,
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
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

ServiceDocumentRequirementSchema.index(
  { name: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
ServiceDocumentRequirementSchema.index({ service_category: 1, status: 1 });

const ServiceDocumentRequirement = mongoose.model(
  "ServiceDocumentRequirement",
  ServiceDocumentRequirementSchema,
);

export default ServiceDocumentRequirement;
