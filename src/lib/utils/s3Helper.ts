// src/lib/utils/s3Helper.ts
// -----------------------------------------------------------------------------
// S3 utilities and higher-level helpers for:
// - Direct server-side uploads
// - Presigned PUT/GET URLs
// - Temp vs final key management
// - File asset finalization (moving from temp → final prefixes)
// - Client-side upload / deletion helpers
//
// This module is shared between server and browser environments.
// Server-only functions rely directly on the AWS SDK client.
// Browser-safe helpers only call HTTP APIs exposed by our Next.js backend.
// -----------------------------------------------------------------------------

import { APP_AWS_ACCESS_KEY_ID, APP_AWS_BUCKET_NAME, APP_AWS_REGION, APP_AWS_SECRET_ACCESS_KEY } from "@/config/env";
import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DEFAULT_PRESIGN_EXPIRY_SECONDS, S3_SUBMISSIONS_FOLDER, S3_TEMP_FOLDER } from "@/constants/aws";
import { ES3Folder, ES3Namespace, IPresignResponse } from "@/types/aws.types";
import { EFileMimeType, type IFileAsset } from "@/types/shared.types";

/* ───────────────────────── S3 client ───────────────────────── */

const s3 = new S3Client({
  region: APP_AWS_REGION,
  credentials: {
    accessKeyId: APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: APP_AWS_SECRET_ACCESS_KEY,
  },
});

/* ───────────────────────── Core ops ───────────────────────── */

