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

  const enabledActions = useMemo(
    () => actions.filter((a) => a && typeof a.onSelect === "function"),
    [actions]
  );

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
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (enabledActions.length === 0) return null;

  return (
    <div ref={rootRef} className="relative inline-flex items-center justify-end">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full border p-2 transition cursor-pointer",
          "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-muted)]",
          "hover:bg-[var(--dash-surface-2)] hover:text-[var(--dash-text)]",
          open && "bg-[var(--dash-surface-2)] text-[var(--dash-text)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]"
        )}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className={cn(
              // Inline "drawer" anchored to the row; absolute so it never changes row height.
              "absolute z-[70] overflow-hidden rounded-2xl border shadow-[var(--dash-shadow)]",
              "border-[var(--dash-border)] bg-[var(--dash-surface)]",
              // Sit just to the left of the trigger button.
              "right-10 top-1/2 -translate-y-1/2"
            )}
            style={{ width: 240 }}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 14 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 p-2">
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
                      // Drawer-style buttons (not list items)
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      "whitespace-nowrap",
                      a.destructive
                        ? "border-[var(--dash-red-soft)] bg-[var(--dash-red-soft)] text-[var(--dash-red)] hover:brightness-[0.98]"
                        : "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:bg-[var(--dash-surface-2)]",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                      disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"
                    )}
                  >
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          a.destructive ? "text-[var(--dash-red)]" : "text-[var(--dash-muted)]"
                        )}
                      />
                    ) : null}
                    <span>{a.label}</span>
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

