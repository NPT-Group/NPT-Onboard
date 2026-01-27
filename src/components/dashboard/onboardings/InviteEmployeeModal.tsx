"use client";

import { useCallback, useMemo, useState } from "react";
import { Mail, User2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/client";
import {
  createAdminOnboarding,
  type CreateAdminOnboardingBody,
} from "@/lib/api/admin/onboardings";
import { ESubsidiary } from "@/types/shared.types";
import { EOnboardingMethod } from "@/types/onboarding.types";

type Props = {
  open: boolean;
  onClose: () => void;
  subsidiary: ESubsidiary;
  onCreated: () => void;
};

function isValidEmail(v: string) {
  // pragmatic, good-enough validation for UI
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function InviteEmployeeModal({
  open,
  onClose,
  subsidiary,
  onCreated,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<EOnboardingMethod>(
    EOnboardingMethod.DIGITAL,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setError(null);
    onClose();
  }, [submitting, onClose]);

  const canSubmit = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim().toLowerCase();
    return Boolean(fn && ln && isValidEmail(em) && !submitting);
  }, [firstName, lastName, email, submitting]);

  async function onSend() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateAdminOnboardingBody = {
        subsidiary,
        method,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };
      await createAdminOnboarding(payload);
      onCreated();
      onClose();
      // reset for next time
      setFirstName("");
      setLastName("");
      setEmail("");
      setMethod(EOnboardingMethod.DIGITAL);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Unable to send invite right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      ariaLabel="Invite employee"
      className={cn(
        "max-w-lg border",
        "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-[var(--dash-shadow)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            Invite Employee
          </div>
          <div className="mt-1 text-sm text-[var(--dash-muted)]">
            Creates an onboarding under the selected subsidiary and sends the
            employee an email.
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] p-3 text-sm text-[var(--dash-text)]">
          <div className="font-semibold text-[var(--dash-red)]">
            Couldn’t send invite
          </div>
          <div className="mt-1 text-[var(--dash-muted)]">{error}</div>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="invite-first-name"
            className="text-xs font-semibold text-[var(--dash-muted)]"
          >
            First name
          </label>
          <div className="relative">
            <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
            <input
              id="invite-first-name"
              name="invite-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={cn(
                "w-full rounded-xl border bg-[var(--dash-surface)] py-2 pl-10 pr-3 text-sm",
                "border-[var(--dash-border)] text-[var(--dash-text)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
              )}
              placeholder="e.g. John"
              autoComplete="section-invite given-name"
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="invite-last-name"
            className="text-xs font-semibold text-[var(--dash-muted)]"
          >
            Last name
          </label>
          <div className="relative">
            <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
            <input
              id="invite-last-name"
              name="invite-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={cn(
                "w-full rounded-xl border bg-[var(--dash-surface)] py-2 pl-10 pr-3 text-sm",
                "border-[var(--dash-border)] text-[var(--dash-text)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
              )}
              placeholder="e.g. Doe"
              autoComplete="section-invite family-name"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <label
          htmlFor="invite-email"
          className="text-xs font-semibold text-[var(--dash-muted)]"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
          <input
            id="invite-email"
            name="invite-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "w-full rounded-xl border bg-[var(--dash-surface)] py-2 pl-10 pr-3 text-sm",
              "border-[var(--dash-border)] text-[var(--dash-text)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
            )}
            placeholder="name@company.com"
            autoComplete="section-invite email"
            inputMode="email"
          />
        </div>
        {email.trim().length > 0 && !isValidEmail(email.trim()) && (
          <div className="text-xs text-[var(--dash-red-2)]">
            Enter a valid email address.
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold text-[var(--dash-muted)]">
          Method
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod(EOnboardingMethod.DIGITAL)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
              method === EOnboardingMethod.DIGITAL
                ? "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]"
                : "border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-surface-2)]",
            )}
            aria-pressed={method === EOnboardingMethod.DIGITAL}
          >
            <div className="text-sm font-semibold">Digital Form</div>
            <div className="mt-1 text-xs text-[var(--dash-muted)]">
              Employee receives a secure invite link and completes the form
              in-app.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMethod(EOnboardingMethod.MANUAL)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
              method === EOnboardingMethod.MANUAL
                ? "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]"
                : "border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-surface-2)]",
            )}
            aria-pressed={method === EOnboardingMethod.MANUAL}
          >
            <div className="text-sm font-semibold">Manual PDF Flow</div>
            <div className="mt-1 text-xs text-[var(--dash-muted)]">
              Employee receives a blank PDF template and instructions to email
              HR.
            </div>
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-semibold transition",
            "border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
            submitting && "opacity-60 cursor-not-allowed",
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSubmit}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            canSubmit
              ? "bg-[var(--dash-red)] text-white hover:opacity-95"
              : "bg-[var(--dash-surface-2)] text-[var(--dash-muted)] border border-[var(--dash-border)] cursor-not-allowed opacity-70",
          )}
        >
          {submitting ? "Sending…" : "Send"}
        </button>
      </div>
    </Modal>
  );
}
