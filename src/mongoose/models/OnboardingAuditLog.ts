// src/mongoose/models/OnboardingAuditLog.ts
import { model, models, type Model } from "mongoose";
import { onboardingAuditLogSchema } from "../schemas/onboardingAuditLogSchema";
import { IOnboardingAuditLog } from "@/types/onboardingAuditLog.types";

export type TOnboardingAuditLogModel = Model<IOnboardingAuditLog>;

export const OnboardingAuditLogModel: TOnboardingAuditLogModel = (models.OnboardingAuditLog as TOnboardingAuditLogModel) || model<IOnboardingAuditLog>("OnboardingAuditLog", onboardingAuditLogSchema);
