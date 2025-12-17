import { Suspense } from "react";
import { TerminatedClient } from "./TerminatedClient";

export const dynamic = "force-dynamic";

export default function TerminatedPage() {
  return (
    <Suspense
      fallback={<div className="text-sm text-[var(--dash-muted)]">Loading…</div>}
    >
      <TerminatedClient />
    </Suspense>
  );
}

