// src/features/onboarding/india/IndiaOnboardingForm.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { indiaOnboardingFormSchema, type IndiaOnboardingFormInput, type IndiaOnboardingFormValues } from "./indiaFormSchema";

import type { TOnboardingContext } from "@/types/onboarding.types";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";

import { PersonalInfoSection } from "./sections/PersonalInfoSection";
import { GovernmentIdsSection } from "./sections/GovernmentIdsSection";
import { EducationSection } from "./sections/EducationSection";
import { EmploymentSection } from "./sections/EmploymentSection";
import { BankDetailsSection } from "./sections/BankDetailsSection";
import { DeclarationSection } from "./sections/DeclarationSection";

import { submitIndiaOnboarding } from "@/lib/api/onboarding";
import { ApiError } from "@/lib/api/client";
import type { IGeoLocation } from "@/types/shared.types";
import type { RHFSignatureBoxHandle } from "../common/RHFSignatureBox";

import { INDIA_STEPS, type IndiaStepId } from "./indiaSteps";
import { buildIndiaDefaultValuesFromOnboarding } from "./indiaDefaults";
import { normalizeIndiaFormDataForSubmit } from "./normalizeIndiaFormData";
import { ensureGeoAtSubmit } from "../form-engine/geo";
import { findFirstErrorAcrossSteps, findFirstErrorInStep } from "../form-engine/errors";
import { scrollToField, scrollToSection } from "../form-engine/scrolling";
import { EOnboardingStatus } from "@/types/onboarding.types";
import { RequiredFieldProvider } from "../common/requiredFieldContext";
import { isIndiaRequiredField } from "./requiredFields";
import { useWatch } from "react-hook-form";
import { EEducationLevel } from "@/types/onboarding.types";

type IndiaOnboardingFormProps = {
  onboarding: TOnboardingContext;
  isReadOnly: boolean;
  currentIndex: number;
  onStepChange: (index: number) => void;

  /** so the page can refresh status/context after submit */
  onSubmitted?: (ctx: TOnboardingContext) => void;

  /** provided by page.tsx (prefetched on page load) */
  geo: IGeoLocation;
  geoDenied: boolean;
};

const STEP_IDS = INDIA_STEPS.map((s) => s.id) as IndiaStepId[];

