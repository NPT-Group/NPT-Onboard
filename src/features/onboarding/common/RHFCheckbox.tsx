"use client";

import * as React from "react";
import { useFormContext, useController, type FieldPath } from "react-hook-form";

import type { IndiaOnboardingFormInput } from "../india/indiaFormSchema";
import { getErrorAtPath } from "./getErrorAtPath";
import { useRequiredField } from "./requiredFieldContext";

type RHFCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type" | "checked"
> & {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string | React.ReactNode;
};

export function RHFCheckbox({
  name,
  label,
  className,
  ...rest
}: RHFCheckboxProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormInput>();

  const { field } = useController({
    name,
    control,
    defaultValue: false as any,
  });

  const error = getErrorAtPath(errors, name);
  const errorMessage = error?.message as string | undefined;
  const isRequired = Boolean(useRequiredField(String(name)));

  return (
    <div className={className}>
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          data-field={name}
          checked={!!field.value}
          onChange={(e) => field.onChange(e.target.checked)}
          onBlur={field.onBlur}
          ref={field.ref}
          {...rest}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <span>
          {label}
          {isRequired && (
            <>
              <span className="ml-1 text-red-600" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </span>
      </label>
      {errorMessage && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
