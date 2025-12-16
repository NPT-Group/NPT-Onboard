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
  const [otpStep, setOtpStep] = useState<OtpStep>("idle");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const isInitialOtpStep = otpStep === "idle" || otpStep === "sending";
  const isVerifiedStep = otpStep === "verified";
  const isSending = otpStep === "sending";
  const isVerifying = otpStep === "verifying";

  // Focus OTP input whenever we transition into "code-sent" with modal open.
  useEffect(() => {
    if (open && otpStep === "code-sent" && otpInputRef.current) {
      otpInputRef.current.focus();
      otpInputRef.current.select?.();
    }
  }, [open, otpStep]);

  // Reset state when modal is closed.
  useEffect(() => {
    if (!open) {
      setOtpStep("idle");
      setOtpError(null);
      setOtp("");
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

      setOtpStep("idle");
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

      {/* Phase 1: Initial State - No code sent yet */}
      {isInitialOtpStep ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600 text-center">
            We&apos;ll send a 6-digit verification code to the email address
            used for your invitation when you&apos;re ready.
          </p>
          <Button className="w-full" onClick={sendOtp} isLoading={isSending}>
            Send verification code
          </Button>
        </div>
      ) : !isVerifiedStep ? (
        // Phase 2: Code Sent - Show input field and verification controls
        <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
          <p className="text-sm text-slate-600 text-center">
            We&apos;ve sent a 6-digit verification code
            {emailDisplay}. Enter the code below to continue to your onboarding
            form.
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

          {/* Action Buttons: Resend and Verify */}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={sendOtp}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Resend code"}
            </Button>
            <Button
              type="submit"
              isLoading={isVerifying}
              disabled={otp.length < 6}
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
        directly @HR@example.com
      </p>
    </Modal>
  );
};