export function IndiaOnboardingForm({ onboarding, isReadOnly, currentIndex, onStepChange, onSubmitted, geo, geoDenied }: IndiaOnboardingFormProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const methods = useForm<IndiaOnboardingFormInput, unknown, IndiaOnboardingFormValues>({
    resolver: zodResolver(indiaOnboardingFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: buildIndiaDefaultValuesFromOnboarding(onboarding, today),
    shouldUnregister: false,
  });

  const {
    trigger,
    getValues,
    formState: { isSubmitting },
  } = methods;

  // NOTE:
  // Our submit flow is custom (we don't use RHF's handleSubmit), so RHF's `isSubmitting`
  // does not reliably reflect in-flight submission. Track a local flag for button UX.
  const [submitting, setSubmitting] = useState(false);

  // Conditional requiredness (schema contains superRefine-based requirements)
  // We only watch the minimal driver fields needed for required indicators.
  const highestEducationLevel = useWatch({
    control: methods.control,
    name: "education.0.highestLevel",
  }) as EEducationLevel | "" | undefined;

  const isRequired = (path: string): boolean => {
    const p = String(path).replace(/\.\d+(?=\.|$)/g, ".*");

    // Education conditional requirements (superRefine):
    if (p === "education.*.schoolName") return highestEducationLevel === EEducationLevel.PRIMARY_SCHOOL;
    // primaryYearCompleted is optional for primary school
    if (p === "education.*.highSchoolInstitutionName") return highestEducationLevel === EEducationLevel.HIGH_SCHOOL;
    // highSchoolYearCompleted is optional for high school

    // For diploma/bachelor/masters/doctorate/other
    const isHigherEd =
      highestEducationLevel != null && highestEducationLevel !== "" && highestEducationLevel !== EEducationLevel.PRIMARY_SCHOOL && highestEducationLevel !== EEducationLevel.HIGH_SCHOOL;
    if (p === "education.*.institutionName") return Boolean(isHigherEd);
    // startYear is optional
    if (p === "education.*.endYear") return Boolean(isHigherEd);

    return isIndiaRequiredField(path);
  };

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Turnstile token state (NOT in RHF)
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  // signature upload-on-submit (DeclarationSection passes this into RHFSignatureBox)
  const signatureRef = useRef<RHFSignatureBoxHandle | null>(null);

  const sectionRefs = useRef<Record<IndiaStepId, HTMLElement | null>>({
    personal: null,
    governmentIds: null,
    education: null,
    employment: null,
    banking: null,
    declaration: null,
  });

  const stepIndex = (id: IndiaStepId) => STEP_IDS.indexOf(id);

  /**
   * Scroll to a section by step ID.
   * Uses smooth scrolling for better UX.
   */
  const scrollSection = (stepId: IndiaStepId) => scrollToSection(stepId, sectionRefs as any);
  const scrollField = (path: string, fallback: IndiaStepId) => scrollToField(path, fallback, sectionRefs as any);

  /**
   * Handle Next button click - validates current section before proceeding.
   * Gates navigation if validation fails and scrolls to first error.
   */
  async function handleNext() {
    const step = INDIA_STEPS[currentIndex];
    const ok = await trigger(step.fieldPaths as any, { shouldFocus: false });

    if (!ok) {
      // RHF can update errors before React re-renders; schedule scroll on next tick
      // to ensure we read the latest `formState.errors`.
      setTimeout(() => {
        const errs = methods.formState.errors;
        const firstPath = findFirstErrorInStep(step as any, errs as any);
        if (firstPath) scrollField(firstPath, step.id);
        else scrollSection(step.id);
      }, 0);
      return;
    }

    const nextIndex = Math.min(INDIA_STEPS.length - 1, currentIndex + 1);
    onStepChange(nextIndex);
    scrollSection(INDIA_STEPS[nextIndex].id);
  }

  function handlePrev() {
    const prevIndex = Math.max(0, currentIndex - 1);
    onStepChange(prevIndex);
    scrollSection(INDIA_STEPS[prevIndex].id);
  }

  /**
   * Handle form submission with proper flow:
   * 1. Validate entire form (signature must already be saved)
   * 3. Scroll to first error if validation fails
   * 4. Check Turnstile token
   * 5. Get geolocation
   * 6. Submit if all checks pass
   */
  async function handleSubmitWithUploads(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isReadOnly || submitting) return;

    setSubmitting(true);
    try {
      // Force error visibility in the last section (and signature box) for custom submit flow
      setSubmitAttempted(true);
      setSubmitError(null);

      // Step 1: Validate entire form
      // Signature is explicitly saved by the user in Declaration section.
      const isValid = await trigger(undefined, { shouldFocus: false });

      if (!isValid) {
        // Find first error across all sections and scroll to it.
        // Do this after the next render so we use the latest errors snapshot.
        setTimeout(() => {
          const errs = methods.formState.errors;
          const firstError = findFirstErrorAcrossSteps(INDIA_STEPS as any, errs as any);
          if (firstError) {
            const { stepId, errorPath } = firstError;
            // IMPORTANT:
            // Submit should NOT "gate" visibility like Next does. We intentionally do
            // NOT call onStepChange(stepWithError) here, because step index controls
            // conditional rendering (sections after the index become invisible).
            //
            // We only scroll to the first error so the user can fix it, while keeping
            // the full form visible.
            setTimeout(() => {
              if (errorPath) scrollField(errorPath, stepId);
              else scrollSection(stepId);
            }, 150);
          } else {
            // Fallback: scroll to current section
            scrollSection(INDIA_STEPS[currentIndex].id);
          }
        }, 0);
        return;
      }

      // Step 3: Verify Turnstile token is present
      if (!turnstileToken) {
        setSubmitError("Please complete the verification to submit.");
        // Ensure user is on the declaration step, then scroll to the widget itself
        const declIndex = STEP_IDS.indexOf("declaration");
        if (declIndex >= 0) onStepChange(declIndex);
        setTimeout(() => {
          scrollField("declaration.turnstile", "declaration");
        }, 150);
        return;
      }

      // Step 4: Ensure geolocation is available (REQUIRED for submission)
      // Location should have been requested on page entry, but we verify/request again here
      // This ensures we have location even if user changed settings or initial request failed
      let locationAtSubmit: IGeoLocation;
      try {
        locationAtSubmit = await ensureGeoAtSubmit({ geo, geoDenied });

        // Double-check we have valid coordinates
        if (locationAtSubmit.latitude == null || locationAtSubmit.longitude == null) {
          throw new Error("Location coordinates are missing. Please allow location access to submit.");
        }
      } catch (err: any) {
        // Location is REQUIRED - block submission with clear error message
        setSubmitError(err?.message || "Location access is required to submit. Please enable location access in your browser settings.");
        scrollSection("declaration");
        return;
      }

      // Step 5: All validations passed - submit the form
      const values = getValues() as IndiaOnboardingFormValues;

      // Normalize payload to match backend expectations (no empty-string optionals,
      // strict education shape, and bankDetails.voidCheque compatibility).
      const normalizedIndiaFormData = normalizeIndiaFormDataForSubmit(values);

      try {
        const res = await submitIndiaOnboarding(onboarding.id, {
          indiaFormData: normalizedIndiaFormData as any,
          locationAtSubmit,
          turnstileToken,
        });

        // Success - notify parent to update context
        onSubmitted?.(res.onboardingContext);
      } catch (err) {
        // Handle submission errors
        if (err instanceof ApiError) {
          setSubmitError(err.message || "Submission failed.");
        } else {
          setSubmitError("Submission failed. Please try again.");
        }
        scrollSection("declaration");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <RequiredFieldProvider isRequired={isRequired}>
        <form className="space-y-10" autoComplete="off" onSubmit={handleSubmitWithUploads}>
          <section
            ref={(el) => {
              sectionRefs.current.personal = el;
            }}
            aria-label="Personal information"
          >
            <PersonalInfoSection onboarding={onboarding} isReadOnly={isReadOnly} />
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.governmentIds = el;
            }}
            aria-label="Government identification"
          >
            {currentIndex >= stepIndex("governmentIds") && <GovernmentIdsSection isReadOnly={isReadOnly} docId={onboarding.id} />}
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.education = el;
            }}
            aria-label="Education"
          >
            {currentIndex >= stepIndex("education") && <EducationSection isReadOnly={isReadOnly} />}
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.employment = el;
            }}
            aria-label="Employment history"
          >
            {currentIndex >= stepIndex("employment") && <EmploymentSection isReadOnly={isReadOnly} docId={onboarding.id} />}
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.banking = el;
            }}
            aria-label="Bank & payment details"
          >
            {currentIndex >= stepIndex("banking") && <BankDetailsSection isReadOnly={isReadOnly} docId={onboarding.id} />}
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.declaration = el;
            }}
            aria-label="Declaration"
          >
            {currentIndex >= stepIndex("declaration") && (
              <DeclarationSection
                isReadOnly={isReadOnly}
                docId={onboarding.id}
                turnstileToken={turnstileToken}
                onTurnstileToken={setTurnstileToken}
                submitError={submitError}
                signatureRef={signatureRef}
                showErrors={submitAttempted}
              />
            )}
          </section>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              Previous
            </button>

            <div className="flex items-center gap-3">
              {currentIndex < ONBOARDING_STEPS.length - 1 ? (
                <button
                  type="button"
                  className="cursor-pointer rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={handleNext}
                  disabled={isReadOnly}
                >
                  Next section
                </button>
              ) : (
                <button
                  type="submit"
                  className="cursor-pointer rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isReadOnly || submitting || isSubmitting}
                >
                  {submitting || isSubmitting ? "Submitting..." : onboarding.status === EOnboardingStatus.ModificationRequested ? "Resubmit onboarding" : "Submit onboarding"}
                </button>
              )}
            </div>
          </div>
        </form>
      </RequiredFieldProvider>
    </FormProvider>
  );
}
