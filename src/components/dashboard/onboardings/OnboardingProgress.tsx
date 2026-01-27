"use client";

import { cn } from "@/lib/utils/cn";
import { EOnboardingMethod, EOnboardingStatus, type EOnboardingMethod as TOnboardingMethod } from "@/types/onboarding.types";

type ProgressModel = {
  title: string;
  subtitle: string;
  pct: number; // 0..100
  tone: "neutral" | "warn" | "info-lite" | "info" | "contract-lite" | "contract" | "success" | "danger";
};

function mapProgress(status: EOnboardingStatus, method?: TOnboardingMethod): ProgressModel {
  // Apple-inspired: smooth color progression with clear visual hierarchy
  // Progression: Gray (20%) → Amber (40%) → Light Blue (55%) → Dark Blue (70%) → Indigo (85-92%) → Green (100%)
  // Earlier states use lighter shades, later states use darker shades within the same color family
  switch (status) {
    case EOnboardingStatus.InviteGenerated:
      return {
        title: "Invite sent",
        subtitle: method === EOnboardingMethod.MANUAL ? "Waiting for HR upload" : "Waiting for employee",
        pct: 20,
        tone: "neutral",
      };
    case EOnboardingStatus.ManualPDFSent:
      return { title: "Manual sent", subtitle: "Awaiting employee email", pct: 20, tone: "neutral" };
    case EOnboardingStatus.ModificationRequested:
      return { title: "Needs changes", subtitle: "Awaiting employee update", pct: 40, tone: "warn" };
    case EOnboardingStatus.Submitted:
      return { title: "Pending review", subtitle: "HR review in progress", pct: 55, tone: "info-lite" };
    case EOnboardingStatus.Resubmitted:
      return { title: "Pending review · Resubmitted", subtitle: "HR review in progress", pct: 55, tone: "info-lite" };
    case EOnboardingStatus.DETAILS_CONFIRMED:
      return { title: "Details confirmed", subtitle: "Ready for contracts & policies", pct: 70, tone: "info" };
    case EOnboardingStatus.CONTRACT_SENT:
      return { title: "Contract sent", subtitle: "Awaiting employee signature", pct: 85, tone: "contract-lite" };
    case EOnboardingStatus.CONTRACT_SUBMITTED:
      return { title: "Contract submitted", subtitle: "HR review in progress", pct: 92, tone: "contract" };
    case EOnboardingStatus.Approved:
      return { title: "Approved", subtitle: "Onboarding finalized", pct: 100, tone: "success" };
    case EOnboardingStatus.Terminated:
      return { title: "Terminated", subtitle: "Closed", pct: 100, tone: "danger" };
    default:
      return { title: status, subtitle: "—", pct: 0, tone: "neutral" };
  }
}

export function OnboardingProgress({
  status,
  method,
}: {
  status: EOnboardingStatus;
  method?: TOnboardingMethod;
}) {
  const m = mapProgress(status, method);

  // Apple-inspired color progression: earlier states use lighter shades, later states use darker shades
  const dotClass =
    m.tone === "success"
      ? "bg-emerald-500"
      : m.tone === "contract"
        ? "bg-[var(--dash-indigo)]" /* Darker indigo for Contract Submitted */
        : m.tone === "contract-lite"
          ? "bg-[var(--dash-indigo-light)]" /* Lighter indigo for Contract Sent */
          : m.tone === "info"
            ? "bg-[var(--dash-blue)]" /* Darker blue for Details Confirmed */
            : m.tone === "info-lite"
              ? "bg-[var(--dash-blue-light)]" /* Lighter blue for Submitted/Resubmitted */
              : m.tone === "warn"
                ? "bg-amber-500"
                : m.tone === "danger"
                  ? "bg-[var(--dash-red)]"
                  : "bg-[var(--dash-muted)]";

  const fillClass =
    m.tone === "success"
      ? "bg-emerald-500"
      : m.tone === "contract"
        ? "bg-[var(--dash-indigo)]" /* Darker indigo for Contract Submitted */
        : m.tone === "contract-lite"
          ? "bg-[var(--dash-indigo-light)]" /* Lighter indigo for Contract Sent */
          : m.tone === "info"
            ? "bg-[var(--dash-blue)]" /* Darker blue for Details Confirmed */
            : m.tone === "info-lite"
              ? "bg-[var(--dash-blue-light)]" /* Lighter blue for Submitted/Resubmitted */
              : m.tone === "warn"
                ? "bg-amber-500"
                : m.tone === "danger"
                  ? "bg-[var(--dash-red)]"
                  : "bg-[var(--dash-muted)]";

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-2 w-2 rounded-full", dotClass)} aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{m.title}</div>
          <div className="mt-0.5 text-xs text-[var(--dash-muted)] truncate">
            {m.subtitle}
          </div>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--dash-surface-2)] border border-[var(--dash-border)] overflow-hidden">
        <div
          className={cn("h-full rounded-full", fillClass)}
          style={{ width: `${m.pct}%` }}
        />
      </div>
    </div>
  );
}

