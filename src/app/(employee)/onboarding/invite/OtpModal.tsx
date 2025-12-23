"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { X } from "lucide-react";
import {
  requestOnboardingOtp,
  verifyOnboardingOtp,
} from "@/lib/api/onboarding";
import { ApiError } from "@/lib/api/client";
import { ESubsidiary } from "@/types/shared.types";
import { OtpErrorBanner } from "./OtpErrorBanner";
import { OtpInput } from "./OtpInput";
import { NEXT_PUBLIC_NPT_HR_EMAIL } from "@/config/publicEnv";

type OtpStep = "idle" | "sending" | "code-sent" | "verifying" | "verified";

type OtpModalProps = {
  open: boolean;
  onClose: () => void;
  inviteToken: string;
  /**
   * Callback fired once we know which subsidiary this invite belongs to.
   * Used by the parent to update Navbar/branding.
   */
  onSubsidiaryResolved?: (subsidiary: ESubsidiary) => void;
};

export const OtpModal: React.FC<OtpModalProps> = ({
  open,
  onClose,
  inviteToken,
  onSubsidiaryResolved,
}) => {
  // IMPORTANT UX:
  // Users may already have a valid OTP (e.g. they closed the modal by mistake).
  // So we default to showing the OTP entry UI whenever the modal opens.
  const [otpStep, setOtpStep] = useState<OtpStep>("code-sent");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const isVerifiedStep = otpStep === "verified";
  const isSending = otpStep === "sending";
  const isVerifying = otpStep === "verifying";

  // Focus OTP input whenever the modal opens on the code-entry screen.
  useEffect(() => {
    if (open && !isVerifiedStep && otpInputRef.current) {
      otpInputRef.current.focus();
      otpInputRef.current.select?.();
    }
  }, [open, isVerifiedStep]);

  // Reset state when modal is closed.
  useEffect(() => {
    if (!open) {
      setOtpError(null);
    }
  }, [open]);

  async function sendOtp() {
    setOtpError(null);
    setOtpStep("sending");

    try {
      const data = await requestOnboardingOtp(inviteToken);

      setEmail(data.email);

      if (onSubsidiaryResolved) {
        onSubsidiaryResolved(data.subsidiary);
      }

      setOtpStep("code-sent");
    } catch (err) {
      if (err instanceof ApiError) {
        const reason = err.meta && (err.meta as any).reason;

        if (err.status === 429 && reason === "OTP_THROTTLED") {
          const retryAfter = (err.meta as any).retryAfterSeconds;
          setOtpError(
            retryAfter
              ? `You requested a code too recently. Please wait ${retryAfter} seconds and try again.`
              : "You requested a code too recently. Please try again shortly."
          );
        } else if (err.status === 429 && reason === "OTP_LOCKED") {
          setOtpError(
            "Too many attempts have been made for this link. Please try again later or contact NPT HR."
          );
        } else {
          setOtpError(
            err.status === 400 || err.status === 404
              ? "This onboarding link is invalid or has expired. Please contact NPT HR for a new invitation."
              : err.message || "Something went wrong while sending the code."
          );
        }
      } else {
        setOtpError(
          "Unexpected error while sending the code. Please try again."
        );
      }

      // Keep the code-entry UI visible so users can still enter an already-valid OTP.
      setOtpStep("code-sent");
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpStep("verifying");

    try {
      const { onboardingContext } = await verifyOnboardingOtp(
        inviteToken,
        otp.trim()
      );

      setOtpStep("verified");
      window.location.assign(`/onboarding/${onboardingContext.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const reason = err.meta && (err.meta as any).reason;

        if (err.status === 400 && reason === "OTP_NOT_ISSUED") {
          setOtpError("No active verification code found. Please request a new code.");
          setOtp("");
        } else
        if (err.status === 400 && reason === "OTP_EXPIRED") {
          setOtpError(
            "This verification code has expired. Please request a new code."
          );
          setOtp("");
        } else if (err.status === 400 && reason === "OTP_INVALID") {
          setOtpError(
            "The verification code you entered is incorrect. Please try again."
          );
        } else if (err.status === 429 && reason === "OTP_LOCKED") {
          setOtpError(
            "Too many incorrect attempts. This onboarding has been temporarily locked. Please try again later or contact NPT HR."
          );
        } else {
          setOtpError(
            err.message || "Unable to verify the code. Please try again."
          );
        }
      } else {
        setOtpError(
          "Unexpected error while verifying the code. Please try again."
        );
      }

      // Stay on code entry view for retries
      setOtpStep("code-sent");
    }
  }

  const emailDisplay = useMemo(
    () =>
      email ? (
        <>
          {" "}
          to <span className="font-medium">{email}</span>
        </>
      ) : null,
    [email]
  );

  const sendLabel = email ? "Resend code" : "Send verification code";

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Verify your NPT onboarding invitation"
    >
      {/* Modal Header: Title and close button */}
      <div className="relative flex items-center justify-center pb-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 text-center">
          Verify your invitation
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>

      {/* Error Alert: Accessible, aria-live */}
      <OtpErrorBanner message={otpError} />

      {/* Code Entry: Always visible so users can enter an already-valid OTP */}
      {!isVerifiedStep ? (
        <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
          <p className="text-sm text-slate-600 text-center">
            Enter your 6-digit verification code{emailDisplay}. If you don&apos;t have a code,
            request one below.
          </p>

          {/* OTP Input Field */}
          <div className="space-y-1">
            <Label htmlFor="otp">Verification code</Label>
            <OtpInput
              id="otp"
              ref={otpInputRef}
              value={otp}
              onChange={setOtp}
              disabled={isVerifying}
            />
          </div>

          {/* Action Buttons: Send/Resend and Verify */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={sendOtp}
              disabled={isSending}
              className="w-full sm:w-auto"
            >
              {isSending ? "Sending..." : sendLabel}
            </Button>
            <Button
              type="submit"
              isLoading={isVerifying}
              disabled={otp.length < 6}
              className="w-full sm:w-auto"
            >
              Verify &amp; continue
            </Button>
          </div>
        </form>
      ) : (
        // Phase 3: Verified - Success state before redirect
        <div className="mt-4">
          <Alert
            variant="success"
            title="Verified"
            description="Your identity has been verified. Redirecting you to the onboarding form..."
          />
        </div>
      )}

      {/* Footer text: Contact information for help */}
      <p className="mt-4 text-xs text-slate-400 text-center">
        If you believe you received this email in error, please contact NPT HR
        {" "}
        directly at{" "}
        <a
          href={`mailto:${NEXT_PUBLIC_NPT_HR_EMAIL}`}
          className="underline underline-offset-2 hover:text-slate-500"
        >
          {NEXT_PUBLIC_NPT_HR_EMAIL}
        </a>
      </p>
    </Modal>
  );
};
