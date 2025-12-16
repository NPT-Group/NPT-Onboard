// src/app/api/v1/onboarding/session/resolve/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import connectDB from "@/lib/utils/connectDB";
import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { ONBOARDING_SESSION_COOKIE_NAME } from "@/config/env";
import { hashString } from "@/lib/utils/encryption";
import { clearOnboardingCookieHeader } from "@/lib/utils/auth/onboardingSession";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";

/**
 * ---------------------------------------------------------------------------
 * GET /api/v1/onboarding/session/resolve
 * ---------------------------------------------------------------------------
 * Middleware-only helper endpoint that resolves an employee onboarding session
 * from the onboarding auth cookie.
 *
 * Why this exists:
 * - Next.js middleware must remain DB-free (edge/runtime constraints + perf).
 * - The proxy (middleware) still needs to know whether a request has a valid
 *   employee onboarding session and, if so, which `/onboarding/[id]` route
 *   to redirect to.
 *
 * What it does:
 * - Reads the raw onboarding session cookie (invite token).
 * - Hashes the token and finds the DIGITAL onboarding whose `invite.tokenHash`
 *   matches.
 * - Enforces invite validity (expiresAt must exist and be in the future).
 * - Enforces employee session eligibility by status:
 *     - Allowed ONLY when status is:
 *         - EOnboardingStatus.InviteGenerated
 *         - EOnboardingStatus.ModificationRequested
 *     - Any other status => treated as NO active session.
 *
 * Cookie handling:
 * - On logical "no session" outcomes (missing/invalid/stale/not eligible),
 *   the endpoint sets a `Set-Cookie` header that clears the onboarding cookie.
 * - IMPORTANT: When called from middleware via `fetch()`, that `Set-Cookie`
 *   header is NOT automatically forwarded to the browser. The proxy must also
 *   delete the cookie on its own response to actually clear it client-side.
 *
 * Response:
 * - Always returns HTTP 200 for logical outcomes so middleware can branch
 *   deterministically without retry logic.
 * - Shape:
 *   {
 *     success: true,
 *     data: { hasSession: boolean; onboardingId?: string }
 *   }
 * - True 5xx errors still use `errorResponse(...)` for visibility/monitoring.
 * ---------------------------------------------------------------------------
 */
export async function GET(_req: NextRequest) {
  try {
    await connectDB();

    if (!ONBOARDING_SESSION_COOKIE_NAME) {
      return successResponse(200, "OK", { hasSession: false });
    }

    const jar = await cookies();
    const rawToken = jar.get(ONBOARDING_SESSION_COOKIE_NAME)?.value;

    if (!rawToken) {
      return successResponse(200, "OK", { hasSession: false });
    }

    const tokenHash = hashString(rawToken);
    const now = new Date();

    const onboarding = await OnboardingModel.findOne({
      method: EOnboardingMethod.DIGITAL,
      "invite.tokenHash": tokenHash,
    });

    const isEmployeeSessionAllowed = onboarding?.status === EOnboardingStatus.InviteGenerated || onboarding?.status === EOnboardingStatus.ModificationRequested;

    if (!onboarding || !onboarding.invite || !onboarding.invite.expiresAt || new Date(onboarding.invite.expiresAt) <= now || !isEmployeeSessionAllowed) {
      const res = successResponse(200, "OK", { hasSession: false });
      res.headers.set("Set-Cookie", clearOnboardingCookieHeader());
      return res;
    }

    return successResponse(200, "OK", {
      hasSession: true,
      onboardingId: onboarding._id.toString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
