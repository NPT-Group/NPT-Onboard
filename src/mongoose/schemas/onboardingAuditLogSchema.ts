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
    },

    action: {
      type: String,
      enum: Object.values(EOnboardingAuditAction),
      required: true,
    },

    actor: {
      type: onboardingAuditActorSchema,
      required: true,
    },

    message: { type: String, required: true },

    metadata: {
      type: Schema.Types.Mixed,
    },

    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

/* -------------------------------------------------------------------------- */
/* Indexes for OnboardingAuditLog list route performance                       */
/* -------------------------------------------------------------------------- */

// Primary list pattern: filter by onboardingId + sort / range on createdAt
onboardingAuditLogSchema.index({ onboardingId: 1, createdAt: -1 });

// Optional: if you often filter by action within an onboarding
onboardingAuditLogSchema.index({ onboardingId: 1, action: 1, createdAt: -1 });
