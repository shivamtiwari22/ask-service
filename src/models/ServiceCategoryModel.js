import mongoose from "mongoose";

const categoryOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { _id: true }
);

const ServiceCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    image: {
      type: String,
      default: null,
      get: (val) => {
        if (!val) return null;
        if (val.startsWith("http")) return val;
        return process.env.IMAGE_URL + val;
      },
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    parent_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      default: null,
    },
    options: {
      type: [categoryOptionSchema],
      default: [],
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
    toObject: { getters: true },
    toJSON: { getters: true },
    retainNullValues: true,
  }
);

ServiceCategorySchema.index(
  { title: 1, parent_category: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);
ServiceCategorySchema.index({ parent_category: 1 });
ServiceCategorySchema.index({ status: 1 });

const ServiceCategory = mongoose.model("ServiceCategory", ServiceCategorySchema);

export default ServiceCategory;
