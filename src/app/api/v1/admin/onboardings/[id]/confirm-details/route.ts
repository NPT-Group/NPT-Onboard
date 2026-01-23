import { NextRequest } from "next/server";
import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";
import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { EOnboardingStatus } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { sendEmployeeOnboardingDetailsConfirmed } from "@/lib/mail/employee/sendEmployeeOnboardingDetailsConfirmed";

/**
 * POST /api/v1/admin/onboardings/[id]/confirm-details
 *
 * HR: Confirms employee details are correct.
 *
 * Rules:
 * - Onboarding must exist.
 * - Onboarding must NOT be Terminated.
 * - Onboarding must NOT already be Approved.
 * - Onboarding must be fully complete (isFormComplete = true).
 * - Sets status => DETAILS_CONFIRMED
 * - Sends "details confirmed" email to employee
 * - Does NOT finalize onboarding, does NOT clear invite/otp
 */
export const POST = async (_: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const user = await guard();

    const { id } = await params;

    const onboarding = await OnboardingModel.findById(id);
    if (!onboarding) return errorResponse(404, "Onboarding not found");

    if (onboarding.status === EOnboardingStatus.Terminated) {
      return errorResponse(400, "Cannot confirm details for a terminated onboarding");
    }

    if (onboarding.status === EOnboardingStatus.Approved) {
      return errorResponse(400, "Onboarding is already approved");
    }

    if (!onboarding.isFormComplete) {
      return errorResponse(400, "Cannot confirm details until the onboarding form is fully completed");
    }

    // Optional: avoid duplicate transitions
    if (onboarding.status === EOnboardingStatus.DETAILS_CONFIRMED) {
      return errorResponse(400, "Details are already confirmed");
    }

    const prevStatus = onboarding.status;
    const now = new Date();

    onboarding.status = EOnboardingStatus.DETAILS_CONFIRMED;
    onboarding.updatedAt = now;

    await onboarding.validate();
    await onboarding.save();

    // Email employee (details confirmed)
    await sendEmployeeOnboardingDetailsConfirmed({
      to: onboarding.email,
      firstName: onboarding.firstName,
      lastName: onboarding.lastName,
      subsidiary: onboarding.subsidiary,
    });

    // Audit
    await createOnboardingAuditLogSafe({
      onboardingId: onboarding._id.toString(),
      action: EOnboardingAuditAction.DETAILS_CONFIRMED,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message: `Details confirmed by ${user.name}; onboarding moved to DETAILS_CONFIRMED and employee notified.`,
      metadata: {
        previousStatus: prevStatus,
        newStatus: onboarding.status,
        subsidiary: onboarding.subsidiary,
        method: onboarding.method,
        source: "ADMIN_CONFIRM_DETAILS",
      },
    });

    return successResponse(200, "Details confirmed", {
      onboarding: onboarding.toObject({ virtuals: true, getters: true }),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
