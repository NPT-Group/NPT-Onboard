import { NextRequest } from "next/server";
import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";

import { parseJsonBody } from "@/lib/utils/reqParser";

// You’ll need to implement these mailers similarly to the invite/OTP ones.
import { sendEmployeeOnboardingApproved } from "@/lib/mail/employee/sendEmployeeOnboardingApproved";

type ApproveBody = {
  employeeNumber?: string;
};

/**
 * POST /api/v1/admin/onboardings/[id]/approve
 *
 * HR: Approve an onboarding and optionally assign an employee number.
 *
 * Rules:
 * - Onboarding must exist.
 * - Onboarding must NOT be Terminated.
 * - Onboarding must NOT already be Approved.
 * - isFormComplete must be true (form fully filled by employee or HR).
 * - Optional employeeNumber must be unique per subsidiary (when provided).
 * - For digital flows, invite/otp are cleared so the employee can no longer access.
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
      return errorResponse(400, "Cannot approve a terminated onboarding");
    }

    if (onboarding.status === EOnboardingStatus.Approved) {
      return errorResponse(400, "Onboarding is already approved");
    }

    if (!onboarding.isFormComplete) {
      return errorResponse(400, "Cannot approve until the onboarding form is fully completed");
    }

    const body = await parseJsonBody<ApproveBody>(req);
    const employeeNumber = body?.employeeNumber?.trim();

    // Enforce unique employeeNumber within the subsidiary, if provided
    if (employeeNumber) {
      const existing = await OnboardingModel.findOne({
        _id: { $ne: onboarding._id },
        subsidiary: onboarding.subsidiary,
        employeeNumber,
      }).lean();

      if (existing) {
        return errorResponse(409, "Employee number already in use for this subsidiary");
      }

      onboarding.employeeNumber = employeeNumber;
    }

    const prevStatus = onboarding.status;
    const now = new Date();

    // Mark approved
    onboarding.status = EOnboardingStatus.Approved;
    onboarding.approvedAt = now;
    onboarding.updatedAt = now;

    // Ensure completion flags are consistent
    onboarding.isFormComplete = true;
    if (!onboarding.completedAt) {
      onboarding.completedAt = now;
    }

    // Digital: kill invite/otp to prevent future access
    if (onboarding.method === EOnboardingMethod.DIGITAL) {
      (onboarding as any).invite = undefined;
      (onboarding as any).otp = undefined;
    }

    await onboarding.validate();
    await onboarding.save();

    // Fire approval email(s)
    await sendEmployeeOnboardingApproved({
      to: onboarding.email,
      firstName: onboarding.firstName,
      lastName: onboarding.lastName,
      subsidiary: onboarding.subsidiary,
      baseUrl,
      employeeNumber: onboarding.employeeNumber,
    });

    // Audit: approved
    await createOnboardingAuditLogSafe({
      onboardingId: onboarding._id.toString(),
      action: EOnboardingAuditAction.APPROVED,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      metadata: {
        previousStatus: prevStatus,
        newStatus: onboarding.status,
        employeeNumber: onboarding.employeeNumber,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        source: "ADMIN_APPROVE",
      },
    });

    return successResponse(200, "Onboarding approved", {
      onboardingId: onboarding._id.toString(),
      status: onboarding.status,
      employeeNumber: onboarding.employeeNumber,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
