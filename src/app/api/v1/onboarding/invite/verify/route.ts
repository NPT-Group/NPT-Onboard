// src/app/api/v1/onboarding/invite/verify/route.ts
import { NextRequest } from "next/server";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { hashString } from "@/lib/utils/encryption";

import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { EOnboardingMethod, EOnboardingStatus, type TOnboarding, type IOnboardingOtp } from "@/types/onboarding.types";

import { sendEmployeeOnboardingOtp } from "@/lib/mail/employee/sendEmployeeOnboardingOtp";

// -----------------------------------------------------------------------------
// Security-related constants for OTP issuance
// -----------------------------------------------------------------------------
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_INTERVAL_MS = 60 * 1000; // 1 minute between OTP emails
const OTP_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lock after too many invalid attempts

type InviteVerifyBody = {
  token: string;
};

/* -------------------------------------------------------------------------- */
/* POST /api/v1/onboarding/invite/verify                                         */
/* -------------------------------------------------------------------------- */
/**
 * Validates a digital invite token and issues a one-time verification code (OTP).
 *
 * High-level flow:
 *  1. Accept the raw invite token from the employee-facing link:
 *       POST /api/v1/onboarding/invite/verify
 *       Body: { "token": "<rawInviteTokenFromUrl>" }
 *
 *  2. Look up the matching onboarding by HMAC hash of the token:
 *       - method MUST be DIGITAL
 *       - invite.tokenHash MUST match
 *       - invite.expiresAt MUST be in the future
 *       - onboarding.status MUST NOT be Approved / Terminated
 *
 *  3. Enforce security around OTP:
 *       - If an OTP exists and is currently locked (too many bad attempts), block
 *       - Limit to 1 OTP email per minute per onboarding (throttling)
 *
 *  4. Generate a new 6-digit OTP, store its HMAC hash and metadata:
 *       onboarding.otp = {
 *         otpHash,
 *         expiresAt,
 *         attempts: 0,
 *         lockedAt: undefined,
 *         lastSentAt: now
 *       }
 *
 *  5. Send the OTP via email to the employee.
 *
 *  6. Respond with a success payload (no cookie yet – cookie is only set in
 *     /api/v1/onboarding/otp/verify after the OTP is validated):
 *       200 OK
 *       {
 *         "message": "Verification code sent",
 *         "data": {
 *           "onboardingId": "...",
 *           "subsidiary": "...",
 *           "email": "..."
 *         }
 *       }
 *
 * Error cases:
 *  - 400: missing/invalid token
 *  - 401: invite not found, expired, or onboarding not accessible
 *  - 429: OTP throttled (too many resend requests or locked state)
 *  - 500: unexpected errors
 */
export const POST = async (req: NextRequest) => {
  try {
    await connectDB();

    const body = await parseJsonBody<InviteVerifyBody>(req);
    const { token } = body;

    if (!token || typeof token !== "string") {
      return errorResponse(400, "Missing or invalid invite token");
    }

    const tokenHash = hashString(token);
    if (!tokenHash) {
      return errorResponse(400, "Invalid invite token");
    }

    const now = new Date();

    // Find the onboarding for this invite token
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

    // Existing OTP throttling / lock checks
    const existingOtp = (onboarding as any).otp as IOnboardingOtp | undefined;

    // If previously locked, enforce lock duration
    if (existingOtp?.lockedAt) {
      const lockedAt = new Date(existingOtp.lockedAt);
      const lockAgeMs = now.getTime() - lockedAt.getTime();
      if (lockAgeMs < OTP_LOCK_DURATION_MS) {
        return errorResponse(429, "Too many invalid OTP attempts. Please try again later.", { reason: "OTP_LOCKED" });
      }
    }

    // Enforce 1 OTP email per minute per onboarding
    if (existingOtp?.lastSentAt) {
      const lastSentAt = new Date(existingOtp.lastSentAt);
      const sinceLastMs = now.getTime() - lastSentAt.getTime();
      if (sinceLastMs < OTP_RESEND_INTERVAL_MS) {
        const secondsRemaining = Math.ceil((OTP_RESEND_INTERVAL_MS - sinceLastMs) / 1000);
        return errorResponse(429, "You can request a new verification code only once per minute.", {
          reason: "OTP_THROTTLED",
          retryAfterSeconds: secondsRemaining,
        });
      }
    }

    // Generate a new 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashString(otpCode);
    if (!otpHash) {
      return errorResponse(500, "Failed to generate verification code");
    }

    const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    const otpMeta: IOnboardingOtp = {
      otpHash,
      expiresAt: otpExpiresAt,
      attempts: 0,
      lockedAt: undefined,
      lastSentAt: now,
    };

    (onboarding as any).otp = otpMeta;
    await (onboarding as any).save();

    await sendEmployeeOnboardingOtp({
      to: onboarding.email,
      firstName: onboarding.firstName,
      lastName: onboarding.lastName,
      subsidiary: onboarding.subsidiary,
      otpCode,
      expiresInMinutes: Math.round(OTP_EXPIRY_MS / 60000),
    });

    return successResponse(200, "Verification code sent", {
      onboardingId: onboarding._id,
      subsidiary: onboarding.subsidiary,
      email: onboarding.email,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
