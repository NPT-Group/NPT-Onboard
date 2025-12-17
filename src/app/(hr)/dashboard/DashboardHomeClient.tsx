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
    statusGroupRaw as StatusGroupKey
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
    null
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

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
    [router, sp]
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
          Number.isFinite(res.meta.totalPages) ? res.meta.totalPages : 1
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

  return (
    <div className="space-y-5">
      <DataOperationsBar
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
      />

      {!isSupportedSubsidiary ? (
        <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6 shadow-[var(--dash-shadow)]">
          <div className="text-lg font-semibold">
            {subsidiary === ESubsidiary.CANADA
              ? "NPT Canada will be implemented in V2."
              : "NPT US will be implemented in V2."}
          </div>
          <div className="mt-2 text-sm text-[var(--dash-muted)]">
            Switch back to <span className="font-semibold">NPT India</span> to
            view and manage onboardings in V1.
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
