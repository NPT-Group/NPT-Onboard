// src/workers/onboardingsReportWorker.ts
import ExcelJS from "exceljs";
import { PassThrough } from "stream";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

import mongoose from "mongoose";
import { OnboardingModel } from "@/mongoose/models/Onboarding";
import type { SortOrder } from "mongoose";

import { rx } from "@/lib/utils/queryUtils";

import { ESubsidiary } from "@/types/shared.types";
import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";

import { keyJoin } from "@/lib/utils/s3Helper";
import { S3_TEMP_FOLDER } from "@/constants/aws";

/* ───────── Env ───────── */
const APP_AWS_BUCKET_NAME = process.env.APP_AWS_BUCKET_NAME!;
const APP_AWS_REGION = process.env.APP_AWS_REGION!;
const MONGO_URI = process.env.MONGO_URI!;
const ENC_KEY = process.env.ENC_KEY!;

if (!APP_AWS_BUCKET_NAME) throw new Error("APP_AWS_BUCKET_NAME is not set");
if (!APP_AWS_REGION) throw new Error("APP_AWS_REGION is not set");
if (!MONGO_URI) throw new Error("MONGO_URI is not set");
if (!ENC_KEY) throw new Error("ENC_KEY is not set");

/* ───────── Types ───────── */
type JobState = "RUNNING" | "DONE" | "ERROR";
type FileFormat = "csv" | "xlsx";
type DateField = "created" | "submitted" | "approved" | "terminated" | "updated";

type Payload = {
  jobId: string;
  subsidiary: ESubsidiary;

  q: string | null;
  method: EOnboardingMethod | null;
  statuses: EOnboardingStatus[] | null;
  statusGroup: string | null;

  hasEmployeeNumber: boolean | null;
  isCompleted: boolean | null;

  dateField: DateField;
  from: string | null;
  to: string | null;

  sortBy: string | null;
  sortDir: "asc" | "desc" | null;

  format: FileFormat;
  filename: string | null;

  page: string | null;
  pageSize: string | null;
};

type JobStatus = {
  state: JobState;
  progressPercent: number;
  processed: number;
  total: number | null;
  rowCount: number | null;

  format: FileFormat;
  startedAt: string;
  updatedAt: string;

  downloadKey: string | null;
  downloadUrl: string | null;

  errorMessage?: string | null;
};

/* ───────── S3 ───────── */
const s3 = new S3Client({ region: APP_AWS_REGION });

function trimSlashes(p: string) {
  return p.replace(/^\/+|\/+$/g, "");
}
function publicUrlForKey(key: string) {
  return `https://${APP_AWS_BUCKET_NAME}.s3.${APP_AWS_REGION}.amazonaws.com/${trimSlashes(key)}`;
}

