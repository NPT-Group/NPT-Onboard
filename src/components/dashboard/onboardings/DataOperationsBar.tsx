// src/components/dashboard/onboardings/DataOperationsBar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronDown, Search, SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { ESubsidiary } from "@/types/shared.types";

export type StatusGroupKey =
  | ""
  | "pending"
  | "modificationRequested"
  | "pendingReview"
  | "approved"
  | "manual";

const statusGroups: Array<{ key: StatusGroupKey; label: string }> = [
  // No status filter selected by default → show all.
  { key: "", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pendingReview", label: "Pending review" },
  { key: "modificationRequested", label: "Modification requested" },
  { key: "pending", label: "Digital application sent" },
  { key: "manual", label: "Manual application sent" },
];

const subsidiaryOptions: Array<{ value: ESubsidiary; label: string }> = [
  { value: ESubsidiary.INDIA, label: "Onboardly India" },
  { value: ESubsidiary.CANADA, label: "Onboardly Canada" },
  { value: ESubsidiary.USA, label: "Onboardly US" },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function FancySelect<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Select",
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const activeLabel = value
    ? (options.find((o) => o.value === value)?.label ?? String(value))
    : "";

  function compute() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const desiredWidth = Math.min(
      Math.max(280, rect.width),
      420,
      vw - margin * 2,
    );
    const left = clamp(rect.left, margin, vw - desiredWidth - margin);
    const top = clamp(rect.bottom + 8, margin, vh - margin);
    setPos({ top, left, width: desiredWidth });
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      compute();
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", compute);
      window.addEventListener("scroll", compute, true);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) window.requestAnimationFrame(() => compute());
            return next;
          });
        }}
        className={cn(
          "w-full inline-flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition cursor-pointer",
          "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)]",
          "hover:bg-[var(--dash-surface-2)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={cn(
            "truncate text-left",
            !activeLabel && "text-[var(--dash-muted)]",
          )}
        >
          {activeLabel || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--dash-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && pos && (
          <motion.div
            role="listbox"
            className={cn(
              "fixed z-[60] rounded-2xl border p-3",
              "border-[var(--dash-border)] bg-[var(--dash-surface-2)] shadow-[var(--dash-shadow)]",
            )}
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: "min(55vh, 420px)",
              overflow: "auto",
            }}
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <div className="grid gap-2">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-full border px-3 py-2 text-left text-xs font-semibold transition cursor-pointer",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                      active
                        ? "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] text-[var(--dash-text)]"
                        : "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-muted)] hover:bg-[var(--dash-surface-2)]",
                    )}
                    role="option"
                    aria-selected={active}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type DataOperationsBarBaseProps = {
  searchDraft: string;
  onSearchDraft: (v: string) => void;
  supported?: boolean;
};

type ExportUiState =
  | { state: "idle" }
  | { state: "running"; showProgress: boolean; progressPercent: number }
  | { state: "ready"; downloadUrl: string }
  | { state: "error"; message: string };

type DataOperationsBarHomeProps = DataOperationsBarBaseProps & {
  variant: "home";
  subsidiary: ESubsidiary;
  onSubsidiary: (s: ESubsidiary) => void;
  canSendInvite?: boolean;

  statusGroup: StatusGroupKey;
  hasEmployeeNumber: string;
  dateField: "created" | "submitted" | "approved" | "terminated" | "updated";
  from: string;
  to: string;

  onUpdateQuery: (next: Record<string, string | undefined>) => void;
  onSendInvite: () => void;

  exportState: ExportUiState;
  onExport: () => void;
  onDownloadExport: (url: string) => void;
};

type DataOperationsBarTerminatedProps = DataOperationsBarBaseProps & {
  variant: "terminated";
};

