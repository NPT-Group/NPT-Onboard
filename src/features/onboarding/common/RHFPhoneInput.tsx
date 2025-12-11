// src/features/onboarding/common/RHFPhoneInput.tsx
"use client";

import * as React from "react";
import { useFormContext, useWatch, type FieldPath } from "react-hook-form";

import { cn } from "@/lib/utils/cn";
import type { IndiaOnboardingFormValues } from "../india/indiaFormSchema";
import { FormField } from "./FormField";
import { getErrorAtPath } from "./getErrorAtPath";

type RHFPhoneInputProps = {
  name: FieldPath<IndiaOnboardingFormValues>;
  label: string;
  containerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Formats an Indian phone number as the user types.
 * Raw value is always stored as 10 digits in the form state.
 */
function formatIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function RHFPhoneInput({
  name,
  label,
  containerClassName,
  disabled,
  placeholder = "98765 43210",
}: RHFPhoneInputProps) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormValues>();

  const fieldError = getErrorAtPath(errors, name);
  const errorMessage = fieldError?.message?.toString();
  const hasError = Boolean(errorMessage);

  const rawValue = useWatch({
    control,
    name,
  }) as string | undefined;

  const displayValue = formatIndianPhone(rawValue ?? "");

  // Register to give RHF the ref + blur handler, but we manage value ourselves
  const { ref, onBlur } = register(name);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);

    setValue(name, digits, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <FormField
      label={label}
      htmlFor={name}
      error={errorMessage}
      className={containerClassName}
    >
      <div
        className={cn(
          "mt-1 flex items-stretch rounded-lg border bg-white text-sm shadow-sm",
          "border-slate-200 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-300",
          "overflow-hidden",
          disabled &&
            "bg-slate-50 text-slate-400 cursor-not-allowed shadow-none"
        )}
      >
        {/* Country code block */}
        <div
          className={cn(
            "flex items-center px-3 text-sm border-r bg-slate-50 text-slate-700",
            "border-slate-200"
          )}
        >
          +91
        </div>

        {/* Phone number input */}
        <input
          id={name}
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          aria-invalid={hasError || undefined}
          className={cn(
            "flex-1 border-none bg-transparent px-3 py-2 text-sm text-slate-900 outline-none",
            disabled && "cursor-not-allowed"
          )}
          value={displayValue}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
        />
      </div>
    </FormField>
  );
}
