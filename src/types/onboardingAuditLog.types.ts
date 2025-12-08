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
  INVITE_RESENT = "INVITE_RESENT",
  MODIFICATION_REQUESTED = "MODIFICATION_REQUESTED",
  SUBMITTED = "SUBMITTED",
  RESUBMITTED = "RESUBMITTED",
  APPROVED = "APPROVED",
  TERMINATED = "TERMINATED",
  DELETED = "DELETED",
}

export interface IOnboardingAuditLog {
  id: string; // e.g. Mongo ObjectId as string
  onboardingId: Schema.Types.ObjectId | string;
  action: EOnboardingAuditAction;
  actorType: EOnboardingActor;
  actorEmail?: string;
  createdAt: Date | string; // ISO date string
  metadata?: Record<string, unknown>;
}
