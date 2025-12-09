/**
 * Onboarding Invite Screen Component
 * 
 * Main landing page for employee onboarding invitations. Displays a welcome screen
 * with onboarding information and manages the OTP (One-Time Password) verification
 * flow via a modal interface.
 * 
 * This component handles:
 * - Initial welcome screen with onboarding instructions
 * - OTP request and verification workflow
 * - Error handling for various OTP-related scenarios (throttling, expiration, etc.)
 * - Navigation to the actual onboarding form after successful verification
 * 
 * @fileoverview Employee onboarding invitation screen with OTP verification flow.
 * 
 * @component
 * @example
 * <OnboardingInviteScreen inviteToken="abc123..." />
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { X } from "lucide-react";
import {
  requestOnboardingOtp,
  verifyOnboardingOtp,
} from "@/lib/api/onboarding";
import { ApiError } from "@/lib/api/client";
import { ESubsidiary } from "@/types/shared.types";
import { subsidiaryContent } from "@/config/subsidiaries";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

/**
 * Component Props
 * 
 * @interface Props
 */
type Props = {
  /** Invitation token from the onboarding invitation URL query parameter */
  inviteToken: string;
};

/**
 * View State Type
 * 
 * Controls which main view is displayed:
 * - "welcome": Initial welcome screen with onboarding information
 * - "otp-modal": OTP verification modal overlay
 */
type ViewState = "welcome" | "otp-modal";

/**
 * OTP Step State Type
 * 
 * Tracks the current stage of the OTP verification workflow:
 * - "idle": Initial state, no OTP request made yet
 * - "sending": OTP request is in progress
 * - "code-sent": OTP has been successfully sent to user's email
 * - "verifying": OTP verification is in progress
 * - "verified": OTP verification successful, redirecting to onboarding form
 */
type OtpStep = "idle" | "sending" | "code-sent" | "verifying" | "verified";

/**
 * Onboarding Invite Screen Component
 * 
 * Main component for the employee onboarding invitation landing page.
 * Manages the welcome screen display and OTP verification modal workflow.
 * 
 * @param {Props} props - Component props containing the invitation token
 * @returns {JSX.Element} Full-page onboarding invitation UI with OTP verification
 */
