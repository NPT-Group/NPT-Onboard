// src/app/(hr)/dashboard/onboardings/[id]/page.tsx
import { fetchServerPageData } from "@/lib/utils/fetchServerPageData";
import { OnboardingDetailsClient } from "./OnboardingDetailsClient";

export const dynamic = "force-dynamic";

export default async function OnboardingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetchServerPageData<{ onboarding: any }>(`/api/v1/admin/onboardings/${id}`, { redirectOnSessionRequired: true, homeRedirectPath: "/login" });

  return <OnboardingDetailsClient onboardingId={id} initialOnboarding={res.data?.onboarding ?? null} initialError={res.error ?? null} />;
}
