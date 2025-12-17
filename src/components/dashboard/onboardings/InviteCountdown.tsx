"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function InviteCountdown({
  expiresAt,
  hideWhenExpired,
  nowMs,
}: {
  expiresAt?: string | Date;
  /** If true, render nothing when the timer has expired. */
  hideWhenExpired?: boolean;
  /** Optional shared clock (ms since epoch) to avoid per-row intervals. */
  nowMs?: number;
}) {
  const target = useMemo(() => {
    if (!expiresAt) return null;
    const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    return isNaN(d.getTime()) ? null : d;
  }, [expiresAt]);

  const [localNow, setLocalNow] = useState(() => Date.now());
  const now = nowMs ?? localNow;

  useEffect(() => {
    // If a shared clock is provided, do not create an interval here.
    if (!target || nowMs != null) return;
    const id = window.setInterval(() => setLocalNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target, nowMs]);

  if (!target) return null;

  const remaining = target.getTime() - now;
  const expired = remaining <= 0;

  if (expired && hideWhenExpired) return null;

  return (
    <span
      className={[
        "text-[11px] font-medium leading-none whitespace-nowrap",
        expired ? "text-[var(--dash-red)]" : "text-[var(--dash-muted)]",
      ].join(" ")}
      title={target.toLocaleString()}
    >
      {formatRemaining(remaining)}
    </span>
  );
}

