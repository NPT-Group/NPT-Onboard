"use client";

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

type OtpInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(
  ({ id, value, onChange, disabled }, ref) => {
    return (
      <Input
        id={id}
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder="6-digit code"
        required
        disabled={disabled}
      />
    );
  }
);

OtpInput.displayName = "OtpInput";
