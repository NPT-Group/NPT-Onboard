"use client";

import React from "react";
import { Alert } from "@/components/ui/alert";

type OtpErrorBannerProps = {
  message: string | null;
};

export const OtpErrorBanner: React.FC<OtpErrorBannerProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="mt-3" role="alert" aria-live="assertive" aria-atomic="true">
      <Alert variant="error" description={message} />
    </div>
  );
};
