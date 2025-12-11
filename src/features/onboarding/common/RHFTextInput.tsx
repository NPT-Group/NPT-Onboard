// src/features/onboarding/common/RHFTextInput.tsx
"use client";

import * as React from "react";
import { useFormContext, Controller, type FieldPath } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

import type { IndiaOnboardingFormValues } from "../india/indiaFormSchema";
import { FormField } from "./FormField";

type RHFTextInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name"
> & {
  name: FieldPath<IndiaOnboardingFormValues>;
  label: string;
  containerClassName?: string;
};

export function RHFTextInput({
  name,
  label,
  containerClassName,
  className,
  ...rest
}: RHFTextInputProps) {
  const { control } = useFormContext<IndiaOnboardingFormValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message?.toString();
        const hasError = Boolean(errorMessage);

        // Coerce RHF value to something Input accepts (we only use this
        // wrapper for scalar/text/date-like fields).
        const inputValue =
          (field.value as string | number | undefined | null) ?? "";

        return (
          <FormField
            label={label}
            htmlFor={name}
            error={errorMessage}
            className={containerClassName}
          >
            <Input
              id={name}
              data-field={name}
              name={field.name}
              ref={field.ref}
              aria-invalid={hasError || undefined}
              value={inputValue}
              onChange={field.onChange}
              onBlur={field.onBlur}
              {...rest}
              className={cn(
                "mt-1 text-sm",
                hasError &&
                  "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200",
                rest.disabled &&
                  "bg-slate-50 text-slate-400 cursor-not-allowed shadow-none",
                className
              )}
            />
          </FormField>
        );
      }}
    />
  );
}
