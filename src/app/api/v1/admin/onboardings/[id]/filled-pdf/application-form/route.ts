import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

import connectDB from "@/lib/utils/connectDB";
import { guard } from "@/lib/utils/auth/authUtils";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";

import { APP_AWS_BUCKET_NAME, APP_AWS_REGION, APP_AWS_ACCESS_KEY_ID, APP_AWS_SECRET_ACCESS_KEY, APPLICATION_FORM_PDF_LAMBDA_NAME } from "@/config/env";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { isValidObjectId } from "mongoose";
import { keyJoin } from "@/lib/utils/s3Helper";
import { S3_TEMP_FOLDER } from "@/constants/aws";
import { AppError } from "@/types/api.types";
import { ESubsidiary } from "@/types/shared.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const s3 = new S3Client({
  region: APP_AWS_REGION,
  credentials: { accessKeyId: APP_AWS_ACCESS_KEY_ID, secretAccessKey: APP_AWS_SECRET_ACCESS_KEY },
});

const lambda = new LambdaClient({
  region: APP_AWS_REGION,
  credentials: { accessKeyId: APP_AWS_ACCESS_KEY_ID, secretAccessKey: APP_AWS_SECRET_ACCESS_KEY },
});

type JobState = "PENDING" | "RUNNING" | "DONE" | "ERROR";
type JobStatus = {
  state: JobState;
  progressPercent: number;

  startedAt: string | null;
  updatedAt: string;

  downloadKey: string | null;
  downloadUrl: string | null;

  errorMessage?: string | null;
};

type Payload = {
  jobId: string;
  requestedAt: string;

  onboardingId: string;
  subsidiary: ESubsidiary;
  filename: string | null; // optional desired filename (without path)
};

function reportsBasePrefix() {
  return keyJoin(S3_TEMP_FOLDER, "onboardings", "application-form-pdf");
}
function statusKeyFor(jobId: string) {
  return keyJoin(reportsBasePrefix(), `${jobId}.json`);
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    await guard();

    if (!APPLICATION_FORM_PDF_LAMBDA_NAME) throw new AppError(500, "APPLICATION_FORM_PDF_LAMBDA_NAME not configured");

    const { id: onboardingId } = await params;
    if (!isValidObjectId(onboardingId)) throw new AppError(400, "Not a valid onboarding ID");

    const url = new URL(req.url);
    const subsidiaryRaw = url.searchParams.get("subsidiary");
    if (!subsidiaryRaw) throw new AppError(400, "subsidiary is required");

    if (!Object.values(ESubsidiary).includes(subsidiaryRaw as ESubsidiary)) throw new AppError(400, "Invalid subsidiary");
    const subsidiary = subsidiaryRaw as ESubsidiary;

    // India-only for this feature (matches your current filled-pdf route)
    if (subsidiary !== ESubsidiary.INDIA) {
      throw new AppError(400, "Filled application form bundle PDF is only supported for INDIA subsidiary");
    }

    // Optional filename
    const filenameRaw = url.searchParams.get("filename");
    const filename = filenameRaw ? sanitizeFilename(filenameRaw) : null;

    const jobId = `job-${uuidv4()}`;

    const initialStatus: JobStatus = {
      state: "PENDING",
      progressPercent: 0,
      startedAt: null,
      updatedAt: new Date().toISOString(),
      downloadKey: null,
      downloadUrl: null,
      errorMessage: null,
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: APP_AWS_BUCKET_NAME,
        Key: statusKeyFor(jobId),
        Body: JSON.stringify(initialStatus),
        ContentType: "application/json",
      })
    );

    const payload: Payload = {
      jobId,
      requestedAt: new Date().toISOString(),
      onboardingId,
      subsidiary,
      filename,
    };

    const invokeRes = await lambda.send(
      new InvokeCommand({
        FunctionName: APPLICATION_FORM_PDF_LAMBDA_NAME,
        InvocationType: "RequestResponse",
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      })
    );

    if (invokeRes.FunctionError) {
      const errText = invokeRes.Payload ? new TextDecoder().decode(invokeRes.Payload) : "";
      throw new AppError(500, `Lambda PDF generation failed: ${invokeRes.FunctionError}${errText ? ` — ${errText}` : ""}`);
    }

    const statusUrl = `/api/v1/admin/onboardings/${onboardingId}/filled-pdf/application-form/status?jobId=${jobId}&subsidiary=${subsidiary}`;

    return successResponse(200, "PDF bundle job started", { jobId, statusUrl });
  } catch (err: any) {
    return errorResponse(err);
  }
}
