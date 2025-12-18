"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileDown,
  RefreshCcw,
  ShieldCheck,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import {
  approveOnboarding,
  getAdminOnboarding,
  getOnboardingAuditLogs,
  requestModification,
  terminateOnboarding,
  type AdminOnboardingListItem,
} from "@/lib/api/admin/onboardings";
import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import {
  EOnboardingActor,
  EOnboardingAuditAction,
  type TOnboardingAuditActor,
} from "@/types/onboardingAuditLog.types";

import { OnboardingProgress } from "@/components/dashboard/onboardings/OnboardingProgress";
import { TerminateModal } from "@/components/dashboard/onboardings/TerminateModal";
import { ApiError } from "@/lib/api/client";

import { ApproveModal } from "@/components/dashboard/onboardings/ApproveModal";
import { RequestModificationModal } from "@/components/dashboard/onboardings/RequestModificationModal";
import { HrOnboardingEditForm } from "./HrOnboardingEditForm";

type Props = {
  onboardingId: string;
  initialOnboarding: any | null;
  initialError: string | null;
};

function subsidiaryMeta(s: ESubsidiary | string | undefined): {
  name: string;
  code: string;
} {
  if (s === ESubsidiary.INDIA) return { name: "India", code: "IN" };
  if (s === ESubsidiary.CANADA) return { name: "Canada", code: "CA" };
  if (s === ESubsidiary.USA) return { name: "US", code: "US" };
  const v = String(s ?? "").trim();
  return { name: v || "—", code: v || "—" };
}

function fmtDateTime(value?: string | Date | null, tz?: string) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const fmt = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz || undefined,
    timeZoneName: tz ? "short" : undefined,
  });
  return fmt.format(d);
}

