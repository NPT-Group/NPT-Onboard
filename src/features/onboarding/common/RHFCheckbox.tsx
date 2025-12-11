"use client";

import * as React from "react";
import { useFormContext, type FieldPath } from "react-hook-form";

import type { IndiaOnboardingFormValues } from "../india/indiaFormSchema";
import { getErrorAtPath } from "./getErrorAtPath";

type RHFCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type"
> & {
  name: FieldPath<IndiaOnboardingFormValues>;
  label: string | React.ReactNode;
};

export function RHFCheckbox({ name, label, ...rest }: RHFCheckboxProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormValues>();

  const fieldError = getErrorAtPath(errors, name);
  const errorMessage = fieldError?.message?.toString();

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          data-field={name}
          {...register(name)}
          {...rest}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <span>{label}</span>
      </label>
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
    </div>
  );
}
