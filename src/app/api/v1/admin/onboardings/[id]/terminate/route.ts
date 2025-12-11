import { NextRequest } from "next/server";
import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus, ETerminationType } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { parseJsonBody } from "@/lib/utils/reqParser";

// You’ll need to implement this mailer.
import { sendEmployeeOnboardingTerminationNotice } from "@/lib/mail/employee/sendEmployeeOnboardingTerminationNotice";

type TerminateBody = {
  terminationType: ETerminationType;
  terminationReason?: string;
};

/**
 * POST /api/v1/admin/onboardings/[id]/terminate
 *
 * HR: Terminate an onboarding in any state.
 *
 * Rules:
 * - Onboarding must exist.
 * - Onboarding must NOT already be Terminated.
 * - terminationType is required (company-initiated vs resigned).
 * - terminationReason is optional free text.
 * - Digital flows must lose invite/otp access immediately.
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

    if (onboarding.status === EOnboardingStatus.Terminated) {
      return errorResponse(400, "Onboarding is already terminated");
    }

    const body = await parseJsonBody<TerminateBody>(req);
    if (!body || !body.terminationType) {
      return errorResponse(400, "terminationType is required");
    }

    const terminationType = body.terminationType;
    const terminationReason = body.terminationReason?.trim() || undefined;

    const prevStatus = onboarding.status;
    const now = new Date();

    onboarding.status = EOnboardingStatus.Terminated;
    onboarding.terminationType = terminationType;
    onboarding.terminationReason = terminationReason;
    onboarding.terminatedAt = now;
    onboarding.updatedAt = now;

    // Digital: clear invite/otp to block future access
    if (onboarding.method === EOnboardingMethod.DIGITAL) {
      (onboarding as any).invite = undefined;
      (onboarding as any).otp = undefined;
    }

    await onboarding.validate();
    await onboarding.save();

    // Email the employee about termination (per spec)
    await sendEmployeeOnboardingTerminationNotice({
      to: onboarding.email,
      firstName: onboarding.firstName,
      lastName: onboarding.lastName,
      subsidiary: onboarding.subsidiary,
      baseUrl,
      terminationType,
      terminationReason,
    });

    // Audit: terminated
    await createOnboardingAuditLogSafe({
      onboardingId: onboarding._id.toString(),
      action: EOnboardingAuditAction.TERMINATED,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      metadata: {
        previousStatus: prevStatus,
        newStatus: onboarding.status,
        terminationType,
        terminationReason,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        source: "ADMIN_TERMINATE",
      },
    });

    return successResponse(200, "Onboarding terminated", {
      onboardingId: onboarding._id.toString(),
      status: onboarding.status,
      terminationType: onboarding.terminationType,
      terminationReason: onboarding.terminationReason,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
