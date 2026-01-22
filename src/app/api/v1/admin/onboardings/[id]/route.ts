// src/app/api/v1/admin/onboardings/[id]/route.ts
import { NextRequest } from "next/server";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";
import { parseJsonBody } from "@/lib/utils/reqParser";

import { makeEntityFinalPrefix, finalizeAssetWithCache, deleteS3Objects, collectS3KeysDeep, diffS3KeysToDelete } from "@/lib/utils/s3Helper";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingStatus, type IIndiaOnboardingFormData } from "@/types/onboarding.types";
import { ES3Namespace, ES3Folder } from "@/types/aws.types";
import { type IFileAsset } from "@/types/shared.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { ESubsidiary } from "@/types/shared.types";
import { validateIndiaOnboardingForm } from "@/lib/validation/onboardingFormValidation";
import { OnboardingAuditLogModel } from "@/mongoose/models/OnboardingAuditLog";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type PutBody = {
  indiaFormData?: IIndiaOnboardingFormData;
  // For future:
  // canadaFormData?: ICanadaOnboardingFormData;
  // usFormData?: IUsOnboardingFormData;
};

/**
 * Finalize all file assets within the India onboarding form data into
 * submissions/onboardings/{onboardingId}/... using proper logical folders.
 *
 * Returns a deep-cloned, mutated copy of the payload with FINAL S3 keys.
 * Any newly created final keys are pushed into `collector` for potential
 * cleanup on failure.
 *
 * NOTE: This mirrors the employee-side logic.
 */
async function finalizeIndiaOnboardingAssetsForAdmin(onboardingId: string, payload: IIndiaOnboardingFormData, collector: string[]): Promise<IIndiaOnboardingFormData> {
  const ns = ES3Namespace.ONBOARDINGS;
  const cache = new Map<string, IFileAsset>();

  const pushMoved = (key?: string) => {
    if (!key) return;
    collector.push(key);
  };

  // Deep clone so we don't mutate caller's reference
  const form: IIndiaOnboardingFormData = JSON.parse(JSON.stringify(payload)) as IIndiaOnboardingFormData;

  /* --------------------------- Government IDs --------------------------- */

  // Aadhaar card file
  if (form.governmentIds?.aadhaar?.file) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.GOV_AADHAAR);
    const current = form.governmentIds.aadhaar.file;
    const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
    form.governmentIds.aadhaar.file = finalized;
  }

  // PAN card file
  if (form.governmentIds?.panCard?.file) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.GOV_PAN);
    const current = form.governmentIds.panCard.file;
    const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
    form.governmentIds.panCard.file = finalized;
  }

  // Passport front/back
  if (form.governmentIds?.passport) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.GOV_PASSPORT);
    if (form.governmentIds.passport.frontFile) {
      const current = form.governmentIds.passport.frontFile;
      const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
      form.governmentIds.passport.frontFile = finalized;
    }
    if (form.governmentIds.passport.backFile) {
      const current = form.governmentIds.passport.backFile;
      const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
      form.governmentIds.passport.backFile = finalized;
    }
  }

  // Drivers license front/back (optional)
  if (form.governmentIds?.driversLicense) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.GOV_DRIVERS_LICENSE);
    if (form.governmentIds.driversLicense.frontFile) {
      const current = form.governmentIds.driversLicense.frontFile;
      const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
      form.governmentIds.driversLicense.frontFile = finalized;
    }
    if (form.governmentIds.driversLicense.backFile) {
      const current = form.governmentIds.driversLicense.backFile;
      const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
      form.governmentIds.driversLicense.backFile = finalized;
    }
  }

  /* ---------------------------- Bank details ---------------------------- */

  // Void cheque (optional)
  if (form.bankDetails?.voidCheque?.file) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.BANK_VOID_CHEQUE);
    const current = form.bankDetails.voidCheque.file;
    const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
    form.bankDetails.voidCheque.file = finalized;
  }

  /* -------------------------- Employment history ------------------------ */

  if (Array.isArray(form.employmentHistory)) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.EMPLOYMENT_CERTIFICATES);

    for (const entry of form.employmentHistory) {
      // Ensure employerReferenceCheck is always present (required field)
      if (typeof entry.employerReferenceCheck !== "boolean") {
        entry.employerReferenceCheck = false;
      }

      if (entry.experienceCertificateFile) {
        const current = entry.experienceCertificateFile;
        const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
        entry.experienceCertificateFile = finalized;
      }
    }
  }

  /* --------------------- Declaration & signature file ------------------- */

  if (form.declaration?.signature?.file) {
    const dest = makeEntityFinalPrefix(ns, onboardingId, ES3Folder.DECLARATION_SIGNATURE);
    const current = form.declaration.signature.file;
    const finalized = (await finalizeAssetWithCache(current, dest, cache, pushMoved)) || current;
    form.declaration.signature.file = finalized;
  }

  return form;
}

