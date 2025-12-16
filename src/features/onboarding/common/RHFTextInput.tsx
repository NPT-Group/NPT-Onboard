// src/features/onboarding/common/RHFTextInput.tsx
"use client";

import * as React from "react";
import { useFormContext, Controller, type FieldPath } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

import type { IndiaOnboardingFormInput } from "../india/indiaFormSchema";
import { FormField } from "./FormField";

type RHFTextInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name"
> & {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string;
  containerClassName?: string;
  /**
   * Controls error visibility explicitly.
   * - `undefined` (default): Always show errors if they exist (standard behavior)
   * - `true`: Show errors if they exist
   * - `false`: Hide errors even if they exist
   *
   * Use this in sections where you want to gate errors until interaction/submit
   * (e.g., DeclarationSection with custom submit flow).
   */
  showErrors?: boolean;
};

export function RHFTextInput({
  name,
  label,
  containerClassName,
  className,
  showErrors,
  onBlur: externalOnBlur,
  ...rest
}: RHFTextInputProps) {
  const { control } = useFormContext<IndiaOnboardingFormInput>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const zodError = fieldState.error?.message?.toString();

        // Determine whether to show the error:
        // - If `showErrors` is explicitly provided (true/false), use that value
        // - If `showErrors` is undefined (default), ALWAYS show errors when they exist
        //   This preserves the original behavior for all existing usages (PersonalInfo, etc.)
        //   Only DeclarationSection opts into gated error display by passing showErrors prop
        const errorMessage =
          showErrors === undefined ? zodError : showErrors ? zodError : undefined;
        const hasError = Boolean(errorMessage);

        // Coerce RHF value to something Input accepts (we only use this
        // wrapper for scalar/text/date-like fields).
        const inputValue =
          (field.value as string | number | undefined | null) ?? "";

        // Compose RHF's onBlur with external onBlur handler
        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
          field.onBlur(); // RHF's blur handler (marks field as touched)
          externalOnBlur?.(e); // External handler (e.g., for tracking interaction)
        };

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
              onBlur={handleBlur}
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
