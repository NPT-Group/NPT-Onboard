"use client";

import { Eye, Trash2, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import type { AdminOnboardingListItem } from "@/lib/api/admin/onboardings";
import { cn } from "@/lib/utils/cn";
import { OnboardingProgress } from "@/components/dashboard/onboardings/OnboardingProgress";
import { SmartPagination } from "@/components/dashboard/pagination/SmartPagination";
import { RowActionsMenu } from "@/components/dashboard/onboardings/RowActionsMenu";

const GRID_COLS = "md:grid-cols-[1.25fr_1.2fr_1.35fr_0.9fr_0.9fr]";

function formatMethodLabel(method: unknown): string {
  const v = String(method ?? "").trim().toLowerCase();
  if (v === "digital") return "Digital";
  if (v === "manual") return "Manual";
  return String(method ?? "—");
}

function formatTerminationType(value?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v;
}

export function TerminatedDataGrid({
  items,
  loading,
  error,
  page,
  pages,
  total,
  onPage,
  onView,
  onRestore,
  onDelete,
}: {
  items: AdminOnboardingListItem[];
  loading: boolean;
  error: string | null;
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
  onView: (id: string) => void;
  onRestore: (item: AdminOnboardingListItem) => void;
  onDelete: (item: AdminOnboardingListItem) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--dash-border)]">
          <div className="text-xs font-semibold text-[var(--dash-muted)]">
            {loading ? "Loading…" : error ? "—" : `${total} result(s)`}
          </div>
          <SmartPagination page={page} pages={pages} onPage={onPage} />
        </div>

        <div
          className={cn(
            "hidden md:grid gap-4 px-5 py-3 border-b border-[var(--dash-border)] text-xs font-semibold text-[var(--dash-muted)]",
            GRID_COLS
          )}
        >
          <div>Employee</div>
          <div>Email</div>
          <div>Progress</div>
          <div className="text-center">Termination type</div>
          <div className="text-right">Actions</div>
        </div>

        {error ? (
          <div className="px-5 py-8 text-sm text-[var(--dash-muted)]">{error}</div>
        ) : (
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
                  className="px-5 py-8 text-sm text-[var(--dash-muted)]"
                >
                  Loading terminated onboardings…
                </motion.div>
              ) : items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-5 py-10 text-sm text-[var(--dash-muted)]"
                >
                  No terminated onboardings found.
                </motion.div>
              ) : (
                <>
                  {items.map((it, index) => {
              const terminationType = formatTerminationType(it.terminationType);
              const isResigned = terminationType === "Resigned";
              const fullName = `${it.firstName} ${it.lastName}`.trim();
              const methodLabel = formatMethodLabel(it.method);

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
                    "border-b border-[var(--dash-border)] px-5 py-4",
                    "md:grid md:grid-cols-[1.25fr_1.2fr_1.35fr_0.9fr_0.9fr] md:gap-4 md:items-center"
                  )}
                >
                {/* Employee */}
                <div className="min-w-0">
                  <div className="text-xs text-[var(--dash-muted)] truncate">
                    EN#:{" "}
                    <span className="font-mono text-[var(--dash-text)]">
                      {it.employeeNumber || "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--dash-text)] truncate">
                    {fullName}
                  </div>

                  {/* Mobile: stack email/method under name */}
                  <div className="mt-1 text-xs text-[var(--dash-muted)] truncate md:hidden">
                    {it.email}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--dash-muted)] md:hidden">
                    {methodLabel}
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

                {/* Progress */}
                <div className="mt-4 md:mt-0">
                  <OnboardingProgress status={it.status} method={it.method} />
                </div>

                {/* Termination type */}
                <div className="mt-4 md:mt-0 md:flex md:items-center md:justify-center">
                  {terminationType ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        isResigned
                          ? "border border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-text)]"
                          : "bg-[var(--dash-red-soft)] text-[var(--dash-red)]"
                      )}
                      title={terminationType}
                    >
                      {terminationType}
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--dash-muted)]">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 md:mt-0 flex items-center justify-end">
                  <RowActionsMenu
                    ariaLabel="Terminated onboarding actions"
                    actions={[
                      { key: "view", label: "View", Icon: Eye, onSelect: () => onView(it.id) },
                      { key: "restore", label: "Restore", Icon: Undo2, onSelect: () => onRestore(it) },
                      { key: "delete", label: "Delete", Icon: Trash2, destructive: true, onSelect: () => onDelete(it) },
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


