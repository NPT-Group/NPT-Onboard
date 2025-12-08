import { AppError } from "@/types/api.types";
import { NextRequest } from "next/server";

/**
 * Parses JSON body from a NextRequest.
 * @param req NextRequest
 * @returns Parsed JSON object
 * @throws AppError if parsing fails
 */
export async function parseJsonBody<T = any>(req: NextRequest): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "Invalid JSON body");
  }
}

/**
 * Parses form-data from a NextRequest.
 * @param req NextRequest
 * @returns FormData object
 * @throws AppError if parsing fails or content-type is not multipart/form-data
 */
export async function parseFormData(req: NextRequest): Promise<FormData> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    throw new AppError(415, "Invalid content-type, expected multipart/form-data");
  }
  try {
    const formData = await req.formData();
    return formData;
  } catch {
    throw new AppError(400, "Invalid form-data body");
  }
}
