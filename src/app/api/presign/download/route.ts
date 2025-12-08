// src/app/api/presign/download/route.ts
import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { getPresignedGetUrl, s3ObjectExists } from "@/lib/utils/s3Helper";

type Body = {
  key?: string;
  filename?: string; // can be "some file" (no ext) — server will append from key
  expiresIn?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<Body>(req);
    const { key, filename, expiresIn } = body || {};

    if (!key || typeof key !== "string" || !key.trim()) {
      return errorResponse(400, "Missing or invalid 'key'");
    }

    const exists = await s3ObjectExists(key);
    if (!exists) return errorResponse(404, "S3 object not found");

    const { url } = await getPresignedGetUrl({ key, filename, expiresIn });
    return successResponse(200, "Presigned GET URL generated", { url, expiresIn: expiresIn ?? undefined });
  } catch (err) {
    return errorResponse(err);
  }
}
