// src/workers/applicationFormPdfWorker.ts

import path from "node:path";
import fs from "node:fs/promises";

import mongoose from "mongoose";
import { PassThrough } from "stream";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { ESubsidiary, EFileMimeType, type IFileAsset } from "@/types/shared.types";

import { keyJoin } from "@/lib/utils/s3Helper";
import { S3_TEMP_FOLDER } from "@/constants/aws";

import { buildNptIndiaApplicationFormPayload, applyNptIndiaApplicationFormPayloadToForm } from "@/lib/pdf/application-form/mappers/npt-india-application-form.mapper";
import { ENptIndiaApplicationFormFields as F } from "@/lib/pdf/application-form/mappers/npt-india-application-form.types";

const APP_AWS_BUCKET_NAME = process.env.APP_AWS_BUCKET_NAME!;
const APP_AWS_REGION = process.env.APP_AWS_REGION!;
const MONGO_URI = process.env.MONGO_URI!;

if (!APP_AWS_BUCKET_NAME) throw new Error("APP_AWS_BUCKET_NAME is not set");
if (!APP_AWS_REGION) throw new Error("APP_AWS_REGION is not set");
if (!MONGO_URI) throw new Error("MONGO_URI is not set");

type JobState = "RUNNING" | "DONE" | "ERROR";

type Payload = {
  jobId: string;
  requestedAt: string;

  onboardingId: string;
  subsidiary: ESubsidiary;
  filename: string | null;
};

type JobStatus = {
  state: JobState;
  progressPercent: number;

  startedAt: string;
  updatedAt: string;

  downloadKey: string | null;
  downloadUrl: string | null;

  errorMessage?: string | null;
};

const s3 = new S3Client({ region: APP_AWS_REGION });

function trimSlashes(p: string) {
  return p.replace(/^\/+|\/+$/g, "");
}
function publicUrlForKey(key: string) {
  return `https://${APP_AWS_BUCKET_NAME}.s3.${APP_AWS_REGION}.amazonaws.com/${trimSlashes(key)}`;
}

function basePrefix() {
  return keyJoin(S3_TEMP_FOLDER, "onboardings", "application-form-pdf");
}
function statusKeyFor(jobId: string) {
  return keyJoin(basePrefix(), `${jobId}.json`);
}

async function putStatus(jobId: string, status: JobStatus) {
  const payload: JobStatus = { ...status, updatedAt: new Date().toISOString() };
  await s3.send(
    new PutObjectCommand({
      Bucket: APP_AWS_BUCKET_NAME,
      Key: statusKeyFor(jobId),
      Body: JSON.stringify(payload),
      ContentType: "application/json",
    })
  );
}

async function getStatusIfExists(jobId: string): Promise<JobStatus | null> {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: APP_AWS_BUCKET_NAME, Key: statusKeyFor(jobId) }));
    if (!out.Body) return null;
    const buf = await out.Body.transformToByteArray();
    return JSON.parse(new TextDecoder("utf-8").decode(buf)) as JobStatus;
  } catch {
    return null;
  }
}

function startS3UploadStream(key: string, contentType: string) {
  const pass = new PassThrough();
  const uploader = new Upload({
    client: s3,
    params: { Bucket: APP_AWS_BUCKET_NAME, Key: key, Body: pass, ContentType: contentType },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  });
  return { pass, donePromise: uploader.done() };
}

let mongoConnected = false;
async function connectDB() {
  if (mongoConnected) return;
  await mongoose.connect(MONGO_URI);
  mongoConnected = true;
}

async function getS3ObjectBytes(key: string): Promise<Uint8Array> {
  const out = await s3.send(new GetObjectCommand({ Bucket: APP_AWS_BUCKET_NAME, Key: key }));
  const body: any = out.Body;
  if (!body) throw new Error(`Empty S3 body for ${key}`);
  if (body.transformToByteArray) return await body.transformToByteArray();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    body.on("data", (d: Buffer) => chunks.push(d));
    body.on("end", () => resolve());
    body.on("error", reject);
  });
  return new Uint8Array(Buffer.concat(chunks));
}

