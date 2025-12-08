// src/mongoose/schemas/onboardingAuditLogSchema.ts
import { Schema } from "mongoose";
import { EOnboardingActor, EOnboardingAuditAction, IOnboardingAuditLog } from "@/types/onboardingAuditLog.types";

export const onboardingAuditLogSchema = new Schema<IOnboardingAuditLog>(
  {
    onboardingId: {
      type: Schema.Types.ObjectId,
      ref: "Onboarding",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: Object.values(EOnboardingAuditAction),
      required: true,
      index: true,
    },

    actorType: {
      type: String,
      enum: Object.values(EOnboardingActor),
      required: true,
    },

    actorEmail: { type: String },

    metadata: { type: Schema.Types.Mixed },

    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);
