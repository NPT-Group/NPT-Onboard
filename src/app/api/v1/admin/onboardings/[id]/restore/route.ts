import { NextRequest } from "next/server";
import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";

/**
 * Infer a reasonable status to restore to from a terminated onboarding.
 *
 * Heuristics:
 * - If there is an approvedAt timestamp → restore to Approved.
 * - Else if there is a submittedAt timestamp → restore to Submitted.
 * - Else:
 *    - Digital → InviteGenerated.
 *    - Manual → ManualPDFSent.
 */
function inferRestoreStatus(onboarding: any): EOnboardingStatus {
  if (onboarding.approvedAt) {
    return EOnboardingStatus.Approved;
  }
  if (onboarding.submittedAt) {
    return EOnboardingStatus.Submitted;
  }
  if (onboarding.method === EOnboardingMethod.DIGITAL) {
    return EOnboardingStatus.InviteGenerated;
  }
  return EOnboardingStatus.ManualPDFSent;
}

/**
 * POST /api/v1/admin/onboardings/[id]/restore
 *
 * HR: Restore a previously terminated onboarding back to an active state.
 *
 * Rules:
 * - Onboarding must exist.
 * - Onboarding must be in Terminated status.
 * - terminationType / terminationReason / terminatedAt are cleared.
 * - Status is inferred from existing timestamps/method.
 * - Does NOT regenerate invites or emails; HR can explicitly resend if needed.
 */
export const POST = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const user = await guard();

    const { id } = await params;

    const onboarding = await OnboardingModel.findById(id);
    if (!onboarding) {
      return errorResponse(404, "Onboarding not found");
    }

    if (onboarding.status !== EOnboardingStatus.Terminated) {
      return errorResponse(400, "Only terminated onboardings can be restored");
    }

    const prevStatus = onboarding.status;
    const prevTerminationType = onboarding.terminationType;
    const prevTerminationReason = onboarding.terminationReason;
    const prevTerminatedAt = onboarding.terminatedAt;

    const newStatus = inferRestoreStatus(onboarding);
    const now = new Date();

    onboarding.status = newStatus;
    onboarding.terminationType = undefined;
    onboarding.terminationReason = undefined;
    onboarding.terminatedAt = undefined;
    onboarding.updatedAt = now;

    await onboarding.validate();
    await onboarding.save();

    await createOnboardingAuditLogSafe({
      onboardingId: onboarding._id.toString(),
      action: EOnboardingAuditAction.STATUS_CHANGED,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      metadata: {
        previousStatus: prevStatus,
        newStatus,
        previousTerminationType: prevTerminationType,
        previousTerminationReason: prevTerminationReason,
        previousTerminatedAt: prevTerminatedAt,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        source: "ADMIN_RESTORE",
      },
    });

    return successResponse(200, "Onboarding restored", {
      onboardingId: onboarding._id.toString(),
      status: onboarding.status,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
