import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  const collection = mongoose.connection.collection("servicedocumentrequirements");

  try {
    await collection.dropIndex("service_category_1_name_1_type_1");
    console.log("Dropped legacy unique index service_category_1_name_1_type_1");
  } catch (err) {
    console.log("Legacy index drop skipped:", err.message);
  }

  const result = await collection.updateMany(
    {
      service_category: { $exists: true, $ne: null, $not: { $type: "array" } },
    },
    [{ $set: { service_category: ["$service_category"] } }],
  );

  console.log(
    `Document requirement migration complete: wrapped ${result.modifiedCount} record(s)`,
  );
  await mongoose.disconnect();
};

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
