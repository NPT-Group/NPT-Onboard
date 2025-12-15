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
 * IMPORTANT:
 * - This function is a pure mapper.
 * - Caller must pass a plain JS object (not a Mongoose document),
 *   already serialized with { virtuals: true, getters: true }.
 * - `id` must already be present on the object (string).
 */
export function createOnboardingContext(onboarding: TOnboarding): TOnboardingContext {
  // Ensure we always have a string id (Mongoose doc.id OR fallback to _id)
  const id = (onboarding as any).id ?? ((onboarding as any)._id != null ? String((onboarding as any)._id) : undefined);

  if (!id) {
    throw new AppError(500, "Onboarding serialization error: missing id/_id");
  }

  const base = {
    id,
    subsidiary: onboarding.subsidiary,
    method: onboarding.method,

    firstName: onboarding.firstName,
    lastName: onboarding.lastName,
    email: onboarding.email,

    status: onboarding.status,

    modificationRequestMessage: onboarding.modificationRequestMessage,
    modificationRequestedAt: onboarding.modificationRequestedAt,

    employeeNumber: onboarding.employeeNumber,
    isFormComplete: onboarding.isFormComplete,
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
      throw new AppError(500, "Unsupported subsidiary for onboarding context");
  }
}

/* -------------------------------------------------------------------------- */
/* Audit log helpers                                                          */
/* -------------------------------------------------------------------------- */

export interface CreateOnboardingAuditLogParams {
  onboardingId: string;
  action: EOnboardingAuditAction;

  /** Human-friendly summary for UI */
  message: string;

  actor: {
    type: EOnboardingActor;
    id?: string;
    name: string;
    email: string;
  };

  metadata?: Record<string, unknown>;
}

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
      message: params.message,
      metadata: params.metadata,
    } as any);
  } catch (err) {
    console.error("Failed to create onboarding audit log entry", err);
  }
}
