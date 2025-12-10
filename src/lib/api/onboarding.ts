// src/lib/api/onboarding.ts
"use client";

import { postJson } from "./client";
import { ESubsidiary } from "@/types/shared.types";
import type { TOnboardingContext } from "@/types/onboarding.types";

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