function reportsBasePrefix() {
  return keyJoin(S3_TEMP_FOLDER, "onboardings", "reports");
}
function statusKeyFor(jobId: string) {
  return keyJoin(reportsBasePrefix(), `${jobId}.json`);
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

/* ───────── Mongo ───────── */
let mongoConnected = false;
async function connectDB() {
  if (mongoConnected) return;
  await mongoose.connect(MONGO_URI);
  mongoConnected = true;
}

/* ───────── Filtering (match list route semantics) ───────── */
function parseIsoDateLoose(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}

function inclusiveEndOfDayLocal(input: Date, raw: string | null): Date {
  // matches your API helper behavior: if raw is YYYY-MM-DD, treat as end of day
  if (!raw) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const end = new Date(input);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  return input;
}

function buildFilter(payload: Payload) {
  const filter: any = { subsidiary: payload.subsidiary };

  if (payload.method) filter.method = payload.method;

  if (payload.q && payload.q.trim()) {
    const tokens = payload.q.trim().split(/\s+/).filter(Boolean);

    // Each token must match at least one of the fields (AND of ORs)
    const tokenClauses = tokens.map((t) => {
      const r = rx(t);
      return { $or: [{ firstName: r }, { lastName: r }, { email: r }, { employeeNumber: r }] };
    });

    filter.$and = filter.$and ? [...filter.$and, ...tokenClauses] : tokenClauses;
  }

  // statuses vs statusGroup map (same as route)
  const groupMap: Record<string, EOnboardingStatus[]> = {
    pending: [EOnboardingStatus.InviteGenerated],
    modificationRequested: [EOnboardingStatus.ModificationRequested],
    pendingReview: [EOnboardingStatus.Submitted, EOnboardingStatus.Resubmitted],
    approved: [EOnboardingStatus.Approved],
    manual: [EOnboardingStatus.ManualPDFSent],
    terminated: [EOnboardingStatus.Terminated],
  };

  const statuses = payload.statuses?.length ? payload.statuses : payload.statusGroup && groupMap[payload.statusGroup] ? groupMap[payload.statusGroup] : null;

  const includeTerminated = (statuses?.includes(EOnboardingStatus.Terminated) ?? false) || payload.statusGroup === "terminated";
  if (statuses && statuses.length) {
    filter.status = { $in: statuses };
  } else if (!includeTerminated) {
    filter.status = { $ne: EOnboardingStatus.Terminated };
  }

  if (payload.hasEmployeeNumber !== null && payload.hasEmployeeNumber !== undefined) {
    if (payload.hasEmployeeNumber) {
      filter.employeeNumber = { $exists: true, $type: "string", $ne: "" };
    } else {
      const missingEmployeeNumberOr = { $or: [{ employeeNumber: { $exists: false } }, { employeeNumber: null }, { employeeNumber: "" }] };
      filter.$and = filter.$and ? [...filter.$and, missingEmployeeNumberOr] : [missingEmployeeNumberOr];
    }
  }

  if (payload.isCompleted !== null && payload.isCompleted !== undefined) {
    filter.isCompleted = payload.isCompleted;
  }

  // dateField mapping
  const dateFieldMap: Record<DateField, string> = {
    created: "createdAt",
    submitted: "submittedAt",
    approved: "approvedAt",
    terminated: "terminatedAt",
    updated: "updatedAt",
  };

  const from = parseIsoDateLoose(payload.from);
  const toParsed = parseIsoDateLoose(payload.to);
  const to = toParsed ? inclusiveEndOfDayLocal(toParsed, payload.to) : null;

  if (from || to) {
    const field = dateFieldMap[payload.dateField];
    filter[field] = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }

  return { filter, statusesResolved: statuses };
}

/* ───────── Sorting ───────── */
function buildSort(sortByRaw: string | null, sortDirRaw: "asc" | "desc" | null) {
  const allowed = new Set(["createdAt", "updatedAt", "submittedAt", "approvedAt", "terminatedAt", "firstName", "lastName", "email", "status", "employeeNumber"]);

  const sortBy = sortByRaw && allowed.has(sortByRaw) ? sortByRaw : "createdAt";
  const dir: SortOrder = sortDirRaw === "asc" ? "asc" : "desc";
  // Mongoose types accept Record<string, SortOrder>, but computed keys often need a nudge.
  return { [sortBy]: dir, _id: "asc" as SortOrder } as Record<string, SortOrder>;
}

/* ───────── Export row shaping (India-only columns) ───────── */
type ExportRow = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  aadhaar_number: string;
  pan_number: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
};

const HEADERS: Array<keyof ExportRow> = ["name", "email", "phone", "dob", "aadhaar_number", "pan_number", "bank_name", "bank_account_number", "ifsc_code"];

