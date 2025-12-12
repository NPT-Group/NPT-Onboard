// src/components/media/UploadPicker.tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { FileUp } from "lucide-react";

/* ───────────────── Types ───────────────── */

type UploadPickerProps = {
  label?: string;
  onPick: (file: File | null) => void | Promise<void>;
  accept?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;

  mode?: "pdf" | "image";
  showPdfGuidance?: boolean;
};

const PDF_GUIDANCE_STORAGE_KEY = "nptonboard_pdf_guidance_disabled";

type Platform = "ios" | "android" | "other";

/* ───────────────── Platform detection ───────────────── */

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent || navigator.vendor;

  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";

  return "other";
}

/* ───────────────── Upload Picker ───────────────── */

export default function UploadPicker({
  label = "Upload document",
  onPick,
  accept,
  disabled,
  ariaLabel,
  className,
  mode = "pdf",
  showPdfGuidance = true,
}: UploadPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const isPdfMode = mode === "pdf";
  const effectiveAccept = accept ?? (isPdfMode ? "application/pdf" : "image/*");

  async function handleChange(input: HTMLInputElement, file: File | null) {
    try {
      await onPick(file);
    } finally {
      input.value = "";
    }
  }

  function shouldShowPdfGuidance(): boolean {
    if (!isPdfMode || !showPdfGuidance) return false;
    try {
      return window.localStorage.getItem(PDF_GUIDANCE_STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  }

  function handleTriggerClick() {
    if (disabled) return;

    if (isPdfMode && shouldShowPdfGuidance()) {
      setPdfModalOpen(true);
      return;
    }

    fileInputRef.current?.click();
  }

  function handlePdfModalContinue(dontShowAgain: boolean) {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(PDF_GUIDANCE_STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }
    setPdfModalOpen(false);
    fileInputRef.current?.click();
  }

  return (
    <div className={`relative ${className || ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || label}
        onClick={handleTriggerClick}
        className="cursor-pointer flex flex-col items-center justify-center h-11 px-4 mt-1 w-full text-sm text-slate-600 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileUp className="w-4 h-4 text-slate-400" />
        <span className="font-medium text-slate-500 text-xs">{label}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={effectiveAccept}
        className="hidden"
        onChange={(e) =>
          handleChange(e.currentTarget, e.target.files?.[0] || null)
        }
      />

      {isPdfMode && showPdfGuidance && pdfModalOpen && (
        <PdfGuidanceModal
          onClose={() => setPdfModalOpen(false)}
          onContinue={handlePdfModalContinue}
        />
      )}
    </div>
  );
}

/* ───────────────── PDF Guidance Modal ───────────────── */

function PdfGuidanceModal({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: (dontShowAgain: boolean) => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const titleId = useId();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          Use a clear PDF scan
        </h2>

        <p className="mt-3 text-sm text-slate-700 leading-5">
          For security checks and document processing, we can only accept{" "}
          <span className="font-semibold">PDF files</span> with clear, readable
          scans. Please avoid photos with glare, shadows, or background clutter.
        </p>
        <p className="mt-3 text-sm text-slate-700 leading-5">
          You'll see this reminder when uploading documents on other file fields
          as well. You can turn it off below if you don't need to be reminded
          again.
        </p>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p className="font-medium">
            You can use any phone scanner app, for example:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>CamScanner (recommended)</li>
            <li>Apple Notes → Scan Document (iPhone)</li>
            <li>GYour phone's built-in "Scan" option in Files or Camera</li>
          </ul>
        </div>

        {/* Store badges — platform aware (Drivedock parity) */}
        <div className="flex items-center justify-center gap-4 mt-4">
          {(platform === "ios" || platform === "other") && (
            <a
              href="https://apps.apple.com/ca/app/camscanner-pdf-scanner-app/id388627783"
              target="_blank"
              rel="noreferrer"
            >
              <Image
                src="/assets/logos/Applestore.png"
                alt="Download on the App Store"
                className="h-12 w-auto hover:opacity-90 transition"
                width={0}
                height={0}
                sizes="100vw"
              />
            </a>
          )}

          {(platform === "android" || platform === "other") && (
            <a
              href="https://play.google.com/store/apps/details?id=com.intsig.camscanner"
              target="_blank"
              rel="noreferrer"
            >
              <Image
                src="/assets/logos/Playstore.png"
                alt="Get it on Google Play"
                className="h-12 w-auto hover:opacity-90 transition"
                width={0}
                height={0}
                sizes="100vw"
              />
            </a>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          Don&apos;t show this reminder again on this device.
        </label>

        <div className="mt-5 flex justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onContinue(dontShowAgain)}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            Continue to upload PDF
          </button>
        </div>
      </div>
    </div>
  );
}
