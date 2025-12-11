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
};

export function FormField({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">
          {label}
        </Label>
      )}
      {children}
      {description && !error && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
