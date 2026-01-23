// src/app/(hr)/dashboard/onboardings/[id]/OnboardingDetailsClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileDown, RefreshCcw, ShieldCheck, Wand2, Home } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { confirmDetailsOnboarding, getAdminOnboarding, getOnboardingAuditLogs, requestModification, terminateOnboarding, type AdminOnboardingListItem } from "@/lib/api/admin/onboardings";
import { EOnboardingMethod, EOnboardingStatus } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import { EOnboardingActor, EOnboardingAuditAction, type TOnboardingAuditActor } from "@/types/onboardingAuditLog.types";

import { OnboardingProgress } from "@/components/dashboard/onboardings/OnboardingProgress";
import { TerminateModal } from "@/components/dashboard/onboardings/TerminateModal";
import { ApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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

function joinLocation(loc?: { city?: string; region?: string; country?: string } | null) {
  if (!loc) return "—";
  const parts = [loc.city, loc.region, loc.country].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function statusAllowsApprove(status: EOnboardingStatus, isFormComplete: boolean) {
  // "Confirm Details" button should only show for Submitted/Resubmitted statuses
  // Once DETAILS_CONFIRMED, this button should be hidden (contract flow will handle next steps)
  if (!isFormComplete) return false;
  return status === EOnboardingStatus.Submitted || status === EOnboardingStatus.Resubmitted;
}

function statusAllowsModification(method: EOnboardingMethod, status: EOnboardingStatus, isFormComplete: boolean) {
  if (method !== EOnboardingMethod.DIGITAL) return false;
  if (!isFormComplete) return false;
  return status === EOnboardingStatus.Submitted || status === EOnboardingStatus.Resubmitted || status === EOnboardingStatus.ModificationRequested;
}

type JobState = "PENDING" | "RUNNING" | "DONE" | "ERROR";
type JobStatus = {
  state: JobState;
  progressPercent: number;

  startedAt: string | null;
  updatedAt: string;

  downloadKey: string | null;
  downloadUrl: string | null;

  errorMessage?: string | null;
};

async function readApiJson(res: Response) {
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.message || json?.error?.message || json?.errorMessage || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  // successResponse(...) usually nests under data
  return json?.data ?? json;
}

function buildPdfFilename(fullName: string, code: string) {
  const base = (fullName || "Application").trim();
  // Server sanitizes, we keep it human-readable.
  return `${base} - ${code} Application Form.pdf`;
}

function ApplicationFormPdfButton(props: { onboardingId: string; subsidiary: ESubsidiary; fullName: string; disabled?: boolean; onErrorChange?: (msg: string | null) => void }) {
  const { onboardingId, subsidiary, fullName, disabled, onErrorChange } = props;

  const [uiState, setUiState] = useState<"idle" | "starting" | "polling" | "ready">("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPoll();
  }, [clearPoll]);

  const reset = useCallback(() => {
    clearPoll();
    setUiState("idle");
    setJobId(null);
    setDownloadUrl(null);
    onErrorChange?.(null);
  }, [clearPoll, onErrorChange]);

  const pollStatus = useCallback(
    async (nextJobId: string) => {
      const statusUrl = `/api/v1/admin/onboardings/${encodeURIComponent(onboardingId)}/filled-pdf/application-form/status?jobId=${encodeURIComponent(nextJobId)}&subsidiary=${encodeURIComponent(
        subsidiary
      )}`;

      const res = await fetch(statusUrl, { method: "GET" });
      const payload = await readApiJson(res);

      // route returns { jobId, status }
      const status: JobStatus | null = payload?.status ?? null;

      if (!status) throw new Error("Invalid status response.");

      if (status.state === "DONE") {
        if (!status.downloadUrl) throw new Error("PDF generation completed, but no download URL was provided.");
        clearPoll();
        setDownloadUrl(status.downloadUrl);
        setUiState("ready");
        onErrorChange?.(null);
        return;
      }

      if (status.state === "ERROR") {
        clearPoll();
        setUiState("idle");
        setJobId(null);
        setDownloadUrl(null);
        onErrorChange?.(status.errorMessage || "PDF generation failed.");
        return;
      }

      // PENDING / RUNNING: keep polling
      setUiState("polling");
    },
    [onboardingId, subsidiary, clearPoll, onErrorChange]
  );

  const startJob = useCallback(async () => {
    if (uiState === "starting" || uiState === "polling") return;

    onErrorChange?.(null);
    setUiState("starting");
    setDownloadUrl(null);

    try {
      const filename = buildPdfFilename(fullName, "IN");
      const startUrl = `/api/v1/admin/onboardings/${encodeURIComponent(onboardingId)}/filled-pdf/application-form?subsidiary=${encodeURIComponent(subsidiary)}&filename=${encodeURIComponent(
        filename
      )}`;

      const res = await fetch(startUrl, { method: "POST" });
      const payload = await readApiJson(res);

      const nextJobId: string | null = payload?.jobId ?? null;
      if (!nextJobId) throw new Error("Job ID missing from response.");

      setJobId(nextJobId);

      // Immediately poll once, then every 1s.
      await pollStatus(nextJobId);

      clearPoll();
      pollTimerRef.current = window.setInterval(() => {
        pollStatus(nextJobId).catch((e) => {
          clearPoll();
          setUiState("idle");
          setJobId(null);
          setDownloadUrl(null);
          onErrorChange?.(e instanceof Error ? e.message : "Unable to check PDF status.");
        });
      }, 1000);
    } catch (e) {
      setUiState("idle");
      setJobId(null);
      setDownloadUrl(null);
      onErrorChange?.(e instanceof Error ? e.message : "Unable to start PDF generation.");
    }
  }, [uiState, onboardingId, subsidiary, fullName, pollStatus, clearPoll, onErrorChange]);

  const onClick = useCallback(() => {
    if (uiState === "ready" && downloadUrl) {
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      // Reset to default state after a successful download click.
      reset();
      return;
    }
    startJob();
  }, [uiState, downloadUrl, reset, startJob]);

  const isBusy = uiState === "starting" || uiState === "polling";
  const label = uiState === "ready" ? "Download PDF" : isBusy ? "Generating…" : "Generate PDF";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(disabled) || isBusy}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
        "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
        disabled || isBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      )}
      aria-busy={isBusy}
      aria-live="polite"
      title={jobId ? `Job: ${jobId}` : undefined}
    >
      <FileDown className={cn("h-4 w-4", isBusy && "animate-pulse")} />
      {label}
    </button>
  );
}

