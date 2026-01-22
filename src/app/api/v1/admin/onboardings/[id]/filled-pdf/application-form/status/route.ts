import { NextRequest } from "next/server";

import connectDB from "@/lib/utils/connectDB";
import { guard } from "@/lib/utils/auth/authUtils";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";

import { APP_AWS_BUCKET_NAME, APP_AWS_REGION, APP_AWS_ACCESS_KEY_ID, APP_AWS_SECRET_ACCESS_KEY } from "@/config/env";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

import { keyJoin } from "@/lib/utils/s3Helper";
import { S3_TEMP_FOLDER } from "@/constants/aws";
import { AppError } from "@/types/api.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const s3 = new S3Client({
  region: APP_AWS_REGION,
  credentials: { accessKeyId: APP_AWS_ACCESS_KEY_ID, secretAccessKey: APP_AWS_SECRET_ACCESS_KEY },
});

function basePrefix() {
  return keyJoin(S3_TEMP_FOLDER, "onboardings", "application-form-pdf");
}
function statusKeyFor(jobId: string) {
  return keyJoin(basePrefix(), `${jobId}.json`);
}

async function readJsonFromS3(key: string) {
  const out = await s3.send(new GetObjectCommand({ Bucket: APP_AWS_BUCKET_NAME, Key: key }));
  if (!out.Body) throw new AppError(404, "Status not found");
  const bytes = await out.Body.transformToByteArray();
  return JSON.parse(new TextDecoder("utf-8").decode(bytes));
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await guard();

    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    if (!jobId) throw new AppError(400, "jobId is required");

    const status = await readJsonFromS3(statusKeyFor(jobId));
    return successResponse(200, "OK", { jobId, status });
  } catch (err: any) {
    return errorResponse(err);
  }
}
