import mongoose from "mongoose";

const dbConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("DB connected successfully");
    } catch (err) {
        console.log("Error in DB connection : ", err);
    }
}

export default dbConnection;