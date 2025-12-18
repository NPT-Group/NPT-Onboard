// src/lib/utils/s3Upload.client.ts
"use client";

import { DEFAULT_FILE_SIZE_LIMIT_MB, S3_TEMP_FOLDER } from "@/constants/aws";
import {
  ES3Namespace,
  ES3Folder,
  type IPresignResponse,
} from "@/types/aws.types";
import { EFileMimeType, type IFileAsset } from "@/types/shared.types";

export type UploadToS3Options = {
  file: File;
  namespace: ES3Namespace;
  folder: ES3Folder;
  docId?: string;
  allowedMimeTypes?: readonly EFileMimeType[];
  maxSizeMB?: number;
};

export function isTempKey(key?: string) {
  if (!key) return false;
  return key.startsWith(`${S3_TEMP_FOLDER}/`);
}

export async function uploadToS3Presigned({
  file,
  namespace,
  folder,
  docId,
  allowedMimeTypes = [EFileMimeType.PDF],
  maxSizeMB = DEFAULT_FILE_SIZE_LIMIT_MB,
}: UploadToS3Options): Promise<IFileAsset> {
  if (!namespace) throw new Error("Missing namespace");
  if (!folder) throw new Error("Missing folder");

  const clientMime = (file.type || "").toLowerCase() as EFileMimeType;

  const isAllowed =
    allowedMimeTypes.includes(clientMime) ||
    // fallback for some browsers that send empty mime for PDFs
    (allowedMimeTypes.includes(EFileMimeType.PDF) &&
      file.name.toLowerCase().endsWith(".pdf"));

  if (!isAllowed) {
    throw new Error(
      `Invalid file type. Allowed: ${allowedMimeTypes.join(", ")}`
    );
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
      mimeType: clientMime || EFileMimeType.PDF, // fallback
      filesize: file.size,
      filename: file.name,
      docId: docId?.trim() || undefined,
    }),
  });

  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: "" }));
    throw new Error(message || "Failed to get presigned upload URL.");
  }

  const { data }: { data: IPresignResponse } = await res.json();

  // PUT to S3 with the signed Content-Type
  const putRes = await fetch(data.url, {
    method: "PUT",
    headers: { "Content-Type": data.mimeType },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("Upload failed while sending file to storage.");
  }

  return {
    s3Key: data.key,
    url: data.publicUrl,
    mimeType: data.mimeType,
    sizeBytes: file.size,
    originalName: file.name,
  };
}

export async function deleteTempFiles(keys: string[]) {
  const tempKeys = (keys || []).filter((k) => isTempKey(k));
  if (tempKeys.length === 0) return;

  const res = await fetch("/api/v1/delete-temp-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: tempKeys }),
  });

  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: "" }));
    throw new Error(message || "Failed to delete temp files.");
  }
}

export async function deleteTempFile(asset?: IFileAsset | null) {
  if (!asset?.s3Key) return;
  await deleteTempFiles([asset.s3Key]);
}

export async function getDownloadUrlFromS3Key({
  s3Key,
  filename,
  disposition,
  expiresIn,
}: {
  s3Key: string;
  filename?: string;
  disposition?: "inline" | "attachment";
  expiresIn?: number;
}): Promise<string> {
  const res = await fetch("/api/v1/presign/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: s3Key, filename, disposition, expiresIn }),
  });

  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: "" }));
    throw new Error(message || "Failed to get download URL.");
  }

  const { data } = await res.json();
  return data.url as string;
}
