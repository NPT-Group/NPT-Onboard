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
import { useParams } from "next/navigation";

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
import { ESubsidiary } from "@/types/shared.types";
import { EEApiErrorType } from "@/types/api.types";

import { IndiaOnboardingForm } from "@/features/onboarding/india/IndiaOnboardingForm";

export default function OnboardingFormPage() {
  // ==================================================================
  // Route params (client-side)
  // ==================================================================

  const params = useParams<{ onboardingId: string }>();
  const onboardingId = params?.onboardingId;

  // ==================================================================
  // Data loading state
  // ==================================================================

  const [onboarding, setOnboarding] = useState<TOnboardingContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      return (
        <Alert
          variant="info"
          title="Updates requested"
          description="HR has requested some changes to your information. Please review each section, update any fields with comments, and resubmit your onboarding."
        />
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

    // Normal editable state: no banner
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
          {/* Optional status banner (errors / locked states) */}
          {statusBanner && <div className="mb-6">{statusBanner}</div>}

          {/* Title + subtitle */}
          <header className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Employee Onboarding Form
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              All information must be answered truthfully. Liability falls on
              the applicant.
            </p>
          </header>

          {/* Full Form Wizard - observed for scroll detection */}
          <div ref={wizardRef} className="mb-6 flex justify-center">
            <FormWizard
              steps={ONBOARDING_STEPS}
              currentIndex={currentIndex}
              size="regular"
            />
          </div>

          {/* Form content: India onboarding form shell */}
          {!isLoading &&
            !loadError &&
            onboarding &&
            effectiveSubsidiary === ESubsidiary.INDIA && (
              <IndiaOnboardingForm
                onboarding={onboarding}
                isReadOnly={isReadOnly}
                currentIndex={currentIndex}
                onStepChange={setCurrentIndex}
              />
            )}
        </div>
      </main>
    </div>
  );
}
