// src/mongoose/schemas/onboardingSchema.ts
import { geoLocationSchema } from "./sharedSchemas";
import { indiaOnboardingFormDataSchema, canadaOnboardingFormDataSchema, usOnboardingFormDataSchema } from "./onboardingFormDataSchemas";
import { EOnboardingMethod, EOnboardingStatus, ETerminationType, IOnboardingInvite, IOnboardingOtp, TOnboarding, TOnboardingDoc } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import { Schema } from "mongoose";

const onboardingInviteSchema = new Schema<IOnboardingInvite>(
  {
    tokenHash: { type: String, required: true },
    tokenEncrypted: { type: String, required: false },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { _id: false }
);

const onboardingOtpSchema = new Schema<IOnboardingOtp>(
  {
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
    lockedAt: { type: Date },
    lastSentAt: { type: Date, required: true },
  },
  { _id: false }
);

export const onboardingSchema = new Schema<TOnboarding>(
  {
    subsidiary: {
      type: String,
      enum: Object.values(ESubsidiary),
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: Object.values(EOnboardingMethod),
      required: true,
      index: true,
    },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: Object.values(EOnboardingStatus),
      required: true,
      index: true,
    },

    modificationRequestMessage: {
      type: String,
      required: false,
    },
    modificationRequestedAt: {
      type: Date,
      required: false,
    },

    employeeNumber: {
      type: String,
      index: true,
    },

    invite: { type: onboardingInviteSchema, required: false },
    otp: { type: onboardingOtpSchema, required: false },

    locationAtSubmit: { type: geoLocationSchema, required: false },

    // New field – tracks whether the *form* has ever been fully submitted
    isFormComplete: { type: Boolean, required: true, default: false },

    // Existing lifecycle completion flag (Approved or Terminated)
    isCompleted: { type: Boolean, required: true, default: false },

    // Termination metadata
    terminationType: {
      type: String,
      enum: Object.values(ETerminationType),
      required: false,
    },
    terminationReason: {
      type: String,
      required: false,
    },

    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
    submittedAt: { type: Date },
    completedAt: { type: Date },
    approvedAt: { type: Date },
    terminatedAt: { type: Date },

    // per-subsidiary formData fields
    indiaFormData: { type: indiaOnboardingFormDataSchema, required: false },
    canadaFormData: { type: canadaOnboardingFormDataSchema, required: false },
    usFormData: { type: usOnboardingFormDataSchema, required: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// per-subsidiary uniqueness of employeeNumber
onboardingSchema.index(
  { subsidiary: 1, employeeNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeNumber: { $type: "string" },
    },
  }
);

/* -------------------------------------------------------------------------- */
/* Indexes for admin list route performance                                    */
/* -------------------------------------------------------------------------- */

// Default listing: always subsidiary-scoped, commonly sorted by createdAt desc
onboardingSchema.index({ subsidiary: 1, createdAt: -1 });

// Most common dashboard filters: status groups + sort by created/updated
onboardingSchema.index({ subsidiary: 1, status: 1, createdAt: -1 });
onboardingSchema.index({ subsidiary: 1, status: 1, updatedAt: -1 });

// Terminated view: status=Terminated + sort/filter by terminatedAt
onboardingSchema.index({ subsidiary: 1, status: 1, terminatedAt: -1 });

// Method filter (digital/manual) + sort
onboardingSchema.index({ subsidiary: 1, method: 1, createdAt: -1 });

// Completion filter (if you use it in list queries)
onboardingSchema.index({ subsidiary: 1, isCompleted: 1, createdAt: -1 });

// Fast subsidiary-scoped lookups by email (common admin workflow)
onboardingSchema.index({ subsidiary: 1, email: 1 });

// Validate presence of per-subsidiary formData *only when status requires it*
onboardingSchema.pre<TOnboardingDoc>("save", function () {
  // Decide in which statuses full formData must be present.
  const requiresFormData = this.status === EOnboardingStatus.Submitted || this.status === EOnboardingStatus.Resubmitted || this.status === EOnboardingStatus.Approved;

  // If not in a “form should exist” state, don’t enforce anything.
  if (!requiresFormData) return;

  if (this.subsidiary === ESubsidiary.INDIA && !this.indiaFormData) {
    throw new Error("indiaFormData is required for INDIA subsidiary when onboarding is submitted/approved");
  }

  if (this.subsidiary === ESubsidiary.CANADA && !this.canadaFormData) {
    throw new Error("canadaFormData is required for CANADA subsidiary when onboarding is submitted/approved");
  }

  if (this.subsidiary === ESubsidiary.USA && !this.usFormData) {
    throw new Error("usFormData is required for USA subsidiary when onboarding is submitted/approved");
  }
});
