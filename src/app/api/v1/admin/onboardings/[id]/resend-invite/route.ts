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
// Access:
// - HR admin only (guarded).
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

    // Generate a new raw invite token and build a fresh invite payload
    const rawInviteToken = crypto.randomBytes(32).toString("hex");
    const invite = buildOnboardingInvite(rawInviteToken);
    invite.tokenHash = hashString(rawInviteToken)!;

    // Replace old invite (old links become invalid)
    onboarding.invite = invite;

    // Clear any existing OTP (fresh invite should require fresh OTP flow)
    (onboarding as any).otp = undefined;

    await onboarding.save();

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
        previousStatus: onboarding.status,
        status: onboarding.status,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
      },
    });

    return successResponse(200, "Invite resent", {
      onboarding: onboarding.toObject({ virtuals: true, getters: true }),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
