// src/lib/utils/onboardingUtils.ts
import { INVITATION_EXPIRES_AT_IN_MILSEC } from "@/config/env";
import { OnboardingAuditLogModel } from "@/mongoose/models/OnboardingAuditLog";
import { AppError } from "@/types/api.types";
import { EOnboardingMethod, EOnboardingStatus, IOnboardingInvite, TOnboardingContext, type TOnboarding } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { ESubsidiary } from "@/types/shared.types";

/**
 * True if an employee *should* be able to access /onboarding/[id]
 * assuming they present a valid cookie.
 *
 * This does NOT validate the cookie itself – that's handled by
 * requireOnboardingSession. This is pure business logic.
 */
export function canEmployeeAccess(onboarding: TOnboarding): boolean {
  if (onboarding.method !== EOnboardingMethod.DIGITAL) return false;
  if (!onboarding.invite || !onboarding.invite.expiresAt) return false;

  const status = onboarding.status;
  if (status === EOnboardingStatus.Approved || status === EOnboardingStatus.Terminated) {
    return false;
  }

  const now = new Date();
  const inviteExpiresAt = new Date(onboarding.invite.expiresAt);

  if (inviteExpiresAt <= now) return false;

  return true;
}

/**
 * True if the employee can edit the form (InviteGenerated, ModificationRequested).
 */
export function canEmployeeEdit(onboarding: TOnboarding): boolean {
  if (!canEmployeeAccess(onboarding)) return false;

  return onboarding.status === EOnboardingStatus.InviteGenerated || onboarding.status === EOnboardingStatus.ModificationRequested;
}

/**
 * True if the employee can view but NOT edit the form
 * (Submitted / Resubmitted → pending review). :contentReference[oaicite:2]{index=2}
 */
export function isReadOnlyForEmployee(onboarding: TOnboarding): boolean {
  if (!canEmployeeAccess(onboarding)) return true;

  return onboarding.status === EOnboardingStatus.Submitted || onboarding.status === EOnboardingStatus.Resubmitted;
}

/**
 *
 * Builds an onboarding invite object.
 */
export function buildOnboardingInvite(rawToken: string): IOnboardingInvite {
  const now = Date.now();
  if (!INVITATION_EXPIRES_AT_IN_MILSEC) throw new AppError(500, "INVITATION_EXPIRES_AT_IN_MILSEC is not configured");
  const expiresAt = new Date(now + Number(INVITATION_EXPIRES_AT_IN_MILSEC));

  return {
    tokenHash: rawToken, // will be replaced by hashed value in route
    expiresAt,
    lastSentAt: new Date(now),
  };
}

/* ------------------------------------------------------------------ */
/* Sanitized context builder                                          */
/* ------------------------------------------------------------------ */

/**
 * Builds an employee-facing, sanitized onboarding context.
 *
 * Strips:
 * - invite / otp (token/OTP hashes, attempts, etc.)
 * - locationAtSubmit (precise geo)
 * - approvedAt / terminatedAt (internal lifecycle timestamps)
 */
export function createOnboardingContext(onboarding: TOnboarding): TOnboardingContext {
  const base = {
    id:
      // Mongoose doc: _id is ObjectId
      (onboarding as any)._id?.toString?.() ??
      // Lean/plain object might already have `id`
      (onboarding as any).id ??
      "",
    subsidiary: onboarding.subsidiary,
    method: onboarding.method,

    firstName: onboarding.firstName,
    lastName: onboarding.lastName,
    email: onboarding.email,

    status: onboarding.status,

    modificationRequestMessage: onboarding.modificationRequestMessage,
    modificationRequestedAt: onboarding.modificationRequestedAt,

    employeeNumber: onboarding.employeeNumber,

    isCompleted: onboarding.isCompleted,
    createdAt: onboarding.createdAt,
    updatedAt: onboarding.updatedAt,
    submittedAt: onboarding.submittedAt,
    completedAt: onboarding.completedAt,
  };

  switch (onboarding.subsidiary) {
    case ESubsidiary.INDIA:
      return {
        ...base,
        subsidiary: ESubsidiary.INDIA,
        indiaFormData: onboarding.indiaFormData,
      };

    case ESubsidiary.CANADA:
      return {
        ...base,
        subsidiary: ESubsidiary.CANADA,
        canadaFormData: onboarding.canadaFormData,
      };

    case ESubsidiary.USA:
      return {
        ...base,
        subsidiary: ESubsidiary.USA,
        usFormData: onboarding.usFormData,
      };

    default:
      // Should be unreachable if TOnboarding is in sync with ESubsidiary
      throw new AppError(500, "Unsupported subsidiary for onboarding context");
  }
}

/* -------------------------------------------------------------------------- */
/* Audit log helpers                                                          */
/* -------------------------------------------------------------------------- */

export interface CreateOnboardingAuditLogParams {
  onboardingId: string;
  action: EOnboardingAuditAction;
  actor: {
    type: EOnboardingActor;
    id?: string;
    name: string;
    email: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget helper for creating onboarding audit log entries.
 *
 * Usage rules:
 *  - Call ONLY after the main operation has succeeded (DB + side effects).
 *  - If logging fails, the error is swallowed and only logged to stderr.
 */
export async function createOnboardingAuditLogSafe(params: CreateOnboardingAuditLogParams): Promise<void> {
  try {
    await OnboardingAuditLogModel.create({
      onboardingId: params.onboardingId,
      action: params.action,
      actor: {
        type: params.actor.type,
        id: params.actor.id,
        name: params.actor.name,
        email: params.actor.email,
      },
      metadata: params.metadata,
    } as any);
  } catch (err) {
    // Non-critical: never break the main request because of audit logging
    console.error("Failed to create onboarding audit log entry", err);
  }
}
