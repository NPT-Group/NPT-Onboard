// src/lib/api/client.ts
"use client";

import { EEApiErrorType } from "@/types/api.types";

export type ApiErrorPayload = {
  status: number;
  code: EEApiErrorType;
  message: string;
  meta?: Record<string, unknown>;
  errors?: Record<string, unknown>;
};

export class ApiError extends Error {
  status: number;
  code: EEApiErrorType;
  meta?: Record<string, unknown>;
  errors?: Record<string, unknown>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = payload.status;
    this.code = payload.code;
    this.meta = payload.meta;
    this.errors = payload.errors;
  }
}

type SuccessEnvelope<T> = {
  success: true;
  message: string;
  data: T;
};

type ErrorEnvelope = {
  success: false;
  message: string;
  code: EEApiErrorType;
  meta?: Record<string, unknown>;
  errors?: Record<string, unknown>;
};

type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

async function parseJsonSafe<T>(res: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

export async function request<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const json = await parseJsonSafe<T>(res);

  if (!json) {
    // Non-JSON or unexpected response
    throw new ApiError({
      status: res.status,
      code: EEApiErrorType.INTERNAL,
      message: "Unexpected server response",
    });
  }

  if (json.success) {
    return json.data;
  }

  // Backend always sets a status code consistent with errorResponse
  throw new ApiError({
    status: res.status,
    code: json.code ?? EEApiErrorType.INTERNAL,
    message: json.message || "Request failed",
    meta: json.meta,
    errors: json.errors,
  });
}

export async function postJson<TReq, TRes>(
  url: string,
  body: TReq,
  init?: Omit<RequestInit, "method" | "body">
): Promise<TRes> {
  return request<TRes>(url, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}
