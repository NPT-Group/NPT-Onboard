"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, RefreshCcw, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import type { AdminOnboardingListItem } from "@/lib/api/admin/onboardings";
import { cn } from "@/lib/utils/cn";
import { InviteCountdown } from "@/components/dashboard/onboardings/InviteCountdown";
import { OnboardingProgress } from "@/components/dashboard/onboardings/OnboardingProgress";
import { SmartPagination } from "@/components/dashboard/pagination/SmartPagination";
import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { RowActionsMenu } from "@/components/dashboard/onboardings/RowActionsMenu";

function formatMethodLabel(method: unknown): string {
  const v = String(method ?? "").trim().toLowerCase();
  if (v === "digital") return "Digital";
  if (v === "manual") return "Manual";
  return String(method ?? "—");
}

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function OnboardingsDataGrid({
  items,
  loading,
  error,
  page,
  pages,
  total,
  onPage,
  onCopyLink,
  onView,
  onTerminate,
  onResendInvite,
  resendingId,
  selectedIds = [],
  onToggleSelect,
  onBulkTerminateSelected,
}: {
  items: AdminOnboardingListItem[];
  loading: boolean;
  error: string | null;
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
  onCopyLink: (url?: string) => void;
  onView: (id: string) => void;
  onTerminate: (item: AdminOnboardingListItem) => void;
  onResendInvite: (id: string) => void;
  resendingId?: string | null;
  selectedIds?: string[];
  onToggleSelect?: (item: AdminOnboardingListItem) => void;
  onBulkTerminateSelected?: () => void;
}) {
  const hasAnyInviteTimer = useMemo(
    () => items.some((it) => it.inviteExpiresAt != null),
    [items]
  );

  const selectionCount = selectedIds.length;
  const selectionActive = selectionCount > 0;

  // Only non-terminated onboardings are selectable for bulk actions.
  const selectableIds = useMemo(
    () =>
      items
        .filter((it) => it.status !== EOnboardingStatus.Terminated)
        .map((it) => it.id),
    [items]
  );
  const selectableOnPageCount = selectableIds.length;
  const selectedOnPageCount = selectableIds.filter((id) =>
    selectedIds.includes(id)
  ).length;
  const allSelectedOnPage =
    selectableOnPageCount > 0 &&
    selectedOnPageCount === selectableOnPageCount;
  const someSelectedOnPage =
    selectedOnPageCount > 0 && !allSelectedOnPage;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  useEffect(() => {
    if (!copiedId) return;
    const t = window.setTimeout(() => setCopiedId(null), 1400);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  // Single shared clock so expiry UI is accurate & consistent.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasAnyInviteTimer) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasAnyInviteTimer]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] overflow-hidden">
        {/* Top summary row (before table header) */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--dash-border)]">
          <div className="flex items-center gap-3 text-xs font-semibold text-[var(--dash-muted)]">
            {/* Select-all checkbox (Outlook-style) */}
            {selectableOnPageCount > 0 && onToggleSelect && (
              <button
                type="button"
                onClick={() => {
                  // Toggle selection for all selectable rows on the current page
                  // by delegating to the row-level toggle handler.
                  if (allSelectedOnPage) {
                    // Currently all selectable rows are selected → unselect them.
                    items.forEach((it) => {
                      if (
                        it.status !== EOnboardingStatus.Terminated &&
                        selectedIds.includes(it.id)
                      ) {
                        onToggleSelect(it);
                      }
                    });
                  } else {
                    // Not all selected → select every selectable row that isn't already selected.
                    items.forEach((it) => {
                      if (
                        it.status !== EOnboardingStatus.Terminated &&
                        !selectedIds.includes(it.id)
                      ) {
                        onToggleSelect(it);
                      }
                    });
                  }
                }}
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] transition",
                  allSelectedOnPage
                    ? "bg-[var(--dash-red)] border-[var(--dash-red)] text-[var(--dash-surface)]"
                    : someSelectedOnPage
                    ? "bg-[var(--dash-surface)] border-[var(--dash-border)] text-[var(--dash-text)]"
                    : "bg-[var(--dash-surface)] border-[var(--dash-border)] text-[var(--dash-muted)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]"
                )}
                aria-label={
                  allSelectedOnPage
                    ? "Deselect all"
                    : "Select all on this page"
                }
                aria-pressed={allSelectedOnPage}
              >
                {allSelectedOnPage && <Check className="h-3 w-3" />}
                {!allSelectedOnPage && someSelectedOnPage && (
                  <span className="h-0.5 w-2 rounded-sm bg-[var(--dash-text)]" />
                )}
              </button>
            )}

            <span>
              {loading ? (
                "Loading…"
              ) : error ? (
                "—"
              ) : (
                `${total} result(s)`
              )}
            </span>
            {selectionCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[var(--dash-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--dash-text)]">
                {selectionCount} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectionCount > 0 && onBulkTerminateSelected && (
              <button
                type="button"
                onClick={onBulkTerminateSelected}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] text-[var(--dash-red)] hover:brightness-[0.98]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]"
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Terminate selected
              </button>
            )}

            <SmartPagination page={page} pages={pages} onPage={onPage} />
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[1.25fr_1.2fr_1.35fr_1.7fr_0.9fr] gap-4 px-5 py-3 border-b border-[var(--dash-border)] text-xs font-semibold text-[var(--dash-muted)]">
          <div>Employee</div>
          <div>Email</div>
          <div>Progress</div>
          <div>Invite</div>
          <div className="text-right">Actions</div>
        </div>

        {error && <div className="p-5 text-sm text-[var(--dash-red)]">{error}</div>}
        {!error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 text-sm text-[var(--dash-muted)]"
                >
                  Loading…
                </motion.div>
              ) : items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 text-sm text-[var(--dash-muted)]"
                >
                  No results found.
                </motion.div>
              ) : (
                <>
                  {items.map((it, index) => {
                    const fullName = `${it.firstName} ${it.lastName}`.trim();
                    const methodLabel = formatMethodLabel(it.method);
                    const link = it.inviteUrl;
                    const expiresAt = toDate(it.inviteExpiresAt);
                    const isExpired = expiresAt ? expiresAt.getTime() <= nowMs : false;

                    const isComplete =
                      it.status === EOnboardingStatus.Approved ||
                      it.status === EOnboardingStatus.Terminated;
                    const isModReq = it.status === EOnboardingStatus.ModificationRequested;
                    const linkLabel = isModReq ? "MODIFICATION LINK" : "INVITE LINK";
                    const resendLabel = "Resend";

                    // Employee-facing invite link is only relevant while an invite can be used.
                    // Once the employee has submitted (Submitted/Resubmitted), the invite flow is no longer valid.
                    const isInviteEligible =
                      it.method === EOnboardingMethod.DIGITAL &&
                      (it.status === EOnboardingStatus.InviteGenerated ||
                        it.status === EOnboardingStatus.ModificationRequested);

                    const canResendInvite =
                      it.method === EOnboardingMethod.DIGITAL &&
                      (it.status === EOnboardingStatus.InviteGenerated ||
                        it.status === EOnboardingStatus.ModificationRequested);

                    const tokenHint = (() => {
                      if (!link) return null;
                      try {
                        const u = new URL(link);
                        const token = u.searchParams.get("token");
                        if (!token) return link;
                        if (token.length <= 12) return token;
                        return `${token.slice(0, 6)}…${token.slice(-6)}`;
                      } catch {
                        return link;
                      }
                    })();

                    return (
                      <motion.div
                        key={it.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.05,
                          ease: "easeOut",
                        }}
                        className={cn(
                          "group border-b border-[var(--dash-border)] px-5 py-4",
                          "md:grid md:grid-cols-[1.25fr_1.2fr_1.35fr_1.7fr_0.9fr] md:gap-4 md:items-center"
                        )}
                      >
                {/* Employee (selection + name + optional employee number) */}
                <div className="min-w-0 flex items-start gap-3">
                  {onToggleSelect ? (
                    (() => {
                      const isSelected = selectedIds.includes(it.id);
                      const canSelect = it.status !== EOnboardingStatus.Terminated;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (!canSelect) return;
                            onToggleSelect(it);
                          }}
                          disabled={!canSelect}
                          className={cn(
                            "mt-1 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] transition",
                            canSelect
                              ? isSelected
                                ? "bg-[var(--dash-red)] border-[var(--dash-red)] text-[var(--dash-surface)]"
                                : "bg-[var(--dash-surface)] border-[var(--dash-border)] text-[var(--dash-muted)]"
                              : "bg-[var(--dash-surface-2)] border-[var(--dash-border)] text-[var(--dash-muted)] opacity-60 cursor-not-allowed",
                            !selectionActive &&
                              !isSelected &&
                              canSelect &&
                              "opacity-0 group-hover:opacity-100"
                          )}
                          aria-pressed={isSelected}
                          aria-label={isSelected ? "Deselect onboarding" : "Select onboarding"}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })()
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[var(--dash-muted)] truncate">
                      EN#:{" "}
                      <span className="font-mono text-[var(--dash-text)]">
                        {it.employeeNumber || "—"}
                      </span>
                    </div>

                    <div className="mt-1 text-sm font-semibold truncate">
                      {fullName}
                    </div>

                    {/* Mobile: stack email under name */}
                    <div className="mt-1 text-xs text-[var(--dash-muted)] truncate md:hidden">
                      {it.email}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--dash-muted)] md:hidden">
                      {methodLabel}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="hidden md:block min-w-0">
                  <div className="text-sm text-[var(--dash-text)] truncate">
                    {it.email}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--dash-muted)]">
                    {methodLabel}
                  </div>
                </div>

                {/* Progress (Apple-like: dot + rail) */}
                <div className="mt-4 md:mt-0">
                  <OnboardingProgress status={it.status} method={it.method} />
                </div>

                {/* Invite */}
                <div className="mt-4 md:mt-0 min-w-0">
                  {/* Completed onboardings should not expose invites */}
                  {isComplete ? (
                    <div className="text-sm text-[var(--dash-muted)]">—</div>
                  ) : it.method === EOnboardingMethod.MANUAL ? (
                    <div className="text-sm text-[var(--dash-muted)]">—</div>
                  ) : !isInviteEligible ? (
                    // Submitted / Resubmitted (Pending review) should not show invite link or resend.
                    <div className="text-sm text-[var(--dash-muted)]">—</div>
                  ) : link ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 min-w-0">
                      {/* Invite link (NOT clickable for HR). Copy icon appears on hover only (unless expired). */}
                      <div
                        className={cn(
                          // Keep badge + copy icon from shifting layout by reserving space on the right.
                          "group relative min-w-0 flex-1 rounded-xl border px-3 py-2 pr-12",
                          "border-[var(--dash-border)] bg-[var(--dash-surface-2)]",
                          "transition-colors",
                          !isExpired && "hover:bg-[var(--dash-surface)]",
                          isExpired && "opacity-80"
                        )}
                        title={link}
                      >
                        {/* Badge pinned to the exact top-right spot (timer uses same spot as Expired). */}
                        {(isExpired || it.inviteExpiresAt) && (
                          <span
                            className={cn(
                              "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap",
                              isExpired
                                ? "bg-[var(--dash-red-soft)] text-[var(--dash-red)]"
                                : "border border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-muted)]"
                            )}
                            title={
                              isExpired
                                ? isModReq
                                  ? "Modification link expired"
                                  : "Invite link expired"
                                : isModReq
                                  ? "Time remaining until this modification link expires"
                                  : "Time remaining until this invite expires"
                            }
                          >
                            {isExpired ? (
                              "Expired"
                            ) : (
                              <InviteCountdown
                                expiresAt={it.inviteExpiresAt}
                                nowMs={nowMs}
                              />
                            )}
                          </span>
                        )}

                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--dash-muted)]">
                            {linkLabel}
                          </div>
                          <div
                            className={cn(
                              "mt-1 font-mono text-xs text-[var(--dash-text)] truncate",
                              isExpired && "line-through text-[var(--dash-muted)]"
                            )}
                          >
                            {tokenHint}
                          </div>
                        </div>

                        {/* Hover-only copy control (hidden when expired). Pinned bottom-right to avoid badge overlap. */}
                        {!isExpired && (
                          <button
                            type="button"
                            onClick={() => {
                              onCopyLink(link);
                              setCopiedId(it.id);
                            }}
                            className={cn(
                              "absolute bottom-2 right-2 rounded-lg border p-2 cursor-pointer",
                              "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-muted)]",
                              "opacity-0 pointer-events-none",
                              "group-hover:opacity-100 group-hover:pointer-events-auto",
                              "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                              "hover:bg-[var(--dash-surface-2)]",
                              "active:scale-95 transition",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]"
                            )}
                            aria-label={
                              copiedId === it.id
                                ? "Copied"
                                : isModReq
                                  ? "Copy modification link"
                                  : "Copy invite link"
                            }
                            title={
                              copiedId === it.id
                                ? "Copied"
                                : isModReq
                                  ? "Copy modification link"
                                  : "Copy invite link"
                            }
                          >
                            {copiedId === it.id ? (
                              <Check className="h-4 w-4 text-[var(--dash-red)]" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0">
                        {/* Resend is always available for InviteGenerated (even before expiry). */}
                        {canResendInvite && (
                          <button
                            type="button"
                            onClick={() => onResendInvite(it.id)}
                            disabled={resendingId === it.id}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                              "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                              "cursor-pointer active:scale-[0.98] transition-transform",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                              resendingId === it.id &&
                                "opacity-60 cursor-not-allowed active:scale-100"
                            )}
                            aria-label={isModReq ? "Resend modification request" : "Resend invite"}
                            title={
                              isModReq
                                ? "Resend modification request email (generates a new link)"
                                : "Resend invitation email (generates a new link)"
                            }
                          >
                            <RefreshCcw
                              className={cn(
                                "h-4 w-4",
                                resendingId === it.id && "animate-spin"
                              )}
                            />
                            {resendingId === it.id ? "Resending…" : resendLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {isModReq ? "Modification link unavailable" : "Invite link unavailable"}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--dash-muted)]">
                          This usually means the invite was created before link-copy support or the invite was cleared.
                        </div>
                      </div>
                      {canResendInvite ? (
                        <button
                          type="button"
                          onClick={() => onResendInvite(it.id)}
                          disabled={resendingId === it.id}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition shrink-0",
                            "border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-text)] hover:bg-[var(--dash-surface)]",
                            "cursor-pointer active:scale-[0.98] transition-transform",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                            resendingId === it.id &&
                              "opacity-60 cursor-not-allowed hover:bg-[var(--dash-surface-2)] active:scale-100"
                          )}
                          aria-label="Resend invite"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {resendingId === it.id ? "Resending…" : "Resend"}
                        </button>
                      ) : (
                        <div className="text-sm text-[var(--dash-muted)]">—</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end md:mt-0">
                  <RowActionsMenu
                    ariaLabel="Onboarding actions"
                    actions={[
                      { key: "view", label: "View", Icon: Eye, onSelect: () => onView(it.id) },
                      { key: "terminate", label: "Terminate", Icon: Trash2, destructive: true, onSelect: () => onTerminate(it) },
                    ]}
                  />
                </div>
                      </motion.div>
                    );
                  })}
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

