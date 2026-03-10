import moment from "moment";
import cron from "node-cron";
import ServiceRequest from "../src/models/ServiceRequestModel.js";

cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running ServiceRequest Expiry Cron...");

    const today = moment().startOf("day");

    const expiryDate = moment(today).subtract(7, "days").toDate();

    const result = await ServiceRequest.updateMany(
      {
        status: "ACTIVE",
        deletedAt: null,
        createdAt: { $lte: expiryDate },
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
