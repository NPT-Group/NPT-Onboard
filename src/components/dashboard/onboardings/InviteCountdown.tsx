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
}: {
  expiresAt?: string | Date;
  /** If true, render nothing when the timer has expired. */
  hideWhenExpired?: boolean;
}) {
  const target = useMemo(() => {
    if (!expiresAt) return null;
    const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    return isNaN(d.getTime()) ? null : d;
  }, [expiresAt]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

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

