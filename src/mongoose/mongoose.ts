// src/server/db/mongoose.ts
import mongoose from "mongoose";
import { MONGO_URI } from "@/app/config/env";

let cached = (global as any)._mongoose as {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

if (!cached) {
  cached = (global as any)._mongoose = { conn: null, promise: null };
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, {
        // add options if needed
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
