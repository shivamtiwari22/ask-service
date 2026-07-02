import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    client_type: {
      type: String,
      enum: ["Individual", "Company"],
      default: "Individual",
    },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ServiceRequestSchema = new mongoose.Schema(
  {
    reference_no: { type: String, required: true, unique: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    service_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },
    child_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      default: null,
    },
    manual_child_category: { type: String, default: null, trim: true },
    frequency: {
      type: String,
      // enum: ["One-time service", "Daily", "Weekly", "Bi-weekly", "Monthly"],
      // required: true,
    },
    selected_options: [
      {
        type: String,
        trim: true,
      },
    ],
    preferred_start_date: {
      type: Date,
      default: null,
    },
    preferred_time_of_day: {
      type: String,
      default: null,
      trim: true,
    },
    start_date: {
      type: Date,
      default: null,
    },
    start_time: {
      type: String,
      default: null,
    },
    end_date: {
      type: Date,
      default: null,
    },
    end_time: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
      trim: true,
    },
    address_1: {
      type: String,
      // required: true,
      trim: true,
    },
    address_2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      // required: true,
      trim: true,
    },
    state: {
      type: String,
      // required: true,
      trim: true,
    },
    country: {
      type: String,
      // required: true,
      trim: true,
    },
    pincode: {
      type: String,
      default: null,
      trim: true,
    },

    cityOrPostalCode : {
      type: String,
      default: null,
      trim: true,
    },

    desiredDate : {
      type: Date,
      default: null,
    } ,

    timeSlot : {
      type: String,
      default: null,
      trim: true,
    } ,

    additionalDetails : {
      type: String,
      default: null,
      trim: true,
    } ,

    contact_details: { type: contactSchema, required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED", "EXPIRED"],
      default: "ACTIVE",
    },
    deletedAt: { type: Date, default: null },
    reason: {
      type: String,
      default: null,
    },

    dynamic_answers: [
      {
        question_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "questions",
        },
        key: String,
        label: String,
        value: String,
      },
    ],

    computed_point: {
      type: Number,
      default: 0,
    },

    max_possible_point: {
      type: Number,
      default: 0,
    },

    point_score_percent: {
      type: Number,
      default: 0,
    },

    lead_stars: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    lead_stars_label: {
      type: String,
      default: "NOT RATED",
      trim: true,
    },
  },
  { timestamps: true },
);

ServiceRequestSchema.index({ user: 1, createdAt: -1 });
ServiceRequestSchema.index({ service_category: 1, status: 1 });

const ServiceRequest = mongoose.model("ServiceRequest", ServiceRequestSchema);

export default ServiceRequest;
