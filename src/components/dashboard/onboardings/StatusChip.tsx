"use client";

import { cn } from "@/lib/utils/cn";
import { EOnboardingStatus } from "@/types/onboarding.types";

function mapStatus(status: EOnboardingStatus) {
  switch (status) {
    case EOnboardingStatus.InviteGenerated:
    case EOnboardingStatus.ManualPDFSent:
      return { label: status === EOnboardingStatus.InviteGenerated ? "Pending" : "Manual PDF sent", tone: "neutral" as const };
    case EOnboardingStatus.ModificationRequested:
      return { label: "Modification requested", tone: "warn" as const };
    case EOnboardingStatus.Submitted:
    case EOnboardingStatus.Resubmitted:
      return { label: "Pending review", tone: "info-lite" as const };
    case EOnboardingStatus.DETAILS_CONFIRMED:
      return { label: "Details confirmed", tone: "info" as const };
    case EOnboardingStatus.CONTRACT_SENT:
      return { label: "Contract sent", tone: "contract-lite" as const };
    case EOnboardingStatus.CONTRACT_SUBMITTED:
      return { label: "Contract submitted", tone: "contract" as const };
    case EOnboardingStatus.Approved:
      return { label: "Approved", tone: "success" as const };
    case EOnboardingStatus.Terminated:
      return { label: "Terminated", tone: "danger" as const };
    default:
      return { label: status, tone: "neutral" as const };
  }
}

export function StatusChip({ status }: { status: EOnboardingStatus }) {
  const { label, tone } = mapStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "neutral" && "bg-[var(--dash-surface-2)] text-[var(--dash-muted)] border-[var(--dash-border)]",
        tone === "warn" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
        tone === "info-lite" && "bg-[var(--dash-blue-light-soft)] text-[var(--dash-blue-light)] border-[var(--dash-blue-light-soft)]",
        tone === "info" && "bg-[var(--dash-blue-soft)] text-[var(--dash-blue)] border-[var(--dash-blue-soft)]",
        tone === "contract-lite" && "bg-[var(--dash-indigo-light-soft)] text-[var(--dash-indigo-light)] border-[var(--dash-indigo-light-soft)]",
        tone === "contract" && "bg-[var(--dash-indigo-soft)] text-[var(--dash-indigo)] border-[var(--dash-indigo-soft)]",
        tone === "success" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        tone === "danger" && "bg-[var(--dash-red-soft)] text-[var(--dash-red)] border-[var(--dash-red-soft)]"
      )}
    >
      {label}
    </span>
  );
}