/* -------------------------------------------------------------------------- */
/* GET /api/v1/admin/onboardings/[id]                                         */
/* -------------------------------------------------------------------------- */
/**
 * HR: Retrieve full onboarding details for a single record.
 * Includes per-subsidiary form data, locationAtSubmit, invite/otp metadata, etc.
 */
export const GET = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    await guard(); // ensure HR / admin

    const { id } = await params;

    const onboarding = await OnboardingModel.findById(id);
    if (!onboarding) {
      return errorResponse(404, "Onboarding not found");
    }

    const obj = onboarding.toObject({ virtuals: true, getters: true });
    const responsePayload = {
      ...obj,
      id: obj._id?.toString?.() ?? id,
    };

    return successResponse(200, "Onboarding retrieved", {
      onboarding: responsePayload,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

/* -------------------------------------------------------------------------- */
/* PUT /api/v1/admin/onboardings/[id]                                         */
/* -------------------------------------------------------------------------- */
/**
 * HR: Update the full onboarding form data.
 *
 * Rules:
 * - Admins can edit in ANY status except Terminated.
 * - Employee participation is optional; HR can fully complete the form alone.
 * - If the form was never completed (isFormComplete = false) and HR saves:
 *     - status is set to Submitted (both digital & manual),
 *     - submittedAt is set to now.
 * - If the form was already completed, HR edits do NOT change status or submittedAt.
 * - This route sets `isFormComplete` but does NOT mark the onboarding
 *   lifecycle as finished (`isCompleted` is controlled by approve/terminate flows).
 * - Admin route does NOT touch locationAtSubmit (employee-only concern).
 */

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const movedFinalKeys: string[] = [];
  let saved = false;
  const replacedKeysToDelete: string[] = [];

  try {
    await connectDB();
    const user = await guard();

    const { id: onboardingId } = await params;

    const onboarding = await OnboardingModel.findById(onboardingId);
    if (!onboarding) {
      return errorResponse(404, "Onboarding not found");
    }

    if (onboarding.status === EOnboardingStatus.Terminated) {
      return errorResponse(400, "Cannot edit a terminated onboarding");
    }

    const body = await parseJsonBody<PutBody>(req);
    if (!body || typeof body !== "object") {
      return errorResponse(400, "Invalid request body");
    }

    const prevStatus: EOnboardingStatus = onboarding.status;
    const prevFormComplete = !!onboarding.isFormComplete;

    const now = new Date();

    /* ---------------------------- Subsidiary switch ---------------------------- */

    if (onboarding.subsidiary === ESubsidiary.INDIA) {
      if (!body.indiaFormData) {
        return errorResponse(400, "indiaFormData is required for India onboardings");
      }

      const oldIndiaFormData = onboarding.indiaFormData ? JSON.parse(JSON.stringify(onboarding.indiaFormData)) : undefined;

      // Validate structure & business rules
      validateIndiaOnboardingForm(body.indiaFormData);

      // Finalize S3 assets (temp -> final) with rollback collector
      const finalizedIndiaFormData = await finalizeIndiaOnboardingAssetsForAdmin(onboarding._id?.toString?.() ?? onboardingId, body.indiaFormData, movedFinalKeys);

      if (oldIndiaFormData) {
        replacedKeysToDelete.push(...diffS3KeysToDelete(oldIndiaFormData, finalizedIndiaFormData));
      }

      onboarding.indiaFormData = finalizedIndiaFormData;
    } else {
      // For v1 we only support India in this endpoint to keep scope aligned
      // with the current activated workflow.
      return errorResponse(400, "Only INDIA subsidiary onboarding updates are supported at this time");
    }

    /* ----------------------- Completion & status semantics --------------------- */

    let auditAction: EOnboardingAuditAction;

    if (!prevFormComplete) {
      // First time the form becomes complete (HR is effectively "submitting" it)
      onboarding.isFormComplete = true;
      onboarding.status = EOnboardingStatus.Submitted;
      onboarding.submittedAt = now;

      auditAction = EOnboardingAuditAction.SUBMITTED;
    } else {
      // Form was already complete; HR is just editing data.
      // Do NOT change status or submittedAt.
      auditAction = EOnboardingAuditAction.DATA_UPDATED;
    }

    onboarding.updatedAt = now;

    // Let Mongoose enforce schema-level validation
    await onboarding.validate();
    await onboarding.save();
    saved = true;

    if (replacedKeysToDelete.length) {
      // best-effort cleanup; don't fail request if this fails
      deleteS3Objects(replacedKeysToDelete).catch((e) => {
        console.warn("Failed to delete replaced S3 keys during admin PUT:", replacedKeysToDelete, e);
      });
    }

    const obj = onboarding.toObject({ virtuals: true, getters: true });
    const responsePayload = {
      ...obj,
      id: obj._id?.toString?.() ?? onboardingId,
    };

    /* ------------------------------ Audit logging ------------------------------ */

    await createOnboardingAuditLogSafe({
      onboardingId: (onboarding as any)._id?.toString?.() ?? String(onboardingId),
      action: auditAction,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message: `Onboarding form details updated by ${user.name}.`,
      metadata: {
        previousStatus: prevStatus,
        newStatus: onboarding.status,
        previousFormComplete: prevFormComplete,
        newFormComplete: !!onboarding.isFormComplete,
        method: onboarding.method,
        subsidiary: onboarding.subsidiary,
        source: "ADMIN_PUT",
      },
    });

    return successResponse(200, "Onboarding updated", {
      onboarding: responsePayload,
    });
  } catch (error) {
    // Only roll back S3 if we *haven't* committed the onboarding yet
    if (!saved && movedFinalKeys.length) {
      try {
        await deleteS3Objects(movedFinalKeys);
      } catch (cleanupError) {
        console.warn("Failed to delete finalized onboarding S3 objects during admin PUT cleanup:", movedFinalKeys, cleanupError);
      }
    }

    return errorResponse(error);
  }
};

/* -------------------------------------------------------------------------- */
/* DELETE /api/v1/admin/onboardings/[id]                                      */
/* -------------------------------------------------------------------------- */
/**
 * HR: Permanently delete a terminated onboarding.
 *
 * Rules:
 * - ONLY terminated onboardings can be deleted. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}
 * - This is meant to be used from the "Terminated" view's Delete action. :contentReference[oaicite:5]{index=5}
 * - We delete:
 *   1) All S3 assets referenced by the onboarding (best-effort; fails the request if S3 delete fails).
 *   2) The onboarding document itself.
 *   3) We also append an OnboardingAuditLog entry with action=DELETED before deletion. :contentReference[oaicite:6]{index=6}
 *
 * NOTE:
 * - We intentionally KEEP existing audit logs for compliance/history (they reference onboardingId).
 *   If you prefer to hard-delete logs too, add:
 *     await OnboardingAuditLogModel.deleteMany({ onboardingId: onboarding._id })
 *   after creating the DELETED audit entry (or skip creating it if you delete logs).
 */

export const DELETE = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const user = await guard(); // ensure HR / admin

    const { id: onboardingId } = await params;

    const onboarding = await OnboardingModel.findById(onboardingId);
    if (!onboarding) {
      return errorResponse(404, "Onboarding not found");
    }

    if (onboarding.status !== EOnboardingStatus.Terminated) {
      return errorResponse(400, "Only terminated onboardings can be deleted");
    }

    // 1) Collect all S3 keys referenced anywhere on the onboarding doc
    //    (covers indiaFormData + future canada/us + any other file asset fields)
    const keys = collectS3KeysDeep(onboarding.toObject());

    // 2) Delete S3 objects first (so we don't lose the references if delete fails)
    if (keys.length) {
      await deleteS3Objects(keys);
    }

    // 3) Write audit entry before deletion (so the "Deleted" action is captured) :contentReference[oaicite:7]{index=7}
    await createOnboardingAuditLogSafe({
      onboardingId: (onboarding as any)._id?.toString?.() ?? String(onboardingId),
      action: EOnboardingAuditAction.DELETED,
      actor: {
        type: EOnboardingActor.HR,
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message: `Onboarding permanently deleted by ${user.name}.`,
      metadata: {
        statusAtDelete: onboarding.status,
        subsidiary: onboarding.subsidiary,
        method: onboarding.method,
        deletedS3KeysCount: keys.length,
        source: "ADMIN_DELETE",
      },
    });

    // delete associated audit logs
    await OnboardingAuditLogModel.deleteMany({ onboardingId: onboarding._id });

    // 4) Delete the onboarding document
    await OnboardingModel.deleteOne({ _id: onboarding._id });

    return successResponse(200, "Onboarding deleted", {
      deleted: {
        id: onboarding._id?.toString?.() ?? onboardingId,
        deletedS3KeysCount: keys.length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
