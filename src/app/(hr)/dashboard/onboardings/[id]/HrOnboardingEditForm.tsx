"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { indiaOnboardingFormSchema, type IndiaOnboardingFormInput, type IndiaOnboardingFormValues } from "@/features/onboarding/india/indiaFormSchema";
import { buildIndiaDefaultValuesFromOnboarding } from "@/features/onboarding/india/indiaDefaults";
import { normalizeIndiaFormDataForSubmit } from "@/features/onboarding/india/normalizeIndiaFormData";

import { RequiredFieldProvider } from "@/features/onboarding/common/requiredFieldContext";
import { isIndiaRequiredField } from "@/features/onboarding/india/requiredFields";
import { EEducationLevel } from "@/types/onboarding.types";
import { UpdateSubmitBar } from "@/components/dashboard/onboardings/UpdateSubmitBar";
import { updateAdminOnboarding } from "@/lib/api/admin/onboardings";
import { ApiError } from "@/lib/api/client";

import { PersonalInfoSection } from "@/features/onboarding/india/sections/PersonalInfoSection";
import { GovernmentIdsSection } from "@/features/onboarding/india/sections/GovernmentIdsSection";
import { EducationSection } from "@/features/onboarding/india/sections/EducationSection";
import { EmploymentSection } from "@/features/onboarding/india/sections/EmploymentSection";
import { BankDetailsSection } from "@/features/onboarding/india/sections/BankDetailsSection";
import {
  PERSONAL_INFO_FIELD_PATHS,
} from "@/features/onboarding/india/sections/PersonalInfoSection";
import {
  GOVERNMENT_IDS_FIELD_PATHS,
} from "@/features/onboarding/india/sections/GovernmentIdsSection";
import {
  EDUCATION_FIELD_PATHS,
} from "@/features/onboarding/india/sections/EducationSection";
import {
  DECLARATION_FIELD_PATHS,
} from "@/features/onboarding/india/sections/DeclarationSection";
import {
  findFirstErrorAcrossSteps,
  findFirstErrorInStep,
} from "@/features/onboarding/form-engine/errors";
import type { StepDef } from "@/features/onboarding/form-engine/types";
import { scrollToField, scrollToSection, type SectionRefs } from "@/features/onboarding/form-engine/scrolling";

import { cn } from "@/lib/utils/cn";
import { RHFCheckbox } from "@/features/onboarding/common/RHFCheckbox";
import { RHFTextInput } from "@/features/onboarding/common/RHFTextInput";
import { RHFSignatureBox } from "@/features/onboarding/common/RHFSignatureBox";
import { ES3Folder, ES3Namespace } from "@/types/aws.types";

type TabKey =
  | "summary"
  | "personal"
  | "governmentIds"
  | "education"
  | "employment"
  | "banking"
  | "declaration";

function findFirstEmploymentErrorPath(errs: any): string | null {
  if (errs?.hasPreviousEmployment?.message) return "hasPreviousEmployment";
  const arr = errs?.employmentHistory;
  if (!arr) return null;
  if (arr?.message) return "employmentHistory";
  if (Array.isArray(arr)) {
    const order = [
      "organizationName",
      "designation",
      "startDate",
      "endDate",
      "reasonForLeaving",
      "experienceCertificateFile",
    ];
    for (let i = 0; i < priorLengthSafe(arr); i++) {
      const row = arr[i];
      if (!row) continue;
      for (const key of order) {
        if (row?.[key]?.message) return `employmentHistory.${i}.${key}`;
      }
    }
  }
  return null;
}

