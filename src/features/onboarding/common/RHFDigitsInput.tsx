"use client";

import * as React from "react";
import { Controller, useFormContext, type FieldPath } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { FormField } from "./FormField";
import type { IndiaOnboardingFormInput } from "../india/indiaFormSchema";

type RHFDigitsInputProps = {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string;
  /** Max digits to store (e.g. Aadhaar = 12) */
  maxDigits: number;
  disabled?: boolean;
  placeholder?: string;
  containerClassName?: string;

  /**
   * Optional formatter for display only.
   * Stored value remains digits-only.
   */
  formatDigits?: (digits: string) => string;

  /**
   * Optional: if you want to show a prefix/addon (rare for digits),
   * pass a ReactNode (e.g. a badge). If not provided, input is full width.
   */
  leftAddon?: React.ReactNode;
};

export function RHFDigitsInput({
  name,
  label,
  maxDigits,
  disabled,
  placeholder,
  containerClassName,
  formatDigits,
  leftAddon,
}: RHFDigitsInputProps) {
  const { control } = useFormContext<IndiaOnboardingFormInput>();

  return (
    <Controller
      name={name as any}
      control={control}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message?.toString();
        const hasError = Boolean(errorMessage);

        const rawValue = (field.value as string | undefined) ?? "";
        const digitsOnly = rawValue.replace(/\D/g, "").slice(0, maxDigits);
        const displayValue = formatDigits
          ? formatDigits(digitsOnly)
          : digitsOnly;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
          field.onChange(digits); // store digits only
        };

        return (
          <FormField
            label={label}
            htmlFor={String(name)}
            error={errorMessage}
            className={containerClassName}
          >
            <div className={cn("flex gap-2", leftAddon ? "items-start" : "")}>
              {leftAddon}

              <Input
                id={String(name)}
                data-field={String(name)}
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
                  "mt-1 text-sm",
                  Boolean(leftAddon) && "flex-1",
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
