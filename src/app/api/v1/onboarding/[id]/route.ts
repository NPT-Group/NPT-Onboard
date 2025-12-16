// src/app/api/v1/onboarding/[id]/route.ts
import { NextRequest } from "next/server";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { parseJsonBody } from "@/lib/utils/reqParser";

import { clearOnboardingCookieHeader, requireOnboardingSession } from "@/lib/utils/auth/onboardingSession";
import { createOnboardingContext, createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";

import { makeEntityFinalPrefix, finalizeAssetWithCache, deleteS3Objects } from "@/lib/utils/s3Helper";

import { ES3Namespace, ES3Folder } from "@/types/aws.types";
import { EOnboardingStatus, type IIndiaOnboardingFormData } from "@/types/onboarding.types";
import { ESubsidiary, type IFileAsset, type IGeoLocation } from "@/types/shared.types";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";
import { validateIndiaOnboardingForm } from "@/lib/validation/onboardingFormValidation";
import { verifyTurnstileToken } from "@/lib/security/verifyTurnstile";
import { reverseGeocodeStrict } from "@/lib/utils/reverseGeocode.server";
import { attachCookies } from "@/lib/utils/auth/attachCookie";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type SubmitIndiaFormBody = {
  indiaFormData: IIndiaOnboardingFormData;
  locationAtSubmit: IGeoLocation;
  turnstileToken: string; // Cloudflare Turnstile token from client
};

/**
 * Finalize all file assets within the India onboarding form data into
 * submissions/onboardings/{onboardingId}/... using proper logical folders.
 *
 * Returns a deep-cloned, mutated copy of the payload with FINAL S3 keys.
 * Any newly created final keys are pushed into `collector` for potential
 * cleanup on failure.
 */
async function finalizeIndiaOnboardingAssets(onboardingId: string, payload: IIndiaOnboardingFormData, collector: string[]): Promise<IIndiaOnboardingFormData> {
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

// -----------------------------------------------------------------------------
// GET /api/v1/onboarding/[id]
//
// Returns a sanitized onboarding “context” for the employee UI.
//
// Access control (employee session):
// - Requires a valid onboarding session cookie (raw invite token).
// - Cookie token must hash-match `invite.tokenHash` for the SAME onboarding [id].
// - Enforces: method = DIGITAL, invite exists + not expired.
// - Employee session is only valid when onboarding.status is:
//     - InviteGenerated
//     - ModificationRequested
//   (Any other status => no session; employee cannot access this route.)

//
// Response:
// - Returns `onboardingContext` (derived from `createOnboardingContext`), not the
//   raw onboarding document, to avoid leaking sensitive/internal fields.
// -----------------------------------------------------------------------------
export const GET = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();

    const { id } = await params;

    // Validates cookie, onboardingId, invite, status, etc.
    const { onboarding } = await requireOnboardingSession(id);

    const onboardingObj = onboarding.toObject({ virtuals: true, getters: true });
    const onboardingContext = createOnboardingContext(onboardingObj);

    return successResponse(200, "Onboarding data retrieved", {
      onboardingContext,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

/* -------------------------------------------------------------------------- */
/* POST /api/v1/onboarding/[id]                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Submit (or re-submit) the India onboarding form as an employee.
 *
 * Expected body (India only for now):
 * {
 *   "indiaFormData": { ...full IIndiaOnboardingFormData payload... },
 *   "locationAtSubmit": { ...IGeoLocation... },
 *   "turnstileToken": "string-from-client-widget"
 * }
 *
 * Behavior:
 *  - Requires a valid onboarding session cookie (invite+OTP).
 *  - Onboarding must be DIGITAL and belong to subsidiary INDIA.
 *  - Onboarding must be in an editable state:
 *      - InviteGenerated  -> first submission  -> status: Submitted
 *      - ModificationRequested -> re-submission -> status: Resubmitted
 *  - All TEMP S3 keys in the form are finalized under:
 *      submissions/onboardings/{onboardingId}/...
 *    with logical ES3Folder mapping (IDs, bank docs, employment certificates,
 *    declaration signature).
 *  - On success:
 *      - `indiaFormData` is saved on the onboarding document
 *      - `status`, `submittedAt`, and `locationAtSubmit` are updated
 *      - An audit log entry is recorded (SUBMITTED or RESUBMITTED)
 *      - Returns a sanitized `onboardingContext`.
 *
 *  - On failure:
 *      - Any finalized S3 objects created during this request are deleted
 *        best-effort.
 */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  // Collector of finalized S3 keys to delete if something goes wrong
  const movedFinalKeys: string[] = [];
  let saved = false;
  try {
    await connectDB();

    const { id: onboardingId } = await params;

    // Validate session + base access (digital, invite valid, status session-eligible)
    const { onboarding } = await requireOnboardingSession(onboardingId);

    // For now we only support India onboarding flow
    if (onboarding.subsidiary !== ESubsidiary.INDIA) {
      return errorResponse(400, "Only INDIA subsidiary onboarding is supported at this time");
    }

    // Ensure employee is allowed to edit in current status
    const prevStatus: EOnboardingStatus = onboarding.status;

    if (prevStatus !== EOnboardingStatus.InviteGenerated && prevStatus !== EOnboardingStatus.ModificationRequested) {
      return errorResponse(403, "Onboarding is not editable in the current state");
    }

    // Parse body
    const body = await parseJsonBody<SubmitIndiaFormBody>(req);

    if (!body || typeof body !== "object") {
      return errorResponse(400, "Invalid request body");
    }

    const { indiaFormData, locationAtSubmit, turnstileToken } = body;

    // Basic shape checks
    if (!indiaFormData) {
      return errorResponse(400, "Missing indiaFormData in request body");
    }

    if (!locationAtSubmit || typeof locationAtSubmit !== "object") {
      return errorResponse(400, "Missing locationAtSubmit in request body");
    }
    if (typeof (locationAtSubmit as any).latitude !== "number" || typeof (locationAtSubmit as any).longitude !== "number") {
      return errorResponse(400, "locationAtSubmit.latitude and longitude are required");
    }

    // Turnstile verification (bot protection)
    if (!turnstileToken || typeof turnstileToken !== "string") {
      return errorResponse(400, "Missing Turnstile token");
    }

    const turnstileResult = await verifyTurnstileToken(turnstileToken);

    if (!turnstileResult.ok) {
      const status = turnstileResult.error === "Missing TURNSTILE_SECRET_KEY" ? 500 : 400;
      return errorResponse(status, `Turnstile verification failed: ${turnstileResult.error}`);
    }

    // Enforce canonical identity from onboarding doc
    indiaFormData.personalInfo.firstName = onboarding.firstName;
    indiaFormData.personalInfo.lastName = onboarding.lastName;
    indiaFormData.personalInfo.email = onboarding.email;

    // Validate indiaFormData
    validateIndiaOnboardingForm(indiaFormData);

    // Finalize S3 assets in the India form payload
    const finalizedIndiaFormData = await finalizeIndiaOnboardingAssets(onboarding._id?.toString?.() ?? onboardingId, indiaFormData, movedFinalKeys);

    // Transition status based on previous state
    let nextStatus: EOnboardingStatus;
    let auditAction: EOnboardingAuditAction;

    if (prevStatus === EOnboardingStatus.InviteGenerated) {
      nextStatus = EOnboardingStatus.Submitted;
      auditAction = EOnboardingAuditAction.SUBMITTED;
    } else {
      // ModificationRequested -> Resubmitted
      nextStatus = EOnboardingStatus.Resubmitted;
      auditAction = EOnboardingAuditAction.RESUBMITTED;
    }

    const now = new Date();

    // Server-trusted location:
    // We do NOT trust client-provided city/region/country. We derive them from
    // lat/lng on the server using reverse geocoding for consistency across IN/US/CA.
    // If we cannot derive these reliably, we fail submission (requirement: always
    // have true location data).
    let serverLocationAtSubmit: IGeoLocation;
    try {
      const latitude = (locationAtSubmit as any).latitude as number;
      const longitude = (locationAtSubmit as any).longitude as number;
      const derived = await reverseGeocodeStrict({ latitude, longitude });
      serverLocationAtSubmit = {
        ...locationAtSubmit,
        latitude,
        longitude,
        country: derived.country,
        region: derived.region,
        city: derived.city,
      };
    } catch (e: any) {
      return errorResponse(502, e?.message || "Unable to determine your city/state/country from GPS. Please try again.");
    }

    // Mutate onboarding document
    onboarding.indiaFormData = finalizedIndiaFormData;
    onboarding.status = nextStatus;
    onboarding.submittedAt = now;
    onboarding.isFormComplete = true; // form data is now complete
    onboarding.locationAtSubmit = serverLocationAtSubmit;

    // Let Mongoose enforce schema-level validation (including pre-save hook
    // that requires per-subsidiary formData when status is Submitted/Resubmitted)
    await onboarding.validate();
    await onboarding.save();
    saved = true;

    // Build sanitized context for frontend
    const onboardingObj = onboarding.toObject({ virtuals: true, getters: true });
    const onboardingContext = createOnboardingContext(onboardingObj);

    // Fire-and-forget audit log (do not break request if it fails)
    await createOnboardingAuditLogSafe({
      onboardingId: (onboarding as any)._id?.toString?.() ?? String(onboardingId),
      action: auditAction,
      actor: {
        type: EOnboardingActor.EMPLOYEE,
        // We don't have a stable employee ID yet
        id: undefined,
        name: `${onboarding.firstName} ${onboarding.lastName}`.trim(),
        email: onboarding.email,
      },
      message: auditAction === EOnboardingAuditAction.SUBMITTED ? `Onboarding form submitted by the employee.` : `Onboarding form re-submitted by the employee after requested changes.`,
      metadata: {
        previousStatus: prevStatus,
        newStatus: nextStatus,
        subsidiary: onboarding.subsidiary,
      },
    });

    const res = successResponse(200, "Onboarding form submitted", {
      onboardingContext,
    });

    // employee session ends immediately after submission
    attachCookies(res, clearOnboardingCookieHeader());

    return res;
  } catch (error) {
    // Only roll back S3 if we *haven't* committed the onboarding yet
    if (!saved && movedFinalKeys.length) {
      try {
        await deleteS3Objects(movedFinalKeys);
      } catch (cleanupError) {
        console.warn("Failed to delete finalized onboarding S3 objects during cleanup:", movedFinalKeys, cleanupError);
      }
    }

    return errorResponse(error);
  }
};
