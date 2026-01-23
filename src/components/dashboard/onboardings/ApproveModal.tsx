"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/client";

type ApproveModalProps =
  | {
    open: boolean;
    onClose: () => void;
    employeeLabel: string;
    variant: "confirmDetails";
    onConfirm: () => Promise<void> | void;
  }
  | {
    open: boolean;
    onClose: () => void;
    employeeLabel: string;
    variant?: "approveFinal";
    onConfirm: (employeeNumber?: string) => Promise<void> | void;
  };

export function ApproveModal({
  open,
  onClose,
  onConfirm,
  employeeLabel,
  variant = "approveFinal",
}: ApproveModalProps) {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = useMemo(() => !saving, [saving]);

  useEffect(() => {
    if (open) return;
    setEmployeeNumber("");
    setError(null);
    setSaving(false);
  }, [open]);

  function handleClose() {
    if (saving) return;
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    if (!canProceed) return;
    setSaving(true);
    setError(null);
    try {
      if (variant === "confirmDetails") {
        // confirmDetails variant doesn't need employeeNumber
        await (onConfirm as () => Promise<void> | void)();
      } else {
        // approveFinal variant can optionally use employeeNumber
        const v = employeeNumber.trim();
        await (onConfirm as (employeeNumber?: string) => Promise<void> | void)(v || undefined);
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else if (e instanceof Error) setError(e.message);
      else setError(variant === "confirmDetails" ? "Unable to confirm details right now. Please try again." : "Unable to approve right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      ariaLabel={variant === "confirmDetails" ? "Approve details" : "Approve onboarding"}
      className="max-w-lg"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-text)]">
          {variant === "confirmDetails" ? "Approve details" : "Approve onboarding"}
        </h2>
        <p className="mt-1 text-sm text-[var(--dash-muted)]">
          {variant === "confirmDetails" ? (
            <>
              This confirms the employee’s onboarding details for{" "}
              <span className="font-medium text-[var(--dash-text)]">{employeeLabel}</span>. Contracts &amp; policies will be handled next.
            </>
          ) : (
            <>
              Approving will complete onboarding for{" "}
              <span className="font-medium text-[var(--dash-text)]">{employeeLabel}</span>.
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] p-3 text-sm">
          <div className="font-semibold text-[var(--dash-red)]">{variant === "confirmDetails" ? "Couldn’t confirm details" : "Couldn’t approve"}</div>
          <div className="mt-1 text-[var(--dash-muted)]">{error}</div>
        </div>
      )}

      {variant !== "confirmDetails" && (
        <div className="mt-5 space-y-1">
          <label className="text-xs font-semibold text-[var(--dash-muted)]">Employee number</label>
          <input
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            placeholder="Optional (must be unique per subsidiary)"
            className={cn(
              "w-full rounded-xl border bg-[var(--dash-surface)] px-3 py-2 text-sm",
              "border-[var(--dash-border)] text-[var(--dash-text)]",
              "placeholder:text-[var(--dash-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]"
            )}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={saving}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-semibold transition",
            "border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
            saving && "opacity-60 cursor-not-allowed"
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canProceed}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            canProceed
              ? "bg-[var(--dash-red)] text-white hover:opacity-95"
              : "bg-[var(--dash-surface-2)] text-[var(--dash-muted)] border border-[var(--dash-border)] cursor-not-allowed opacity-70"
          )}
        >
          <BadgeCheck className="h-4 w-4" />
          {saving ? (variant === "confirmDetails" ? "Approving details…" : "Approving…") : variant === "confirmDetails" ? "Approve details" : "Approve"}
        </button>
      </div>
    </Modal>
  );
}


