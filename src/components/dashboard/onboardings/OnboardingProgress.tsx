"use client";

import { cn } from "@/lib/utils/cn";
import { EOnboardingMethod, EOnboardingStatus, type EOnboardingMethod as TOnboardingMethod } from "@/types/onboarding.types";

type ProgressModel = {
  title: string;
  subtitle: string;
  pct: number; // 0..100
  tone: "neutral" | "info" | "warn" | "success" | "danger";
};

function mapProgress(status: EOnboardingStatus, method?: TOnboardingMethod): ProgressModel {
  // Apple-ish: subtle dot + thin progress rail + short subtitle.
  switch (status) {
    case EOnboardingStatus.InviteGenerated:
      return {
        title: "Invite sent",
        subtitle: method === EOnboardingMethod.MANUAL ? "Waiting for HR upload" : "Waiting for employee",
        pct: 20,
        // Keep this visually calmer than "Pending review" so HR can scan.
        tone: "neutral",
      };
    case EOnboardingStatus.ModificationRequested:
      return { title: "Needs changes", subtitle: "Awaiting employee update", pct: 55, tone: "warn" };
    case EOnboardingStatus.Submitted:
      return { title: "Pending review", subtitle: "HR review in progress", pct: 75, tone: "info" };
    case EOnboardingStatus.Resubmitted:
      return { title: "Pending review · Resubmitted", subtitle: "HR review in progress", pct: 75, tone: "info" };
    case EOnboardingStatus.Approved:
      return { title: "Approved", subtitle: "Completed", pct: 100, tone: "success" };
    case EOnboardingStatus.ManualPDFSent:
      return { title: "Manual sent", subtitle: "Awaiting employee email", pct: 20, tone: "neutral" };
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

  const dotClass =
    m.tone === "success"
      ? "bg-emerald-500"
      : m.tone === "warn"
      ? "bg-amber-500"
      : m.tone === "danger"
      ? "bg-[var(--dash-red)]"
      : m.tone === "info"
      ? "bg-[var(--dash-red-2)]"
      : "bg-[var(--dash-muted)]";

  const fillClass =
    m.tone === "success"
      ? "bg-emerald-500"
      : m.tone === "warn"
      ? "bg-amber-500"
      : m.tone === "danger"
      ? "bg-[var(--dash-red)]"
      : m.tone === "info"
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

