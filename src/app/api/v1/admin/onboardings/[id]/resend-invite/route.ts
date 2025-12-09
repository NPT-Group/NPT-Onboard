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

/* -------------------- POST /admin/onboardings/[id]/resend-invite -------------------- */
export const POST = async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    await connectDB();
    const user = await guard();

    const { id } = params;
    const baseUrl = req.nextUrl.origin;

    const onboarding = await OnboardingModel.findById(id);

    if (!onboarding) {
      return errorResponse(404, "Onboarding not found");
    }

    if (onboarding.method !== EOnboardingMethod.DIGITAL) {
      return errorResponse(400, "Resend invite is only allowed for digital onboardings");
    }

    if (onboarding.status === EOnboardingStatus.Approved || onboarding.status === EOnboardingStatus.Terminated) {
      return errorResponse(400, "Cannot resend invite for completed or terminated onboardings");
    }

    // Generate a new raw invite token and build a fresh invite payload
    const rawInviteToken = crypto.randomBytes(32).toString("hex");
    const invite = buildOnboardingInvite(rawInviteToken);
    invite.tokenHash = hashString(rawInviteToken)!;

    // Replace the old invite with the new one
    onboarding.invite = invite;

    await onboarding.save();

    // Send the new invite email with the fresh token
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
      metadata: {
        status: onboarding.status,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
      },
    });

    return successResponse(200, "Invite resent", {
      onboardingId: onboarding._id.toString(),
      status: onboarding.status,
      inviteExpiresAt: onboarding.invite?.expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
