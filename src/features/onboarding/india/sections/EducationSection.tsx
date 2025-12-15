"use client";

import {
  useWatch,
  useFormContext,
  Controller,
  type FieldPath,
} from "react-hook-form";
import { useEffect, useRef } from "react";
import { EEducationLevel } from "@/types/onboarding.types";
import type { IndiaOnboardingFormInput } from "../indiaFormSchema";

import { RHFSelect } from "../../common/RHFSelect";
import { RHFTextInput } from "../../common/RHFTextInput";
import { FormField } from "../../common/FormField";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export const EDUCATION_FIELD_PATHS: FieldPath<IndiaOnboardingFormInput>[] = [
  "education.0.highestLevel",
  "education.0.schoolName",
  "education.0.schoolLocation",
  "education.0.primaryYearCompleted",
  "education.0.highSchoolInstitutionName",
  "education.0.highSchoolBoard",
  "education.0.highSchoolStream",
  "education.0.highSchoolYearCompleted",
  "education.0.highSchoolGradeOrPercentage",
  "education.0.institutionName",
  "education.0.universityOrBoard",
  "education.0.fieldOfStudy",
  "education.0.startYear",
  "education.0.endYear",
  "education.0.gradeOrCgpa",
];

type EducationSectionProps = {
  isReadOnly?: boolean;
};

const EDUCATION_LEVEL_OPTIONS: { value: EEducationLevel; label: string }[] = [
  { value: EEducationLevel.PRIMARY_SCHOOL, label: "Primary school" },
  { value: EEducationLevel.HIGH_SCHOOL, label: "High school / Secondary" },
  { value: EEducationLevel.DIPLOMA, label: "Diploma" },
  { value: EEducationLevel.BACHELORS, label: "Bachelor's degree" },
  { value: EEducationLevel.MASTERS, label: "Master's degree" },
  { value: EEducationLevel.DOCTORATE, label: "Doctorate / PhD" },
  { value: EEducationLevel.OTHER, label: "Other" },
];

type NumberFieldProps = {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
};

function NumberField({
  name,
  label,
  disabled,
  min,
  max,
  placeholder,
}: NumberFieldProps) {
  const { control } = useFormContext<IndiaOnboardingFormInput>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message?.toString();
        const hasError = Boolean(errorMessage);

        const inputValue =
          field.value === undefined || field.value === null
            ? ""
            : String(field.value);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;

          if (raw === "") {
            field.onChange(undefined);
            return;
          }

          const num = Number(raw);
          field.onChange(Number.isNaN(num) ? undefined : num);
        };

        return (
          <FormField
            label={label}
            htmlFor={name}
            error={errorMessage}
            className="w-full"
          >
            <Input
              id={name}
              type="number"
              inputMode="numeric"
              data-field={name}
              disabled={disabled}
              placeholder={placeholder}
              min={min}
              max={max}
              value={inputValue}
              onChange={handleChange}
              onBlur={field.onBlur}
              className={cn(
                "mt-1 block w-full rounded-lg bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400",
                hasError &&
                  "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200",
                disabled &&
                  "bg-slate-50 text-slate-400 cursor-not-allowed shadow-none"
              )}
            />
          </FormField>
        );
      }}
    />
  );
}

