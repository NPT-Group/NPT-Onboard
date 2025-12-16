import { NextRequest } from "next/server";
import crypto from "crypto";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { buildOnboardingInvite, createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { hashString } from "@/lib/utils/encryption";
import { parseJsonBody } from "@/lib/utils/reqParser";

// You’ll need to implement this mailer.
import { sendEmployeeOnboardingModificationRequest } from "@/lib/mail/employee/sendEmployeeOnboardingModificationRequest";

type RequestModificationBody = {
  message: string;
};

/**
 * POST /api/v1/admin/onboardings/[id]/request-modification
 *
 * HR: Request modifications from an employee (digital flow only).
 *
 * Rules:
 * - Onboarding must exist.
 * - method must be DIGITAL.
 * - status must NOT be Approved or Terminated.
 * - isFormComplete must be true (there is something to modify).
 * - Typically used from Submitted / Resubmitted.
 * - Generates a new 48h invite and sets status = ModificationRequested.
 */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const user = await guard();

    const { id } = await params;
    const baseUrl = req.nextUrl.origin;

    const onboarding = await OnboardingModel.findById(id);
    if (!onboarding) {
      return errorResponse(404, "Onboarding not found");
    }

    if (onboarding.method !== EOnboardingMethod.DIGITAL) {
      return errorResponse(400, "Modification requests are only allowed for digital onboardings");
    }

    if (onboarding.status === EOnboardingStatus.Approved || onboarding.status === EOnboardingStatus.Terminated) {
      return errorResponse(400, "Cannot request modification for approved or terminated onboardings");
    }

    if (!onboarding.isFormComplete) {
      return errorResponse(400, "Cannot request modification until the onboarding form is fully completed");
    }

    // (Optional stricter rule: only allow from Submitted/Resubmitted)
    if (onboarding.status !== EOnboardingStatus.Submitted && onboarding.status !== EOnboardingStatus.Resubmitted) {
      return errorResponse(400, "Modification can only be requested on submitted digital onboardings");
    }

    const body = await parseJsonBody<RequestModificationBody>(req);
    const message = body?.message?.trim();
    if (!message) {
      return errorResponse(400, "Modification message is required");
    }

    const prevStatus = onboarding.status;
    const now = new Date();

    // Generate fresh invite token for modification flow
    const rawInviteToken = crypto.randomBytes(32).toString("hex");
    const invite = buildOnboardingInvite(rawInviteToken);
    invite.tokenHash = hashString(rawInviteToken)!;

    onboarding.invite = invite;
    (onboarding as any).otp = undefined; // clear any previous OTP/session

    onboarding.status = EOnboardingStatus.ModificationRequested;
    onboarding.modificationRequestMessage = message;
    onboarding.modificationRequestedAt = now;
    onboarding.updatedAt = now;

    await onboarding.validate();
    await onboarding.save();

    // Send modification request email with new link
    await sendEmployeeOnboardingModificationRequest({
      to: onboarding.email,
      firstName: onboarding.firstName,
      lastName: onboarding.lastName,
      subsidiary: onboarding.subsidiary,
      baseUrl,
      inviteToken: rawInviteToken,
      message,
    });

    // Audit: modification requested
    await createOnboardingAuditLogSafe({
      onboardingId: onboarding._id.toString(),
      action: EOnboardingAuditAction.MODIFICATION_REQUESTED,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message: `Modifications requested by ${user.name}; a new onboarding link was sent to the employee.`,
      metadata: {
        previousStatus: prevStatus,
        newStatus: onboarding.status,
        modificationRequestMessage: message,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        source: "ADMIN_REQUEST_MODIFICATION",
      },
    });

    return successResponse(200, "Modification requested", {
      onboarding: onboarding.toObject({ virtuals: true, getters: true }),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
