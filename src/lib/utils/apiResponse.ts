// src/lib/utils/apiResponse.ts
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import formatMongooseValidationError from "./formatMongooseValidationError";
import { AppError, EEApiErrorType } from "@/types/api.types";

export function successResponse(status: number = 200, message: string = "Request successful", data = {}) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * Map an HTTP status to a default EEApiErrorType.
 * Only used when the caller/exception did not specify a code explicitly.
 */
function mapStatusToCode(status: number): EEApiErrorType {
  if (status === 400) return EEApiErrorType.VALIDATION_ERROR;
  if (status === 401) return EEApiErrorType.UNAUTHORIZED;
  if (status === 403) return EEApiErrorType.FORBIDDEN;
  if (status === 404) return EEApiErrorType.NOT_FOUND;
  if (status === 409) return EEApiErrorType.CONFLICT;
  if (status === 429) return EEApiErrorType.RATE_LIMITED;
  // Treat anything else (>=500 or uncommon 4xx) as INTERNAL by default
  return EEApiErrorType.INTERNAL;
}

export function errorResponse(statusOrError: unknown, msgOrError?: unknown, extraErrors: Record<string, unknown> = {}) {
  let status = 500;
  let message = "An error occurred";
  let code: EEApiErrorType | undefined;
  let meta: Record<string, unknown> | undefined;

  // ------------------------------
  // Derive status/message/code/meta
  // ------------------------------
  if (typeof statusOrError !== "number") {
    const err = statusOrError;

    if (err instanceof AppError) {
      status = err.status;
      message = err.message;
      // Honor explicit code if provided; otherwise infer from status
      code = err.code ?? mapStatusToCode(status);
      meta = err.meta;
    } else if (err instanceof mongoose.Error.ValidationError) {
      status = 400;
      message = formatMongooseValidationError(err);
      code = EEApiErrorType.VALIDATION_ERROR; // explicit for ValidationError
    } else if (err instanceof Error) {
      message = err.message;
      // No explicit code -> infer from default 500
      code = mapStatusToCode(status);
    } else if (typeof err === "string") {
      message = err;
      code = mapStatusToCode(status);
    }
  } else {
    status = statusOrError;
    if (typeof msgOrError === "string") {
      message = msgOrError;
    } else if (msgOrError instanceof Error) {
      message = (msgOrError as Error).message;
    }
    // No explicit code path here; infer from provided status
    code = mapStatusToCode(status);
  }

  const payload: any = {
    success: false,
    message,
    code, // always include a code (either explicit or inferred)
  };

  if (meta && Object.keys(meta).length > 0) payload.meta = meta;
  if (extraErrors && Object.keys(extraErrors).length > 0) payload.errors = extraErrors;

  const res = NextResponse.json(payload, { status });

  // If the thrown AppError included a cookie to clear or any Set-Cookie headers, append them.
  // We avoid importing other utils here to prevent circular deps; instead callers provide headers via meta.
  if (meta && typeof meta === "object") {
    const clearCookieHeader = (meta as any).clearCookieHeader as string | undefined;
    const setCookies = (meta as any).setCookies as string[] | undefined;

    if (clearCookieHeader) {
      res.headers.append("set-cookie", clearCookieHeader);
    }
    if (Array.isArray(setCookies)) {
      for (const c of setCookies) res.headers.append("set-cookie", c);
    }
  }

  return res;
}
