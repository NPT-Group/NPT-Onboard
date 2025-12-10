// src/mongoose/schemas/onboardingAuditLogSchema.ts
import { Schema } from "mongoose";
import { EOnboardingActor, EOnboardingAuditAction, type IOnboardingAuditLog, type TOnboardingAuditActor } from "@/types/onboardingAuditLog.types";

const onboardingAuditActorSchema = new Schema<TOnboardingAuditActor>(
  {
    type: {
      type: String,
      enum: Object.values(EOnboardingActor),
      required: true,
    },
    id: {
      type: String,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

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

    actor: {
      type: onboardingAuditActorSchema,
      required: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
    },

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