export function OnboardingInviteScreen({ inviteToken }: Props) {
  // ==================================================================
  // State Management
  // ==================================================================

  /** Current view state: welcome screen or OTP modal */
  const [view, setView] = useState<ViewState>("welcome");
  
  /** Current step in the OTP verification workflow */
  const [otpStep, setOtpStep] = useState<OtpStep>("idle");

  /** Subsidiary information retrieved from API (set after OTP request) */
  const [subsidiary, setSubsidiary] = useState<ESubsidiary | null>(null);
  
  /** User email address retrieved from API (set after OTP request) */
  const [email, setEmail] = useState<string | null>(null);

  /** Error message to display in the OTP modal (null if no error) */
  const [otpError, setOtpError] = useState<string | null>(null);
  
  /** Current OTP code value entered by the user */
  const [otp, setOtp] = useState("");

  // ==================================================================
  // Computed Values
  // ==================================================================

  /**
   * Resolved subsidiary code - defaults to INDIA if not yet retrieved from API.
   * This ensures the UI always has a valid subsidiary for display purposes.
   */
  const resolvedSubsidiary = subsidiary ?? ESubsidiary.INDIA;
  
  /**
   * Subsidiary-specific content configuration (name, branding, etc.)
   */
  const content = subsidiaryContent[resolvedSubsidiary];
  
  /**
   * Display name for the region, extracted from subsidiary name.
   * Example: "NPT India" -> "India"
   */
  const regionName = content.name.replace(/^NPT\s+/i, "");

  /** Computed flag: true when OTP modal should be displayed */
  const isOtpModalOpen = view === "otp-modal";

  // ==================================================================
  // Modal Control Functions
  // ==================================================================

  /**
   * Opens the OTP verification modal and resets related state.
   * Called when user clicks "Continue" on the welcome screen.
   */
  function openOtpModal() {
    setView("otp-modal");
    setOtpStep("idle");
    setOtpError(null);
    setOtp("");
  }

  /**
   * Closes the OTP verification modal and returns to welcome screen.
   * Resets all OTP-related state to initial values.
   */
  function closeOtpModal() {
    setView("welcome");
    setOtpStep("idle");
    setOtpError(null);
    setOtp("");
  }

  // ==================================================================
  // OTP Request Handler
  // ==================================================================

  /**
   * Sends an OTP (One-Time Password) to the user's email address.
   * 
   * Flow:
   * 1. Clears any previous errors
   * 2. Sets loading state ("sending")
   * 3. Makes API request with invitation token
   * 4. On success: stores email/subsidiary and moves to "code-sent" state
   * 5. On error: handles various error scenarios with user-friendly messages
   * 
   * Error Handling:
   * - 429 + OTP_THROTTLED: Rate limiting - shows retry countdown if available
   * - 429 + OTP_LOCKED: Too many attempts - account temporarily locked
   * - 400/404: Invalid or expired invitation link
   * - Other errors: Generic error message
   * 
   * @async
   * @throws {ApiError} When API request fails (handled internally)
   */
  async function sendOtp() {
    setOtpError(null);
    setOtpStep("sending");

    try {
      // Request OTP from backend API
      const data = await requestOnboardingOtp(inviteToken);
      
      // Store retrieved information for display in UI
      setEmail(data.email);
      setSubsidiary(data.subsidiary);
      
      // Move to code-sent state to show input field
      setOtpStep("code-sent");
    } catch (err) {
      // Handle API errors with specific error messages
      if (err instanceof ApiError) {
        const reason = err.meta && (err.meta as any).reason;

        // Rate limiting: user requested code too recently
        if (err.status === 429 && reason === "OTP_THROTTLED") {
          const retryAfter = (err.meta as any).retryAfterSeconds;
          setOtpError(
            retryAfter
              ? `You requested a code too recently. Please wait ${retryAfter} seconds and try again.`
              : "You requested a code too recently. Please try again shortly."
          );
        } 
        // Account locked: too many attempts
        else if (err.status === 429 && reason === "OTP_LOCKED") {
          setOtpError(
            "Too many attempts have been made for this link. Please try again later or contact NPT HR."
          );
        } 
        // Invalid or expired invitation link
        else {
          setOtpError(
            err.status === 400 || err.status === 404
              ? "This onboarding link is invalid or has expired. Please contact NPT HR for a new invitation."
              : err.message || "Something went wrong while sending the code."
          );
        }
      } 
      // Unexpected error (network, etc.)
      else {
        setOtpError(
          "Unexpected error while sending the code. Please try again."
        );
      }
      // Reset to idle state on error so user can retry
      setOtpStep("idle");
    }
  }

  // ==================================================================
  // OTP Verification Handler
  // ==================================================================

  /**
   * Verifies the OTP code entered by the user.
   * 
   * Flow:
   * 1. Prevents form default submission
   * 2. Clears any previous errors
   * 3. Sets loading state ("verifying")
   * 4. Makes API request with token and trimmed OTP code
   * 5. On success: moves to "verified" state and redirects to onboarding form
   * 6. On error: handles various error scenarios with user-friendly messages
   * 
   * Error Handling:
   * - 400 + OTP_EXPIRED: Code has expired, user must request new one
   * - 400 + OTP_INVALID: Incorrect code entered
   * - 429 + OTP_LOCKED: Too many failed attempts, account locked
   * - Other errors: Generic error message
   * 
   * @param {React.FormEvent} e - Form submission event
   * @async
   * @throws {ApiError} When API request fails (handled internally)
   */
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpStep("verifying");

    try {
      // Verify OTP with backend API
      const { onboardingContext } = await verifyOnboardingOtp(
        inviteToken,
        otp.trim() // Trim whitespace from user input
      );

      // Mark as verified and redirect to onboarding form
      setOtpStep("verified");
      window.location.assign(`/onboarding/${onboardingContext.id}`);
    } catch (err) {
      // Handle API errors with specific error messages
      if (err instanceof ApiError) {
        const reason = err.meta && (err.meta as any).reason;

        // Code has expired - user must request a new one
        if (err.status === 400 && reason === "OTP_EXPIRED") {
          setOtpError(
            "This verification code has expired. Please request a new code."
          );
          setOtp(""); // Clear input to encourage new code request
        } 
        // Incorrect code entered
        else if (err.status === 400 && reason === "OTP_INVALID") {
          setOtpError(
            "The verification code you entered is incorrect. Please try again."
          );
        } 
        // Too many failed attempts - account locked
        else if (err.status === 429 && reason === "OTP_LOCKED") {
          setOtpError(
            "Too many incorrect attempts. This onboarding has been temporarily locked. Please try again later or contact NPT HR."
          );
        } 
        // Generic API error
        else {
          setOtpError(
            err.message || "Unable to verify the code. Please try again."
          );
        }
      } 
      // Unexpected error (network, etc.)
      else {
        setOtpError(
          "Unexpected error while verifying the code. Please try again."
        );
      }
      // Stay in "code-sent" state so the OTP input UI remains visible for retry
      setOtpStep("code-sent");
    }
  }

  // ==================================================================
  // Computed State Flags
  // ==================================================================

  /** True when OTP workflow is in initial state (before code is sent) */
  const isInitialOtpStep = otpStep === "idle" || otpStep === "sending";
  
  /** True when OTP has been successfully verified */
  const isVerifiedStep = otpStep === "verified";
  
  /** True when OTP request is currently in progress */
  const isSending = otpStep === "sending";
  
  /** True when OTP verification is currently in progress */
  const isVerifying = otpStep === "verifying";

  // ==================================================================
  // Render
  // ==================================================================

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navigation Bar */}
      <Navbar
        subsidiaryDisplayName={regionName}
        subsidiaryCode={resolvedSubsidiary}
        helpEmail="hr@example.com"
      />

      {/* ========================================================== */}
      {/* Hero Section: Welcome Screen                               */}
      {/* ========================================================== */}
      <main className="flex flex-1 items-stretch justify-center px-4 pb-25 pt-20 sm:px-6 lg:px-8">
        <section className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-5 py-8 sm:px-8 sm:py-10">
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
            {/* Top label: Subsidiary and page identifier */}
            <p className="text-[11px] font-semibold tracking-[0.26em] text-slate-500">
              {content.name.toUpperCase()} • EMPLOYEE ONBOARDING
            </p>

            {/* Main heading with brand pill */}
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.4rem] md:text-[2.8rem] md:leading-tight">
              <span className="inline-flex flex-wrap items-center justify-center gap-2">
                <span>Welcome to</span>
                <span className="hero-brand-pill align-baseline">
                  NPT Group
                </span>
              </span>
            </h1>

            {/* Subheading: Brief explanation of the onboarding process */}
            <p className="mt-4 max-w-2xl text-sm text-slate-700 sm:text-[0.95rem]">
              You&apos;ve been invited by our HR team to complete your
              employment onboarding. This secure portal will guide you through
              the information we need to finalize your hire.
            </p>

            {/* Information card: Required documents and information */}
            <div className="mt-9 w-full">
              <div className="mx-auto max-w-xl rounded-2xl border border-slate-100 bg-white/95 p-6 text-left shadow-[0_12px_40px_rgba(15,23,42,0.10)]">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                  WHAT YOU&apos;LL NEED
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-800">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span>Government ID (Aadhaar, PAN, or equivalent)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span>Bank account details and IFSC code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span>Emergency contact information</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Primary call-to-action button */}
            <div className="mt-9 flex justify-center">
              <Button
                className="rounded-full px-10 py-2.5 text-sm font-semibold bg-slate-950 hover:bg-black text-white shadow-lg shadow-slate-900/25 cursor-pointer"
                onClick={openOtpModal}
              >
                Continue
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* ========================================================== */}
      {/* OTP Verification Modal                                     */}
      {/* ========================================================== */}
      <Modal
        open={isOtpModalOpen}
        onClose={closeOtpModal}
        ariaLabel="Verify your NPT onboarding invitation"
      >
        {/* Modal Header: Title and close button */}
        <div className="relative flex items-center justify-center pb-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 text-center">
            Verify your invitation
          </h2>

          {/* Close button (X icon) */}
          <button
            type="button"
            onClick={closeOtpModal}
            className="absolute right-0 top-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        {/* Error Alert: Displayed when OTP operations fail */}
        {otpError && (
          <div className="mt-3">
            <Alert variant="error" description={otpError} />
          </div>
        )}

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
              {email && (
                <>
                  {" "}
                  to <span className="font-medium">{email}</span>
                </>
              )}
              . Enter the code below to continue to your onboarding form.
            </p>

            {/* OTP Input Field */}
            <div className="space-y-1">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                required
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
    </div>
  );
}