export function EducationSection({ isReadOnly }: EducationSectionProps) {
  const { control, setValue } = useFormContext<IndiaOnboardingFormInput>();

  const highestLevel = useWatch({
    control,
    name: "education.0.highestLevel",
  }) as EEducationLevel | undefined;

  // Production safety: keep form payload aligned with backend strict validation.
  // When the education level changes, clear fields that are no longer applicable,
  // so we don't submit stale values that backend rejects.
  const prevLevelRef = useRef<EEducationLevel | undefined>(undefined);

  useEffect(() => {
    const level = highestLevel;
    const prev = prevLevelRef.current;
    if (!level || level === prev) return;
    prevLevelRef.current = level;

    const clear = (path: FieldPath<IndiaOnboardingFormInput>) => {
      setValue(path as any, undefined as any, { shouldDirty: true, shouldValidate: false });
    };

    if (level === EEducationLevel.PRIMARY_SCHOOL) {
      // Clear high school + diploma/bachelor+ fields
      clear("education.0.highSchoolInstitutionName");
      clear("education.0.highSchoolBoard");
      clear("education.0.highSchoolStream");
      clear("education.0.highSchoolYearCompleted");
      clear("education.0.highSchoolGradeOrPercentage");

      clear("education.0.institutionName");
      clear("education.0.universityOrBoard");
      clear("education.0.fieldOfStudy");
      clear("education.0.startYear");
      clear("education.0.endYear");
      clear("education.0.gradeOrCgpa");
    } else if (level === EEducationLevel.HIGH_SCHOOL) {
      // Clear primary + diploma/bachelor+ fields
      clear("education.0.schoolName");
      clear("education.0.schoolLocation");
      clear("education.0.primaryYearCompleted");

      clear("education.0.institutionName");
      clear("education.0.universityOrBoard");
      clear("education.0.fieldOfStudy");
      clear("education.0.startYear");
      clear("education.0.endYear");
      clear("education.0.gradeOrCgpa");
    } else {
      // Diploma / Bachelor / Masters / Doctorate / Other
      // Clear primary + high school fields
      clear("education.0.schoolName");
      clear("education.0.schoolLocation");
      clear("education.0.primaryYearCompleted");

      clear("education.0.highSchoolInstitutionName");
      clear("education.0.highSchoolBoard");
      clear("education.0.highSchoolStream");
      clear("education.0.highSchoolYearCompleted");
      clear("education.0.highSchoolGradeOrPercentage");
    }
  }, [highestLevel, setValue]);

  return (
    <div className="rounded-2xl px-4 py-6 shadow-sm sm:px-6 sm:py-7">
      <header className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Education
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tell us about your highest completed level of education.
        </p>
      </header>

      <div className="space-y-6">
        <RHFSelect
          name="education.0.highestLevel"
          label="Highest level of education completed"
          placeholder="Select level"
          options={EDUCATION_LEVEL_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          disabled={isReadOnly}
          errorMessageOverride="Please select your highest level of education."
        />

        {highestLevel === EEducationLevel.PRIMARY_SCHOOL && (
          <div className="grid gap-4 sm:grid-cols-2">
            <RHFTextInput
              name="education.0.schoolName"
              label="School name"
              disabled={isReadOnly}
            />
            <RHFTextInput
              name="education.0.schoolLocation"
              label="School location (city, state)"
              disabled={isReadOnly}
            />
            <NumberField
              name="education.0.primaryYearCompleted"
              label="Year completed"
              placeholder="e.g. 2010"
              min={1900}
              max={2100}
              disabled={isReadOnly}
            />
          </div>
        )}

        {highestLevel === EEducationLevel.HIGH_SCHOOL && (
          <div className="grid gap-4 sm:grid-cols-2">
            <RHFTextInput
              name="education.0.highSchoolInstitutionName"
              label="High school / secondary institution name"
              disabled={isReadOnly}
            />
            <RHFTextInput
              name="education.0.highSchoolBoard"
              label="Board / curriculum"
              disabled={isReadOnly}
            />
            <RHFTextInput
              name="education.0.highSchoolStream"
              label="Stream (e.g. Science, Commerce, Arts)"
              disabled={isReadOnly}
            />
            <NumberField
              name="education.0.highSchoolYearCompleted"
              label="Year completed"
              placeholder="e.g. 2016"
              min={1900}
              max={2100}
              disabled={isReadOnly}
            />
            <RHFTextInput
              name="education.0.highSchoolGradeOrPercentage"
              label="Final grade / percentage"
              disabled={isReadOnly}
            />
          </div>
        )}

        {highestLevel &&
          highestLevel !== EEducationLevel.PRIMARY_SCHOOL &&
          highestLevel !== EEducationLevel.HIGH_SCHOOL && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <RHFTextInput
                  name="education.0.institutionName"
                  label="Institution name"
                  disabled={isReadOnly}
                />
                <RHFTextInput
                  name="education.0.universityOrBoard"
                  label="University / board"
                  disabled={isReadOnly}
                />
              </div>
              <RHFTextInput
                name="education.0.fieldOfStudy"
                label="Field of study"
                disabled={isReadOnly}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  name="education.0.startYear"
                  label="Start year"
                  placeholder="e.g. 2018"
                  min={1900}
                  max={2100}
                  disabled={isReadOnly}
                />
                <NumberField
                  name="education.0.endYear"
                  label="Year completed / expected"
                  placeholder="e.g. 2022"
                  min={1900}
                  max={2100}
                  disabled={isReadOnly}
                />
              </div>
              <RHFTextInput
                name="education.0.gradeOrCgpa"
                label="Final grade / CGPA"
                disabled={isReadOnly}
              />
            </div>
          )}
      </div>
    </div>
  );
}
