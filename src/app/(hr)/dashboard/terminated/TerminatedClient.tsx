"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  deleteOnboarding,
  getAdminOnboardings,
  restoreOnboarding,
  type AdminOnboardingListItem,
} from "@/lib/api/admin/onboardings";
import { DataOperationsBar } from "@/components/dashboard/onboardings/DataOperationsBar";
import { TerminatedDataGrid } from "@/components/dashboard/onboardings/TerminatedDataGrid";
import { RestoreModal } from "@/components/dashboard/onboardings/RestoreModal";
import { DeleteOnboardingModal } from "@/components/dashboard/onboardings/DeleteOnboardingModal";
import { ESubsidiary } from "@/types/shared.types";

const PAGE_SIZE = 20;

export function TerminatedClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const q = sp.get("q") ?? "";
  const subsidiaryFromUrl = sp.get("subsidiary") as ESubsidiary | null;

  const [subsidiary, setSubsidiary] = useState<ESubsidiary | null>(
    subsidiaryFromUrl,
  );

  // Resolve subsidiary from URL → localStorage → null (requires home selection).
  useEffect(() => {
    if (subsidiaryFromUrl) {
      setSubsidiary(subsidiaryFromUrl);
      try {
        localStorage.setItem("dash_subsidiary", subsidiaryFromUrl);
      } catch {
        // ignore
      }
      return;
    }

    try {
      const saved = localStorage.getItem(
        "dash_subsidiary",
      ) as ESubsidiary | null;
      if (saved) {
        setSubsidiary(saved);
      } else {
        setSubsidiary(null);
      }
    } catch {
      setSubsidiary(null);
    }
  }, [subsidiaryFromUrl]);

  const isSupportedSubsidiary = subsidiary === ESubsidiary.INDIA;

  const [searchDraft, setSearchDraft] = useState(q);
  const [items, setItems] = useState<AdminOnboardingListItem[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<AdminOnboardingListItem | null>(
    null,
  );

  const employeeLabel = useMemo(() => {
    if (!selected) return "";
    return `${selected.firstName} ${selected.lastName}`.trim();
  }, [selected]);

  const updateQuery = useCallback(
    (next: Record<string, string | undefined>) => {
      const nextSp = new URLSearchParams(sp.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (!v) nextSp.delete(k);
        else nextSp.set(k, v);
      });
      if (!("page" in next)) nextSp.set("page", "1");
      router.replace(`/dashboard/terminated?${nextSp.toString()}`);
    },
    [router, sp],
  );

  // If subsidiary was resolved from storage, keep URL canonical (no switcher on this page).
  useEffect(() => {
    if (!subsidiary) return;
    if (subsidiaryFromUrl) return;
    updateQuery({ subsidiary });
  }, [subsidiary, subsidiaryFromUrl]);

  // Keep draft in sync when URL changes externally (back/forward)
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

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
      if (!subsidiary) {
        setError(null);
        setItems([]);
        setPages(1);
        setTotal(0);
        setLoading(false);
        return;
      }

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
          statusGroup: "terminated",
          page,
          pageSize: PAGE_SIZE,
          sortBy: "terminatedAt",
          sortDir: "desc",
          dateField: "terminated",
        });
        if (cancelled) return;
        setItems(res.items);
        setPages(
          Number.isFinite(res.meta.totalPages) ? res.meta.totalPages : 1,
        );
        setTotal(res.meta.total);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) setError(e.message);
        else setError("Unable to load terminated onboardings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce, subsidiary, isSupportedSubsidiary, q, page]);

  if (!subsidiary) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Terminated</h1>
        <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6 shadow-[var(--dash-shadow)]">
          <div className="text-lg font-semibold">Select a subsidiary first</div>
          <div className="mt-2 text-sm text-[var(--dash-muted)]">
            Terminated onboardings are scoped by subsidiary. Go to{" "}
            <Link href="/dashboard" className="font-semibold underline">
              Home
            </Link>{" "}
            and select a subsidiary, then come back.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Terminated</h1>
        <p className="text-sm text-[var(--dash-muted)]">
          Terminated and resigned applications are only shown here.
        </p>
      </div>

      <DataOperationsBar
        variant="terminated"
        searchDraft={searchDraft}
        onSearchDraft={setSearchDraft}
        supported={isSupportedSubsidiary}
      />

      {!isSupportedSubsidiary ? (
        <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6 shadow-[var(--dash-shadow)]">
          <div className="text-lg font-semibold">
            This subsidiary will be implemented in V2.
          </div>
          <div className="mt-2 text-sm text-[var(--dash-muted)]">
            Switch back to{" "}
            <span className="font-semibold">Onboardly India</span> on Home to
            manage terminated onboardings in V1.
          </div>
        </div>
      ) : (
        <TerminatedDataGrid
          items={items}
          loading={loading}
          error={error}
          page={page}
          pages={pages}
          total={total}
          onPage={(p: number) => updateQuery({ page: String(p) })}
          onView={(id: string) => router.push(`/dashboard/onboardings/${id}`)}
          onRestore={(it: AdminOnboardingListItem) => {
            setSelected(it);
            setRestoreOpen(true);
          }}
          onDelete={(it: AdminOnboardingListItem) => {
            setSelected(it);
            setDeleteOpen(true);
          }}
        />
      )}

      <RestoreModal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        employeeLabel={employeeLabel}
        onConfirm={async () => {
          if (!selected) return;
          await restoreOnboarding(selected.id);
          setRestoreOpen(false);
          setReloadNonce((n) => n + 1);
        }}
      />

      <DeleteOnboardingModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        employeeLabel={employeeLabel}
        onConfirm={async () => {
          if (!selected) return;
          await deleteOnboarding(selected.id);
          setDeleteOpen(false);
          setReloadNonce((n) => n + 1);
        }}
      />
    </div>
  );
}