/** Put a small binary directly (server-side). Prefer presigned uploads for browsers. */
export async function uploadBinaryToS3({
  fileBuffer,
  fileType,
  folder, // full prefix path without trailing slash
}: {
  fileBuffer: Buffer;
  fileType: string;
  folder: string;
}): Promise<{ url: string; key: string }> {
  const extension = (fileType.split("/")[1] || "bin").toLowerCase();
  const key = `${trimSlashes(folder)}/${uuidv4()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: APP_AWS_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: fileType,
    })
  );

  return { url: publicUrlForKey(key), key };
}

/** Batch delete using S3 DeleteObjects (handles up to 1000 keys per call). */
export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (!Array.isArray(keys) || keys.length === 0) return;

  const Bucket = APP_AWS_BUCKET_NAME;

  // S3 DeleteObjects limit is 1000 objects per request
  const CHUNK = 1000;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK).map((Key) => ({ Key }));

    try {
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: slice, Quiet: true },
        })
      );

      // Optional: log errors if any objects failed to delete
      if (res.Errors && res.Errors.length) {
        for (const err of res.Errors) {
          console.error(`Failed to delete S3 object: ${err?.Key} (${err?.Code} ${err?.Message})`);
        }
      }
    } catch (err: any) {
      console.error(`DeleteObjects batch failed (${i}-${i + slice.length - 1}):`, err?.name, err?.message, err);
      // continue with next batches; best-effort cleanup
    }
  }
}

/** Move via copy+delete (S3 has no native move). */
export async function moveS3Object({ fromKey, toKey }: { fromKey: string; toKey: string }): Promise<{ url: string; key: string }> {
  const Bucket = APP_AWS_BUCKET_NAME;

  await s3.send(
    new CopyObjectCommand({
      Bucket,
      CopySource: `${Bucket}/${fromKey}`,
      Key: toKey,
    })
  );
  await s3.send(new DeleteObjectCommand({ Bucket, Key: fromKey }));

  return { url: publicUrlForKey(toKey), key: toKey };
}

/** HEAD request to see if an object exists. */
export async function s3ObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: APP_AWS_BUCKET_NAME, Key: key }));
    return true;
  } catch (err: any) {
    if (err?.name === "NotFound") return false;
    console.error("S3 existence check failed:", err);
    return false;
  }
}

/** Server-side: create a presigned PUT URL for the exact key + Content-Type. */
export async function getPresignedPutUrl({ key, fileType, expiresIn = DEFAULT_PRESIGN_EXPIRY_SECONDS }: { key: string; fileType: string; expiresIn?: number }): Promise<{ url: string }> {
  const command = new PutObjectCommand({
    Bucket: APP_AWS_BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url };
}

/* ───────────────────────── Key helpers (generic) ───────────────────────── */

/** Strip leading/trailing slashes. */
export const trimSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");

/** Join path parts safely, trimming slashes on each segment. */
export const keyJoin = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((p) => typeof p === "string" && p.length > 0)
    .map((p) => trimSlashes(String(p)))
    .join("/");

/** Public URL for a given S3 key (no ACL change implied). */
export const publicUrlForKey = (key: string) => `https://${APP_AWS_BUCKET_NAME}.s3.${APP_AWS_REGION}.amazonaws.com/${trimSlashes(key)}`;

/** Is this a temp object? (Namespace-agnostic) */
export const isTempKey = (key?: string) => Boolean(key && trimSlashes(key).startsWith(trimSlashes(`${S3_TEMP_FOLDER}/`)));

/** Build a temp prefix with arbitrary subfolders. */
export const makeTempPrefix = (...parts: string[]) => keyJoin(S3_TEMP_FOLDER, ...parts);

/** Build a submissions (final) prefix with arbitrary subfolders. */
export const makeFinalPrefix = (...parts: string[]) => keyJoin(S3_SUBMISSIONS_FOLDER, ...parts);

/** Convenience: make a final prefix for any entity (namespace/id/folder). */
export const makeEntityFinalPrefix = (namespace: ES3Namespace | string, id: string, folder: ES3Folder | string) => makeFinalPrefix(namespace, id, folder);

/* ───────────────── File-asset finalization (generic) ───────────────── */

/** True if asset is already final (or empty). */
export const isFinalOrEmptyAsset = (asset?: IFileAsset) => !asset?.s3Key || !isTempKey(asset.s3Key);

/**
 * Move a temp asset to a final folder prefix and return the updated asset.
 * `finalFolder` should be a full prefix, e.g. makeFinalPrefix(namespace, id, folder)
 */
export async function finalizeAsset(asset: IFileAsset, finalFolder: string): Promise<IFileAsset> {
  if (!asset?.s3Key) throw new Error("Missing s3Key in file asset");
  if (!asset.mimeType) throw new Error("Missing mimeType in file asset");

  if (!isTempKey(asset.s3Key)) return asset; // already finalized

  const filename = asset.s3Key.split("/").pop();
  const finalKey = keyJoin(finalFolder, filename!);

  const moved = await moveS3Object({ fromKey: asset.s3Key, toKey: finalKey });
  return { ...asset, s3Key: moved.key, url: moved.url };
}

/** Safe wrapper that tolerates undefined asset. */
export async function finalizeAssetSafe(asset: IFileAsset | undefined, finalFolder: string): Promise<IFileAsset | undefined> {
  if (!asset) return asset;
  return finalizeAsset(asset, finalFolder);
}

/** Finalize a vector of assets (only those that are temp). */
export async function finalizeAssetVector(vec: IFileAsset[] | undefined, dest: string): Promise<IFileAsset[] | undefined> {
  if (!Array.isArray(vec)) return vec;
  const out: IFileAsset[] = [];
  for (const a of vec) out.push(isTempKey(a?.s3Key) ? await finalizeAsset(a, dest) : a);
  return out;
}

/**
 * Cache-aware single-asset finalizer (generic).
 * - If asset is already final (or undefined) => returns it as-is.
 * - If `asset.s3Key` is TEMP, moves it under `finalFolder`, memoizes by temp key,
 *   and invokes `onMoved(finalKey)` so callers can track final keys for cleanup.
 */
export async function finalizeAssetWithCache(
  asset: IFileAsset | undefined,
  finalFolder: string,
  cache: Map<string, IFileAsset>,
  onMoved?: (finalKey: string) => void
): Promise<IFileAsset | undefined> {
  if (!asset?.s3Key) return asset; // empty or missing key
  if (!isTempKey(asset.s3Key)) return asset; // already finalized

  const cached = cache.get(asset.s3Key);
  if (cached) return cached;

  const moved = await finalizeAsset(asset, finalFolder);
  cache.set(asset.s3Key, moved);
  onMoved?.(moved.s3Key);
  return moved;
}

/**
 * Cache-aware vector finalizer (generic).
 * - Always returns an array (never `undefined`) to simplify calling code.
 * - Uses the same temp->final cache and `onMoved` hook as the single-asset helper.
 */
export async function finalizeVectorWithCache(vec: IFileAsset[] | undefined, dest: string, cache: Map<string, IFileAsset>, onMoved?: (finalKey: string) => void): Promise<IFileAsset[]> {
  if (!Array.isArray(vec)) return [];
  const out: IFileAsset[] = [];
  for (const a of vec) {
    const finalized = await finalizeAssetWithCache(a, dest, cache, onMoved);
    out.push(finalized ?? a);
  }
  return out;
}

/**
 * Deep-scan an arbitrary object graph and collect any `s3Key` string fields.
 *
 * - Handles arrays + objects
 * - Dedupes keys
 * - Guards against cycles via `seen`
 *
 * Use cases:
 * - Deleting all S3 objects referenced by a document (terminated onboarding deletion)
 * - Auditing or reporting referenced assets
 */
export function collectS3KeysDeep(input: unknown): string[] {
  const out = new Set<string>();
  const seen = new Set<object>();

  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;

    // Cycle guard
    if (seen.has(v as object)) return;
    seen.add(v as object);

    // Arrays
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }

    // Objects
    const obj = v as Record<string, unknown>;

    // Common file asset shape: { s3Key, url, mimeType, ... }
    const maybeKey = obj["s3Key"];
    if (typeof maybeKey === "string") {
      const k = maybeKey.trim();
      if (k) out.add(k);
    }

    for (const key of Object.keys(obj)) {
      walk(obj[key]);
    }
  };

  walk(input);
  return Array.from(out);
}

