// src/app/api/v1/admin/onboardings/generate-report/route.ts
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

import connectDB from "@/lib/utils/connectDB";
import { guard } from "@/lib/utils/auth/authUtils";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";

import { APP_AWS_BUCKET_NAME, APP_AWS_REGION, APP_AWS_ACCESS_KEY_ID, APP_AWS_SECRET_ACCESS_KEY, ONBOARDINGS_REPORTS_LAMBDA_NAME } from "@/config/env";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { parseJsonBody } from "@/lib/utils/reqParser";
import { parseBool, parseEnumParam, parseIsoDate } from "@/lib/utils/queryUtils";
import { ESubsidiary } from "@/types/shared.types";
import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { keyJoin } from "@/lib/utils/s3Helper";
import { S3_TEMP_FOLDER } from "@/constants/aws";
import { AppError } from "@/types/api.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ---------------- AWS clients ---------------- */
const s3 = new S3Client({
  region: APP_AWS_REGION,
  credentials: { accessKeyId: APP_AWS_ACCESS_KEY_ID, secretAccessKey: APP_AWS_SECRET_ACCESS_KEY },
});

const lambda = new LambdaClient({
  region: APP_AWS_REGION,
  credentials: { accessKeyId: APP_AWS_ACCESS_KEY_ID, secretAccessKey: APP_AWS_SECRET_ACCESS_KEY },
});

/* ---------------- Types ---------------- */
type FileFormat = "csv" | "xlsx";
type DateField = "created" | "submitted" | "approved" | "terminated" | "updated";

type Payload = {
  jobId: string;
  requestedAt: string;
  subsidiary: ESubsidiary;

  // list-route compatible filters
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

  // export controls
  format: FileFormat;
  filename: string | null;

  // optional pagination (if present, export just that slice; otherwise export all)
  page: string | null;
  pageSize: string | null;
};

type JobState = "PENDING" | "RUNNING" | "DONE" | "ERROR";
type JobStatus = {
  state: JobState;
  progressPercent: number;
  processed: number;
  total: number | null;
  rowCount: number | null;

  format: FileFormat;
  startedAt: string | null;
  updatedAt: string;

  downloadKey: string | null;
  downloadUrl: string | null;

  errorMessage?: string | null;
};

