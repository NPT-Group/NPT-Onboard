"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { useRequiredField } from "./requiredFieldContext";

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  children: React.ReactNode;
  error?: string;
  description?: string;
  className?: string;
  /** When true, show a red required indicator (*) next to the label */
  required?: boolean;
  /** Optional extra classes for the label (e.g. text-center) */
  labelClassName?: string;
  /** Optional extra classes for the error text */
  errorClassName?: string;
};

export function FormField({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
  required,
  labelClassName,
  errorClassName,
}: FormFieldProps) {
  const inferredRequired = useRequiredField(htmlFor);
  const showRequired = required ?? inferredRequired;

  return (
    // IMPORTANT:
    // Many sections use CSS grid. Grid items default to min-width:auto, which can cause
    // children (inputs, file cards, etc.) to overflow horizontally on narrow screens.
    // `min-w-0` ensures fields can shrink within their grid cell.
    <div className={cn("space-y-1.5 w-full min-w-0", className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className={cn("text-sm font-medium text-slate-800", labelClassName)}
        >
          {label}
          {showRequired && (
            <>
              <span className="ml-1 font-semibold text-red-600" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </Label>
      )}

      {children}

      {description && !error && (
        <p className="text-xs text-slate-500">{description}</p>
      )}

      {error && (
        <p className={cn("text-xs text-red-600", errorClassName)}>{error}</p>
      )}
    </div>
  );
}
