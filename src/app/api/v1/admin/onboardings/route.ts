// src/app/api/v1/admin/onboardings/route.ts
import { NextRequest } from "next/server";
import fs from "fs/promises";
import crypto from "crypto";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { hashString } from "@/lib/utils/encryption";
import { buildOnboardingInvite, createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { sendEmployeeOnboardingInvitation } from "@/lib/mail/employee/sendEmployeeOnboardingInvitation";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import type { GraphAttachment } from "@/lib/mail/mailer";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";

/* --------------------- Request body shape --------------------- */
type PostBody = {
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;
  firstName: string;
  lastName: string;
  email: string;
};

/* -------------------------- POST /admin/onboardings -------------------------- */
export const POST = async (req: NextRequest) => {
  try {
    await connectDB();
    const user = await guard();

    const body = await parseJsonBody<PostBody>(req);
    const { subsidiary, method, firstName, lastName, email } = body;

    if (!subsidiary || !method || !firstName || !lastName || !email) {
      return errorResponse(400, "Missing required fields");
    }

    if (subsidiary !== ESubsidiary.INDIA) {
      return errorResponse(400, "Only INDIA subsidiary onboarding is supported at this time");
    }

    if (method !== EOnboardingMethod.DIGITAL && method !== EOnboardingMethod.MANUAL) {
      return errorResponse(400, "Invalid onboarding method");
    }

    /* ----------------- Prevent duplicate active onboardings ----------------- */
    const existing = await OnboardingModel.findOne({
      subsidiary,
      email,
      status: { $ne: EOnboardingStatus.Terminated },
    }).lean();

    if (existing) {
      return errorResponse(409, "An active onboarding already exists for this email in this subsidiary");
    }

    const now = new Date();

    const onboarding = new OnboardingModel({
      subsidiary,
      method,
      firstName,
      lastName,
      email,
      status: method === EOnboardingMethod.DIGITAL ? EOnboardingStatus.InviteGenerated : EOnboardingStatus.ManualPDFSent,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    let rawInviteToken: string | undefined;

    /* ---------------- DIGITAL: generate invite token + hash ---------------- */
    if (method === EOnboardingMethod.DIGITAL) {
      // random opaque token
      rawInviteToken = crypto.randomBytes(32).toString("hex");

      const invite = buildOnboardingInvite(rawInviteToken);
      // hash the token before saving
      invite.tokenHash = hashString(rawInviteToken)!;

      // attach invite to onboarding
      onboarding.invite = invite;
    }

    // Validate and persist the onboarding record
    await onboarding.validate();
    await onboarding.save();

    /* ---------------------- Email sending logic (with rollback) ---------------------- */
    const baseUrl = req.nextUrl.origin;

    try {
      if (method === EOnboardingMethod.DIGITAL) {
        await sendEmployeeOnboardingInvitation({
          to: email,
          firstName,
          lastName,
          method,
          subsidiary,
          baseUrl,
          inviteToken: rawInviteToken!, // safe: only set for DIGITAL
        });

        // Audit: digital invite generated
        await createOnboardingAuditLogSafe({
          onboardingId: onboarding._id.toString(),
          action: EOnboardingAuditAction.INVITE_GENERATED,
          actor: {
            type: EOnboardingActor.HR,
            id: user.id,
            name: user.name,
            email: user.email,
          },
          metadata: {
            status: onboarding.status,
            method,
            subsidiary,
          },
        });
      } else {
        // MANUAL: attach blank India onboarding PDF
        const pdfPath = `${process.cwd()}/src/lib/assets/pdfs/npt-india-onboarding-form.pdf`;
        const pdfBuffer = await fs.readFile(pdfPath);

        const manualFormAttachment: GraphAttachment = {
          name: "NPT-India-Onboarding-Form.pdf",
          contentType: "application/pdf",
          base64: pdfBuffer.toString("base64"),
        };

        await sendEmployeeOnboardingInvitation({
          to: email,
          firstName,
          lastName,
          method,
          subsidiary,
          baseUrl,
          manualFormAttachment,
        });

        // Audit: manual onboarding created / status set to ManualPDFSent
        await createOnboardingAuditLogSafe({
          onboardingId: onboarding._id.toString(),
          action: EOnboardingAuditAction.MANUAL_PDF_SENT,
          actor: {
            type: EOnboardingActor.HR,
            id: user.id,
            name: user.name,
            email: user.email,
          },
          metadata: {
            newStatus: onboarding.status,
            method,
            subsidiary,
          },
        });
      }
    } catch (emailError) {
      // Rollback: delete the onboarding doc if email (or PDF read) fails
      try {
        await OnboardingModel.findByIdAndDelete(onboarding._id);
      } catch (cleanupError) {
        console.error("Failed to rollback onboarding after email error", cleanupError);
      }

      throw emailError;
    }

    return successResponse(201, "Onboarding created", {
      onboarding,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