function priorLengthSafe(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

export function HrOnboardingEditForm({
  onboardingId,
  onboarding,
  canEdit,
  onSaved,
  summaryNode,
}: {
  onboardingId: string;
  onboarding: any;
  canEdit: boolean;
  onSaved: (nextOnboarding: any) => void;
  summaryNode?: React.ReactNode;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const steps = useMemo(() => {
    const defs: StepDef<IndiaOnboardingFormInput, TabKey>[] = [
      { id: "summary", label: "Summary", fieldPaths: [] as any },
      { id: "personal", label: "Personal info", fieldPaths: PERSONAL_INFO_FIELD_PATHS as any },
      {
        id: "governmentIds",
        label: "Government IDs",
        fieldPaths: GOVERNMENT_IDS_FIELD_PATHS as any,
        nestedScrollPaths: [
          "governmentIds.aadhaar.aadhaarNumber",
          "governmentIds.aadhaar.file",
          "governmentIds.panCard.file",
          "governmentIds.passport.frontFile",
          "governmentIds.passport.backFile",
          "governmentIds.driversLicense.frontFile",
          "governmentIds.driversLicense.backFile",
        ],
      },
      { id: "education", label: "Education", fieldPaths: EDUCATION_FIELD_PATHS as any },
      {
        id: "employment",
        label: "Employment",
        fieldPaths: ["hasPreviousEmployment", "employmentHistory"] as any,
        findFirstErrorPath: (errs) => findFirstEmploymentErrorPath(errs as any),
      },
      {
        id: "banking",
        label: "Bank details",
        fieldPaths: ["bankDetails"] as any,
        nestedScrollPaths: [
          "bankDetails.bankName",
          "bankDetails.branchName",
          "bankDetails.accountHolderName",
          "bankDetails.accountNumber",
          "bankDetails.ifscCode",
          "bankDetails.upiId",
          "bankDetails.voidCheque",
        ],
      },
      { id: "declaration", label: "Declaration", fieldPaths: DECLARATION_FIELD_PATHS as any },
    ];
    return defs;
  }, []);

  const defaultValues = useMemo(
    () => buildIndiaDefaultValuesFromOnboarding(onboarding as any, today),
    [onboarding, today]
  );

  const methods = useForm<IndiaOnboardingFormInput, unknown, IndiaOnboardingFormValues>({
    resolver: zodResolver(indiaOnboardingFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
    shouldUnregister: false,
  });

  const {
    formState: { isDirty },
    reset,
    getValues,
    trigger,
  } = methods;

  const [activeIdx, setActiveIdx] = useState(0);
  const activeTab = steps[activeIdx]?.id ?? ("summary" as TabKey);

  const [saving, setSaving] = useState(false);
  const [barError, setBarError] = useState<string | null>(null);

  // Reset form when onboarding payload changes (e.g. refresh/save)
  useEffect(() => {
    // Important: update BOTH values and defaultValues so `isDirty` resets correctly.
    reset(defaultValues as any);
    setBarError(null);
  }, [defaultValues, reset]);

  // Conditional requiredness (same as employee form)
  const highestEducationLevel = (methods.watch("education.0.highestLevel") ??
    "") as EEducationLevel | "" | undefined;

  const isRequired = (path: string): boolean => {
    const p = String(path).replace(/\.\d+(?=\.|$)/g, ".*");
    if (p === "education.*.schoolName") return highestEducationLevel === EEducationLevel.PRIMARY_SCHOOL;
    if (p === "education.*.primaryYearCompleted") return highestEducationLevel === EEducationLevel.PRIMARY_SCHOOL;
    if (p === "education.*.highSchoolInstitutionName") return highestEducationLevel === EEducationLevel.HIGH_SCHOOL;
    if (p === "education.*.highSchoolYearCompleted") return highestEducationLevel === EEducationLevel.HIGH_SCHOOL;

    const isHigherEd =
      highestEducationLevel != null &&
      highestEducationLevel !== "" &&
      highestEducationLevel !== EEducationLevel.PRIMARY_SCHOOL &&
      highestEducationLevel !== EEducationLevel.HIGH_SCHOOL;
    if (p === "education.*.institutionName") return Boolean(isHigherEd);
    if (p === "education.*.fieldOfStudy") return Boolean(isHigherEd);
    if (p === "education.*.endYear") return Boolean(isHigherEd);

    return isIndiaRequiredField(path);
  };

  const sectionRefs = useRef<SectionRefs<TabKey>>({
    summary: null,
    personal: null,
    governmentIds: null,
    education: null,
    employment: null,
    banking: null,
    declaration: null,
  });

  const navigateTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setActiveIdx(clamped);
  };

  const handleStepClick = (idx: number) => {
    navigateTo(idx);
  };

  const handlePrev = () => navigateTo(activeIdx - 1);

  const handleNext = async () => {
    const step = steps[activeIdx];
    if (!step) return;

    // Summary is an overview tab, not a form section.
    if (step.id === "summary") {
      navigateTo(activeIdx + 1);
      return;
    }

    if (!canEdit) {
      navigateTo(activeIdx + 1);
      return;
    }

    setBarError(null);
    const ok = await trigger(step.fieldPaths as any, { shouldFocus: false });
    if (!ok) {
      setBarError("Fix the errors in this section before continuing.");
      // Scroll to the first error like employee flow (resolver updates errors async).
      setTimeout(() => {
        const errs = methods.formState.errors;
        const firstPath = findFirstErrorInStep(step as any, errs as any);
        if (firstPath) scrollToField(firstPath, step.id, sectionRefs as any, { delayMs: 0 });
        else scrollToSection(step.id, sectionRefs as any, { delayMs: 0 });
      }, 0);
      return;
    }

    navigateTo(activeIdx + 1);
  };

  const onSave = async () => {
    if (!canEdit) return;
    setBarError(null);

    // HR can access any section, so validate the full payload before saving.
    const stepsToValidate = steps.filter((s) => s.id !== "summary");
    const ok = await trigger(undefined, {
      shouldFocus: false,
    });
    if (!ok) {
      // Jump + scroll to the first section with an error (mirrors employee behavior).
      setTimeout(() => {
        const errs = methods.formState.errors as any;
        const n = countErrors(errs);
        setBarError(n > 0 ? `Fix ${n} field(s) before saving.` : "Fix validation errors before saving.");

        const first = findFirstErrorAcrossSteps(stepsToValidate as any, errs as any) as any;
        const stepId = first?.stepId as TabKey | undefined;
        const errorPath = first?.errorPath as string | null | undefined;
        if (stepId) {
          const idx = steps.findIndex((s) => s.id === stepId);
          if (idx >= 0) {
            navigateTo(idx);
            if (errorPath) {
              setTimeout(() => {
                scrollToField(errorPath, stepId, sectionRefs as any, { delayMs: 0 });
              }, 80);
            }
          }
        }
      }, 0);
      return;
    }

    setSaving(true);
    try {
      const values = getValues() as IndiaOnboardingFormValues;
      const normalized = normalizeIndiaFormDataForSubmit(values);

      const res = await updateAdminOnboarding(onboardingId, {
        indiaFormData: normalized as any,
      });

      onSaved(res.onboarding);
      // reset dirty state to the newly saved values
      const nextDefaults = buildIndiaDefaultValuesFromOnboarding(res.onboarding as any, today);
      // Important: update BOTH values and defaultValues so `isDirty` becomes false after save.
      reset(nextDefaults as any);
      setBarError(null);
    } catch (e) {
      setBarError(e instanceof ApiError ? e.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    // Important: revert values and defaultValues so `isDirty` becomes false after discard.
    reset(defaultValues as any);
    setBarError(null);
  };

  const showUpdateBar =
    activeTab !== "summary" || isDirty || Boolean(barError) || saving;

  return (
    <FormProvider {...methods}>
      <RequiredFieldProvider isRequired={isRequired}>
        <div className="space-y-4">
          {/* Mobile: ONLY the update bar is sticky (tabs scroll away to save space) */}
          {showUpdateBar && (
            <div className="sticky top-16 z-20 mb-3 sm:hidden bg-[var(--dash-bg)]/75 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--dash-bg)]/60">
              <UpdateSubmitBar
                dirty={isDirty}
                busy={saving}
                errorMessage={barError}
                onSubmit={onSave}
                onDiscard={onDiscard}
                placement="top"
                sticky={false}
              />
            </div>
          )}

          {/* sm+: tabs + update bar behave like a single sticky stack */}
          <div className="space-y-3 pb-2 sm:sticky sm:top-16 sm:z-20 sm:bg-[var(--dash-bg)]/75 sm:backdrop-blur-xl sm:supports-[backdrop-filter]:bg-[var(--dash-bg)]/60">
            {/* Tabs */}
            <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] p-2">
              <div className="flex flex-wrap gap-2">
                {steps.map((s, idx) => (
                  <TabButton
                    key={s.id}
                    active={activeIdx === idx}
                    onClick={() => handleStepClick(idx)}
                  >
                    {s.label}
                  </TabButton>
                ))}
              </div>
            </div>

            {/* Update bar (non-sticky; parent provides sticky stacking) */}
            {showUpdateBar && (
              <div className="hidden sm:block">
                <UpdateSubmitBar
                  dirty={isDirty}
                  busy={saving}
                  errorMessage={barError}
                  onSubmit={onSave}
                  onDiscard={onDiscard}
                  placement="top"
                  sticky={false}
                />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] p-5">
            {!canEdit && (
              <div className="mb-4 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-2)] p-3 text-sm text-[var(--dash-muted)]">
                Editing is disabled because this onboarding is terminated.
              </div>
            )}

            {/* Skin employee-side sections to match dashboard theme (esp. dark mode) */}
            <div className="dash-form-skin">
              {activeTab === "summary" && (
                <div
                  className="space-y-4"
                  ref={(el) => {
                    sectionRefs.current.summary = el;
                  }}
                >
                  {summaryNode ? (
                    summaryNode
                  ) : (
                    <div className="text-sm text-[var(--dash-muted)]">
                      Use the tabs above to review and edit the onboarding details. Changes are saved via the admin update route.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "personal" && (
                <div
                  className="rounded-2xl bg-[var(--dash-surface)]"
                  ref={(el) => {
                    sectionRefs.current.personal = el;
                  }}
                >
                  <PersonalInfoSection onboarding={onboarding as any} isReadOnly={!canEdit} />
                </div>
              )}

              {activeTab === "governmentIds" && (
                <div
                  ref={(el) => {
                    sectionRefs.current.governmentIds = el;
                  }}
                >
                  <GovernmentIdsSection isReadOnly={!canEdit} docId={onboardingId} />
                </div>
              )}

              {activeTab === "education" && (
                <div
                  ref={(el) => {
                    sectionRefs.current.education = el;
                  }}
                >
                  <EducationSection isReadOnly={!canEdit} />
                </div>
              )}

              {activeTab === "employment" && (
                <div
                  ref={(el) => {
                    sectionRefs.current.employment = el;
                  }}
                >
                  <EmploymentSection isReadOnly={!canEdit} docId={onboardingId} />
                </div>
              )}

              {activeTab === "banking" && (
                <div
                  ref={(el) => {
                    sectionRefs.current.banking = el;
                  }}
                >
                  <BankDetailsSection isReadOnly={!canEdit} docId={onboardingId} />
                </div>
              )}

              {activeTab === "declaration" && (
                <div
                  ref={(el) => {
                    sectionRefs.current.declaration = el;
                  }}
                >
                  <HrDeclarationSection onboardingId={onboardingId} canEdit={canEdit} />
                </div>
              )}
            </div>

            {/* Step controls (mirror employee "Next/Back" gating) */}
            {activeTab !== "summary" && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={activeIdx === 0}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                    "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                    activeIdx === 0 ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  Back
                </button>

                {activeIdx < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-semibold transition",
                      "bg-[var(--dash-red)] text-white hover:opacity-95 cursor-pointer"
                    )}
                  >
                    Next
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </RequiredFieldProvider>
    </FormProvider>
  );
}

function TabButton({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl px-3 py-2 text-xs font-semibold transition",
        "cursor-pointer",
        active
          ? "bg-[var(--dash-red-soft)] text-[var(--dash-text)]"
          : "bg-[var(--dash-surface)] text-[var(--dash-muted)] hover:bg-[var(--dash-surface-2)] hover:text-[var(--dash-text)]",
        disabled &&
          "opacity-50 cursor-not-allowed hover:bg-[var(--dash-surface)] hover:text-[var(--dash-muted)]"
      )}
    >
      {children}
    </button>
  );
}

function HrDeclarationSection({ onboardingId, canEdit }: { onboardingId: string; canEdit: boolean }) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-[var(--dash-muted)]">
        HR can update the declaration fields and signature. (No Turnstile required for HR.)
      </div>

      <RHFTextInput
        name={"declaration.declarationDate" as any}
        label="Declaration date"
        type="date"
        disabled={!canEdit}
      />

      <div className="flex items-center">
        <RHFCheckbox
          name={"declaration.hasAcceptedDeclaration" as any}
          label="I accept the declaration and confirm the information is true and complete."
          disabled={!canEdit}
        />
      </div>

      <RHFSignatureBox
        name={"declaration.signature.file" as any}
        signedAtName={"declaration.signature.signedAt" as any}
        label="Signature"
        namespace={ES3Namespace.ONBOARDINGS}
        folder={ES3Folder.DECLARATION_SIGNATURE}
        docId={onboardingId}
        disabled={!canEdit}
        dataField="declaration.signature.file"
        forceShowErrors
        showTouchedErrors
        requireExplicitSave={false}
      />
    </div>
  );
}

function countErrors(errs: any): number {
  if (!errs || typeof errs !== "object") return 0;
  let n = 0;
  const walk = (v: any) => {
    if (!v) return;
    if (typeof v === "object") {
      if (typeof v.message === "string") n += 1;
      Object.values(v).forEach(walk);
    }
  };
  walk(errs);
  return n;
}


