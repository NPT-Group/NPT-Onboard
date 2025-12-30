"use client";

import {
  useFormContext,
  useFieldArray,
  useWatch,
  type FieldPath,
} from "react-hook-form";

import type { IndiaOnboardingFormInput } from "../indiaFormSchema";
import { RHFTextInput } from "../../common/RHFTextInput";
import { RHFCheckbox } from "../../common/RHFCheckbox";
import { FormField } from "../../common/FormField";
import { cn } from "@/lib/utils/cn";
import { ES3Folder, ES3Namespace } from "@/types/aws.types";
import { RHFFileUpload } from "../../common/RHFFileUpload";

type EmploymentSectionProps = {
  isReadOnly?: boolean;
  docId: string; // onboarding.id
};

export function EmploymentSection({
  isReadOnly,
  docId,
}: EmploymentSectionProps) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "employmentHistory",
  });

  const hasPreviousEmployment = useWatch({
    control,
    name: "hasPreviousEmployment",
  }) as boolean | undefined;

  const hasPreviousEmploymentError = (
    errors.hasPreviousEmployment as { message?: string } | undefined
  )?.message;

  const employmentArrayError =
    (errors.employmentHistory as { message?: string } | undefined)?.message ??
    undefined;

  const ensureOneEntry = () => {
    if (fields.length === 0) {
      append({
        organizationName: "",
        designation: "",
        startDate: "",
        endDate: "",
        reasonForLeaving: "",
        experienceCertificateFile: null,
        employerReferenceCheck: false,
      } as any);
    }
  };

  const clearAllEntries = () => {
    if (fields.length === 0) return;
    for (let i = fields.length - 1; i >= 0; i--) remove(i);
  };

  const handleTogglePreviousEmployment = (value: boolean) => {
    setValue("hasPreviousEmployment", value as any, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (value) ensureOneEntry();
    else clearAllEntries();
  };

  const showEntries = hasPreviousEmployment === true;

  return (
    <div className="rounded-2xl px-4 py-6 shadow-sm sm:px-6 sm:py-7">
      <header className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Employment history (last 3 years)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Please provide your work/occupation history for the last 3 years. If
          one role doesn&apos;t cover the full 3 years, add additional entries (up
          to 3 total). If you were a student, unemployed, or in a non-traditional
          role during any part of this period, you can include that as an entry.
        </p>
      </header>

      <input
        type="hidden"
        data-field="hasPreviousEmployment"
        id="hasPreviousEmployment"
        {...register("hasPreviousEmployment" as any)}
      />

      <div className="mb-5">
        <FormField
          label="Do you have any previous employment?"
          htmlFor="hasPreviousEmployment"
          labelClassName="w-full text-center"
          error={hasPreviousEmploymentError ?? undefined}
          errorClassName="w-full text-center"
          className="flex flex-col items-center"
        >
          <div className="mt-2 flex justify-center">
            <div
              className={cn(
                "flex w-full max-w-xs overflow-hidden rounded-full border",
                "border-slate-300"
              )}
            >
              {[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ].map((opt, idx) => {
                const isActive = hasPreviousEmployment === opt.value;

                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleTogglePreviousEmployment(opt.value)}
                    className={cn(
                      "flex-1 min-w-0 px-4 py-2 text-sm font-medium transition-all",
                      idx > 0 && "border-l border-slate-300",
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-800 hover:bg-slate-50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/70",
                      isReadOnly && "cursor-not-allowed opacity-75"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </FormField>

        {employmentArrayError && (
          <p className="mt-1 text-xs text-red-600 text-center">
            {employmentArrayError}
          </p>
        )}
      </div>

      {hasPreviousEmployment === false && (
        <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-xs text-slate-600">
          You indicated that you don&apos;t have previous employment. You can
          still continue your onboarding without adding any roles.
        </div>
      )}

      {showEntries && (
        <div className="space-y-5">
          {fields.map((field, index) => {
            const prefix =
              `employmentHistory.${index}` as FieldPath<IndiaOnboardingFormInput>;

            return (
              <div
                key={field.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Employment {index + 1}
                  </h2>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={isReadOnly}
                      className="cursor-pointer text-xs font-medium text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <RHFTextInput
                    name={
                      `${prefix}.organizationName` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="Organization name"
                    disabled={isReadOnly}
                  />
                  <RHFTextInput
                    name={
                      `${prefix}.designation` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="Designation / role"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <RHFTextInput
                    name={
                      `${prefix}.startDate` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="Start date"
                    type="date"
                    disabled={isReadOnly}
                  />
                  <RHFTextInput
                    name={
                      `${prefix}.endDate` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="End date"
                    type="date"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="mt-4">
                  <RHFTextInput
                    name={
                      `${prefix}.reasonForLeaving` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="Reason for leaving"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="mt-4">
                  <RHFFileUpload
                    name={
                      `${prefix}.experienceCertificateFile` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="Experience certificate (optional)"
                    description="If you received any certification or experience certificate during this employment and wish to share it for credibility, you can attach it here at your preference. Upload a PDF file (max 20MB)."
                    namespace={ES3Namespace.ONBOARDINGS}
                    folder={ES3Folder.EMPLOYMENT_CERTIFICATES}
                    docId={docId}
                    disabled={isReadOnly}
                    dataField={`${prefix}.experienceCertificateFile`}
                    placeholderLabel="Upload PDF experience certificate (optional)"
                    maxSizeMB={20}
                  />
                </div>

                <div className="mt-4">
                  <RHFCheckbox
                    name={
                      `${prefix}.employerReferenceCheck` as FieldPath<IndiaOnboardingFormInput>
                    }
                    label="I confirm that NPT can contact this employer for reference check"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            );
          })}

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() =>
                append({
                  organizationName: "",
                  designation: "",
                  startDate: "",
                  endDate: "",
                  reasonForLeaving: "",
                  experienceCertificateFile: null,
                  employerReferenceCheck: false,
                } as any)
              }
              disabled={isReadOnly || fields.length >= 3}
              className="cursor-pointer rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add another role (max 3)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
