// lib/utils/urlHelper.server.ts
import "server-only";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { isProd, PORT } from "@/config/env";
import { trimTrailingSlash } from "./urlHelper";

/** Resolve current request origin via proxy headers (Vercel/CDN safe). */
export async function resolveBaseUrl(): Promise<string> {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? hdrs.get("x-url-scheme") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost";
  return trimTrailingSlash(`${proto}://${host}`);
}

/** Server-to-server base:
 * - Dev: http://localhost:PORT
 * - Prod: current origin (same as resolveBaseUrl)
 */
export async function resolveInternalBaseUrl(): Promise<string> {
  if (!isProd) return `http://localhost:${PORT}`;
  return await resolveBaseUrl();
}

/** If you already have a NextRequest in a route handler. */
export function resolveBaseUrlFromRequest(req: NextRequest): string {
  return req.nextUrl.origin;
}

/** Alias for clarity when only the origin is needed. */
export async function getCurrentOrigin(): Promise<string> {
  return resolveBaseUrl();
}
