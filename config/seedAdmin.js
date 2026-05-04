import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnection from "./dbConnection.js";
import Role from "../src/models/RoleModel.js";
import User from "../src/models/UserModel.js";
import { hashPassword } from "../utils/auth.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await dbConnection();

    const existingUser = await User.findOne({ email: "admin@gmail.com" });
    if (existingUser) {
      console.log(" admin already exists");
      process.exit();
    }


     let role = await Role.findOne({ name: "Admin" });
    if (!role) {
     role = await Role.create({ name: "Admin" });
    }

    const user = await User.create({
      first_name: "Ask",
      last_name : "Service",
      email: "admin@gmail.com",
      password:  await hashPassword("12345678"),
      is_email_verified : true,
      role: role._id,
      status : "ACTIVE",
    });


    console.log("Admin Created:", user.email);
    process.exit();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

seedAdmin();