"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, UserMinus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/client";
import { ETerminationType } from "@/types/onboarding.types";

export function TerminateModal({
  open,
  onClose,
  onConfirm,
  employeeLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: { terminationType: ETerminationType; terminationReason?: string }) => Promise<void> | void;
  employeeLabel: string;
}) {
  const [type, setType] = useState<ETerminationType | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = useMemo(() => !saving && type != null, [saving, type]);

  // Reset state when closing
  useEffect(() => {
    if (open) return;
    setType(null);
    setReason("");
    setError(null);
    setSaving(false);
  }, [open]);

  function handleClose() {
    if (saving) return;
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    if (!type || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        terminationType: type,
        terminationReason: reason.trim() || undefined,
      });
      onClose();
      setReason("");
      setType(null);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else if (e instanceof Error) setError(e.message);
      else setError("Unable to terminate right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      ariaLabel="Terminate onboarding"
      className={cn(
        // Let Modal surface follow dashboard theme via CSS vars on `.dashboard-root`.
        "max-w-lg"
      )}
    >
      {/* Header (no X for consistency): title + description */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-text)]">
          Terminate onboarding
        </h2>
        <p className="mt-1 text-sm text-[var(--dash-muted)]">
          This will end the onboarding for{" "}
          <span className="font-medium text-[var(--dash-text)]">
            {employeeLabel}
          </span>
          .
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] p-3 text-sm">
          <div className="font-semibold text-[var(--dash-red)]">Couldn’t terminate</div>
          <div className="mt-1 text-[var(--dash-muted)]">{error}</div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-xs font-semibold text-[var(--dash-muted)]">Type</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setType(ETerminationType.TERMINATED)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
              type === ETerminationType.TERMINATED
                ? "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]"
                : "border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-surface-2)]"
            )}
            aria-pressed={type === ETerminationType.TERMINATED}
          >
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-[var(--dash-red)]" />
              <div className="text-sm font-semibold text-[var(--dash-text)]">Terminate</div>
            </div>
            <div className="mt-1 text-xs text-[var(--dash-muted)]">
              Company-initiated termination. Employee access is revoked immediately.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setType(ETerminationType.RESIGNED)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
              type === ETerminationType.RESIGNED
                ? "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)]"
                : "border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-surface-2)]"
            )}
            aria-pressed={type === ETerminationType.RESIGNED}
          >
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-[var(--dash-muted)]" />
              <div className="text-sm font-semibold text-[var(--dash-text)]">Resigned</div>
            </div>
            <div className="mt-1 text-xs text-[var(--dash-muted)]">
              Employee resignation. Keeps a clear history of why the onboarding ended.
            </div>
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-1">
        <label className="text-xs font-semibold text-[var(--dash-muted)]">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className={cn(
            "w-full rounded-xl border bg-[var(--dash-surface)] px-3 py-2 text-sm",
            "border-[var(--dash-border)] text-[var(--dash-text)]",
            "placeholder:text-[var(--dash-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]"
          )}
          placeholder="Add a short note for audit/logs…"
        />
      </div>

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
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            canProceed
              ? "bg-[var(--dash-red)] text-white hover:opacity-95"
              : "bg-[var(--dash-surface-2)] text-[var(--dash-muted)] border border-[var(--dash-border)] cursor-not-allowed opacity-70"
          )}
        >
          {saving ? "Saving…" : "Proceed"}
        </button>
      </div>
    </Modal>
  );
}


