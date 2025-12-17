"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

export function DeleteOnboardingModal({
  open,
  onClose,
  onConfirm,
  employeeLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  employeeLabel: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const canProceed = useMemo(() => {
    return !saving && confirmText.trim().toUpperCase() === "DELETE";
  }, [saving, confirmText]);

  // Reset state when closing
  useEffect(() => {
    if (open) return;
    setSaving(false);
    setError(null);
    setConfirmText("");
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
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} ariaLabel="Delete onboarding permanently">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-text)]">
            Delete onboarding permanently
          </h2>
          <p className="mt-1 text-sm text-[var(--dash-muted)]">
            You’re about to permanently delete{" "}
            <span className="font-medium">{employeeLabel}</span>.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]/40 p-3">
          <div className="text-sm font-semibold text-[var(--dash-red)]">This cannot be undone.</div>
          <div className="mt-1 text-xs text-[var(--dash-muted)]">
            This will delete the onboarding record and remove any referenced uploaded files from storage.
            Audit logs are kept for history.
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--dash-muted)]">
            Type <span className="font-semibold text-[var(--dash-text)]">DELETE</span> to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={saving}
            className={cn(
              "w-full rounded-xl border bg-[var(--dash-surface)] px-3 py-2 text-sm font-medium",
              "border-[var(--dash-border)] text-[var(--dash-text)]",
              "placeholder:text-[var(--dash-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
              saving && "opacity-70 cursor-not-allowed"
            )}
            placeholder="DELETE"
            inputMode="text"
            autoComplete="off"
          />
          <div className="text-xs text-[var(--dash-muted)]">
            This is permanent and will also remove referenced uploaded files from storage.
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]/40 p-3 text-sm text-[var(--dash-red)]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
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
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              canProceed
                ? "bg-[var(--dash-red)] text-white hover:opacity-95"
                : "bg-[var(--dash-surface-2)] text-[var(--dash-muted)] border border-[var(--dash-border)] cursor-not-allowed opacity-70"
            )}
          >
            {saving ? "Saving…" : "Proceed"}
          </button>
        </div>
      </div>
    </Modal>
  );
}


