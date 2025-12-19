"use client";

import * as React from "react";
import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import type { IndiaOnboardingFormInput } from "../india/indiaFormSchema";
import { FormField } from "./FormField";

type RHFPhoneInputProps = {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string;
  countryCodePrefix?: string;
  maxDigits?: number;
  formatDigits?: (digits: string) => string;
  placeholder?: string;
  containerClassName?: string;
  disabled?: boolean;
};

function defaultFormatDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10)
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return digits;
}

export function RHFPhoneInput({
  name,
  label,
  countryCodePrefix = "+91",
  maxDigits = 10,
  formatDigits = defaultFormatDigits,
  placeholder,
  containerClassName,
  disabled,
}: RHFPhoneInputProps) {
  const { control } = useFormContext<IndiaOnboardingFormInput>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message?.toString();
        const hasError = Boolean(errorMessage);

        const rawValue = (field.value as string | undefined) ?? "";
        const clampedDigits = rawValue.slice(0, maxDigits);
        const displayValue = formatDigits(clampedDigits);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
          field.onChange(digits);
        };

        return (
          <FormField
            label={label}
            htmlFor={name}
            error={errorMessage}
            className={containerClassName}
          >
            <div className="flex w-full min-w-0 gap-2">
              <div className="mt-1 flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600">
                {countryCodePrefix}
              </div>

              <Input
                id={name}
                data-field={name}
                name={field.name}
                ref={field.ref}
                aria-invalid={hasError || undefined}
                value={displayValue}
                onChange={handleChange}
                onBlur={field.onBlur}
                disabled={disabled}
                inputMode="numeric"
                placeholder={placeholder}
                className={cn(
                  "mt-1 flex-1 min-w-0 text-sm",
                  hasError &&
                    "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200",
                  disabled &&
                    "bg-slate-50 text-slate-400 cursor-not-allowed shadow-none"
                )}
              />
            </div>
          </FormField>
        );
      }}
    />
  );
}
