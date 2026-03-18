import mongoose from "mongoose";

const QuestionsSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    key: { type: String, required: true },

    type: {
      type: String,
      enum: [
        "text",
        "textarea",
        "number",
        "dropdown",
        "radio",
        "checkbox",
        "date",
        "file",
      ],
      required: true,
    },

    options: [
      {
        label: String,
        value: String,
      },
    ],

    is_multiple: { type: Boolean, default: false },
    is_required: { type: Boolean, default: false },

    placeholder: String,
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },

    step: { type: Number, required: true }, // ⭐ NEW

    order: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

// unique `key` per service (active records only)
QuestionsSchema.index(
  { service_id: 1, key: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
QuestionsSchema.index({ service_id: 1, step: 1, order: 1 });
QuestionsSchema.index({ service_id: 1, createdAt: -1 });

const Question = mongoose.model("Question", QuestionsSchema);
export default Question;
