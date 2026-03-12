import moment from "moment";
import cron from "node-cron";
import ServiceRequest from "../src/models/ServiceRequestModel.js";
import VendorQuote from "../src/models/VendorQuoteModel.js";

cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running ServiceRequest Expiry Cron...");

    const today = moment().startOf("day");

    const expiryDate = moment(today).subtract(7, "days").toDate();


    const quote = await VendorQuote.find();
    const serviceIds =  quote.map((e)=> e.service_request_id);

    const result = await ServiceRequest.updateMany(
      {
        status: "ACTIVE" ,
        deletedAt: null ,
        createdAt: { $lte: expiryDate } ,
        _id : {$nin : serviceIds }
      },
      {
        $set: { status: "EXPIRED" },
      },
    );

    console.log(
      `Expired ${result.modifiedCount} service requests successfully`,
    );
  } catch (error) {
    console.error("ServiceRequest Expiry Cron Error:", error);
  }
});
