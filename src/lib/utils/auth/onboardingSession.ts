// src/lib/utils/auth/onboardingSession.ts
import "server-only";
import { cookies } from "next/headers";
import { Types } from "mongoose";

import connectDB from "@/lib/utils/connectDB";
import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { EOnboardingMethod, EOnboardingStatus, type TOnboarding } from "@/types/onboarding.types";
import { AppError, EEApiErrorType } from "@/types/api.types";
import { ONBOARDING_SESSION_COOKIE_NAME } from "@/config/env";
// Adjust this import to whatever you actually use for hashing invite tokens.
import { hashString } from "@/lib/utils/encryption";

/**
 * Build Set-Cookie string for the employee onboarding auth cookie.
 *
 * `value` is the *raw* invite token (or equivalent opaque string).
 * Max-Age is in seconds and should typically be (invite.expiresAt - now)/1000.
 */
function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  const attrs = [`${ONBOARDING_SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", "Secure", `Max-Age=${Math.max(0, maxAgeSeconds)}`];

  return attrs.join("; ");
}

/** Clear cookie helper (used when we know the cookie is stale/invalid). */
export function clearOnboardingCookieHeader(): string {
  const attrs = [`${ONBOARDING_SESSION_COOKIE_NAME}=;`, "Path=/", "HttpOnly", "SameSite=Lax", "Secure", "Max-Age=0"];
  return attrs.join("; ");
}

/**
 * Issue an onboarding session cookie for a digital onboarding after successful OTP.
 *
 * - Validates that onboarding is digital and has a non-expired invite.
 * - Computes Max-Age as the remaining lifetime of the invite.
 * - Returns the Set-Cookie header string so the caller can `NextResponse.headers.set`.
 *
 * Typical usage in POST /api/onboarding/otp/verify:
 *   const { setCookie } = await issueOnboardingSessionCookie(onboarding, rawToken);
 *   const res = NextResponse.json(...);
 *   res.headers.set("Set-Cookie", setCookie);
 */
export async function issueOnboardingSessionCookie(onboarding: TOnboarding, rawInviteToken: string): Promise<{ setCookie: string; maxAgeSeconds: number }> {
  if (onboarding.method !== EOnboardingMethod.DIGITAL) {
    throw new AppError(400, "cannot issue session cookie for non-digital onboarding", EEApiErrorType.INTERNAL);
  }

  if (!onboarding.invite || !onboarding.invite.expiresAt) {
    throw new AppError(400, "cannot issue session cookie without a valid invite", EEApiErrorType.INTERNAL);
  }

  const now = Date.now();
  const inviteExpiresAt = new Date(onboarding.invite.expiresAt).getTime();
  const deltaMs = inviteExpiresAt - now;

  if (deltaMs <= 0) {
    throw new AppError(401, "invite link has expired", EEApiErrorType.SESSION_REQUIRED, { reason: "INVITE_EXPIRED" });
  }

  const maxAgeSeconds = Math.floor(deltaMs / 1000);
  const setCookie = buildSessionCookie(rawInviteToken, maxAgeSeconds);

  return { setCookie, maxAgeSeconds };
}

/**
 * Options for requireOnboardingSession.
 *
 * - allowSubmittedReadOnly:
 *    If true (default), Submitted/Resubmitted onboardings are allowed but
 *    the frontend should treat them as read-only.
 */
type RequireOptions = {
  allowSubmittedReadOnly?: boolean;
};

/**
 * Core guard for employee-facing APIs and pages under `/onboarding/[id]`.
 *
 * Behavior:
 *  - Reads the onboarding auth cookie (raw invite token).
 *  - Hashes it and finds the matching digital onboarding with that invite hash.
 *  - Enforces:
 *      - valid invite (not expired)
 *      - method = DIGITAL
 *      - status is not Approved / Terminated
 *  - Optionally allows Submitted/Resubmitted as read-only.
 *
 * Failures:
 *  - Throws AppError with:
 *      status: 401/404
 *      code: EEApiErrorType.SESSION_REQUIRED or UNAUTHORIZED/NOT_FOUND
 *      meta: { reason, clearCookieHeader }
 *
 * Success:
 *  - Returns { onboarding } – caller decides how to use it.
 */
export async function requireOnboardingSession(onboardingId: string, opts: RequireOptions = { allowSubmittedReadOnly: true }): Promise<{ onboarding: TOnboarding }> {
  await connectDB();

  const jar = await cookies();
  const rawToken = jar.get(ONBOARDING_SESSION_COOKIE_NAME)?.value;

  const clearCookie = clearOnboardingCookieHeader();

  if (!rawToken) {
    throw new AppError(401, "session expired, new invite required", EEApiErrorType.SESSION_REQUIRED, {
      reason: "MISSING_OR_INVALID_COOKIE",
      clearCookieHeader: clearCookie,
    });
  }

  if (!Types.ObjectId.isValid(onboardingId)) {
    throw new AppError(401, "session expired, new invite required", EEApiErrorType.SESSION_REQUIRED, {
      reason: "INVALID_ONBOARDING_ID",
      clearCookieHeader: clearCookie,
    });
  }

  const now = new Date();
  const tokenHash = hashString(rawToken);

  // Enforce: same onboarding id, digital method, matching invite hash.
  const onboarding = (await OnboardingModel.findOne({
    id: new Types.ObjectId(onboardingId),
    method: EOnboardingMethod.DIGITAL,
    "invite.tokenHash": tokenHash,
  })) as TOnboarding | null;

  if (!onboarding) {
    // Cookie doesn't match any active digital invite for this onboarding.
    throw new AppError(401, "session expired, new invite required", EEApiErrorType.SESSION_REQUIRED, {
      reason: "SESSION_NOT_FOUND_OR_MISMATCH",
      clearCookieHeader: clearCookie,
    });
  }

  // Basic invite validity (aligned with spec: cookie should die when invite expires).
  if (!onboarding.invite || !onboarding.invite.expiresAt) {
    throw new AppError(401, "invite no longer valid", EEApiErrorType.SESSION_REQUIRED, {
      reason: "INVITE_MISSING",
      clearCookieHeader: clearCookie,
    });
  }

  if (new Date(onboarding.invite.expiresAt) <= now) {
    throw new AppError(401, "invite link has expired", EEApiErrorType.SESSION_REQUIRED, {
      reason: "INVITE_EXPIRED",
      clearCookieHeader: clearCookie,
    });
  }

  // After approval or termination, employee must not be able to access. :contentReference[oaicite:1]{index=1}
  if (onboarding.status === EOnboardingStatus.Approved || onboarding.status === EOnboardingStatus.Terminated) {
    throw new AppError(401, "onboarding no longer accessible", EEApiErrorType.UNAUTHORIZED, {
      reason: onboarding.status === EOnboardingStatus.Approved ? "APPROVED" : "TERMINATED",
      clearCookieHeader: clearCookie,
    });
  }

  // Optionally enforce that Submitted/Resubmitted are read-only only.
  if (!opts.allowSubmittedReadOnly) {
    if (onboarding.status === EOnboardingStatus.Submitted || onboarding.status === EOnboardingStatus.Resubmitted) {
      throw new AppError(403, "onboarding is read-only", EEApiErrorType.FORBIDDEN, {
        reason: "READ_ONLY_STATE",
        clearCookieHeader: clearCookie,
      });
    }
  }

  // No sliding window here – cookie naturally expires with the invite.
  // If HR resends or requests modification, a new invite + OTP flow issues a new cookie.

  return { onboarding };
}