export function DataOperationsBar(
  props: DataOperationsBarHomeProps | DataOperationsBarTerminatedProps,
) {
  const { searchDraft, onSearchDraft, supported = true } = props;

  // Terminated page: Search-only bar (no filters, subsidiary switcher, or invite button).
  if (props.variant === "terminated") {
    return (
      <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)]">
        <div className="px-4 py-4 sm:px-5">
          <div className="grid gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
              <input
                value={searchDraft}
                onChange={(e) => onSearchDraft(e.target.value)}
                placeholder={
                  supported ? "Search terminated onboardings…" : "Search…"
                }
                className={cn(
                  "w-full rounded-xl border bg-[var(--dash-surface)] px-10 py-2 text-sm font-medium text-[var(--dash-text)] transition",
                  "border-[var(--dash-border)]",
                  "placeholder:text-[var(--dash-muted)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                )}
              />
            </div>

            {!supported && (
              <div className="text-xs text-[var(--dash-muted)]">
                Terminated view is only available for supported subsidiaries.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const {
    subsidiary,
    onSubsidiary,
    canSendInvite = true,
    statusGroup,
    hasEmployeeNumber,
    dateField,
    from,
    to,
    onUpdateQuery,
    onSendInvite,
    exportState,
    onExport,
    onDownloadExport,
  } = props as DataOperationsBarHomeProps;

  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [popover, setPopover] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  function computePopover() {
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const barRect = barRef.current?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12; // breathing room from viewport edges
    const gap = 8; // tiny clean separation

    const isMobile = window.matchMedia("(max-width: 639px)").matches;

    // Mobile: align to the bar so the dropdown starts right after the bar.
    // Desktop/tablet: align dropdown's RIGHT edge to the bar's RIGHT edge
    // for a clean, consistent end alignment.
    const desiredWidth = isMobile
      ? Math.min(vw - margin * 2, barRect?.width ?? vw - margin * 2)
      : Math.min(720, vw - margin * 2);

    let left: number;
    if (isMobile) {
      const baseLeft = barRect?.left ?? rect.left;
      left = clamp(baseLeft, margin, vw - desiredWidth - margin);
    } else {
      const baseRight = barRect?.right ?? rect.right;
      const right = clamp(baseRight, margin + desiredWidth, vw - margin);
      left = right - desiredWidth;
    }

    const baseTop = isMobile ? (barRect?.bottom ?? rect.bottom) : rect.bottom;
    const top = clamp(baseTop + gap, margin, vh - margin); // y is further constrained by maxHeight + overflow

    setPopover({ top, left, width: desiredWidth });
  }

  // Close on outside click / escape
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reposition popover (resize/scroll) while open
  useEffect(() => {
    if (!open) return;
    computePopover();

    function onReflow() {
      computePopover();
    }

    window.addEventListener("resize", onReflow);
    // capture scroll from any scroll container
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchDraft.trim()) n += 1;
    if (statusGroup) n += 1;
    if (hasEmployeeNumber) n += 1;
    if (from) n += 1;
    if (to) n += 1;
    if (dateField !== "created") n += 1;
    return n;
  }, [searchDraft, statusGroup, hasEmployeeNumber, from, to, dateField]);

  function clearAll() {
    onSearchDraft("");
    onUpdateQuery({
      q: undefined,
      statusGroup: undefined,
      hasEmployeeNumber: undefined,
      dateField: undefined,
      from: undefined,
      to: undefined,
    });
  }

  return (
    <div
      ref={barRef}
      className={cn(
        "rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)]",
        "p-3 sm:p-4",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "hidden sm:flex items-center rounded-xl border px-3 py-2 text-xs font-semibold",
              "border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-muted)]",
            )}
          >
            Data Operations
          </div>

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
            <input
              value={searchDraft}
              onChange={(e) => onSearchDraft(e.target.value)}
              placeholder="Name, Email or Employee Number"
              disabled={!supported}
              className={cn(
                "w-full rounded-xl border bg-[var(--dash-surface)] pl-10 pr-3 py-2 text-sm",
                "border-[var(--dash-border)] text-[var(--dash-text)]",
                "placeholder:text-[var(--dash-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
                !supported && "opacity-60 cursor-not-allowed",
              )}
            />
          </div>

          {/* Filter dropdown */}
          <div ref={rootRef} className="relative">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => {
                if (!supported) return;
                setOpen((v) => {
                  const next = !v;
                  if (next) {
                    // Measure after state flips so layout is stable.
                    window.requestAnimationFrame(() => computePopover());
                  }
                  return next;
                });
              }}
              disabled={!supported}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)]",
                "hover:bg-[var(--dash-surface-2)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                !supported
                  ? "opacity-60 cursor-not-allowed hover:bg-[var(--dash-surface)]"
                  : "cursor-pointer",
              )}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <SlidersHorizontal className="h-4 w-4 text-[var(--dash-muted)]" />
              <span>Filter by</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--dash-red-soft)] px-1.5 text-xs text-[var(--dash-red)]">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--dash-muted)] transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {open && popover && (
                <motion.div
                  role="menu"
                  className={cn(
                    // Use a fixed, viewport-clamped popover for perfect responsiveness.
                    "fixed z-50 rounded-2xl border p-4",
                    "border-[var(--dash-border)] bg-[var(--dash-surface-2)] shadow-[var(--dash-shadow)]",
                  )}
                  style={{
                    top: popover.top,
                    left: popover.left,
                    width: popover.width,
                    maxHeight: "min(70vh, 520px)",
                    overflow: "auto",
                  }}
                  initial={{ opacity: 0, y: -8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[var(--dash-muted)]">
                        Status
                      </div>
                      <FancySelect<StatusGroupKey>
                        value={statusGroup}
                        options={statusGroups.map((s) => ({
                          value: s.key,
                          label: s.label,
                        }))}
                        onChange={(v) =>
                          onUpdateQuery({ statusGroup: v || undefined })
                        }
                        placeholder="Select status"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[var(--dash-muted)]">
                        Employee Number
                      </div>
                      <FancySelect<"" | "true" | "false">
                        value={
                          (hasEmployeeNumber as "" | "true" | "false") ?? ""
                        }
                        options={[
                          { value: "", label: "All" },
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]}
                        onChange={(v) =>
                          onUpdateQuery({ hasEmployeeNumber: v || undefined })
                        }
                        placeholder="Select"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[var(--dash-muted)]">
                        Date field
                      </div>
                      <FancySelect<
                        | "created"
                        | "submitted"
                        | "approved"
                        | "terminated"
                        | "updated"
                      >
                        value={dateField}
                        options={[
                          { value: "created", label: "Created" },
                          { value: "submitted", label: "Submitted" },
                          { value: "approved", label: "Approved" },
                          { value: "terminated", label: "Terminated" },
                          { value: "updated", label: "Updated" },
                        ]}
                        onChange={(v) => onUpdateQuery({ dateField: v })}
                        placeholder="Select"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[var(--dash-muted)]">
                        From
                      </div>
                      <div className="relative">
                        <input
                          type="date"
                          value={from}
                          onChange={(e) =>
                            onUpdateQuery({ from: e.target.value || undefined })
                          }
                          className={cn(
                            "w-full appearance-none rounded-xl border bg-[var(--dash-surface)] px-3 py-2 pr-10 text-sm",
                            "border-[var(--dash-border)] text-[var(--dash-text)]",
                            "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
                          )}
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[var(--dash-muted)]">
                        To
                      </div>
                      <div className="relative">
                        <input
                          type="date"
                          value={to}
                          onChange={(e) =>
                            onUpdateQuery({ to: e.target.value || undefined })
                          }
                          className={cn(
                            "w-full appearance-none rounded-xl border bg-[var(--dash-surface)] px-3 py-2 pr-10 text-sm",
                            "border-[var(--dash-border)] text-[var(--dash-text)]",
                            "focus:outline-none focus:ring-2 focus:ring-[var(--dash-red-soft)]",
                          )}
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-muted)]" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={clearAll}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                        "border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                      )}
                    >
                      Clear all
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right side: subsidiary switcher + Export + CTA */}
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="min-w-[168px]">
            <FancySelect<ESubsidiary>
              value={subsidiary}
              onChange={onSubsidiary}
              options={subsidiaryOptions.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
              placeholder="Select subsidiary"
            />
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={() => {
              if (exportState.state === "ready") {
                onDownloadExport(exportState.downloadUrl);
                return;
              }
              if (exportState.state === "running") return;
              onExport();
            }}
            disabled={!supported || exportState.state === "running"}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
              !supported || exportState.state === "running"
                ? "bg-emerald-500/40 text-white/80 border border-emerald-400/40 cursor-not-allowed opacity-80"
                : exportState.state === "ready"
                  ? "bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 cursor-pointer"
                  : exportState.state === "error"
                    ? "bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600 cursor-pointer"
                    : "bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600 cursor-pointer",
            )}
            title={
              exportState.state === "error"
                ? exportState.message
                : exportState.state === "ready"
                  ? "Download export"
                  : "Export"
            }
          >
            {exportState.state === "idle" && "Export"}
            {exportState.state === "running" &&
              (exportState.showProgress
                ? `Exporting (${Math.max(0, Math.min(100, Math.round(exportState.progressPercent)))}%)`
                : "Exporting…")}
            {exportState.state === "ready" && "Download"}
            {exportState.state === "error" && "Export"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canSendInvite) return;
              onSendInvite();
            }}
            disabled={!canSendInvite}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              canSendInvite
                ? "bg-[var(--dash-red)] text-white hover:opacity-95 cursor-pointer"
                : "bg-[var(--dash-surface-2)] text-[var(--dash-muted)] border border-[var(--dash-border)] cursor-not-allowed opacity-70",
            )}
          >
            Send Invite
          </button>
        </div>
      </div>
      {exportState.state === "error" && (
        <div className="mt-2 text-xs font-semibold text-[var(--dash-red)]">
          {exportState.message}
        </div>
      )}
    </div>
  );
}
