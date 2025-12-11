"use client";

import * as React from "react";
import { useFormContext, type FieldPath } from "react-hook-form";
import { cn } from "@/lib/utils/cn";

import type { IndiaOnboardingFormValues } from "../india/indiaFormSchema";
import { FormField } from "./FormField";
import { getErrorAtPath } from "./getErrorAtPath";

type RHFSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: FieldPath<IndiaOnboardingFormValues>;
  label: string;
  containerClassName?: string;
};

export function RHFSelect({
  name,
  label,
  containerClassName,
  className,
  children,
  ...rest
}: RHFSelectProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormValues>();

  const fieldError = getErrorAtPath(errors, name);
  const errorMessage = fieldError?.message?.toString();

  return (
    <FormField
      label={label}
      htmlFor={name}
      error={errorMessage}
      className={containerClassName}
    >
      <select
        id={name}
        data-field={name}
        {...register(name)}
        {...rest}
        className={cn(
          "mt-1 block w-full rounded-lg bg-white px-3 py-2 text-sm",
          "shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400",
          rest.disabled && "bg-slate-50 text-slate-400 cursor-not-allowed",
          className
        )}
      >
        {children}
      </select>
    </FormField>
  );
}
