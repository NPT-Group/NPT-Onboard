// src/types/onboardingAuditLog.types.ts

import { Schema } from "mongoose";

/**
 * Who performed an action in the audit log.
 */
export enum EOnboardingActor {
  HR = "HR",
  EMPLOYEE = "EMPLOYEE",
  SYSTEM = "SYSTEM",
}

/**
 * Single audit log entry.
 */
export enum EOnboardingAuditAction {
  STATUS_CHANGED = "STATUS_CHANGED",
  INVITE_GENERATED = "INVITE_GENERATED",
  MANUAL_PDF_SENT = "MANUAL_PDF_SENT",
  INVITE_RESENT = "INVITE_RESENT",
  MODIFICATION_REQUESTED = "MODIFICATION_REQUESTED",
  SUBMITTED = "SUBMITTED",
  RESUBMITTED = "RESUBMITTED",

  // NEW
  DETAILS_CONFIRMED = "DETAILS_CONFIRMED",

  APPROVED = "APPROVED",
  TERMINATED = "TERMINATED",
  DELETED = "DELETED",
  DATA_UPDATED = "DATA_UPDATED",
}

export type TOnboardingAuditActor = {
  type: EOnboardingActor;
  id?: string;
  name: string;
  email: string;
};

export interface IOnboardingAuditLog {
  id: string;
  onboardingId: Schema.Types.ObjectId | string;
  action: EOnboardingAuditAction;
  actor: TOnboardingAuditActor;
  createdAt: Date | string;

  /** Human-friendly text for UI (primary display line). */
  message: string;

  /** Technical structured context (JSON viewer in UI). */
  metadata?: Record<string, unknown>;
}