export function OnboardingDetailsClient({ onboardingId, initialOnboarding, initialError }: Props) {
  const router = useRouter();
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

  const [working, setWorking] = useState<null | "refresh" | "approve" | "modify" | "terminate">(null);

  // PDF generation UI error (shown under the action row)
  const [pdfError, setPdfError] = useState<string | null>(null);

  const loadSubmitActor = useCallback(async () => {
    // Don't try to load audit logs if onboarding doesn't exist
    if (!onboarding) {
      setSubmitActor(null);
      return;
    }

    try {
      // Pull recent logs and infer "who completed" from latest SUBMITTED/RESUBMITTED event.
      const res = await getOnboardingAuditLogs({
        id: onboardingId,
        page: 1,
        pageSize: 25,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      const hit = (res.items ?? []).find((it) => it.action === EOnboardingAuditAction.SUBMITTED || it.action === EOnboardingAuditAction.RESUBMITTED) as any;
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
  }, [onboardingId, onboarding]);

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
      setError(e instanceof ApiError ? e.message : "Unable to load onboarding.");
    } finally {
      setLoading(false);
      setWorking(null);
    }
  }, [onboardingId, loadSubmitActor]);

  useEffect(() => {
    // Only load submit actor if onboarding exists
    if (onboarding) {
      loadSubmitActor();
    } else {
      setSubmitActor(null);
    }
  }, [loadSubmitActor, onboarding]);

  const head = onboarding as AdminOnboardingListItem | null;
  const fullName = useMemo(() => {
    if (!head) return "—";
    return `${head.firstName ?? ""} ${head.lastName ?? ""}`.trim() || "—";
  }, [head]);

  const method = (head?.method ?? EOnboardingMethod.DIGITAL) as EOnboardingMethod;
  const status = (head?.status ?? EOnboardingStatus.InviteGenerated) as EOnboardingStatus;
  const isFormComplete = Boolean((head as any)?.isFormComplete);

  const canApprove = head ? statusAllowsApprove(status, isFormComplete) : false;
  const canRequestModification = head ? statusAllowsModification(method, status, isFormComplete) : false;
  const canTerminate = head ? status !== EOnboardingStatus.Terminated : false;

  // India-only + only when form complete
  const canGeneratePdf = head ? head.subsidiary === ESubsidiary.INDIA && Boolean((head as any)?.isFormComplete) : false;

  const canEdit = head ? status !== EOnboardingStatus.Terminated : false;

  const locationStr = joinLocation((head as any)?.locationAtSubmit ?? null);
  const tz = ((head as any)?.locationAtSubmit?.timezone as string | undefined) ?? undefined;
  const applicationDateTime = (head as any)?.submittedAt ?? (head as any)?.completedAt ?? (head as any)?.updatedAt ?? null;

  // Show error UI when onboarding is missing or error exists
  if (!onboarding || error) {
    const errorMessage = error || "The application you are trying to view does not exist. It may have been deleted or the link is invalid.";

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] p-8">
          <Alert variant="error" title="Application Not Found" description={errorMessage} className="mb-6" />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="primary" onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-2">
              <Home className="h-4 w-4" />
              Return to Dashboard
            </Button>

            <Button variant="secondary" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2">
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
                      <span className="uppercase">{subsidiaryMeta((head as any)?.subsidiary).name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none", "bg-[var(--dash-red-soft)] text-[var(--dash-red)]")}>
                        {subsidiaryMeta((head as any)?.subsidiary).code}
                      </span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--dash-text)] truncate">{fullName}</div>
                    <div className="mt-0.5 text-sm text-[var(--dash-muted)] truncate">{(head as any)?.email ?? "—"}</div>
                  </div>

                  <div className="w-full sm:max-w-[320px]">
                    <OnboardingProgress status={status} method={method} />
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  {submitActor?.actor?.type === EOnboardingActor.HR ? (
                    <div className="text-sm text-[var(--dash-text)]">
                      This application was completed by HR: <span className="font-medium">{submitActor.actor.email}</span>.
                    </div>
                  ) : submitActor?.actor?.type === EOnboardingActor.EMPLOYEE ? (
                    locationStr !== "—" ? (
                      <div className="text-sm text-[var(--dash-text)]">
                        The applicant completed the onboard form at: <span className="font-medium">{locationStr}</span>.
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--dash-text)]">The applicant completed the onboard form.</div>
                    )
                  ) : method === EOnboardingMethod.MANUAL ? (
                    <div className="text-sm text-[var(--dash-text)]">This application is being completed by HR.</div>
                  ) : (
                    <div className="text-sm text-[var(--dash-text)]">The applicant has not completed the onboard process yet.</div>
                  )}
                  <div className="text-sm text-[var(--dash-muted)]">
                    Date & time of application: <span className="text-[var(--dash-text)] font-medium">{fmtDateTime(applicationDateTime, tz)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={refresh}
                      disabled={loading}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                        "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                        loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <RefreshCcw className={cn("h-4 w-4", working === "refresh" && "animate-spin")} />
                      Refresh
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canGeneratePdf && head && (
                      <ApplicationFormPdfButton
                        onboardingId={onboardingId}
                        subsidiary={head.subsidiary as ESubsidiary}
                        fullName={fullName === "—" ? "" : fullName}
                        disabled={working != null}
                        onErrorChange={setPdfError}
                      />
                    )}

                    {canRequestModification && (
                      <button
                        type="button"
                        onClick={() => setModOpen(true)}
                        disabled={working != null}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                          "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                          working != null ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
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
                          working != null ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Approve details
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
                          working != null ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        <Download className="h-4 w-4 rotate-90" />
                        Terminate
                      </button>
                    )}
                  </div>
                </div>

                {/* PDF error under the action row (as requested) */}
                {pdfError && <div className="mt-2 text-sm text-[var(--dash-red)]">{pdfError}</div>}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] p-4 text-sm">
                <div className="font-semibold text-[var(--dash-red)]">Couldn’t load onboarding</div>
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
        variant="confirmDetails"
        onConfirm={async () => {
          // confirmDetails variant doesn't need employeeNumber parameter
          setWorking("approve");
          try {
            // Phase A finalization: confirm details only (Contracts & Policies comes next)
            await confirmDetailsOnboarding(onboardingId);
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