function normalizeMime(mt?: string): string {
  return (mt || "").toLowerCase();
}
function isPdfAsset(a?: IFileAsset | null) {
  return a?.s3Key && normalizeMime(a.mimeType) === EFileMimeType.PDF;
}
function isImageAsset(a?: IFileAsset | null) {
  const mt = normalizeMime(a?.mimeType);
  return a?.s3Key && (mt === EFileMimeType.PNG || mt === EFileMimeType.JPEG || mt === EFileMimeType.JPG || mt.startsWith("image/"));
}

/**
 * India-only attachment collector:
 * - include all uploaded docs EXCEPT signature
 * - include PDFs + images only
 * - preserve a stable, HR-friendly ordering
 */
function collectIndiaAttachments(formData: any): Array<{ label: string; asset: IFileAsset }> {
  const out: Array<{ label: string; asset: IFileAsset }> = [];

  const g = formData?.governmentIds;
  const bank = formData?.bankDetails;
  const jobs = Array.isArray(formData?.employmentHistory) ? formData.employmentHistory : [];

  const push = (label: string, asset?: IFileAsset | null) => {
    if (!asset?.s3Key) return;
    if (!(isPdfAsset(asset) || isImageAsset(asset))) return;
    out.push({ label, asset });
  };

  // Gov IDs
  push("Aadhaar Card", g?.aadhaar?.file);
  push("PAN Card", g?.panCard?.file);

  push("Passport (Front)", g?.passport?.frontFile);
  push("Passport (Back)", g?.passport?.backFile);

  push("Driver's License (Front)", g?.driversLicense?.frontFile);
  push("Driver's License (Back)", g?.driversLicense?.backFile);

  // Bank
  push("Void Cheque", bank?.voidCheque?.file);

  // Employment certs
  for (let i = 0; i < Math.min(3, jobs.length); i++) {
    push(`Experience Certificate (${i + 1})`, jobs[i]?.experienceCertificateFile);
  }

  // NOTE: signature is excluded by design (it’s already drawn into the filled form)
  return out;
}

function fitIntoA4(imgW: number, imgH: number) {
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;

  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;

  return { pageW, pageH, x, y, w, h };
}

async function appendPdfOrImage(merged: PDFDocument, asset: IFileAsset) {
  const bytes = await getS3ObjectBytes(asset.s3Key);
  const mt = normalizeMime(asset.mimeType);

  if (mt === EFileMimeType.PDF) {
    const src = await PDFDocument.load(bytes);
    const srcPages = await merged.copyPages(src, src.getPageIndices());
    for (const p of srcPages) merged.addPage(p);
    return;
  }

  let embedded: any;
  if (mt === EFileMimeType.PNG) embedded = await merged.embedPng(bytes);
  else embedded = await merged.embedJpg(bytes);

  const { width: iw, height: ih } = embedded.scale(1);
  const { pageW, pageH, x, y, w, h } = fitIntoA4(iw, ih);

  const page = merged.addPage([pageW, pageH]);
  page.drawImage(embedded, { x, y, width: w, height: h });
}

/* -------------------------------------------------------------------------- */
/* Checkmark drawing (uses widget rectangle from the form field)              */
/* -------------------------------------------------------------------------- */

// Page indices in the PDF (0-based): Page1=0, Page2=1, Page3=2, Page4=3, Page5=4
const CHECKBOX_PAGE_INDEX: Partial<Record<F, number>> = {
  // Page 2
  [F.CONSENT_TO_CONTACT]: 1,
  [F.AADHAAR_CARD_ATTACHED]: 1,
  [F.PAN_CARD_ATTACHED]: 1,
  [F.PASSPORT_FRONT_ATTACHED]: 1,
  [F.PASSPORT_BACK_ATTACHED]: 1,
  [F.LICENSE_FRONT_ATTACHED]: 1,
  [F.LICENSE_BACK_ATTACHED]: 1,

  // Page 3
  [F.EDU_PRIMARY_SCHOOL]: 2,
  [F.EDU_HIGH_SCHOOL]: 2,
  [F.EDU_DIPLOMA]: 2,
  [F.EDU_BACHELORS]: 2,
  [F.EDU_MASTERS]: 2,
  [F.EDU_DOCTORATE]: 2,
  [F.EDU_OTHER]: 2,

  // Page 4
  [F.EMP1_NA]: 3,
  [F.EMP1_REF_CHECK_YES]: 3,
  [F.EMP1_REF_CHECK_NO]: 3,
  [F.EMP1_EXP_CERT_YES]: 3,
  [F.EMP1_EXP_CERT_NO]: 3,

  [F.EMP2_NA]: 3,
  [F.EMP2_REF_CHECK_YES]: 3,
  [F.EMP2_REF_CHECK_NO]: 3,
  [F.EMP2_EXP_CERT_YES]: 3,
  [F.EMP2_EXP_CERT_NO]: 3,

  [F.EMP3_NA]: 3,
  [F.EMP3_REF_CHECK_YES]: 3,
  [F.EMP3_REF_CHECK_NO]: 3,
  [F.EMP3_EXP_CERT_YES]: 3,
  [F.EMP3_EXP_CERT_NO]: 3,

  // Page 5
  [F.VOID_CHEQUE_ATTACHED_YES]: 4,
  [F.VOID_CHEQUE_ATTACHED_NO]: 4,
  [F.DECLARATION_ACCEPTED]: 4,
};