/**
 * Diff two arbitrary objects and return S3 keys present in `before` but missing in `after`.
 * - Uses `collectS3KeysDeep` to find all keys in both objects.
 * - Excludes temp keys via `isTempKey`.
 */
export function diffS3KeysToDelete(before: unknown, after: unknown): string[] {
  const beforeKeys = new Set(collectS3KeysDeep(before));
  const afterKeys = new Set(collectS3KeysDeep(after));

  const out: string[] = [];
  for (const k of beforeKeys) {
    if (!afterKeys.has(k) && !isTempKey(k)) out.push(k);
  }
  return out;
}

/* ───────────── Client-side presigned upload convenience ───────────── */

/**
 * These helpers are safe to import in the browser.
 * They call your /api/v1/presign/upload endpoint, PUT the file to S3, and return metadata.
 */

export interface UploadToS3Options {
  file: File;
  namespace: ES3Namespace; // required
  folder: ES3Folder; // logical folder fragment
  docId?: string; // e.g., movementId
  allowedMimeTypes?: readonly EFileMimeType[]; // strong-typed allowed list
  maxSizeMB?: number;
}

export interface UploadResult {
  s3Key: string;
  url: string;
  putUrl: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

/**
 *
 * Upload a file to S3 via presigned URL obtained from your API.
 */
export async function uploadToS3Presigned({
  file,
  namespace,
  folder,
  docId = "unknown",
  allowedMimeTypes = [EFileMimeType.JPEG, EFileMimeType.JPG, EFileMimeType.PNG, EFileMimeType.PDF, EFileMimeType.DOC, EFileMimeType.DOCX],
  maxSizeMB = 10,
}: UploadToS3Options): Promise<UploadResult> {
  if (!namespace) throw new Error("Missing namespace");
  if (!folder) throw new Error("Missing folder");

  const clientMime = file.type.toLowerCase() as EFileMimeType;

  if (!allowedMimeTypes.includes(clientMime)) {
    throw new Error(`Invalid file type. Allowed: ${allowedMimeTypes.join(", ")}`);
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`File size exceeds ${maxSizeMB}MB.`);
  }

  const res = await fetch("/api/v1/presign/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      namespace,
      folder,
      mimeType: clientMime,
      docId,
      filesize: file.size,
      filename: file.name,
    }),
  });

  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: "" }));
    throw new Error(message || "Failed to get presigned URL.");
  }

  const { data }: { data: IPresignResponse } = await res.json();

  // PUT must use the same Content-Type as signed
  await fetch(data.url, {
    method: "PUT",
    headers: { "Content-Type": data.mimeType },
    body: file,
  });

  return {
    s3Key: data.key,
    url: data.publicUrl,
    putUrl: data.url,
    mimeType: data.mimeType,
    sizeBytes: file.size,
    originalName: file.name,
  };
}

/* ───────────────────────── Bytes helpers ───────────────────────── */

async function fetchBytesFromUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch object: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function getS3ObjectBytes(key: string): Promise<Uint8Array> {
  const out = await s3.send(new GetObjectCommand({ Bucket: APP_AWS_BUCKET_NAME, Key: key }));
  const body: any = out.Body;

  if (body?.transformToByteArray) return await body.transformToByteArray();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    body.on("data", (d: Buffer) => chunks.push(d));
    body.on("end", () => resolve());
    body.on("error", reject);
  });
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * Load image bytes from an asset (for PDF embedding, etc.).
 * Keep this for image workflows only. If you need generic bytes, add another helper.
 */