function joinLocation(
  loc?: { city?: string; region?: string; country?: string } | null
) {
  if (!loc) return "—";
  const parts = [loc.city, loc.region, loc.country]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function statusAllowsApprove(
  status: EOnboardingStatus,
  isFormComplete: boolean
) {
  if (!isFormComplete) return false;
  return (
    status !== EOnboardingStatus.Approved &&
    status !== EOnboardingStatus.Terminated
  );
}

function statusAllowsModification(
  method: EOnboardingMethod,
  status: EOnboardingStatus,
  isFormComplete: boolean
) {
  if (method !== EOnboardingMethod.DIGITAL) return false;
  if (!isFormComplete) return false;
  return (
    status === EOnboardingStatus.Submitted ||
    status === EOnboardingStatus.Resubmitted ||
    status === EOnboardingStatus.ModificationRequested
  );
}

export function OnboardingDetailsClient({
  onboardingId,
  initialOnboarding,
  initialError,
}: Props) {
  const [onboarding, setOnboarding] = useState<any | null>(initialOnboarding);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [submitActor, setSubmitActor] = useState<{
    action: EOnboardingAuditAction;
    actor: TOnboardingAuditActor;
    createdAt: Date | string;
  } | null>(null);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [modOpen, setModOpen] = useState(false);

  const [working, setWorking] = useState<
    null | "refresh" | "approve" | "modify" | "terminate" | "downloadPdf"
  >(null);

  const loadSubmitActor = useCallback(async () => {
    try {
      // Pull recent logs and infer "who completed" from latest SUBMITTED/RESUBMITTED event.
      const res = await getOnboardingAuditLogs({
        id: onboardingId,
        page: 1,
        pageSize: 25,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      const hit = (res.items ?? []).find(
        (it) =>
          it.action === EOnboardingAuditAction.SUBMITTED ||
          it.action === EOnboardingAuditAction.RESUBMITTED
      ) as any;
      if (hit?.actor?.type && hit?.actor?.email) {
        setSubmitActor({
          action: hit.action as EOnboardingAuditAction,
          actor: hit.actor as TOnboardingAuditActor,
          createdAt: hit.createdAt as any,
        });
      } else {
        setSubmitActor(null);
      }
    } catch {
      // Don't block the page on audit log fetch.
      setSubmitActor(null);
    }
  }, [onboardingId]);

  const refresh = useCallback(async () => {
    setWorking("refresh");
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminOnboarding(onboardingId);
      setOnboarding(res.onboarding);
      // Keep "completed by" signal in sync after refresh.
      loadSubmitActor();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to load onboarding."
      );
    } finally {
      setLoading(false);
      setWorking(null);
    }
  }, [onboardingId]);

  useEffect(() => {
    loadSubmitActor();
  }, [loadSubmitActor]);

  const head = onboarding as AdminOnboardingListItem | null;
  const fullName = useMemo(() => {
    if (!head) return "—";
    return `${head.firstName ?? ""} ${head.lastName ?? ""}`.trim() || "—";
  }, [head]);

  const method = (head?.method ??
    EOnboardingMethod.DIGITAL) as EOnboardingMethod;
  const status = (head?.status ??
    EOnboardingStatus.InviteGenerated) as EOnboardingStatus;
  const isFormComplete = Boolean((head as any)?.isFormComplete);

  const canApprove = head ? statusAllowsApprove(status, isFormComplete) : false;
  const canRequestModification = head
    ? statusAllowsModification(method, status, isFormComplete)
    : false;
  const canTerminate = head ? status !== EOnboardingStatus.Terminated : false;
  const canDownloadPdf = head
    ? head.subsidiary === ESubsidiary.INDIA &&
      Boolean((head as any)?.isFormComplete)
    : false;
  const canEdit = head ? status !== EOnboardingStatus.Terminated : false;

  const locationStr = joinLocation((head as any)?.locationAtSubmit ?? null);
  const tz =
    ((head as any)?.locationAtSubmit?.timezone as string | undefined) ??
    undefined;
  const applicationDateTime =
    (head as any)?.submittedAt ??
    (head as any)?.completedAt ??
    (head as any)?.updatedAt ??
    null;

  const handleDownloadPdf = useCallback(() => {
    if (!head) return;
    setWorking("downloadPdf");
    const url = `/api/v1/admin/onboardings/${encodeURIComponent(
      onboardingId
    )}/filled-pdf/application-form?subsidiary=${encodeURIComponent(
      head.subsidiary
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => setWorking(null), 600);
  }, [head, onboardingId]);

  return (
    <div className="space-y-4">
      {/* Sections */}
      <HrOnboardingEditForm
        onboardingId={onboardingId}
        onboarding={onboarding}
        canEdit={canEdit}
        onSaved={(next) => setOnboarding(next)}
        summaryNode={
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] overflow-hidden">
              <div className="p-5 border-b border-[var(--dash-border)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[var(--dash-muted)]">
                      <span className="uppercase">
                        {subsidiaryMeta((head as any)?.subsidiary).name}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                          "bg-[var(--dash-red-soft)] text-[var(--dash-red)]"
                        )}
                      >
                        {subsidiaryMeta((head as any)?.subsidiary).code}
                      </span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--dash-text)] truncate">
                      {fullName}
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--dash-muted)] truncate">
                      {(head as any)?.email ?? "—"}
                    </div>
                  </div>

                  <div className="w-full sm:w-[320px]">
                    <OnboardingProgress status={status} method={method} />
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  {submitActor?.actor?.type === EOnboardingActor.HR ? (
                    <div className="text-sm text-[var(--dash-text)]">
                      This application was completed by HR:{" "}
                      <span className="font-medium">
                        {submitActor.actor.email}
                      </span>
                      .
                    </div>
                  ) : submitActor?.actor?.type === EOnboardingActor.EMPLOYEE ? (
                    locationStr !== "—" ? (
                      <div className="text-sm text-[var(--dash-text)]">
                        The applicant completed the onboard form at:{" "}
                        <span className="font-medium">{locationStr}</span>.
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--dash-text)]">
                        The applicant completed the onboard form.
                      </div>
                    )
                  ) : method === EOnboardingMethod.MANUAL ? (
                    <div className="text-sm text-[var(--dash-text)]">
                      This application is being completed by HR.
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--dash-text)]">
                      The applicant has not completed the onboard process yet.
                    </div>
                  )}
                  <div className="text-sm text-[var(--dash-muted)]">
                    Date & time of application:{" "}
                    <span className="text-[var(--dash-text)] font-medium">
                      {fmtDateTime(applicationDateTime, tz)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                      loading
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer"
                    )}
                  >
                    <RefreshCcw
                      className={cn(
                        "h-4 w-4",
                        working === "refresh" && "animate-spin"
                      )}
                    />
                    Refresh
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canDownloadPdf && (
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={working === "downloadPdf"}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                        "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                        working === "downloadPdf"
                          ? "opacity-60 cursor-not-allowed"
                          : "cursor-pointer"
                      )}
                    >
                      <FileDown className="h-4 w-4" />
                      Download PDF
                    </button>
                  )}

                  {canRequestModification && (
                    <button
                      type="button"
                      onClick={() => setModOpen(true)}
                      disabled={working != null}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                        "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                        working != null
                          ? "opacity-60 cursor-not-allowed"
                          : "cursor-pointer"
                      )}
                    >
                      <Wand2 className="h-4 w-4" />
                      Request modification
                    </button>
                  )}

                  {canApprove && (
                    <button
                      type="button"
                      onClick={() => setApproveOpen(true)}
                      disabled={working != null}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                        "bg-[var(--dash-red)] text-white hover:opacity-95",
                        working != null
                          ? "opacity-60 cursor-not-allowed"
                          : "cursor-pointer"
                      )}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Approve
                    </button>
                  )}

                  {canTerminate && (
                    <button
                      type="button"
                      onClick={() => setTerminateOpen(true)}
                      disabled={working != null}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                        "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] text-[var(--dash-red)] hover:brightness-[0.98]",
                        working != null
                          ? "opacity-70 cursor-not-allowed"
                          : "cursor-pointer"
                      )}
                    >
                      <Download className="h-4 w-4 rotate-90" />
                      Terminate
                    </button>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] p-4 text-sm">
                <div className="font-semibold text-[var(--dash-red)]">
                  Couldn’t load onboarding
                </div>
                <div className="mt-1 text-[var(--dash-muted)]">{error}</div>
              </div>
            )}
          </div>
        }
      />

      <TerminateModal
        open={terminateOpen}
        onClose={() => setTerminateOpen(false)}
        employeeLabel={fullName}
        onConfirm={async (payload) => {
          setWorking("terminate");
          try {
            await terminateOnboarding(onboardingId, payload);
            await refresh();
          } finally {
            setWorking(null);
          }
        }}
      />

      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        employeeLabel={fullName}
        onConfirm={async (employeeNumber) => {
          setWorking("approve");
          try {
            await approveOnboarding(onboardingId, { employeeNumber });
            await refresh();
          } finally {
            setWorking(null);
          }
        }}
      />

      <RequestModificationModal
        open={modOpen}
        onClose={() => setModOpen(false)}
        employeeLabel={fullName}
        onConfirm={async (message) => {
          setWorking("modify");
          try {
            await requestModification(onboardingId, { message });
            await refresh();
          } finally {
            setWorking(null);
          }
        }}
      />
    </div>
  );
}
