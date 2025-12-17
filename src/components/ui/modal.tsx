// src/components/ui/modal.tsx
"use client";

import { ReactNode, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { overlayFade, dialogScale } from "@/lib/animations/presets";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function Modal({
  open,
  onClose,
  children,
  className,
  ariaLabel,
}: ModalProps) {
  const onCloseRef = useRef<ModalProps["onClose"]>(onClose);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElRef = useRef<HTMLElement | null>(null);
  const portalRootRef = useRef<HTMLElement | null>(null);
  const inertedElsRef = useRef<Array<{ el: HTMLElement; inert: boolean; ariaHidden: string | null }>>([]);
  const portalThemeSnapshotRef = useRef<Array<{ name: string; prev: string }>>([]);
  const [mounted, setMounted] = useState(false);

  const canClose = Boolean(onClose);

  // Keep latest onClose without re-running open effects.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const focusableSelector = useMemo(
    () =>
      [
        'a[href]:not([tabindex="-1"])',
        'button:not([disabled]):not([tabindex="-1"])',
        'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
        'select:not([disabled]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    []
  );

  // A11y + UX: focus management, Escape-to-close, basic focus trap, and scroll lock.
  useEffect(() => {
    if (!open) return;
    if (!mounted) return;

    // Create or fetch a single modal portal root.
    if (!portalRootRef.current) {
      let root = document.getElementById("modal-root") as HTMLElement | null;
      if (!root) {
        root = document.createElement("div");
        root.id = "modal-root";
        document.body.appendChild(root);
      }
      portalRootRef.current = root;
    }

    // IMPORTANT: Modal is portalled to <body>, so it is outside `.dashboard-root`.
    // To make dashboard modals respect light/dark switching, we copy the computed
    // dashboard CSS variables onto the portal root while a modal is open.
    const portalRoot = portalRootRef.current;
    const dashboardRoot = document.querySelector(".dashboard-root") as HTMLElement | null;
    if (portalRoot && dashboardRoot) {
      const computed = window.getComputedStyle(dashboardRoot);
      const varNames = [
        "--dash-bg",
        "--dash-surface",
        "--dash-surface-2",
        "--dash-text",
        "--dash-muted",
        "--dash-border",
        "--dash-shadow",
        "--dash-red",
        "--dash-red-2",
        "--dash-red-soft",
        "--app-overlay",
        "--app-modal-surface",
      ] as const;

      portalThemeSnapshotRef.current = varNames.map((name) => ({
        name,
        prev: portalRoot.style.getPropertyValue(name),
      }));

      for (const name of varNames) {
        const v = computed.getPropertyValue(name);
        if (v) portalRoot.style.setProperty(name, v.trim());
      }
    }

    // Save focus so we can restore it on close.
    previouslyFocusedElRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Industry-standard "true modal": make the rest of the page inert so
    // background inputs cannot receive focus or browser autofill.
    // (We portal the modal into #modal-root so it is not inside the inert subtree.)
    if (portalRoot) {
      const toInert = Array.from(document.body.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== portalRoot
      );
      inertedElsRef.current = toInert.map((el) => ({
        el,
        inert: Boolean((el as any).inert),
        ariaHidden: el.getAttribute("aria-hidden"),
      }));
      for (const el of toInert) {
        try {
          (el as any).inert = true;
        } catch {
          // ignore (older browsers) — overlay still blocks pointer events
        }
        el.setAttribute("aria-hidden", "true");
      }
    }

    // Lock scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first focusable element, otherwise the dialog.
    const focusFirst = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector)
      );
      const target = focusables[0] ?? dialog;
      target.focus?.();
    };

    // Wait a tick so the dialog is mounted and animated in.
    const raf = requestAnimationFrame(focusFirst);

    function onKeyDown(e: KeyboardEvent) {
      if (!dialogRef.current) return;

      // ESC closes if allowed
      if (e.key === "Escape" && canClose) {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }

      // Basic focus trap
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      // If no focusable elements, keep focus on dialog
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus?.();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;

      // Restore portal root theme overrides (so employee-side modals don't inherit dashboard tokens).
      if (portalRootRef.current && portalThemeSnapshotRef.current.length) {
        for (const rec of portalThemeSnapshotRef.current) {
          if (rec.prev) portalRootRef.current.style.setProperty(rec.name, rec.prev);
          else portalRootRef.current.style.removeProperty(rec.name);
        }
        portalThemeSnapshotRef.current = [];
      }

      // Restore inert + aria-hidden on background content.
      for (const rec of inertedElsRef.current) {
        try {
          (rec.el as any).inert = rec.inert;
        } catch {
          // ignore
        }
        if (rec.ariaHidden == null) rec.el.removeAttribute("aria-hidden");
        else rec.el.setAttribute("aria-hidden", rec.ariaHidden);
      }
      inertedElsRef.current = [];

      // Restore focus (best-effort).
      previouslyFocusedElRef.current?.focus?.();
      previouslyFocusedElRef.current = null;
    };
  }, [open, canClose, focusableSelector, mounted]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (!onCloseRef.current) return;
    if (e.target === e.currentTarget) onCloseRef.current();
  }

  if (!mounted) return null;

  // Ensure portal root exists even if modal hasn't been opened yet.
  if (!portalRootRef.current) {
    let root = document.getElementById("modal-root") as HTMLElement | null;
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
    }
    portalRootRef.current = root;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--app-overlay)] backdrop-blur-sm px-4 py-6"
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleBackdropClick}
        >
          <motion.div
            key="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            variants={dialogScale}
            initial="hidden"
            animate="visible"
            exit="exit"
            ref={dialogRef}
            tabIndex={-1}
            className={cn(
              "w-full max-w-sm rounded-2xl bg-[color:var(--app-modal-surface)] p-6 shadow-xl",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRootRef.current
  );
}
