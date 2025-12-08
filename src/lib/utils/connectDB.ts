import { MONGO_URI } from "@/config/env";
import mongoose from "mongoose";

let isConnected: boolean = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  const uri = MONGO_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  try {
    await mongoose.connect(uri, {
      // You can add options here if needed
    });
    isConnected = true;
    // Optionally log connection success
  } catch (error) {
    isConnected = false;
    throw error;
  }
};

export default connectDB;
