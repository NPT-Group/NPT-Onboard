"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  children: React.ReactNode;
  error?: string;
  description?: string;
  className?: string;
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
  labelClassName,
  errorClassName,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className={cn("text-sm font-medium text-slate-800", labelClassName)}
        >
          {label}
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
