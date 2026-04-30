import { model, models, type Model } from "mongoose";
import { adminUserSchema } from "../schemas/adminUserSchema";
import type { IAdminUser } from "@/types/adminUser.types";

export type TAdminUserModel = Model<IAdminUser>;

export const AdminUserModel: TAdminUserModel =
  (models.AdminUser as TAdminUserModel) ||
  model<IAdminUser>("AdminUser", adminUserSchema);