type Rect = { x: number; y: number; width: number; height: number };
type PendingMark = { fieldName: string; pageIndex: number; rect: Rect };

function getTextFieldRect(form: any, fieldName: string): Rect | null {
  try {
    const tf = form.getTextField(fieldName);
    const widgets = tf?.acroField?.getWidgets?.();
    const widget = widgets?.[0];
    const r = widget?.getRectangle?.();
    if (!r) return null;
    const { x, y, width, height } = r;
    if ([x, y, width, height].some((n: any) => typeof n !== "number")) return null;
    return { x, y, width, height };
  } catch {
    return null;
  }
}

function computeDrawBox(rect: Rect) {
  // small padding so it doesn't touch box border
  const pad = Math.max(1.5, Math.min(3, rect.width * 0.12, rect.height * 0.12));
  const w = Math.max(1, rect.width - pad * 2);
  const h = Math.max(1, rect.height - pad * 2);
  const x = rect.x + pad;
  const y = rect.y + pad;
  return { x, y, w, h };
}

async function drawCheckmarks(pages: any[], doc: PDFDocument, marks: PendingMark[]) {
  if (!marks.length) return;

  // Load once; embed once; reuse for all marks
  const checkPath = path.join(process.cwd(), "icons", "check-mark.png");
  const checkBytes = await fs.readFile(checkPath);
  const checkImg = await doc.embedPng(checkBytes);

  for (const m of marks) {
    const page = pages[m.pageIndex];
    if (!page) continue;

    const { x, y, w, h } = computeDrawBox(m.rect);

    // preserve aspect ratio of the check image while fitting into w x h
    const scaled = checkImg.scale(1);
    const iw = scaled.width;
    const ih = scaled.height;

    const scale = Math.min(w / iw, h / ih, 1);
    const dw = iw * scale;
    const dh = ih * scale;

    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    page.drawImage(checkImg, { x: dx, y: dy, width: dw, height: dh });
  }
}

