"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

export function RestoreModal({
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
  const [ack, setAck] = useState(false);

  const canProceed = useMemo(() => !saving && ack, [saving, ack]);

  // Reset state when closing
  useEffect(() => {
    if (open) return;
    setSaving(false);
    setError(null);
    setAck(false);
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
      setError(e instanceof Error ? e.message : "Unable to restore right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} ariaLabel="Restore onboarding">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-text)]">
            Restore onboarding
          </h2>
          <p className="mt-1 text-sm text-[var(--dash-muted)]">
            This will restore <span className="font-medium">{employeeLabel}</span>{" "}
            back to an active state.
          </p>
          <p className="mt-2 text-xs text-[var(--dash-muted)]">
            Note: restore does not send an email automatically. HR can resend an invite if needed.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]/40 p-3 text-sm text-[var(--dash-red)]">
            {error}
          </div>
        )}

        <label
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 transition",
            "border-[var(--dash-border)] bg-[var(--dash-surface)]",
            "hover:bg-[var(--dash-surface-2)]"
          )}
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--dash-red)]"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            disabled={saving}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--dash-text)]">
              I understand this will restore the application
            </div>
            <div className="mt-0.5 text-xs text-[var(--dash-muted)]">
              The onboarding will return to an active status based on its history. This does not resend any emails automatically.
            </div>
          </div>
        </label>

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


