// src/components/ui/modal.tsx
"use client";

import { ReactNode, MouseEvent } from "react";
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
  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (!onClose) return;
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-6"
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
            className={cn(
              "w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
