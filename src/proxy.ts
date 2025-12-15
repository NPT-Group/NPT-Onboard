// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { AUTH_COOKIE_NAME, DISABLE_AUTH, NEXTAUTH_SECRET, ONBOARDING_SESSION_COOKIE_NAME } from "./config/env";
import { isAdminEmail } from "@/config/adminAuth";

type AppJWT = {
  userId?: string;
  email?: string;
  name?: string;
  picture?: string;
};

/* ───────────────────────── helpers ───────────────────────── */

async function resolveAdmin(req: NextRequest): Promise<{ isAdmin: boolean; hasInvalidAuthCookie: boolean }> {
  // In dev with auth disabled, everyone is treated as admin and we don't clear cookies.
  if (DISABLE_AUTH) {
    return { isAdmin: true, hasInvalidAuthCookie: false };
  }

  const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const hasAuthCookie = !!authCookie;

  const token = (await getToken({
    req: req as any,
    secret: NEXTAUTH_SECRET,
    cookieName: AUTH_COOKIE_NAME,
  })) as AppJWT | null;

  // If we had our cookie but couldn't parse a valid token, treat it as invalid
  if (!token?.userId || !token?.email || !token?.name) {
    return { isAdmin: false, hasInvalidAuthCookie: hasAuthCookie };
  }

  const isAllowedAdmin = isAdminEmail(token.email);

  return {
    isAdmin: isAllowedAdmin,
    // Cookie exists but email is NOT allowed admin → mark as invalid so caller can clear it
    hasInvalidAuthCookie: hasAuthCookie && !isAllowedAdmin,
  };
}

/**
 * Ask the internal guard route which onboarding (if any) this cookie belongs to.
 * Returns onboardingId or null.
 */
async function resolveEmployeeOnboarding(req: NextRequest): Promise<string | null> {
  if (!ONBOARDING_SESSION_COOKIE_NAME) return null;

  const hasCookie = !!req.cookies.get(ONBOARDING_SESSION_COOKIE_NAME)?.value;
  if (!hasCookie) return null;

  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/v1/onboarding/session/resolve`, {
      cache: "no-store",
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const data = json?.data;

    if (data?.hasSession && typeof data.onboardingId === "string") {
      return data.onboardingId;
    }

    return null;
  } catch {
    return null;
  }
}

/* ───────────────────────── proxy ───────────────────────── */

/**
 * Global routing / auth behavior:
 *
 * - "/" (homepage)
 *   - If admin session → redirect to "/dashboard"
 *   - Else if employee onboarding session → redirect to "/onboarding/[id]"
 *   - Else → redirect to "/login"
 *
 * - "/login"
 *   - If admin session → redirect to "/dashboard"
 *   - Else if employee onboarding session → redirect to "/onboarding/[id]"
 *   - Else → allow request (show login page)
 *
 * - "/dashboard/*"
 *   - When DISABLE_AUTH = false:
 *       - Require valid NextAuth token whose email is in admin allowlist
 *       - If not admin → redirect to "/login?callbackUrl=..."
 *   - When DISABLE_AUTH = true:
 *       - Always allowed (dev mode)
 *
 * - "/onboarding"
 *   - Always allowed (public invite + OTP entry page)
 *
 * - "/onboarding/[id]"
 *   - If admin session → redirect to "/dashboard" (admins must not see employee forms)
 *   - Else, require an active employee onboarding session cookie that resolves
 *     via /api/v1/onboarding/session/resolve
 *   - If no active session → redirect to "/onboarding"
 *   - If session exists but for a different onboarding id → redirect
 *     to canonical "/onboarding/[onboardingId]"
 *
 * - All other routes:
 *   - Pass through without modification
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* ------------------------- 1. Root "/" ------------------------- */
  if (pathname === "/") {
    const { isAdmin, hasInvalidAuthCookie } = await resolveAdmin(req);

    if (isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const onboardingId = await resolveEmployeeOnboarding(req);
    let res: NextResponse;

    if (onboardingId) {
      res = NextResponse.redirect(new URL(`/onboarding/${onboardingId}`, req.url));
    } else {
      res = NextResponse.redirect(new URL("/login", req.url));
    }

    if (hasInvalidAuthCookie) {
      res.cookies.delete(AUTH_COOKIE_NAME);
    }

    return res;
  }

  /* ------------------------- 2. /login --------------------------- */
  if (pathname === "/login") {
    const { isAdmin, hasInvalidAuthCookie } = await resolveAdmin(req);
    if (isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const onboardingId = await resolveEmployeeOnboarding(req);

    const res = onboardingId ? NextResponse.redirect(new URL(`/onboarding/${onboardingId}`, req.url)) : NextResponse.next();

    if (hasInvalidAuthCookie) {
      res.cookies.delete(AUTH_COOKIE_NAME);
    }

    return res;
  }

  /* --------------------- 3. Dashboard guard ---------------------- */
  if (pathname.startsWith("/dashboard")) {
    if (DISABLE_AUTH) {
      return NextResponse.next();
    }

    const { isAdmin, hasInvalidAuthCookie } = await resolveAdmin(req);

    if (!isAdmin) {
      const callbackUrl = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
      const url = new URL(`/login?callbackUrl=${callbackUrl}`, req.url);
      const res = NextResponse.redirect(url);

      if (hasInvalidAuthCookie) {
        res.cookies.delete(AUTH_COOKIE_NAME);
      }

      return res;
    }

    // Admin and cookie is valid, just continue
    return NextResponse.next();
  }

  /* ----------------- 4. /onboarding routes ----------------------- */
  if (pathname.startsWith("/onboarding")) {
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 1) {
      return NextResponse.next();
    }

    const onboardingIdInPath = segments[1];

    const { isAdmin, hasInvalidAuthCookie } = await resolveAdmin(req);
    if (isAdmin) {
      const res = NextResponse.redirect(new URL("/dashboard", req.url));
      if (hasInvalidAuthCookie) {
        res.cookies.delete(AUTH_COOKIE_NAME);
      }
      return res;
    }

    const looksLikeObjectId = /^[a-f\d]{24}$/i.test(onboardingIdInPath);
    if (!looksLikeObjectId) {
      const res = NextResponse.next();
      if (hasInvalidAuthCookie) {
        res.cookies.delete(AUTH_COOKIE_NAME);
      }
      return res;
    }

    const onboardingIdFromSession = await resolveEmployeeOnboarding(req);

    if (!onboardingIdFromSession) {
      const res = NextResponse.redirect(new URL("/onboarding", req.url));
      if (hasInvalidAuthCookie) {
        res.cookies.delete(AUTH_COOKIE_NAME);
      }
      return res;
    }

    if (onboardingIdFromSession !== onboardingIdInPath) {
      const res = NextResponse.redirect(new URL(`/onboarding/${onboardingIdFromSession}`, req.url));
      if (hasInvalidAuthCookie) {
        res.cookies.delete(AUTH_COOKIE_NAME);
      }
      return res;
    }

    const res = NextResponse.next();
    if (hasInvalidAuthCookie) {
      res.cookies.delete(AUTH_COOKIE_NAME);
    }
    return res;
  }

  /* ------------------------ default pass ------------------------- */
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/onboarding/:path*"],
};
