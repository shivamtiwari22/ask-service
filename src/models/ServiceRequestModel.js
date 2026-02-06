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
  { _id: false }
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
      enum: ["One-time service", "Daily", "Weekly", "Bi-weekly", "Monthly"],
      required: true,
    },
    selected_options: [{ type: String, trim: true }],
    preferred_start_date: { type: Date, default: null },
    preferred_time_of_day: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true },
    address_1: { type: String, required: true, trim: true },
    address_2: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    pincode: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["PENDING_VERIFICATION", "Active", "CANCELLED", "EXPIRED"],
      default: "PENDING_VERIFICATION",
    },
    contact_details: { type: contactSchema, required: true },
    vendor_requests: [
      {
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ user: 1, createdAt: -1 });
ServiceRequestSchema.index({ service_category: 1, status: 1 });

const ServiceRequest = mongoose.model("ServiceRequest", ServiceRequestSchema);

export default ServiceRequest;
