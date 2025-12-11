"use client";

import { useRef } from "react";
import {
  FormProvider,
  useForm,
  type FieldPath,
  type DeepPartial,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  indiaOnboardingFormSchema,
  type IndiaOnboardingFormValues,
} from "./indiaFormSchema";
import type { TOnboardingContext } from "@/types/onboarding.types";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";

import {
  PersonalInfoSection,
  PERSONAL_INFO_FIELD_PATHS,
} from "./sections/PersonalInfoSection";
import { getErrorAtPath } from "../common/getErrorAtPath";

type IndiaOnboardingFormProps = {
  onboarding: TOnboardingContext;
  isReadOnly: boolean;
  currentIndex: number;
  onStepChange: (index: number) => void;
};

type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

const STEP_IDS = ONBOARDING_STEPS.map((s) => s.id) as StepId[];

/**
 * Map of step id to the field paths belonging to that section.
 * For now only "personal" is populated; others will be filled as we implement them.
 */
const STEP_FIELD_MAP: Record<StepId, FieldPath<IndiaOnboardingFormValues>[]> = {
  personal: PERSONAL_INFO_FIELD_PATHS,
  education: [],
  employment: [],
  banking: [],
  declaration: [],
  review: [],
};

export function IndiaOnboardingForm({
  onboarding,
  isReadOnly,
  currentIndex,
  onStepChange,
}: IndiaOnboardingFormProps) {
  const methods = useForm<IndiaOnboardingFormValues>({
    resolver: zodResolver(indiaOnboardingFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: buildDefaultValuesFromOnboarding(onboarding),
  });

  const {
    trigger,
    formState: { errors },
  } = methods;

  // Section refs – used to scroll to the top of a section when navigating.
  const sectionRefs = useRef<Record<StepId, HTMLElement | null>>({
    personal: null,
    education: null,
    employment: null,
    banking: null,
    declaration: null,
    review: null,
  });

  function scrollToSection(stepId: StepId) {
    const el = sectionRefs.current[stepId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function scrollToField(path: string, fallbackStep: StepId) {
    const el = document.querySelector<HTMLElement>(`[data-field="${path}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).focus?.();
    } else {
      scrollToSection(fallbackStep);
    }
  }

  async function handleNext() {
    const stepId = STEP_IDS[currentIndex];
    const fieldPaths = STEP_FIELD_MAP[stepId] ?? [];

    // If this step has fields, validate only those.
    if (fieldPaths.length > 0) {
      const ok = await trigger(fieldPaths as any, { shouldFocus: false });

      if (!ok) {
        const firstErroredPath = fieldPaths.find((p) =>
          Boolean(getErrorAtPath(errors, p))
        );
        if (firstErroredPath) {
          scrollToField(firstErroredPath, stepId);
        } else {
          scrollToSection(stepId);
        }
        return;
      }
    }

    const nextIndex = Math.min(ONBOARDING_STEPS.length - 1, currentIndex + 1);
    onStepChange(nextIndex);
    scrollToSection(STEP_IDS[nextIndex]);
  }

  function handlePrev() {
    const prevIndex = Math.max(0, currentIndex - 1);
    onStepChange(prevIndex);
    scrollToSection(STEP_IDS[prevIndex]);
  }

  async function handleFinalSubmit(values: IndiaOnboardingFormValues) {
    // Final whole-form validation is already enforced via resolver,
    // but we explicitly trigger again to be safe and scroll to first error.
    const ok = await trigger(undefined, { shouldFocus: false });
    if (!ok) {
      // Find the first step with an error.
      for (const step of STEP_IDS) {
        const paths = STEP_FIELD_MAP[step] ?? [];
        const firstErroredPath =
          paths.find((p) => Boolean(getErrorAtPath(errors, p))) ?? null;

        if (firstErroredPath) {
          scrollToField(firstErroredPath, step);
          return;
        }
      }
      // Fallback: scroll to top of current step.
      scrollToSection(STEP_IDS[currentIndex]);
      return;
    }

    // TODO: wire into submitIndiaOnboarding (backend POST) in a later step.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("India onboarding form submitted (frontend only):", values);
    }
  }

  return (
    <FormProvider {...methods}>
      <form
        className="space-y-10"
        autoComplete="off"
        onSubmit={methods.handleSubmit(handleFinalSubmit)}
      >
        {/* Step 1: Personal information */}
        <section
          ref={(el) => {
            sectionRefs.current.personal = el;
          }}
          aria-label="Personal information"
        >
          {currentIndex === 0 && (
            <PersonalInfoSection
              onboarding={onboarding}
              isReadOnly={isReadOnly}
            />
          )}
        </section>

        {/* Step 2–6 placeholders – we’ll replace with real sections later */}
        <section
          ref={(el) => {
            sectionRefs.current.education = el;
          }}
          aria-label="Education"
        >
          {currentIndex === 1 && (
            <PlaceholderSection title="Education">
              Education section will be implemented next.
            </PlaceholderSection>
          )}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.employment = el;
          }}
          aria-label="Employment history"
        >
          {currentIndex === 2 && (
            <PlaceholderSection title="Employment history">
              Employment history section will be implemented next.
            </PlaceholderSection>
          )}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.banking = el;
          }}
          aria-label="Bank & payment details"
        >
          {currentIndex === 3 && (
            <PlaceholderSection title="Bank & payment details">
              Bank details section will be implemented next.
            </PlaceholderSection>
          )}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.declaration = el;
          }}
          aria-label="Declaration"
        >
          {currentIndex === 4 && (
            <PlaceholderSection title="Declaration">
              Declaration section will be implemented next.
            </PlaceholderSection>
          )}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.review = el;
          }}
          aria-label="Review & submit"
        >
          {currentIndex === 5 && (
            <PlaceholderSection title="Review & submit">
              Review & submit step will be wired into the backend submission
              route.
            </PlaceholderSection>
          )}
        </section>

        {/* Navigation controls */}
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            Previous
          </button>

          <div className="flex items-center gap-3">
            {currentIndex < ONBOARDING_STEPS.length - 1 ? (
              <button
                type="button"
                className="rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleNext}
                disabled={isReadOnly}
              >
                Next section
              </button>
            ) : (
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isReadOnly}
              >
                Submit onboarding
              </button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

/**
 * Default values for the form, seeded from onboarding context.
 * We use DeepPartial so we only need to provide the subset we care about.
 */
// src/features/onboarding/india/IndiaOnboardingForm.tsx

function buildDefaultValuesFromOnboarding(
  onboarding: TOnboardingContext
): DeepPartial<IndiaOnboardingFormValues> {
  return {
    personalInfo: {
      firstName: onboarding.firstName ?? "",
      lastName: onboarding.lastName ?? "",
      email: onboarding.email ?? "",
      gender: "" as any, // will be set to EGender.MALE/FEMALE
      dateOfBirth: "",
      canProvideProofOfAge: false,
      residentialAddress: {
        addressLine1: "",
        city: "",
        state: "",
        postalCode: "",
        fromDate: "",
        toDate: "",
      },
      phoneHome: "",
      phoneMobile: "",
      emergencyContactName: "",
      emergencyContactNumber: "",
    },
    // we can leave the rest of the form partial for now;
    // we'll fill them out when we implement the later steps.
  };
}

function PlaceholderSection(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-600 sm:px-6">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        {props.title}
      </h2>
      <p>{props.children}</p>
    </div>
  );
}
