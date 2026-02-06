import mongoose from "mongoose";

const ServiceDocumentRequirementSchema = new mongoose.Schema(
  {
    service_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },
    name: {
      type: String,
      required: true,
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
  }
);

ServiceDocumentRequirementSchema.index(
  { service_category: 1, name: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);
ServiceDocumentRequirementSchema.index({ service_category: 1, status: 1 });

const ServiceDocumentRequirement = mongoose.model(
  "ServiceDocumentRequirement",
  ServiceDocumentRequirementSchema
);

export default ServiceDocumentRequirement;
