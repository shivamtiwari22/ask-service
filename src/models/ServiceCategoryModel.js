import mongoose from "mongoose";
const ServiceCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
    },
    parent_service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
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
    timestamps: {},
    toObject: { getters: true },
    toJSON: { getters: true },
    retainNullValues: true,
  }
);

ServiceCategorySchema.index({ title: 1 }, { unique: true });
ServiceCategorySchema.index({ parent_service: 1 });

const ServiceCategory = mongoose.model("ServiceCategory", ServiceCategorySchema);

export default ServiceCategory;
