// src/app/api/v1/presign/upload/route.ts
/**
 * Presign Upload API
 *
 * Purpose:
 *   Returns a short-lived presigned S3 PUT URL for onboarding uploads.
 *
 * Rules:
 *   - Namespace: only ES3Namespace.ONBOARDINGS is supported.
 *   - All uploads are PDFs by default.
 *   - Signature uploads (ES3Folder.DECLARATION_SIGNATURE) must be images only.
 *   - Simple global size limit enforced in MB.
 *
 * Key shape (stored under a temp prefix):
 *   - With docId:
 *       temp-files/onboardings/{docId}/{folder}/{timestamp-uuid}.{ext}
 *   - Without docId:
 *       temp-files/onboardings/{folder}/{timestamp-uuid}.{ext}
 *
 * Notes:
 *   - Response includes both the PUT URL and a publicUrl you can store as IFileAsset.url.
 */

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

import { ES3Namespace, ES3Folder, IPresignRequest, IPresignResponse } from "@/types/aws.types";
import { EFileMimeType } from "@/types/shared.types";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { getPresignedPutUrl } from "@/lib/utils/s3Helper";
import { APP_AWS_BUCKET_NAME, APP_AWS_REGION } from "@/config/env";

/* ───────────────── Simple config ───────────────── */

const MAX_FILE_SIZE_MB = 20;
const TEMP_PREFIX = "temp-files";

/**
 * All uploads are PDFs except signature, which must be an image (jpeg/jpg/png).
 */
const IMAGE_ONLY: readonly EFileMimeType[] = [EFileMimeType.JPEG, EFileMimeType.JPG, EFileMimeType.PNG];

const PDF_ONLY: readonly EFileMimeType[] = [EFileMimeType.PDF];

const SIGNATURE_FOLDERS = new Set<ES3Folder>([ES3Folder.DECLARATION_SIGNATURE]);

/* Mime → extension map */
const MIME_TO_EXT_MAP: Record<EFileMimeType, string> = {
  [EFileMimeType.JPEG]: "jpeg",
  [EFileMimeType.JPG]: "jpg",
  [EFileMimeType.PNG]: "png",
  [EFileMimeType.PDF]: "pdf",
  [EFileMimeType.DOC]: "doc", // not used currently, kept for completeness
  [EFileMimeType.DOCX]: "docx", // not used currently, kept for completeness
};

/* ───────────────────────── Handler ───────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<IPresignRequest>(req);
    const { namespace, folder, mimeType, filesize } = body || {};
    const docId = body?.docId?.trim();

    // Core presence checks
    if (!namespace || !folder || !mimeType) {
      return errorResponse(400, "Missing required fields: namespace, folder or mimeType");
    }

    // Only ONBOARDINGS namespace is supported for now
    if (namespace !== ES3Namespace.ONBOARDINGS) {
      return errorResponse(400, `Namespace not configured: ${namespace}`);
    }

    // Runtime enum checks
    const F_SET = new Set(Object.values(ES3Folder));
    if (!F_SET.has(folder)) {
      return errorResponse(400, `Invalid folder. Must be one of: ${[...F_SET].join(", ")}`);
    }

    // Decide allowed mime types based on folder:
    // - signature folder: images only
    // - all other folders: PDF only
    const normalizedMime = (mimeType as string).toLowerCase() as EFileMimeType;
    const allowedMime: readonly EFileMimeType[] = SIGNATURE_FOLDERS.has(folder) ? IMAGE_ONLY : PDF_ONLY;

    if (!allowedMime.includes(normalizedMime)) {
      const typesList = allowedMime.join(", ");
      return errorResponse(400, `Invalid file type for folder "${folder}". Allowed: ${typesList}`);
    }

    const extFromMime = MIME_TO_EXT_MAP[normalizedMime];
    if (!extFromMime) {
      return errorResponse(400, `Unsupported mimeType: ${mimeType}`);
    }

    // Simple global size check
    if (filesize && filesize > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return errorResponse(400, `File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }

    // Temp key shape:
    // - with id:    temp-files/onboardings/{docId}/{folder}/{ts-uuid}.{ext}
    // - without id: temp-files/onboardings/{folder}/{ts-uuid}.{ext}
    const nsPrefix = `${TEMP_PREFIX}/${namespace}`;
    const folderPrefix = docId ? `${nsPrefix}/${docId}/${folder}` : `${nsPrefix}/${folder}`;
    const finalFilename = `${Date.now()}-${randomUUID()}.${extFromMime}`;
    const fullKey = `${folderPrefix}/${finalFilename}`;

    const { url } = await getPresignedPutUrl({
      key: fullKey,
      fileType: normalizedMime,
    });
    const publicUrl = `https://${APP_AWS_BUCKET_NAME}.s3.${APP_AWS_REGION}.amazonaws.com/${fullKey}`;

    const result: IPresignResponse = {
      key: fullKey,
      url,
      publicUrl,
      expiresIn: 900, // 15 minutes; adjust if needed
      mimeType: normalizedMime,
    };

    return successResponse(200, "Presigned URL generated", result);
  } catch (err) {
    return errorResponse(err);
  }
}
