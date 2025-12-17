import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { isValidObjectId } from "mongoose";
import { PDFDocument } from "pdf-lib";

import connectDB from "@/lib/utils/connectDB";
import { guard } from "@/lib/utils/auth/authUtils";
import { errorResponse } from "@/lib/utils/apiResponse";

import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { ESubsidiary } from "@/types/shared.types";

import { loadImageBytesFromAsset } from "@/lib/utils/s3Helper";
import { drawPdfImage } from "@/lib/pdf/utils/drawPdfImage";

import { buildNptIndiaApplicationFormPayload, applyNptIndiaApplicationFormPayloadToForm } from "@/lib/pdf/application-form/mappers/npt-india-application-form.mapper";
import { ENptIndiaApplicationFormFields as F } from "@/lib/pdf/application-form/mappers/npt-india-application-form.types";

/**
 * GET /api/v1/admin/onboardings/[id]/filled-pdf/application-form
 *
 * Generates a filled Hiring Application PDF for an onboarding record.
 *
 * Access:
 *  - Admin only
 *
 * Requirements:
 *  - `subsidiary` query param is required
 *  - Currently supported subsidiary: INDIA only
 *  - `subsidiary` must match `onboarding.subsidiary`
 *  - `onboarding.isFormComplete === true`
 *  - `onboarding.indiaFormData` must be present
 *
 * Output:
 *  - application/pdf (inline)
 *  - Filled and flattened NPT India Hiring Application form
 */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    await guard();

    const { id: onboardingId } = await params;
    if (!isValidObjectId(onboardingId)) return errorResponse(400, "Not a valid onboarding ID");

    const subsidiaryRaw = req.nextUrl.searchParams.get("subsidiary");
    if (!subsidiaryRaw) return errorResponse(400, "subsidiary is required");

    if (!Object.values(ESubsidiary).includes(subsidiaryRaw as ESubsidiary)) {
      return errorResponse(400, "Invalid subsidiary");
    }
    const subsidiary = subsidiaryRaw as ESubsidiary;

    if (subsidiary !== ESubsidiary.INDIA) {
      return errorResponse(400, "Filled application form PDF is only supported for INDIA subsidiary");
    }

    // IMPORTANT: do NOT use .lean() here, we need getters/virtuals (decryption getters).
    const onboardingDoc = await OnboardingModel.findById(onboardingId);
    if (!onboardingDoc) return errorResponse(404, "Onboarding not found");

    // Ensure caller-provided subsidiary matches record
    if (onboardingDoc.subsidiary !== subsidiary) {
      return errorResponse(400, "subsidiary does not match onboarding.subsidiary");
    }

    if (!onboardingDoc.isFormComplete) {
      return errorResponse(400, "Cannot generate filled PDF: form is not marked complete (isFormComplete=false)");
    }

    // Convert using schema getters/virtuals so encryptedStringField getters run
    const onboarding = onboardingDoc.toObject({ getters: true, virtuals: true }) as any;

    const formData = onboarding.indiaFormData;
    if (!formData) return errorResponse(400, "indiaFormData is missing");

    /* ----------------------------- Load template ------------------------- */

    const pdfPath = path.join(process.cwd(), "src/lib/pdf/application-form/templates/npt-india-application-form-fillable.pdf");
    const pdfBytes = await fs.readFile(pdfPath);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();

    /* ----------------------------- Fill fields --------------------------- */

    const payload = buildNptIndiaApplicationFormPayload(formData);
    applyNptIndiaApplicationFormPayloadToForm(form, payload);

    /* ---------------------------- Draw signature ------------------------- */
    try {
      const sigAsset = formData.declaration?.signature?.file;
      const sigBytes = await loadImageBytesFromAsset(sigAsset);

      await drawPdfImage({
        pdfDoc,
        form,
        page: pages[4], // declaration page
        fieldName: F.DECLARATION_SIGNATURE,
        imageBytes: sigBytes,
        width: 140,
        height: 30,
        yOffset: 0,
      });
    } catch (e) {
      console.warn("Application form signature draw failed:", e);
    }

    form.flatten();

    const out = await pdfDoc.save();
    const arrayBuffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="npt-india-application-form-filled.pdf"',
      },
    });
  } catch (err) {
    console.error("application-form/filled-pdf error:", err);
    return errorResponse(err);
  }
};
