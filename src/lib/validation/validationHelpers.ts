// src/lib/validation/validationHelpers.ts

import { AppError } from "@/types/api.types";

/** Throw AppError(STATUS, message) when condition fails. */
export function vAssert(cond: any, message: string, status = 400): asserts cond {
  if (!cond) throw new AppError(status, message);
}

export function isObj(v: any): v is Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function vString(v: any, label: string) {
  vAssert(typeof v === "string" && v.trim().length > 0, `${label} is required`);
}

export function vBoolean(v: any, label: string) {
  vAssert(typeof v === "boolean", `${label} must be boolean`);
}

export function vNumber(v: any, label: string) {
  vAssert(typeof v === "number" && Number.isFinite(v), `${label} must be a number`);
}

export function vOneOf<T extends string>(v: any, label: string, allowed: readonly T[]) {
  vAssert(typeof v === "string" && allowed.includes(v as T), `${label} must be one of: ${allowed.join(", ")}`);
}

/** Minimal “file-ish” check used across modules (S3 assets). */
export function vFileish(f: any, label: string) {
  vAssert(isObj(f), `${label} is required`);
  vString(f.s3Key, `${label}.s3Key`);
  vString(f.mimeType, `${label}.mimeType`);
}
