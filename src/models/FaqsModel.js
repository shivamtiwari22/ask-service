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

const Faqs = mongoose.model("Faqs", FaqsSchema);

export default Faqs;