export async function loadImageBytesFromAsset(asset?: IFileAsset): Promise<Uint8Array> {
  if (!asset) throw new Error("Asset is undefined");
  if (asset.s3Key) return getS3ObjectBytes(asset.s3Key);
  if (asset.url) return fetchBytesFromUrl(asset.url);
  throw new Error("Asset is missing both s3Key and url");
}

/* ───────────────────────── Temp cleanup ───────────────────────── */

/**
 * Delete temp S3 files via your API.
 * - Filters non-temp keys with `isTempKey`.
 * - No-ops if none remain.
 */
export async function deleteTempFiles(keys: string[]): Promise<{ deleted?: string[]; failed?: string[] }> {
  if (!Array.isArray(keys) || keys.length === 0) return { deleted: [] };
  const tempKeys = keys.filter((k) => isTempKey(k));
  if (tempKeys.length === 0) return { deleted: [] };

  const res = await fetch("/api/v1/delete-temp-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: tempKeys }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to delete temp files");
  }

  const data = await res.json().catch(() => ({}));
  return data;
}

/** Convenience: delete a single temp file if applicable. Returns true if deleted. */
export async function deleteTempFile(file?: IFileAsset): Promise<boolean> {
  if (!file?.s3Key || !isTempKey(file.s3Key)) return false;
  await deleteTempFiles([file.s3Key]);
  return true;
}

function sanitizeDownloadName(name: string): string {
  // remove quotes and path/invalid chars
  return name.replace(/["<>:\\|?*\n\r\t]+/g, "").trim();
}

function getExtFromKey(key: string): string | undefined {
  const base = key.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot > 0 && dot < base.length - 1) return base.slice(dot + 1);
  return undefined;
}

function ensureExtension(filename: string, key: string): string {
  // if caller didn't pass an extension, append from the key (if available)
  if (/\.[A-Za-z0-9]+$/.test(filename)) return filename;
  const ext = getExtFromKey(key);
  return ext ? `${filename}.${ext}` : filename; // fall back to no ext if we truly can't infer
}

/**
 * Generate a presigned GET URL that downloads with a stable filename (with extension)
 * and the object's original Content-Type when available.
 */
export async function getPresignedGetUrl({
  key,
  filename,
  disposition = "attachment",
  expiresIn = DEFAULT_PRESIGN_EXPIRY_SECONDS,
}: {
  key: string;
  filename?: string; // we’ll append extension if missing
  disposition?: "inline" | "attachment";
  expiresIn?: number;
}): Promise<{ url: string }> {
  // 1) Look up stored metadata to preserve real content-type
  let storedContentType: string | undefined;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: APP_AWS_BUCKET_NAME, Key: key }));
    storedContentType = head.ContentType || undefined;
  } catch {
    // If Head fails, we’ll still issue a URL, but use a safe default content-type below
  }

  // 2) Build a safe, extension-inclusive filename
  const baseName = sanitizeDownloadName(filename || key.split("/").pop() || "download");
  const finalName = ensureExtension(baseName, key);
  const encoded = encodeURIComponent(finalName);

  // 3) Build Content-Disposition
  const contentDisposition = `${disposition}; filename="${finalName}"; filename*=UTF-8''${encoded}`;

  // 4) Prefer stored content-type; otherwise, fall back to octet-stream
  const responseContentType = storedContentType || "application/octet-stream";

  const command = new GetObjectCommand({
    Bucket: APP_AWS_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: contentDisposition,
    ResponseContentType: responseContentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url };
}

/**
 * Frontend helper to fetch a presigned GET URL that ALWAYS downloads.
 *
 * Example:
 *   const url = await getDownloadUrlFromS3Key({
 *     s3Key: "submissions/licenses/123/abc.jpeg",
 *     filename: "driver-license" // extension will be inferred from s3Key if missing
 *   });
 *   // `url` is a time-limited (presigned) HTTPS link. You can trigger download with:
 *   // const a = document.createElement("a"); a.href = url; a.click();
 *
 * Returns:
 *   A string — the presigned GET URL (e.g., "https://bucket.s3...&X-Amz-Signature=...").
 *   The server sets Content-Disposition to "attachment" with a safe filename (and extension),
 *   and preserves the original Content-Type when available.
 */
export async function getDownloadUrlFromS3Key({
  s3Key,
  filename,
  expiresIn,
}: {
  s3Key: string;
  filename?: string; // optional; if no extension, server appends from the key
  expiresIn?: number;
}): Promise<string> {
  const res = await fetch("/api/v1/presign/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: s3Key, filename, expiresIn }),
  });

  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: "" }));
    throw new Error(message || "Failed to get presigned download URL.");
  }

  const { data } = await res.json();
  return data.url as string;
}
