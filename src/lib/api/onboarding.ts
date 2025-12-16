// src/lib/api/onboarding.ts
"use client";

import { request, postJson } from "./client";
import { ESubsidiary, type IGeoLocation } from "@/types/shared.types";
import type {
  TOnboardingContext,
  IIndiaOnboardingFormData,
} from "@/types/onboarding.types";

// -----------------------------------------------------------------------------
// Invite / OTP flow (already used by /onboarding?token=...)
// -----------------------------------------------------------------------------

export type InviteVerifyResponse = {
  onboardingId: string;
  subsidiary: ESubsidiary;
  email: string;
};

export async function requestOnboardingOtp(inviteToken: string) {
  return postJson<{ token: string }, InviteVerifyResponse>(
    "/api/v1/onboarding/invite/verify",
    { token: inviteToken }
  );
}

export type OtpVerifyResponse = {
  onboardingContext: TOnboardingContext;
};

export async function verifyOnboardingOtp(inviteToken: string, otp: string) {
  return postJson<{ token: string; otp: string }, OtpVerifyResponse>(
    "/api/v1/onboarding/otp/verify",
    { token: inviteToken, otp }
  );
}

// -----------------------------------------------------------------------------
// Onboarding context (GET /api/v1/onboarding/[id])
// -----------------------------------------------------------------------------

export type GetOnboardingResponse = {
  onboardingContext: TOnboardingContext;
};

/**
 * Fetch the current onboarding context for the given onboardingId.
 * Requires a valid employee onboarding session cookie.
 */
export async function fetchOnboardingContext(onboardingId: string) {
  return request<GetOnboardingResponse>(`/api/v1/onboarding/${onboardingId}`);
}

// -----------------------------------------------------------------------------
// India submission (POST /api/v1/onboarding/[id])
// -----------------------------------------------------------------------------

export type SubmitIndiaPayload = {
  indiaFormData: IIndiaOnboardingFormData;
  locationAtSubmit: IGeoLocation;
  turnstileToken: string;
};

export type SubmitIndiaResponse = {
  onboardingContext: TOnboardingContext;
};

/**
 * Submit (or re-submit) the India onboarding form as an employee.
 * Uses the standard success/error API envelope via postJson.
 */
export async function submitIndiaOnboarding(
  onboardingId: string,
  payload: SubmitIndiaPayload
) {
  return postJson<SubmitIndiaPayload, SubmitIndiaResponse>(
    `/api/v1/onboarding/${onboardingId}`,
    payload
  );
}
