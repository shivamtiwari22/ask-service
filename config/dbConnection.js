import mongoose from "mongoose";

const dbConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 10000 });
        console.log("DB connected successfully");
    } catch (err) {
        console.log("Error in DB connection : ", err);
        process.exit(1);
    }
}

export default dbConnection;
