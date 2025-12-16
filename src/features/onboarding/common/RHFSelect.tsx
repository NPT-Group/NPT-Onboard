"use client";

import * as React from "react";
import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import { cn } from "@/lib/utils/cn";

import type { IndiaOnboardingFormInput } from "../india/indiaFormSchema";
import { FormField } from "./FormField";

type Option = {
  value: string;
  label: string;
};

type RHFSelectProps = {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string;
  options: Option[];
  placeholder?: string;
  containerClassName?: string;
  disabled?: boolean;
  /** Optional: override whatever Zod says with a custom message */
  errorMessageOverride?: string;
};

export function RHFSelect({
  name,
  label,
  options,
  placeholder,
  containerClassName,
  disabled,
  errorMessageOverride,
}: RHFSelectProps) {
  const { control } = useFormContext<IndiaOnboardingFormInput>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        const errorMessage = hasError
          ? errorMessageOverride ?? fieldState.error?.message?.toString()
          : undefined;

        const value = (field.value as string | undefined) ?? "";
        const selectedOption = options.find((opt) => opt.value === value);

        const [open, setOpen] = React.useState(false);
        const wrapperRef = React.useRef<HTMLDivElement | null>(null);
        // Close on outside click or Escape
        React.useEffect(() => {
          function onClickOutside(e: MouseEvent) {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(e.target as Node)) {
              setOpen(false);
            }
          }

          function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
          }

          document.addEventListener("mousedown", onClickOutside);
          document.addEventListener("keydown", onKeyDown);
          return () => {
            document.removeEventListener("mousedown", onClickOutside);
            document.removeEventListener("keydown", onKeyDown);
          };
        }, []);

        const handleSelect = (val: string) => {
          field.onChange(val);
          setOpen(false);
        };

        return (
          <FormField
            label={label}
            htmlFor={name}
            error={errorMessage}
            className={containerClassName}
          >
            <div ref={wrapperRef} className="relative">
              {/* Trigger */}
              <button
                type="button"
                id={name}
                data-field={name}
                onClick={() => !disabled && setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-invalid={hasError || undefined}
                disabled={disabled}
                className={cn(
                  "mt-1 flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm",
                  "border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-200 focus:border-sky-400",
                  hasError &&
                    "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200",
                  disabled &&
                    "bg-slate-50 text-slate-400 cursor-not-allowed shadow-none"
                )}
              >
                <span
                  className={cn(
                    "truncate",
                    !selectedOption && "text-slate-400"
                  )}
                >
                  {selectedOption?.label ?? placeholder ?? "Select"}
                </span>
                <span
                  className={cn(
                    "ml-2 inline-flex h-4 w-4 items-center justify-center text-slate-400 transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              {/* Dropdown */}
              <div
                className={cn(
                  "absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white text-sm shadow-lg",
                  "origin-top transform transition-all duration-150 ease-out",
                  open
                    ? "scale-100 opacity-100"
                    : "pointer-events-none scale-95 opacity-0"
                )}
                role="listbox"
                aria-labelledby={name}
              >
                {options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "flex w-full cursor-pointer items-center px-3 py-2 text-left",
                        "hover:bg-slate-50",
                        isSelected && "bg-slate-100 font-medium"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </FormField>
        );
      }}
    />
  );
}
