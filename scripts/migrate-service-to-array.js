import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  const users = mongoose.connection.collection("users");

  const result = await users.updateMany(
    {
      service: { $exists: true, $ne: null, $not: { $type: "array" } },
    },
    [{ $set: { service: ["$service"] } }],
  );

  const emptyResult = await users.updateMany(
    { $or: [{ service: null }, { service: { $exists: false } }] },
    { $set: { service: [] } },
  );

  console.log(
    `Migration complete: wrapped ${result.modifiedCount} single service(s), set ${emptyResult.modifiedCount} empty service field(s)`,
  );
  await mongoose.disconnect();
};

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