function headerLabel(k: keyof ExportRow) {
  switch (k) {
    case "name":
      return "Name";
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "dob":
      return "DOB";
    case "aadhaar_number":
      return "Aadhaar Number";
    case "pan_number":
      return "PAN Number";
    case "bank_name":
      return "Bank Name";
    case "bank_account_number":
      return "Bank Account Number";
    case "ifsc_code":
      return "IFSC Code";
  }
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(v: string): string {
  const needs = /[",\n]/.test(v);
  if (!needs) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

function fmtDate(d: any): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(+dt)) return "";
  return dt.toISOString().slice(0, 10);
}

function toExportRow(doc: any): ExportRow {
  const first = doc.get?.("firstName") ?? doc.firstName ?? "";
  const last = doc.get?.("lastName") ?? doc.lastName ?? "";
  const email = doc.get?.("email") ?? doc.email ?? "";

  const phone = doc.get?.("indiaFormData.personalInfo.phoneMobile") ?? "";
  const dob = fmtDate(doc.get?.("indiaFormData.personalInfo.dateOfBirth"));

  // IMPORTANT: doc.get() triggers schema getters on these encrypted fields
  const aadhaar = doc.get?.("indiaFormData.governmentIds.aadhaar.aadhaarNumber") ?? "";
  const pan = doc.get?.("indiaFormData.governmentIds.panCard.panNumber") ?? "";

  const bankName = doc.get?.("indiaFormData.bankDetails.bankName") ?? "";
  const acct = doc.get?.("indiaFormData.bankDetails.accountNumber") ?? "";
  const ifsc = doc.get?.("indiaFormData.bankDetails.ifscCode") ?? "";

  return {
    name: `${String(first).trim()} ${String(last).trim()}`.trim(),
    email: String(email),
    phone: String(phone),
    dob,
    aadhaar_number: String(aadhaar),
    pan_number: String(pan),
    bank_name: String(bankName),
    bank_account_number: String(acct),
    ifsc_code: String(ifsc),
  };
}

/* ───────── Lambda handler (direct invoke payload) ───────── */
export const handler = async (event: any) => {
  const payload: Payload = typeof event === "string" ? JSON.parse(event) : event;

  const { jobId } = payload;
  if (!jobId) throw new Error("jobId is required");

  if (payload.subsidiary !== ESubsidiary.INDIA) {
    // reflect your API rule
    throw new Error("Only INDIA subsidiary export is supported at this time");
  }

  const existing = await getStatusIfExists(jobId);
  if (existing?.state === "DONE") return { ok: true, jobId, alreadyDone: true };

  const status: JobStatus = {
    state: "RUNNING",
    progressPercent: 0,
    processed: 0,
    total: null,
    rowCount: 0,
    format: (payload.format || "xlsx") as FileFormat,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    downloadKey: null,
    downloadUrl: null,
    errorMessage: null,
  };

  await putStatus(jobId, status);

  try {
    await connectDB();

    const { filter } = buildFilter(payload);
    const sort = buildSort(payload.sortBy, payload.sortDir);

    // Optional pagination behavior: if page+pageSize are present, export only that slice
    const page = payload.page ? Math.max(1, parseInt(payload.page, 10) || 1) : null;
    const pageSize = payload.pageSize ? Math.max(1, parseInt(payload.pageSize, 10) || 20) : null;
    const skip = page && pageSize ? (page - 1) * pageSize : null;
    const limit = page && pageSize ? pageSize : null;

    // Count for progress (cheap countDocuments)
    status.total = await OnboardingModel.countDocuments(filter);
    await putStatus(jobId, status);

    const basePrefix = reportsBasePrefix();
    const safeName = payload.filename && payload.filename.trim() ? sanitizeFilename(payload.filename.trim()) : `${jobId}.${status.format}`;

    // Ensure extension matches the chosen format
    const finalName = safeName.toLowerCase().endsWith(`.${status.format}`) ? safeName : `${safeName}.${status.format}`;

    const outKey = keyJoin(basePrefix, finalName);

    const contentType = status.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";

    // Build query with filter, sort, optional skip/limit
    let q = OnboardingModel.find(filter).sort(sort).select({
      firstName: 1,
      lastName: 1,
      email: 1,

      "indiaFormData.personalInfo.phoneMobile": 1,
      "indiaFormData.personalInfo.dateOfBirth": 1,

      "indiaFormData.governmentIds.aadhaar.aadhaarNumber": 1,
      "indiaFormData.governmentIds.panCard.panNumber": 1,

      "indiaFormData.bankDetails.bankName": 1,
      "indiaFormData.bankDetails.accountNumber": 1,
      "indiaFormData.bankDetails.ifscCode": 1,
    });

    if (skip !== null && limit !== null) q = q.skip(skip).limit(limit);

    const cursor = q.cursor({ batchSize: 500 });

    if (status.format === "xlsx") {
      const { pass, donePromise } = startS3UploadStream(outKey, contentType);

      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: pass,
        useStyles: false,
        useSharedStrings: false,
      });
      const ws = wb.addWorksheet("Onboardings");

      ws.columns = HEADERS.map((k) => ({ header: headerLabel(k), key: k, width: 22 }));

      let processed = 0;
      for await (const doc of cursor as any) {
        const row = toExportRow(doc as any);
        ws.addRow(row).commit();

        processed++;
        status.processed = processed;
        status.rowCount = processed;
        status.progressPercent = status.total ? Math.min(100, Math.round((processed / status.total) * 100)) : 0;

        if (processed % 500 === 0) await putStatus(jobId, status);
      }

      await wb.commit();
      await donePromise;
    } else {
      const { pass, donePromise } = startS3UploadStream(outKey, contentType);

      pass.write(HEADERS.map((k) => csvEscape(headerLabel(k))).join(",") + "\n");

      let processed = 0;
      for await (const doc of cursor as any) {
        const row = toExportRow(doc as any);
        const line = HEADERS.map((k) => csvEscape(String(row[k] ?? ""))).join(",") + "\n";
        pass.write(line);

        processed++;
        status.processed = processed;
        status.rowCount = processed;
        status.progressPercent = status.total ? Math.min(100, Math.round((processed / status.total) * 100)) : 0;

        if (processed % 1000 === 0) await putStatus(jobId, status);
      }

      pass.end();
      await donePromise;
    }

    status.state = "DONE";
    status.progressPercent = 100;
    status.downloadKey = outKey;
    status.downloadUrl = publicUrlForKey(outKey);
    await putStatus(jobId, status);

    return { ok: true, jobId, downloadKey: outKey, downloadUrl: status.downloadUrl };
  } catch (err: any) {
    status.state = "ERROR";
    status.errorMessage = err?.message || "Unknown export error";
    await putStatus(jobId, status);
    throw err;
  }
};
