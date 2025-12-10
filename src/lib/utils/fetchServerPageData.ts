// lib/utils/fetchServerPageData.ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureLeadingSlash, isAbsoluteUrl, trimTrailingSlash } from "./urlHelper";
import { getCurrentOrigin } from "./urlHelper.server";
import { isProd } from "@/config/env";

/** Standard result shape for server page data fetches. */
export type ServerPageDataResult<T> = {
  data?: T;
  error?: string;
  status?: number;
  code?: string; // matches API's error "code" (e.g., "SESSION_REQUIRED")
  meta?: any; // optional metadata from API error
};

/** Minimal Next.js `next` config typing to avoid importing framework types. */
type NextFetchConfig = {
  revalidate?: number | false;
  tags?: string[];
};

/** RequestInit with Next.js extensions. (Uses global DOM types) */
export type ServerFetchInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  next?: NextFetchConfig;
};

/** Extra behavior flags. */
type FetchExtras = {
  /**
   * Cookie forwarding strategy:
   * - "auto" (default): prod=forward only if same-origin; dev=always forward
   * - "always": always attach cookies() to the request
   * - "never": never attach cookies()
   */
  forwardCookies?: "auto" | "always" | "never";

  /** Enable tiny debug logging during auth debugging. */
  debug?: boolean;

  /**
   * If the API responds with { code: "SESSION_REQUIRED" }, automatically redirect.
   * Default: true.
   */
  redirectOnSessionRequired?: boolean;

  /** Where to redirect when SESSION_REQUIRED is hit. Default: "/" */
  homeRedirectPath?: string;
};

function isJsonResponse(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.toLowerCase().includes("application/json");
}

async function toAbsoluteUrlIfNeeded(url: string): Promise<string> {
  if (isAbsoluteUrl(url)) return url;
  const origin = await getCurrentOrigin();
  return trimTrailingSlash(origin) + ensureLeadingSlash(url);
}

async function isSameOrigin(absoluteUrl: string): Promise<boolean> {
  try {
    const u = new URL(absoluteUrl);
    const origin = await getCurrentOrigin();
    const o = new URL(origin);
    return u.protocol === o.protocol && u.host === o.host;
  } catch {
    return false;
  }
}

/** Detect Next.js redirect errors without importing Next internals */
function isNextRedirectError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && typeof (err as any).digest === "string" && (err as any).digest.startsWith("NEXT_REDIRECT;");
}

/**
 * Server-only helper for Server Components.
 * - Accepts absolute URLs, or relative ("/api/...") and resolves to absolute.
 * - Cookie forwarding is configurable; defaults to "auto".
 * - Auto-redirects on { code: "SESSION_REQUIRED" } (defaults to "/").
 * - Returns `{ data }` on success, or `{ error, status, code, meta }` on failure.
 */
export async function fetchServerPageData<T = unknown>(inputUrl: string, init: ServerFetchInit & FetchExtras = {}): Promise<ServerPageDataResult<T>> {
  const { forwardCookies = "auto", debug = false, redirectOnSessionRequired = true, homeRedirectPath = "/", ...initRest } = init;

  try {
    const url = await toAbsoluteUrlIfNeeded(inputUrl);
    const sameOrigin = await isSameOrigin(url);

    const shouldForwardCookies =
      forwardCookies === "always"
        ? true
        : forwardCookies === "never"
        ? false
        : // "auto"
        isProd
        ? sameOrigin
        : true; // dev: always forward, prod: same-origin only

    const callerControlsCaching = initRest.cache !== undefined || initRest.next?.revalidate !== undefined;

    const defaultInit: ServerFetchInit = {
      redirect: "manual",
      headers: { Accept: "application/json" },
      ...(callerControlsCaching ? {} : { cache: "no-store" }),
    };

    const defaultHeaders = new Headers(defaultInit.headers as HeadersInit);
    const callerHeaders = new Headers(initRest.headers || {});

    if (shouldForwardCookies && !callerHeaders.has("cookie")) {
      const cookieStr = (await cookies()).toString();
      if (cookieStr) defaultHeaders.set("cookie", cookieStr);
      if (debug) {
        console.log(
          "[fetchServerPageData] forwarding cookies ->",
          cookieStr.split("; ").map((p) => p.split("=")[0])
        );
      }
    } else if (debug) {
      console.log("[fetchServerPageData] NOT forwarding cookies", {
        isProd,
        sameOrigin,
        forwardCookies,
        callerHasCookieHeader: callerHeaders.has("cookie"),
      });
    }

    const merged: RequestInit = {
      ...defaultInit,
      ...initRest,
      headers: {
        ...Object.fromEntries(defaultHeaders.entries()),
        ...Object.fromEntries(callerHeaders.entries()),
      },
    };

    const res = await fetch(url, merged);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") || "(unknown)";
      return { error: `Unexpected redirect (${res.status}) to ${location}.`, status: res.status };
    }

    if (!res.ok) {
      if (isJsonResponse(res)) {
        const errJson = (await res.json().catch(() => null)) as any;
        const msg = (errJson && (errJson.message || errJson.error)) || `Request failed with ${res.status}`;
        const code = errJson?.code as string | undefined;
        const meta = errJson?.meta;

        // 🔐 unified handling for session loss
        if (code === "SESSION_REQUIRED" && redirectOnSessionRequired) {
          redirect(homeRedirectPath); // throws; let it bubble
        }

        return { error: msg, status: res.status, code, meta };
      } else {
        await res.text().catch(() => "");
        return { error: `Request failed with ${res.status}. Received non-JSON response.`, status: res.status };
      }
    }

    if (!isJsonResponse(res)) {
      await res.text().catch(() => "");
      return { error: "Expected JSON but received non-JSON response." };
    }

    const json = (await res.json().catch(() => null)) as any;
    if (json == null) return { error: "Empty JSON response." };

    const payload = (Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json) as T;
    return { data: payload };
  } catch (err) {
    // Let Next.js handle redirect() exceptions
    if (isNextRedirectError(err)) throw err;
    console.error("[fetchServerPageData] Unexpected error:", err);
    return { error: "Unexpected server error. Please try again later." };
  }
}
