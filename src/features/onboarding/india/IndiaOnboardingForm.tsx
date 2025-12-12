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
  type IndiaOnboardingFormInput,
  type IndiaOnboardingFormValues,
} from "./indiaFormSchema";

import type { TOnboardingContext } from "@/types/onboarding.types";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";

import {
  PersonalInfoSection,
  PERSONAL_INFO_FIELD_PATHS,
} from "./sections/PersonalInfoSection";
import {
  EducationSection,
  EDUCATION_FIELD_PATHS,
} from "./sections/EducationSection";
import { EmploymentSection } from "./sections/EmploymentSection";

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
const STEP_FIELD_MAP: Record<StepId, FieldPath<IndiaOnboardingFormInput>[]> = {
  personal: PERSONAL_INFO_FIELD_PATHS,
  education: EDUCATION_FIELD_PATHS,
  employment: ["hasPreviousEmployment", "employmentHistory"],
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
  const methods = useForm<
    IndiaOnboardingFormInput,
    unknown,
    IndiaOnboardingFormValues
  >({
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

  function findFirstEmploymentErrorPath(errs: typeof errors): string | null {
    const arr = errs.employmentHistory;

    // array-level error (rare) -> scroll to toggle / section
    if (!arr) return null;

    // RHF field array errors are usually: errors.employmentHistory[index].fieldName
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        const row = arr[i] as any;
        if (!row) continue;

        const order = [
          "organizationName",
          "designation",
          "startDate",
          "endDate",
          "reasonForLeaving",
          "experienceCertificateFile",
        ];

        for (const key of order) {
          if (row?.[key]?.message) {
            return `employmentHistory.${i}.${key}`;
          }
        }
      }
    }

    return null;
  }

  async function handleNext() {
    const stepId = STEP_IDS[currentIndex];

    // Custom gating for Employment step (dynamic field array)
    if (stepId === "employment") {
      const ok = await trigger(
        ["hasPreviousEmployment", "employmentHistory"] as any,
        { shouldFocus: false }
      );

      if (!ok) {
        // Scroll to the *first errored* employment field (not just the first field in the DOM)
        const firstEmploymentErrorPath = findFirstEmploymentErrorPath(errors);

        if (firstEmploymentErrorPath) {
          scrollToField(firstEmploymentErrorPath, "employment");
        } else {
          // fallback
          scrollToSection("employment");
        }

        return;
      }

      const nextIndex = Math.min(ONBOARDING_STEPS.length - 1, currentIndex + 1);
      onStepChange(nextIndex);
      scrollToSection(STEP_IDS[nextIndex]);
      return;
    }

    // Generic path for other steps
    const fieldPaths = STEP_FIELD_MAP[stepId] ?? [];

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
          <PersonalInfoSection
            onboarding={onboarding}
            isReadOnly={isReadOnly}
          />
        </section>

        {/* Step 2: Education */}
        <section
          ref={(el) => {
            sectionRefs.current.education = el;
          }}
          aria-label="Education"
        >
          {currentIndex >= 1 && <EducationSection isReadOnly={isReadOnly} />}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.employment = el;
          }}
          aria-label="Employment history"
        >
          {currentIndex >= 2 && (
            <EmploymentSection isReadOnly={isReadOnly} docId={onboarding.id} />
          )}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.banking = el;
          }}
          aria-label="Bank & payment details"
        >
          {currentIndex >= 3 && (
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
          {currentIndex >= 4 && (
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
          {currentIndex >= 5 && (
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
    education: [],
    employmentHistory: [],
    // bankDetails / declaration will be filled as we implement those sections
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
