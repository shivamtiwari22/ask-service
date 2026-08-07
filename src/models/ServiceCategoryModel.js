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
  { _id: true },
);

export function formatServiceCategoryImageUrl(image) {
  if (!image) return null;
  const value = String(image);
  if (value.startsWith("http")) return value;
  return `${process.env.IMAGE_URL || ""}${value}`;
}

function normalizeLeanCategoryImages(doc) {
  if (!doc || typeof doc !== "object" || doc.$__ != null) return;

  if (Object.prototype.hasOwnProperty.call(doc, "image")) {
    doc.image = formatServiceCategoryImageUrl(doc.image);
  }

  if (doc.parent_category && typeof doc.parent_category === "object") {
    normalizeLeanCategoryImages(doc.parent_category);
  }
}

function serviceCategoryImageTransform(_doc, ret) {
  if (Object.prototype.hasOwnProperty.call(ret, "image")) {
    ret.image = formatServiceCategoryImageUrl(ret.image);
  }

  if (ret.parent_category && typeof ret.parent_category === "object") {
    ret.parent_category.image = formatServiceCategoryImageUrl(
      ret.parent_category.image,
    );
  }

  return ret;
}

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

    credit: {
      type: Number,
      default: 3,
    },
    company_credit: {
      type: Number,
      default: 3,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    frequency: {
      type: [],
      default: [],
    },

    is_frequency_visible: {
      type: Boolean,
      default: false,
    },

    is_start_date_visible: {
      type: Boolean,
      default: false,
    },

    is_start_time_visible: {
      type: Boolean,
      default: false,
    },
    is_tasks_required_visible: {
      type: Boolean,
      default: false,
    },
    is_end_date_visible: {
      type: Boolean,
      default: false,
    },

    is_end_time_visible: {
      type: Boolean,
      default: false,
    },

    is_preferred_time_visible: {
      type: Boolean,
      default: false,
    },

    is_preferred_date_visible: {
      type: Boolean,
      default: false,
    },

    /** Manual display order. Parents ordered among parents; children among siblings. */
    display_order: {
      type: Number,
      default: 999,
      min: 1,
    },
  },
  {
    timestamps: true,
    toObject: { transform: serviceCategoryImageTransform },
    toJSON: { transform: serviceCategoryImageTransform },
    retainNullValues: true,
  },
);

ServiceCategorySchema.post(["find", "findOneAndUpdate"], function (docs) {
  if (!docs) return;
  if (Array.isArray(docs)) docs.forEach(normalizeLeanCategoryImages);
  else normalizeLeanCategoryImages(docs);
});

ServiceCategorySchema.post("findOne", function (doc) {
  normalizeLeanCategoryImages(doc);
});

ServiceCategorySchema.index(
  { title: 1, parent_category: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
ServiceCategorySchema.index({ parent_category: 1 });
ServiceCategorySchema.index({ status: 1 });
ServiceCategorySchema.index({ display_order: 1, parent_category: 1 });

const ServiceCategory = mongoose.model(
  "ServiceCategory",
  ServiceCategorySchema,
);

export default ServiceCategory;
