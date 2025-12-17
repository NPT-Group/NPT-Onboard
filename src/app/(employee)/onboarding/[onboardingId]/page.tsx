/**
 * Onboarding Form Page
 *
 * Main page component for the multi-step onboarding form. Displays the form wizard
 * and manages step navigation. Features a sticky navbar that shows a compact wizard
 * when the full wizard scrolls out of view.
 *
 * Route: /onboarding/[onboardingId]
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Navbar } from "@/components/layout/navbar";
import { FormWizard } from "@/components/onboarding/form-wizard";
import { Alert } from "@/components/ui/alert";

import { subsidiaryContent } from "@/config/subsidiaries";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";

import { fetchOnboardingContext } from "@/lib/api/onboarding";
import { ApiError } from "@/lib/api/client";

import {
  EOnboardingStatus,
  type TOnboardingContext,
} from "@/types/onboarding.types";
import { ESubsidiary, type IGeoLocation } from "@/types/shared.types";
import { EEApiErrorType } from "@/types/api.types";

import { IndiaOnboardingForm } from "@/features/onboarding/india/IndiaOnboardingForm";
import { reverseGeocodeBestEffort } from "@/features/onboarding/form-engine/geo";

import { SubmissionCompleteModal } from "./SubmissionCompleteModal";

export default function OnboardingFormPage() {
  // ==================================================================
  // Route params (client-side)
  // ==================================================================

  const params = useParams<{ onboardingId: string }>();
  const onboardingId = params?.onboardingId;
  const router = useRouter();

  // ==================================================================
  // Data loading state
  // ==================================================================

  const [onboarding, setOnboarding] = useState<TOnboardingContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Completion modal (shown immediately after successful submit)
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);

  // ==================================================================
  // Geo (request IMMEDIATELY on page entry - required for submission)
  // ==================================================================

  const [geo, setGeo] = useState<IGeoLocation>({});
  const [geoDenied, setGeoDenied] = useState(false);

  useEffect(() => {
    // Always set timezone best-effort (no permission needed)
    const timezone =
      Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || undefined;

    setGeo((g) => ({ ...g, timezone }));

    if (typeof window === "undefined") {
      return;
    }

    if (!navigator?.geolocation) {
      setGeoDenied(true);
      return;
    }

    // Request location permission IMMEDIATELY on page entry
    // This ensures we have location data ready for submission
    // If user denies, we'll ask again at submit time (required for submission)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        // Best-effort reverse geocode so geo has {country, region, city}
        // early (submit will also verify/enrich again).
        const enrich = await reverseGeocodeBestEffort(latitude, longitude);

        setGeo((g) => ({
          ...g,
          latitude,
          longitude,
          ...enrich,
        }));
        setGeoDenied(false);
      },
      (error) => {
        // User denied or unavailable - we'll ask again at submit time
        // Location is REQUIRED for submission, so we'll request again then
        setGeoDenied(true);
        console.warn("Location permission denied or unavailable:", error);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000, // Increased timeout for better success rate
        maximumAge: 0, // Always get fresh location, don't use cached
      }
    );
  }, []);

  // ==================================================================
  // Wizard UI state
  // ==================================================================

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompactWizard, setShowCompactWizard] = useState(false);
  const wizardRef = useRef<HTMLDivElement | null>(null);

  // ==================================================================
  // Derive subsidiary + region from onboarding context
  // ==================================================================

  const effectiveSubsidiary = onboarding?.subsidiary ?? ESubsidiary.INDIA;

  const content = subsidiaryContent[effectiveSubsidiary];
  const regionName = content.name.replace(/^NPT\s+/i, "");

  const status = onboarding?.status;

  const isReadOnly =
    status === EOnboardingStatus.Submitted ||
    status === EOnboardingStatus.Resubmitted ||
    status === EOnboardingStatus.Approved ||
    status === EOnboardingStatus.Terminated;

  function handleCompletionAcknowledge() {
    // Backend clears session on submit; we intentionally return the user
    // to the onboarding entry screen afterwards.
    setIsCompletionOpen(false);
    router.replace("/onboarding");
  }

  // ==================================================================
  // Fetch onboarding context when onboardingId is available
  // ==================================================================

  useEffect(() => {
    if (!onboardingId) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const { onboardingContext } = await fetchOnboardingContext(
          onboardingId
        );
        if (cancelled) return;
        setOnboarding(onboardingContext);
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load onboarding context", err);
        if (err instanceof ApiError) {
          if (err.code === EEApiErrorType.SESSION_REQUIRED) {
            setLoadError(
              "Your onboarding session has expired or is invalid. Please reopen the onboarding link sent by HR."
            );
          } else if (err.code === EEApiErrorType.NOT_FOUND) {
            setLoadError(
              "We couldn't find an onboarding session for this link. Please contact HR."
            );
          } else {
            setLoadError(
              err.message ||
                "Something went wrong while loading your onboarding."
            );
          }
        } else {
          setLoadError(
            "Something went wrong while loading your onboarding. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [onboardingId]);

  // ==================================================================
  // Intersection Observer for Sticky Wizard
  // ==================================================================

  useEffect(() => {
    const el = wizardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowCompactWizard(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ==================================================================
  // Helper: status banner content
  // ==================================================================

  function renderStatusBanner() {
    if (loadError) {
      return (
        <Alert
          variant="error"
          title="Unable to load onboarding"
          description={loadError}
        />
      );
    }

    if (isLoading || !onboarding) {
      return (
        <Alert
          variant="info"
          title="Loading your onboarding"
          description="Please wait while we load your onboarding details."
        />
      );
    }

    if (effectiveSubsidiary !== ESubsidiary.INDIA) {
      return (
        <Alert
          variant="info"
          title={`${content.name} onboarding is coming soon`}
          description="Online onboarding for this region will be available in Version 2. Please contact HR if you received this link unexpectedly."
        />
      );
    }

    if (status === EOnboardingStatus.ModificationRequested) {
      const message = onboarding.modificationRequestMessage?.trim();
      return (
        <div className="space-y-3">
          <Alert
            variant="info"
            title="Updates requested"
            description="HR has requested changes to your submission. Please review the message below, update the relevant fields, and resubmit."
          />

          {message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">
                HR MESSAGE
              </div>
              <div className="mt-2 whitespace-pre-line text-sm text-slate-800">
                {message}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (
      status === EOnboardingStatus.Submitted ||
      status === EOnboardingStatus.Resubmitted
    ) {
      return (
        <Alert
          variant="success"
          title="Onboarding submitted"
          description="Your onboarding has been submitted and is currently under review. You can review your answers, but editing is locked."
        />
      );
    }

    return null;
  }

  // ==================================================================
  // Render
  // ==================================================================

  const statusBanner = renderStatusBanner();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        subsidiaryDisplayName={regionName}
        subsidiaryCode={effectiveSubsidiary}
        centerSlot={
          showCompactWizard ? (
            <FormWizard
              steps={ONBOARDING_STEPS}
              currentIndex={currentIndex}
              size="compact"
            />
          ) : null
        }
      />

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          {statusBanner && <div className="mb-6">{statusBanner}</div>}

          <header className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Employee Onboarding Form
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              All information must be answered truthfully. Liability falls on
              the applicant.
            </p>
          </header>

          <div ref={wizardRef} className="mb-6 flex justify-center">
            <FormWizard
              steps={ONBOARDING_STEPS}
              currentIndex={currentIndex}
              size="regular"
            />
          </div>

          {!isLoading &&
            !loadError &&
            onboarding &&
            effectiveSubsidiary === ESubsidiary.INDIA && (
              <IndiaOnboardingForm
                onboarding={onboarding}
                isReadOnly={isReadOnly}
                currentIndex={currentIndex}
                onStepChange={setCurrentIndex}
                onSubmitted={(ctx) => {
                  setOnboarding(ctx);
                  if (
                    ctx.status === EOnboardingStatus.Submitted ||
                    ctx.status === EOnboardingStatus.Resubmitted
                  ) {
                    setIsCompletionOpen(true);
                  }
                }}
                geo={geo}
                geoDenied={geoDenied}
              />
            )}
        </div>
      </main>

      <SubmissionCompleteModal
        open={isCompletionOpen}
        onAcknowledge={handleCompletionAcknowledge}
      />
    </div>
  );
}