function formatShortDate(d: Date) {
  // e.g. "Dec 23, 2025" in Toronto time
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function parseYmdToDate(ymd: string): Date | null {
  // Interpret YYYY-MM-DD as a date (no time). Good enough for display.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, da));
  return Number.isNaN(dt.valueOf()) ? null : dt;
}

function sanitizeFilename(name: string) {
  // remove characters that are annoying/illegal across OSes and S3 downloads
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function subsidiaryDisplayName(sub: ESubsidiary) {
  switch (sub) {
    case ESubsidiary.INDIA:
      return "India";
    case ESubsidiary.CANADA:
      return "Canada";
    case ESubsidiary.USA:
      return "US";
    default:
      return String(sub);
  }
}

function humanStatusLabelFromGroup(group: string | null): string | null {
  if (!group) return null;
  // Keep these short + HR-friendly
  const map: Record<string, string> = {
    pending: "Pending",
    modificationRequested: "Mod Requested",
    pendingReview: "Pending Review",
    approved: "Approved",
    manual: "Manual",
    terminated: "Terminated",
  };
  return map[group] ?? null;
}

function humanStatusLabelFromStatuses(statuses: EOnboardingStatus[] | null): string | null {
  if (!statuses?.length) return null;
  if (statuses.length === 1) {
    // Keep short labels. Adjust if your enum values are already pretty.
    const s = statuses[0];
    const map: Partial<Record<EOnboardingStatus, string>> = {
      [EOnboardingStatus.InviteGenerated]: "Pending",
      [EOnboardingStatus.ModificationRequested]: "Mod Requested",
      [EOnboardingStatus.Submitted]: "Submitted",
      [EOnboardingStatus.Resubmitted]: "Resubmitted",
      [EOnboardingStatus.Approved]: "Approved",
      [EOnboardingStatus.ManualPDFSent]: "Manual",
      [EOnboardingStatus.Terminated]: "Terminated",
    };
    return map[s] ?? String(s);
  }

  // Multiple statuses chosen: keep minimal (don’t dump a long list)
  return "Selected Statuses";
}

function buildDefaultExportFilename(args: {
  subsidiary: ESubsidiary;
  fromRaw: string | null;
  toRaw: string | null;
  format: "csv" | "xlsx";

  // NEW: filter awareness
  q: string | null;
  method: EOnboardingMethod | null;
  statuses: EOnboardingStatus[] | null;
  statusGroup: string | null;
  hasEmployeeNumber: boolean | null;
  isCompleted: boolean | null;
}) {
  const subsidiaryName = subsidiaryDisplayName(args.subsidiary);

  const from = args.fromRaw ? parseYmdToDate(args.fromRaw) : null;
  const to = args.toRaw ? parseYmdToDate(args.toRaw) : null;

  const statusLabel = humanStatusLabelFromGroup(args.statusGroup) ?? humanStatusLabelFromStatuses(args.statuses);

  const hasAnyFilter =
    !!(args.q && args.q.trim()) ||
    !!args.method ||
    !!(args.statusGroup && args.statusGroup.trim()) ||
    !!(args.statuses && args.statuses.length) ||
    args.hasEmployeeNumber !== null ||
    args.isCompleted !== null ||
    !!from ||
    !!to;

  const rangeLabel = from && to ? `${formatShortDate(from)} to ${formatShortDate(to)}` : from ? `From ${formatShortDate(from)}` : to ? `Up to ${formatShortDate(to)}` : null;

  // Keep it minimal:
  // - If status label exists: "Approved Onboardings"
  // - Else: "Onboarding Report"
  const reportTitle = statusLabel ? `${statusLabel} Onboardings` : "Onboarding Report";

  // Suffix:
  // - If we have a date range, include it
  // - Else if filtered, say "Filtered"
  // - Else "All Records"
  const suffix = rangeLabel ? rangeLabel : hasAnyFilter ? "Filtered" : "All Records";

  return sanitizeFilename(`NPT ${subsidiaryName} – ${reportTitle} – ${suffix}.${args.format}`);
}

/**
 * Parse statuses from "status=Submitted,Approved" exactly like list route.
 */
function parseStatuses(statusRaw: string | null): EOnboardingStatus[] | null {
  if (!statusRaw) return null;
  const parts = statusRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowed = Object.values(EOnboardingStatus) as readonly EOnboardingStatus[];
  return parts.map((p) => parseEnumParam(p, allowed, "status") as EOnboardingStatus);
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    await guard();

    const url = new URL(req.url);
    const qsp = Object.fromEntries(url.searchParams.entries());
    const body = await parseJsonBody<any>(req).catch(() => ({} as any));
    const get = (k: string) => (qsp[k] ?? body?.[k] ?? null) as string | null;

    // Required: subsidiary
    const subsidiary = parseEnumParam(get("subsidiary"), Object.values(ESubsidiary) as readonly ESubsidiary[], "subsidiary");
    if (!subsidiary) throw new AppError(400, "subsidiary query param is required");

    // India-only (for now)
    if (subsidiary !== ESubsidiary.INDIA) throw new AppError(400, "Only INDIA subsidiary export is supported at this time");

    const jobId = `job-${uuidv4()}`;

    // Date parsing (same semantics as list route)
    const fromRaw = get("from");
    const toRaw = get("to");
    const fromDate = parseIsoDate(fromRaw);
    if (fromRaw && !fromDate) throw new AppError(400, "Invalid 'from' date. Expected ISO like 2025-12-12 or full ISO datetime.");
    const toParsed = parseIsoDate(toRaw);
    if (toRaw && !toParsed) throw new AppError(400, "Invalid 'to' date. Expected ISO like 2025-12-17 or full ISO datetime.");

    // dateField
    const allowedDateFields = ["created", "submitted", "approved", "terminated", "updated"] as const;
    const dateField = (parseEnumParam(get("dateField"), allowedDateFields, "dateField") ?? "created") as DateField;

    // method
    const method = parseEnumParam(get("method"), Object.values(EOnboardingMethod) as readonly EOnboardingMethod[], "method");

    // statuses (or statusGroup passthrough)
    const statuses = parseStatuses(get("status"));
    const statusGroup = get("statusGroup");

    // booleans
    const hasEmployeeNumber = parseBool(get("hasEmployeeNumber"));
    const isCompleted = parseBool(get("isCompleted"));

    // format
    const formatRaw = (get("format") || "csv").toLowerCase();
    const format: FileFormat = formatRaw === "xlsx" ? "xlsx" : "csv";

    const payload: Payload = {
      jobId,
      requestedAt: new Date().toISOString(),
      subsidiary,

      q: (get("q") || "").trim() || null,
      method: method ?? null,
      statuses: statuses?.length ? statuses : null,
      statusGroup: statusGroup || null,

      hasEmployeeNumber,
      isCompleted,

      dateField,
      from: fromRaw || null,
      to: toRaw || null,

      sortBy: get("sortBy"),
      sortDir: (get("sortDir") as any) === "asc" ? "asc" : "desc",

      format,
      // filename: client-provided wins; otherwise a human-friendly default
      filename: (() => {
        const provided = (get("filename") || "").trim();
        if (provided) {
          // If client forgets extension, add it
          const withExt = /\.[a-z0-9]+$/i.test(provided) ? provided : `${provided}.${format}`;
          return sanitizeFilename(withExt);
        }
        return buildDefaultExportFilename({
          subsidiary,
          fromRaw,
          toRaw,
          format,

          q: (get("q") || "").trim() || null,
          method: method ?? null,
          statuses: statuses?.length ? statuses : null,
          statusGroup: statusGroup || null,
          hasEmployeeNumber,
          isCompleted,
        });
      })(),

      page: get("page"),
      pageSize: get("pageSize"),
    };

    // Seed status JSON in S3
    const basePrefix = keyJoin(S3_TEMP_FOLDER, "onboardings", "reports");
    const statusKey = keyJoin(basePrefix, `${jobId}.json`);

    const initialStatus: JobStatus = {
      state: "PENDING",
      progressPercent: 0,
      processed: 0,
      total: null,
      rowCount: null,
      format,
      startedAt: null,
      updatedAt: new Date().toISOString(),
      downloadKey: null,
      downloadUrl: null,
      errorMessage: null,
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: APP_AWS_BUCKET_NAME,
        Key: statusKey,
        Body: JSON.stringify(initialStatus),
        ContentType: "application/json",
      })
    );

    if (!ONBOARDINGS_REPORTS_LAMBDA_NAME) throw new AppError(500, "ONBOARDINGS_REPORTS_LAMBDA_NAME not configured");

    // Invoke Lambda synchronously (per your requirement)
    const invokeRes = await lambda.send(
      new InvokeCommand({
        FunctionName: ONBOARDINGS_REPORTS_LAMBDA_NAME,
        InvocationType: "RequestResponse",
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      })
    );

    if (invokeRes.FunctionError) {
      const errText = invokeRes.Payload ? new TextDecoder().decode(invokeRes.Payload) : "";
      throw new AppError(500, `Lambda export failed: ${invokeRes.FunctionError}${errText ? ` — ${errText}` : ""}`);
    }

    // The worker writes DONE status + downloadUrl; return the statusUrl either way.
    const statusUrl = `/api/v1/admin/onboardings/generate-report/status?jobId=${jobId}`;

    return successResponse(200, "Export generated", {
      jobId,
      statusUrl,
      // convenience: clients can also compute the download URL if needed
      // (but primary source of truth is the status json)
      // downloadUrl: publicUrlForKey(keyJoin(basePrefix, `${jobId}.${format}`)),
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