export const handler = async (event: any) => {
  const payload: Payload = typeof event === "string" ? JSON.parse(event) : event;
  const { jobId, onboardingId, subsidiary } = payload;

  if (!jobId) throw new Error("jobId is required");
  if (!onboardingId) throw new Error("onboardingId is required");
  if (subsidiary !== ESubsidiary.INDIA) throw new Error("Only INDIA subsidiary is supported");

  const existing = await getStatusIfExists(jobId);
  if (existing?.state === "DONE") return { ok: true, jobId, alreadyDone: true };

  const status: JobStatus = {
    state: "RUNNING",
    progressPercent: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    downloadKey: null,
    downloadUrl: null,
    errorMessage: null,
  };

  await putStatus(jobId, status);

  try {
    await connectDB();

    // IMPORTANT: do NOT use lean; we want getters/virtuals to decrypt fields
    const onboardingDoc = await OnboardingModel.findById(onboardingId);
    if (!onboardingDoc) throw new Error("Onboarding not found");
    if (onboardingDoc.subsidiary !== subsidiary) throw new Error("subsidiary does not match onboarding.subsidiary");
    if (!onboardingDoc.isFormComplete) throw new Error("Cannot generate bundle PDF: isFormComplete=false");

    const onboarding = onboardingDoc.toObject({ getters: true, virtuals: true }) as any;
    const formData = onboarding.indiaFormData;
    if (!formData) throw new Error("indiaFormData is missing");

    // 1) Load fillable template
    const templatePath = path.join(process.cwd(), "templates", "npt-india-application-form-fillable.pdf");
    const templateBytes = await fs.readFile(templatePath);

    // 2) Fill it (text fields), then draw checkmarks + signature as images
    const filledDoc = await PDFDocument.load(templateBytes);
    filledDoc.registerFontkit(fontkit);

    const form = filledDoc.getForm();
    const pages = filledDoc.getPages();

    const filledPayload = buildNptIndiaApplicationFormPayload(formData);

    // 2a) apply all string fields
    applyNptIndiaApplicationFormPayloadToForm(form, filledPayload);

    // 2b) compute which checkboxes to draw (capture rects BEFORE flatten)
    const pendingMarks: PendingMark[] = [];
    for (const [name, value] of Object.entries(filledPayload)) {
      if (value !== true) continue; // only draw when true
      const pageIndex = CHECKBOX_PAGE_INDEX[name as F];
      if (pageIndex == null) continue;

      const rect = getTextFieldRect(form as any, name);
      if (!rect) continue;

      pendingMarks.push({ fieldName: name, pageIndex, rect });
    }

    // 2c) capture signature rect BEFORE flatten (so we can draw after flatten)
    let sigRect: Rect | null = null;
    try {
      sigRect = getTextFieldRect(form as any, F.DECLARATION_SIGNATURE);
    } catch {
      sigRect = null;
    }

    // 2d) Force a light Inter appearance for ALL text fields
    const interPath = path.join(process.cwd(), "fonts", "inter-regular.ttf");
    const interBytes = await fs.readFile(interPath);
    const interRegular = await filledDoc.embedFont(interBytes, { subset: false });

    form.updateFieldAppearances(interRegular);
    form.flatten();

    // 2e) draw checkmarks AFTER flatten so they are definitely on top
    await drawCheckmarks(pages as any[], filledDoc, pendingMarks);

    // 2f) Draw signature AFTER flatten (excluded from attachments)
    try {
      const sigAsset: IFileAsset | undefined = formData?.declaration?.signature?.file;
      if (sigAsset?.s3Key && isImageAsset(sigAsset)) {
        const sigBytes = await getS3ObjectBytes(sigAsset.s3Key);

        // Declaration is page 5 (index 4) in the template
        const page = pages[4];

        if (sigRect && page) {
          const { x, y, width, height } = sigRect;

          const img = normalizeMime(sigAsset.mimeType) === EFileMimeType.PNG ? await filledDoc.embedPng(sigBytes) : await filledDoc.embedJpg(sigBytes);

          const targetW = Math.min(width, 140);
          const targetH = Math.min(height, 30);

          page.drawImage(img, { x, y, width: targetW, height: targetH });
        }
      }
    } catch (e) {
      console.warn("Signature draw failed:", e);
    }

    status.progressPercent = 25;
    await putStatus(jobId, status);

    // 3) Start merged output doc with filled form pages
    const merged = await PDFDocument.create();
    const filledPages = await merged.copyPages(filledDoc, filledDoc.getPageIndices());
    for (const p of filledPages) merged.addPage(p);

    status.progressPercent = 45;
    await putStatus(jobId, status);

    // 4) Append attachments
    const attachments = collectIndiaAttachments(formData);
    const total = attachments.length || 1;
    let done = 0;

    for (const a of attachments) {
      await appendPdfOrImage(merged, a.asset);
      done++;
      status.progressPercent = 45 + Math.round((done / total) * 45);
      await putStatus(jobId, status);
    }

    // 5) Upload merged PDF
    const outName = payload.filename && payload.filename.trim() ? payload.filename.trim() : `${jobId}.pdf`;
    const safeName = outName.toLowerCase().endsWith(".pdf") ? outName : `${outName}.pdf`;
    const outKey = keyJoin(basePrefix(), safeName);

    const { pass, donePromise } = startS3UploadStream(outKey, "application/pdf");
    const outBytes = await merged.save();

    pass.end(Buffer.from(outBytes));
    await donePromise;

    status.state = "DONE";
    status.progressPercent = 100;
    status.downloadKey = outKey;
    status.downloadUrl = publicUrlForKey(outKey);
    await putStatus(jobId, status);

    return { ok: true, jobId, downloadKey: outKey, downloadUrl: status.downloadUrl };
  } catch (err: any) {
    status.state = "ERROR";
    status.errorMessage = err?.message || "Unknown PDF job error";
    await putStatus(jobId, status);
    throw err;
  }
};
