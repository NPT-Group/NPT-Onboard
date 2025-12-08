// src/app/api/onboarding/otp/verify/route.ts
import { NextRequest } from "next/server";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { hashString } from "@/lib/utils/encryption";

import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { EOnboardingMethod, EOnboardingStatus, type TOnboarding, type IOnboardingOtp } from "@/types/onboarding.types";

import { issueOnboardingSessionCookie } from "@/lib/utils/auth/onboardingSession";
import { attachCookies } from "@/lib/utils/auth/attachCookie";

// -----------------------------------------------------------------------------
// Security-related constants for OTP verification
// -----------------------------------------------------------------------------
const OTP_MAX_ATTEMPTS = 3; // after this many failed attempts, temporarily lock
const OTP_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lock after too many invalid attempts

type OtpVerifyBody = {
  token: string;
  otp: string;
};

/* -------------------------------------------------------------------------- */
/* POST /api/onboarding/otp/verify                                           */
/* -------------------------------------------------------------------------- */
/**
 * Verifies a previously issued OTP and grants an onboarding session cookie.
 *
 * High-level flow:
 *  1. Accept the raw invite token and the OTP from the client:
 *       POST /api/onboarding/otp/verify
 *       Body: { "token": "<rawInviteTokenFromUrl>", "otp": "123456" }
 *
 *  2. Identify the onboarding:
 *       - method MUST be DIGITAL
 *       - invite.tokenHash MUST match HMAC of the raw token
 *       - invite.expiresAt MUST be in the future
 *       - onboarding.status MUST NOT be Approved / Terminated
 *
 *  3. Validate OTP:
 *       - onboarding.otp MUST exist
 *       - If locked (lockedAt), enforce lock duration and block
 *       - otp.expiresAt MUST be in the future
 *       - submitted OTP HMAC MUST match stored otpHash
 *       - On mismatch:
 *           * increment attempts
 *           * if attempts >= OTP_MAX_ATTEMPTS, set lockedAt = now
 *           * return error with remainingAttempts metadata when still allowed
 *
 *  4. On success:
 *       - reset attempts to 0 and clear lockedAt (optional, but keeps it clean)
 *       - call issueOnboardingSessionCookie(onboarding, rawToken)
 *         which returns a Set-Cookie header string with:
 *           ONBOARDING_SESSION_COOKIE_NAME = rawInviteToken
 *           Max-Age = remaining lifetime of invite
 *       - return 200 with onboardingId + status for frontend redirect logic
 *
 * Response example:
 *   200 OK
 *   {
 *     "message": "Verification successful",
 *     "data": {
 *       "onboardingId": "...",
 *       "subsidiary": "...",
 *       "status": "InviteGenerated"
 *     }
 *   }
 *
 * Error cases:
 *  - 400: missing/invalid token or OTP, or no active OTP present
 *  - 401: invite / OTP invalid or expired
 *  - 429: OTP locked due to too many failed attempts
 *  - 500: unexpected errors
 */
export const POST = async (req: NextRequest) => {
  try {
    await connectDB();

    const body = await parseJsonBody<OtpVerifyBody>(req);
    const { token, otp } = body;

    if (!token || typeof token !== "string") {
      return errorResponse(400, "Missing or invalid invite token");
    }
    if (!otp || typeof otp !== "string") {
      return errorResponse(400, "Missing or invalid verification code");
    }

    const tokenHash = hashString(token);
    if (!tokenHash) {
      return errorResponse(400, "Invalid invite token");
    }

    const now = new Date();

    // Look up the onboarding based on the invite token
    const onboarding = (await OnboardingModel.findOne({
      method: EOnboardingMethod.DIGITAL,
      "invite.tokenHash": tokenHash,
    })) as TOnboarding | null;

    if (!onboarding || !onboarding.invite) {
      return errorResponse(401, "Invite link is invalid or has expired", {
        reason: "INVITE_NOT_FOUND",
      });
    }

    const inviteExpiresAt = new Date(onboarding.invite.expiresAt);
    if (inviteExpiresAt <= now) {
      return errorResponse(401, "Invite link has expired", {
        reason: "INVITE_EXPIRED",
      });
    }

    if (onboarding.status === EOnboardingStatus.Approved || onboarding.status === EOnboardingStatus.Terminated) {
      return errorResponse(401, "Onboarding is no longer accessible", {
        reason: onboarding.status === EOnboardingStatus.Approved ? "APPROVED" : "TERMINATED",
      });
    }

    const otpMeta = (onboarding as any).otp as IOnboardingOtp | undefined;

    if (!otpMeta) {
      return errorResponse(400, "No active verification code found. Please request a new code.", { reason: "OTP_NOT_ISSUED" });
    }

    // Lock check
    if (otpMeta.lockedAt) {
      const lockedAt = new Date(otpMeta.lockedAt);
      const lockAgeMs = now.getTime() - lockedAt.getTime();
      if (lockAgeMs < OTP_LOCK_DURATION_MS) {
        return errorResponse(429, "Too many invalid verification attempts. Please try again later.", { reason: "OTP_LOCKED" });
      }
    }

    // Expiry check
    const otpExpiresAt = new Date(otpMeta.expiresAt);
    if (otpExpiresAt <= now) {
      return errorResponse(401, "Verification code has expired. Please request a new code.", { reason: "OTP_EXPIRED" });
    }

    // Compare hash
    const submittedOtpHash = hashString(otp);
    if (!submittedOtpHash) {
      return errorResponse(400, "Invalid verification code format");
    }

    const isMatch = submittedOtpHash === otpMeta.otpHash;

    if (!isMatch) {
      const newAttempts = (otpMeta.attempts ?? 0) + 1;
      const updatedOtpMeta: IOnboardingOtp = {
        ...otpMeta,
        attempts: newAttempts,
      };

      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        updatedOtpMeta.lockedAt = now;
      }

      (onboarding as any).otp = updatedOtpMeta;
      await (onboarding as any).save();

      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        return errorResponse(429, "Too many invalid verification attempts. Please try again later.", { reason: "OTP_MAX_ATTEMPTS_EXCEEDED" });
      }

      return errorResponse(401, "Invalid verification code", {
        reason: "OTP_INVALID",
        remainingAttempts: OTP_MAX_ATTEMPTS - newAttempts,
      });
    }

    // Successful OTP → clear lock & attempts (optional but cleaner)
    const cleanedOtpMeta: IOnboardingOtp = {
      ...otpMeta,
      attempts: 0,
      lockedAt: undefined,
    };

    (onboarding as any).otp = cleanedOtpMeta;
    await (onboarding as any).save();

    // Issue onboarding session cookie based on the invite token
    const { setCookie } = await issueOnboardingSessionCookie(
      onboarding,
      token // raw invite token
    );

    const res = successResponse(200, "Verification successful", {
      onboardingId: (onboarding as any)._id,
      subsidiary: onboarding.subsidiary,
      status: onboarding.status,
    });

    return attachCookies(res, setCookie);
  } catch (error) {
    return errorResponse(error);
  }
};
