import mongoose from "mongoose";
import moment from "moment";


const RoleModelSchema = mongoose.Schema(
  {
    id: Number,
    name: { type: String, trim: true },
    email: { type: String, require: true },
    // subject: {
    //   type: String,
    //   default: null,
    // },
    message: { type: String, default: null },
  },
  { timestamps: true }
);


RoleModelSchema.path("createdAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});


RoleModelSchema.path("updatedAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY [at] hh:mm A") : null;
});



const ContactUs = mongoose.model("ContactUs", RoleModelSchema);

export default ContactUs;
