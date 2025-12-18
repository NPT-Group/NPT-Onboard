// src/app/api/v1/presign/download/route.ts

/**
 * POST /api/v1/presign/download
 *
 * Issues a short-lived, presigned S3 GET URL for downloading an existing object.
 *
 * Expected JSON body:
 * - key        (string, required): Full S3 object key. Must be non-empty.
 * - filename   (string, optional): Friendly download filename (no extension required).
 *                                   If omitted, the filename (with extension) is derived
 *                                   from the provided key.
 * - expiresIn  (number, optional): Expiry in seconds for the presigned URL.
 *                                   Falls back to a reasonable default if not provided.
 *
 * Behavior:
 * - Validates that `key` is present and a non-empty string.
 * - Verifies the object exists in S3 via `s3ObjectExists`.
 *   - Returns 404 if the object is missing.
 * - Generates a presigned GET URL via `getPresignedGetUrl`.
 * - Responds with:
 *   - 200 + { url, expiresIn? } on success.
 *   - 400 on missing/invalid input.
 *   - 404 when the S3 object does not exist.
 *   - 500 (wrapped by errorResponse) for unexpected errors.
 *
 * This endpoint is used by both HR and employees to securely download
 * previously uploaded documents without exposing the S3 bucket publicly.
 */

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { getPresignedGetUrl, s3ObjectExists } from "@/lib/utils/s3Helper";

type Body = {
  key?: string;
  filename?: string; // can be "some file" (no ext) — server will append from key
  disposition?: "inline" | "attachment";
  expiresIn?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<Body>(req);
    const { key, filename, expiresIn, disposition } = body || {};

    if (!key || typeof key !== "string" || !key.trim()) {
      return errorResponse(400, "Missing or invalid 'key'");
    }

    if (disposition && disposition !== "inline" && disposition !== "attachment") {
      return errorResponse(400, "Invalid 'disposition' (expected 'inline' or 'attachment')");
    }

    const exists = await s3ObjectExists(key);
    if (!exists) return errorResponse(404, "S3 object not found");

    const { url } = await getPresignedGetUrl({ key, filename, expiresIn, disposition });
    return successResponse(200, "Presigned GET URL generated", {
      url,
      expiresIn: expiresIn ?? undefined,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
