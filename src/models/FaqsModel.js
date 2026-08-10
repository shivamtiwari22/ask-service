import mongoose from "mongoose";
import moment from "moment";

const FaqsSchema = mongoose.Schema(
  {
    question: { type: String, required: true },
    type: {
      type: String,
      default: "general",
      enum: ["general", "payments", "licensing", "support"],
    },
    answer: { type: String, required: true },
    status: {
      type: Boolean,
      default: true,
    },
    deletedAt: { type: Date, default: null },
    display_order: {
      type: Number,
      default: 999,
      min: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

FaqsSchema.virtual("id").get(function () {
  return this._id;
});

FaqsSchema.path("createdAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});

FaqsSchema.path("updatedAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});

FaqsSchema.index({ display_order: 1, type: 1 });

const Faqs = mongoose.model("Faqs", FaqsSchema);

export default Faqs;
