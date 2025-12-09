// src/app/api/v1/delete-temp-files/route.ts

/**
 * Delete Temp Files API
 *
 * Purpose:
 *   Bulk-delete one or more temporary files from S3.
 *   This endpoint is *strictly* limited to objects under the S3 temp folder.
 *
 * Request:
 *   - Method: POST
 *   - Body JSON:
 *       {
 *         "keys": string[]  // each must start with `${S3_TEMP_FOLDER}/`
 *       }
 *
 * Validation & Rules:
 *   - `keys` must be a non-empty array of strings.
 *   - Every key must be scoped to the temp folder (`S3_TEMP_FOLDER`).
 *   - Any attempt to delete objects outside the temp folder is rejected (403).
 *
 * Responses:
 *   - 200: Temp file(s) deleted successfully.
 *   - 400: Missing or invalid `keys` payload.
 *   - 403: One or more keys are outside the temp folder namespace.
 *   - 5xx: Unexpected errors, normalized via `errorResponse`.
 */

import { deleteS3Objects } from "@/lib/utils/s3Helper";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { NextRequest } from "next/server";
import { S3_TEMP_FOLDER } from "@/constants/aws";

export async function POST(req: NextRequest) {
  try {
    const { keys } = await req.json();

    if (!Array.isArray(keys) || keys.length === 0 || !keys.every((key) => typeof key === "string")) {
      return errorResponse(400, "Invalid or missing 'keys'. Expected: string[]");
    }

    const invalidKeys = keys.filter((key) => !key.startsWith(`${S3_TEMP_FOLDER}/`));
    if (invalidKeys.length > 0) {
      return errorResponse(403, `Deletion only allowed for 'temp-files'. Invalid keys: ${invalidKeys.join(", ")}`);
    }

    await deleteS3Objects(keys);

    return successResponse(200, "Temp file(s) deleted");
  } catch (err) {
    console.error("Delete failed:", err);
    return errorResponse(err);
  }
}
