"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type RowAction = {
  key: string;
  label: string;
  onSelect: () => void;
  Icon?: any;
  destructive?: boolean;
  disabled?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function RowActionsMenu({
  actions,
  ariaLabel = "Row actions",
}: {
  actions: RowAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const enabledActions = useMemo(
    () => actions.filter((a) => a && typeof a.onSelect === "function"),
    [actions]
  );

  function compute() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const desiredWidth = clamp(220, 180, 260);

    // Align right edge to button's right edge.
    const left = clamp(rect.right - desiredWidth, margin, vw - desiredWidth - margin);
    const top = clamp(rect.bottom + 8, margin, vh - margin);
    setPos({ top, left, width: desiredWidth });
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      compute();
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", compute);
      window.addEventListener("scroll", compute, true);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  if (enabledActions.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) window.requestAnimationFrame(() => compute());
            return next;
          });
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full border p-2 transition cursor-pointer",
          "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-muted)]",
          "hover:bg-[var(--dash-surface-2)] hover:text-[var(--dash-text)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]"
        )}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && pos && (
          <motion.div
            role="menu"
            className={cn(
              "fixed z-[70] overflow-hidden rounded-2xl border shadow-[var(--dash-shadow)]",
              "border-[var(--dash-border)] bg-[var(--dash-surface)]"
            )}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <div className="py-2">
              {enabledActions.map((a) => {
                const Icon = a.Icon;
                const disabled = Boolean(a.disabled);
                return (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setOpen(false);
                    a.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition",
                    "text-left",
                    a.destructive ? "text-[var(--dash-red)]" : "text-[var(--dash-text)]",
                    "hover:bg-[var(--dash-surface-2)]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                    disabled
                      ? "opacity-60 cursor-not-allowed hover:bg-[var(--dash-surface)]"
                      : "cursor-pointer"
                  )}
                >
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          a.destructive ? "text-[var(--dash-red)]" : "text-[var(--dash-muted)]"
                        )}
                      />
                    ) : (
                      <span className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="flex-1">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

