// src/app/(hr)/dashboard/DashboardHomeClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ESubsidiary } from "@/types/shared.types";
import { ApiError } from "@/lib/api/client";
import {
  getAdminOnboardings,
  resendOnboardingInvite,
  terminateOnboarding,
  type AdminOnboardingListItem,
  generateOnboardingsReport,
  getOnboardingsReportStatus,
} from "@/lib/api/admin/onboardings";

import { TerminateModal } from "@/components/dashboard/onboardings/TerminateModal";
import { InviteEmployeeModal } from "@/components/dashboard/onboardings/InviteEmployeeModal";
import { OnboardingsDataGrid } from "@/components/dashboard/onboardings/OnboardingsDataGrid";
import {
  DataOperationsBar,
  type StatusGroupKey,
} from "@/components/dashboard/onboardings/DataOperationsBar";

const PAGE_SIZE = 20;

export function DashboardHomeClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const q = sp.get("q") ?? "";
  const subsidiary =
    (sp.get("subsidiary") as ESubsidiary | null) ?? ESubsidiary.INDIA;
  const statusGroupRaw = sp.get("statusGroup") ?? "";
  const statusGroupAllowed: readonly StatusGroupKey[] = [
    "",
    "pending",
    "modificationRequested",
    "pendingReview",
    "approved",
    "manual",
  ] as const;
  const statusGroup = statusGroupAllowed.includes(
    statusGroupRaw as StatusGroupKey,
  )
    ? (statusGroupRaw as StatusGroupKey)
    : "";
  const hasEmployeeNumber = sp.get("hasEmployeeNumber") ?? "";

  const dateField = (sp.get("dateField") ?? "created") as
    | "created"
    | "submitted"
    | "approved"
    | "terminated"
    | "updated";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const [searchDraft, setSearchDraft] = useState(q);
  const [items, setItems] = useState<AdminOnboardingListItem[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [selected, setSelected] = useState<AdminOnboardingListItem | null>(
    null,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  type ExportUiState =
    | { state: "idle" }
    | { state: "running"; showProgress: boolean; progressPercent: number }
    | { state: "ready"; downloadUrl: string }
    | { state: "error"; message: string };

  const [exportState, setExportState] = useState<ExportUiState>({
    state: "idle",
  });

  useEffect(() => {
    // Any change to export-relevant filters invalidates previous export result.
    setExportState({ state: "idle" });
  }, [
    subsidiary,
    q,
    statusGroup,
    hasEmployeeNumber,
    dateField,
    from,
    to,
    // if you later make sort dynamic, include it here too
    // sortBy, sortDir
  ]);

  const isSupportedSubsidiary = subsidiary === ESubsidiary.INDIA;

  // Remember last selected subsidiary for other dashboard pages (e.g. Terminated).
  useEffect(() => {
    try {
      localStorage.setItem("dash_subsidiary", subsidiary);
    } catch {
      // ignore
    }
  }, [subsidiary]);

  // Keep draft in sync when URL changes externally (back/forward)
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const updateQuery = useCallback(
    (next: Record<string, string | undefined>) => {
      const nextSp = new URLSearchParams(sp.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (!v) nextSp.delete(k);
        else nextSp.set(k, v);
      });
      if (!("page" in next)) nextSp.set("page", "1");
      router.replace(`/dashboard?${nextSp.toString()}`);
    },
    [router, sp],
  );

  // Debounced search
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (searchDraft !== q) updateQuery({ q: searchDraft || undefined });
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchDraft, q, updateQuery]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupportedSubsidiary) {
        // V1: only INDIA is implemented. Don't call the API for CA/US.
        setError(null);
        setItems([]);
        setPages(1);
        setTotal(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await getAdminOnboardings({
          subsidiary,
          q: q || undefined,
          statusGroup: statusGroup || undefined,
          hasEmployeeNumber:
            hasEmployeeNumber === "true" || hasEmployeeNumber === "false"
              ? (hasEmployeeNumber as "true" | "false")
              : undefined,
          dateField,
          from: from || undefined,
          to: to || undefined,
          page,
          pageSize: PAGE_SIZE,
          sortBy: "createdAt",
          sortDir: "desc",
        });
        if (cancelled) return;
        setItems(res.items);
        // Backend meta uses `totalPages` (not `pages`)
        setPages(
          Number.isFinite(res.meta.totalPages) ? res.meta.totalPages : 1,
        );
        setTotal(res.meta.total);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) setError(e.message);
        else setError("Unable to load onboardings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    reloadNonce,
    isSupportedSubsidiary,
    subsidiary,
    q,
    statusGroup,
    hasEmployeeNumber,
    dateField,
    from,
    to,
    page,
  ]);

  async function copyLink(url?: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  function triggerBrowserDownload(url: string, filename?: string) {
    // Use an <a> click so the browser shows the standard download behavior.
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function runExport() {
    if (!isSupportedSubsidiary) return;
    if (exportState.state === "running") return;

    setExportState({
      state: "running",
      showProgress: false,
      progressPercent: 0,
    });

    // After 1s, only then show progress (if still running)
    const showTimer = window.setTimeout(() => {
      setExportState((prev) =>
        prev.state === "running" ? { ...prev, showProgress: true } : prev,
      );
    }, 1000);

    let pollId: number | null = null;
    let didAutoDownload = false;

    try {
      // Build export params from current filters (IGNORE page/pageSize intentionally)
      const res = await generateOnboardingsReport({
        subsidiary,
        q: q || undefined,
        statusGroup: statusGroup || undefined,
        hasEmployeeNumber:
          hasEmployeeNumber === "true" || hasEmployeeNumber === "false"
            ? (hasEmployeeNumber as "true" | "false")
            : undefined,
        dateField,
        from: from || undefined,
        to: to || undefined,
        sortBy: "createdAt",
        sortDir: "desc",
        format: "xlsx",
        // filename: optional, if you want:
        // filename: `onboardings-${subsidiary.toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`,
      });

      const jobId = res.jobId;

      const pollOnce = async () => {
        const st = await getOnboardingsReportStatus(jobId);
        const s = st.status;

        if (s.state === "ERROR") {
          const msg = s.errorMessage || "Export failed.";
          setExportState({ state: "error", message: msg });
          if (pollId) window.clearInterval(pollId);
          return;
        }

        if (s.state === "DONE") {
          if (pollId) window.clearInterval(pollId);

          const url = s.downloadUrl;
          if (!url) {
            setExportState({
              state: "error",
              message: "Export completed but no download URL was provided.",
            });
            return;
          }

          setExportState({ state: "ready", downloadUrl: url });

          // Auto-trigger once for convenience; user can still click "Download" again.
          if (!didAutoDownload) {
            didAutoDownload = true;
            triggerBrowserDownload(url);
          }
          return;
        }

        // PENDING/RUNNING
        setExportState((prev) => {
          if (prev.state !== "running") return prev;
          return {
            ...prev,
            progressPercent: Number.isFinite(s.progressPercent)
              ? s.progressPercent
              : prev.progressPercent,
          };
        });
      };

      // Poll immediately once (but UI still hides % until the 1s timer flips showProgress)
      await pollOnce();
      pollId = window.setInterval(() => {
        void pollOnce();
      }, 1000);
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" && e.message.trim().length
          ? e.message
          : "Server error. Please try again.";
      setExportState({ state: "error", message: msg });
    } finally {
      window.clearTimeout(showTimer);
    }

    // Cleanup on unmount / route change
    return () => {
      window.clearTimeout(showTimer);
      if (pollId) window.clearInterval(pollId);
    };
  }

  return (
    <div className="space-y-5">
      <DataOperationsBar
        variant="home"
        searchDraft={searchDraft}
        onSearchDraft={setSearchDraft}
        subsidiary={subsidiary}
        onSubsidiary={(s) => {
          try {
            localStorage.setItem("dash_subsidiary", s);
          } catch {
            // ignore
          }
          updateQuery({ subsidiary: s });
        }}
        supported={isSupportedSubsidiary}
        canSendInvite={isSupportedSubsidiary}
        statusGroup={statusGroup}
        hasEmployeeNumber={hasEmployeeNumber}
        dateField={dateField}
        from={from}
        to={to}
        onUpdateQuery={updateQuery}
        onSendInvite={() => {
          setInviteOpen(true);
        }}
        exportState={exportState}
        onExport={() => {
          // Reset any prior error/ready state and run
          if (exportState.state === "error" || exportState.state === "ready") {
            setExportState({ state: "idle" });
          }
          void runExport();
        }}
        onDownloadExport={(url) => triggerBrowserDownload(url)}
      />

      {!isSupportedSubsidiary ? (
        <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6 shadow-[var(--dash-shadow)]">
          <div className="text-lg font-semibold">
            {subsidiary === ESubsidiary.CANADA
              ? "Onboardly Canada will be implemented in V2."
              : "Onboardly US will be implemented in V2."}
          </div>
          <div className="mt-2 text-sm text-[var(--dash-muted)]">
            Switch back to{" "}
            <span className="font-semibold">Onboardly India</span> to view and
            manage onboardings in V1.
          </div>
        </div>
      ) : (
        <OnboardingsDataGrid
          items={items}
          loading={loading}
          error={error}
          page={page}
          pages={pages}
          total={total}
          onPage={(p) => updateQuery({ page: String(p) })}
          onCopyLink={copyLink}
          onView={(id) => router.push(`/dashboard/onboardings/${id}`)}
          onTerminate={(it) => {
            setSelected(it);
            setTerminateOpen(true);
          }}
          onResendInvite={async (id) => {
            try {
              setResendingId(id);
              await resendOnboardingInvite(id);
              setReloadNonce((n) => n + 1);
            } catch (e) {
              if (e instanceof ApiError) setError(e.message);
              else setError("Unable to resend invite right now.");
            } finally {
              setResendingId(null);
            }
          }}
          resendingId={resendingId}
        />
      )}

      <TerminateModal
        open={terminateOpen}
        onClose={() => setTerminateOpen(false)}
        employeeLabel={
          selected ? `${selected.firstName} ${selected.lastName}` : ""
        }
        onConfirm={async (payload) => {
          if (!selected) return;
          await terminateOnboarding(selected.id, payload);
          setTerminateOpen(false);
          setReloadNonce((n) => n + 1);
        }}
      />

      <InviteEmployeeModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        subsidiary={subsidiary}
        onCreated={() => setReloadNonce((n) => n + 1)}
      />
    </div>
  );
}
