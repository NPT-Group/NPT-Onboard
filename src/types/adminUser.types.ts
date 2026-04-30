import type { Types } from "mongoose";

export interface IAdminUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  passwordUpdatedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
