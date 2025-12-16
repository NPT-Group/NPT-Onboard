// src/app/api/v1/admin/onboardings/[id]/resend-invite/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";
import { hashString } from "@/lib/utils/encryption";
import { buildOnboardingInvite, createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { sendEmployeeOnboardingInvitation } from "@/lib/mail/employee/sendEmployeeOnboardingInvitation";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";

// -----------------------------------------------------------------------------
// POST /api/v1/admin/onboardings/[id]/resend-invite
//
// Re-sends the INITIAL digital onboarding invitation to an employee.
//
// Behavior:
// - Allowed only for DIGITAL onboardings.
// - Allowed only when status is InviteGenerated.
// - Generates a new secure invite token and replaces the previous one
//   (old links are immediately invalidated).
// - Clears any existing OTP.
// - Resets invite expiry and sends a fresh onboarding email to the employee.
// - Records an INVITE_RESENT audit log entry attributed to the HR actor.
//
// Reliability:
// - If email sending fails, we attempt to roll back the onboarding record to its
//   previous invite/otp state (best-effort) so the employee is not stranded.
// -----------------------------------------------------------------------------
export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const user = await guard();

    const { id } = await params;
    const baseUrl = req.nextUrl.origin;

    const onboarding = await OnboardingModel.findById(id);
    if (!onboarding) return errorResponse(404, "Onboarding not found");

    if (onboarding.method !== EOnboardingMethod.DIGITAL) {
      return errorResponse(400, "Resend invite is only allowed for digital onboardings");
    }

    // Standard behavior: resend-invite is ONLY for the initial invite state.
    if (onboarding.status !== EOnboardingStatus.InviteGenerated) {
      return errorResponse(400, "Cannot resend invite in the current onboarding state", {
        reason: "STATUS_NOT_INVITE_GENERATED",
        status: onboarding.status,
      });
    }

    const prevStatus = onboarding.status;
    const prevInvite = onboarding.invite;
    const prevOtp = (onboarding as any).otp;
    const prevUpdatedAt = onboarding.updatedAt;

    // Generate a new raw invite token and build a fresh invite payload
    const rawInviteToken = crypto.randomBytes(32).toString("hex");
    const invite = buildOnboardingInvite(rawInviteToken);
    invite.tokenHash = hashString(rawInviteToken)!;

    // Mutate onboarding (pre-email)
    onboarding.invite = invite; // old links become invalid
    (onboarding as any).otp = undefined; // force fresh OTP flow
    onboarding.updatedAt = new Date();

    await onboarding.validate();
    await onboarding.save();

    try {
      // Send email with the fresh token
      await sendEmployeeOnboardingInvitation({
        to: onboarding.email,
        firstName: onboarding.firstName,
        lastName: onboarding.lastName,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        baseUrl,
        inviteToken: rawInviteToken,
      });
    } catch (emailError) {
      // Best-effort rollback so employee isn't stranded with an undispatched link
      try {
        onboarding.status = prevStatus; // status doesn't change in this route, but keep it safe
        onboarding.invite = prevInvite;
        (onboarding as any).otp = prevOtp;
        onboarding.updatedAt = prevUpdatedAt;

        await onboarding.save();
      } catch (rollbackErr) {
        console.error("Failed to rollback onboarding after resend-invite email error", rollbackErr);
      }

      throw emailError;
    }

    // Audit: invite resent
    await createOnboardingAuditLogSafe({
      onboardingId: onboarding._id.toString(),
      action: EOnboardingAuditAction.INVITE_RESENT,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message: `Onboarding invitation re-sent by ${user.name}; a new onboarding link was emailed to the employee.`,
      metadata: {
        previousStatus: prevStatus,
        status: onboarding.status,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        source: "ADMIN_RESEND_INVITE",
      },
    });

    return successResponse(200, "Invite resent", {
      onboarding: onboarding.toObject({ virtuals: true, getters: true }),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
