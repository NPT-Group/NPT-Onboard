import { Schema } from "mongoose";
import type { IAdminUser } from "@/types/adminUser.types";

export const adminUserSchema = new Schema<IAdminUser>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    failedLoginAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

adminUserSchema.index({ email: 1 }, { unique: true });
