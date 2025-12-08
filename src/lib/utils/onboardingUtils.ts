// src/lib/utils/onboardingUtils.ts
import { INVITATION_EXPIRES_AT_IN_MILSEC } from "@/config/env";
import { AppError } from "@/types/api.types";
import { EOnboardingMethod, EOnboardingStatus, IOnboardingInvite, type TOnboarding } from "@/types/onboarding.types";

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
