"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import type ReactSignatureCanvas from "react-signature-canvas";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { FormField } from "./FormField";
import type { IndiaOnboardingFormInput } from "../india/indiaFormSchema";

import { ES3Folder, ES3Namespace } from "@/types/aws.types";
import { EFileMimeType, type IFileAsset } from "@/types/shared.types";
import {
  deleteTempFile,
  uploadToS3Presigned,
} from "@/lib/utils/s3Upload.client";

/**
 * Dynamic import with ref typing for react-signature-canvas@^1.1.0-alpha.2
 */
const DynamicSignatureCanvas = dynamic(() => import("react-signature-canvas"), {
  ssr: false,
}) as unknown as React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<"div"> &
    Record<string, any> &
    React.RefAttributes<ReactSignatureCanvas>
>;

export type RHFSignatureBoxHandle = {
  ensureUploaded: () => Promise<IFileAsset | undefined>;
  clear: () => Promise<void>;
  hasSignature: () => boolean;
};

type RHFSignatureBoxProps = {
  name: FieldPath<IndiaOnboardingFormInput>;
  label: string;

  namespace: ES3Namespace;
  folder: ES3Folder;
  docId?: string;

  disabled?: boolean;
  signedAtName?: FieldPath<IndiaOnboardingFormInput>;

  description?: string;
  dataField?: string;

  maxSizeMB?: number;

  /**
   * When true, show validation/upload errors even if the field hasn't been touched
   * and RHF submitCount hasn't incremented (we use a custom submit flow).
   */
  forceShowErrors?: boolean;

  /**
   * If true, the user must explicitly click "Save signature" to upload.
   * Prevents uploading on submit and keeps submit simple/predictable.
   */
  requireExplicitSave?: boolean;

  /**
   * Parent-controlled "touched" state.
   * When true, show errors. Use this when RHF's isTouched is unreliable
   * (e.g., resolver validates before user interaction).
   */
  showTouchedErrors?: boolean;

  /**
   * Called when the user interacts with the signature box (starts drawing or opens file picker).
   * Parent can use this to track interaction state.
   */
  onInteraction?: () => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function uploadFileToS3(params: {
  file: File;
  namespace: ES3Namespace;
  folder: ES3Folder;
  docId?: string;
  maxSizeMB: number;
}): Promise<IFileAsset> {
  const { file, namespace, folder, docId, maxSizeMB } = params;

  const uploaded = await uploadToS3Presigned({
    file,
    namespace,
    folder,
    docId,
    allowedMimeTypes: [
      EFileMimeType.PNG,
      EFileMimeType.JPG,
      EFileMimeType.JPEG,
    ] as any,
    maxSizeMB,
  });

  return {
    s3Key: uploaded.s3Key,
    url: uploaded.url,
    mimeType: uploaded.mimeType as any,
    sizeBytes: uploaded.sizeBytes,
    originalName: uploaded.originalName,
  };
}

export const RHFSignatureBox = React.forwardRef(function RHFSignatureBox(
  {
    name,
    label,
    namespace,
    folder,
    docId,
    disabled,
    signedAtName,
    description,
    dataField,
    maxSizeMB = 5,
    forceShowErrors = false,
    requireExplicitSave = false,
    showTouchedErrors = false,
    onInteraction,
  }: RHFSignatureBoxProps,
  ref: React.ForwardedRef<RHFSignatureBoxHandle>
) {
  const {
    control,
    setValue,
    formState: { touchedFields },
  } = useFormContext<IndiaOnboardingFormInput>();

  const canvasRef = React.useRef<ReactSignatureCanvas | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // Pending sources (NOT uploaded yet)
  const pendingFileRef = React.useRef<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = React.useState<
    string | null
  >(null);

  const [hasCanvasInk, setHasCanvasInk] = React.useState(false);
  const drawingRef = React.useRef(false);

  // Force remount of canvas when needed (react-signature-canvas can get stuck)
  const [canvasKey, setCanvasKey] = React.useState(0);

  // Responsive canvas without losing strokes
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const lastDataUrlRef = React.useRef<string | null>(null);

  const [status, setStatus] = React.useState<
    "idle" | "uploading" | "deleting" | "error"
  >("idle");
  const [message, setMessage] = React.useState<string>("");
  const [savedPulse, setSavedPulse] = React.useState(0);

  // Keep latest RHF field value available to ensureUploaded()
  const latestAssetRef = React.useRef<IFileAsset | null>(null);
  const latestOnChangeRef = React.useRef<((v: any) => void) | null>(null);

  const revokePendingPreview = React.useCallback(() => {
    setPendingFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const shouldAllowErrorsNow = React.useCallback(() => {
    // Show internal errors (upload failures, etc.) when:
    // - forceShowErrors is true (parent says submit was clicked), OR
    // - showTouchedErrors is true (parent says user interacted), OR
    // - field is touched via RHF (fallback for direct RHF usage)
    return (
      forceShowErrors ||
      showTouchedErrors ||
      Boolean((touchedFields as any)?.[name as any])
    );
  }, [forceShowErrors, showTouchedErrors, touchedFields, name]);

  const fail = React.useCallback(
    (msg: string) => {
      setStatus("error");
      if (shouldAllowErrorsNow()) setMessage(msg);
      return undefined;
    },
    [shouldAllowErrorsNow]
  );

  const measureNow = React.useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // More reliable than clientWidth/clientHeight for absolutely-positioned wrappers
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    setCanvasSize({ width: w, height: h });
  }, []);

  const clearCanvasOnly = React.useCallback(() => {
    try {
      canvasRef.current?.clear();
    } catch {
      // Best-effort: ignore canvas clear failures
    }
    setHasCanvasInk(false);
    // ensure a clean remount if react-signature-canvas gets stuck
    setCanvasKey((k) => k + 1);
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Canvas sizing + snapshot restore (no disappearing strokes)
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const measure = () => {
      if (drawingRef.current) return;

      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));

      const dx = Math.abs(w - canvasSize.width);
      const dy = Math.abs(h - canvasSize.height);
      if (dx < 2 && dy < 2) return;

      const sig = canvasRef.current;
      if (sig && typeof sig.isEmpty === "function" && !sig.isEmpty()) {
        try {
          lastDataUrlRef.current = sig.toDataURL("image/png");
        } catch {
          // Best-effort: ignore export failures
          lastDataUrlRef.current = null;
        }
      } else {
        lastDataUrlRef.current = null;
      }

      setCanvasSize({ width: w, height: h });
    };

    // initial
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [canvasSize.width, canvasSize.height]);

  React.useEffect(() => {
    if (!lastDataUrlRef.current) return;
    const sig = canvasRef.current;
    if (!sig) return;

    try {
      sig.fromDataURL(lastDataUrlRef.current);
      setHasCanvasInk(true);
    } catch {
      // Best-effort: ignore restore failures
    }
    lastDataUrlRef.current = null;
  }, [canvasSize.width, canvasSize.height]);

  // ────────────────────────────────────────────────────────────────────────────
  // CRITICAL: reconcile preview <-> canvas (Drivedock behavior)
  // Fixes: upload image -> clear -> cannot draw
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const sig = canvasRef.current;

    if (pendingFilePreview) {
      // entering preview mode => clear canvas and reset ink state
      try {
        sig?.clear();
      } catch {
        // Best-effort: ignore canvas clear failures
      }
      setHasCanvasInk(false);
      return;
    }

    // leaving preview mode => ensure canvas is visible and interactive
    setCanvasKey((k) => k + 1);
    requestAnimationFrame(() => {
      measureNow();
    });
  }, [pendingFilePreview, measureNow]);

  const openFilePicker = React.useCallback(() => {
    if (disabled || status === "uploading" || status === "deleting") return;

    setMessage("");
    onInteraction?.();

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      // pending only (do not upload yet)
      pendingFileRef.current = file;

      revokePendingPreview();
      const url = URL.createObjectURL(file);
      setPendingFilePreview(url);

      // choosing a file overrides canvas
      clearCanvasOnly();

      setStatus("idle");
      setMessage("");
    };

    input.click();
  }, [disabled, status, revokePendingPreview, clearCanvasOnly, onInteraction]);

  const clearAll = React.useCallback(async () => {
    if (disabled || status === "uploading" || status === "deleting") return;

    setMessage("");

    // Clear pending things
    pendingFileRef.current = null;
    revokePendingPreview();
    clearCanvasOnly();

    // Clear existing uploaded asset from RHF and delete temp file if needed
    const currentAsset = latestAssetRef.current;
    const onChange = latestOnChangeRef.current;

    if (currentAsset?.s3Key) {
      setStatus("deleting");
      try {
        await deleteTempFile(currentAsset);
      } catch {
        // ignore cleanup failure
      }
      setStatus("idle");
    }

    // IMPORTANT:
    // Use an explicit NULL value here (not undefined). With prefilled defaultValues,
    // some RHF/controller timing can cause `undefined` to appear as "fall back to default".
    // Null is an unambiguous "no value" for this field, and our render treats it as empty.
    try {
      setValue(name, null as any, { shouldDirty: true, shouldValidate: true });
    } catch {
      // ignore
    }
    onChange?.(null as any);
    latestAssetRef.current = null;

    if (signedAtName) {
      setValue(signedAtName, "" as any, { shouldDirty: true });
    }

    setStatus("idle");
    setMessage("");

    // ensure canvas is ready immediately after clearing preview
    requestAnimationFrame(() => measureNow());
  }, [
    disabled,
    status,
    revokePendingPreview,
    clearCanvasOnly,
    name,
    signedAtName,
    setValue,
    measureNow,
  ]);

  const hasSignature = React.useCallback(() => {
    const hasPendingFile = !!pendingFileRef.current;
    const hasUploadedAsset = !!latestAssetRef.current?.url;
    return hasPendingFile || hasCanvasInk || hasUploadedAsset;
  }, [hasCanvasInk]);

  const hasUnsavedChanges = React.useCallback(() => {
    return Boolean(pendingFileRef.current) || hasCanvasInk;
  }, [hasCanvasInk]);

  const isSaved = React.useCallback(() => {
    return Boolean(latestAssetRef.current?.url) && !hasUnsavedChanges();
  }, [hasUnsavedChanges]);

  const ensureUploaded = React.useCallback(async (): Promise<
    IFileAsset | undefined
  > => {
    if (disabled) return latestAssetRef.current ?? undefined;

    setMessage("");

    const currentAsset = latestAssetRef.current;
    const onChange = latestOnChangeRef.current;

    // 1) Pending picked file → upload it
    if (pendingFileRef.current) {
      setStatus("uploading");
      try {
        const nextAsset = await uploadFileToS3({
          file: pendingFileRef.current,
          namespace,
          folder,
          docId,
          maxSizeMB,
        });

        if (currentAsset) {
          try {
            await deleteTempFile(currentAsset);
          } catch {
            // Best-effort: ignore temp file cleanup failures
          }
        }

        onChange?.(nextAsset as any);
        latestAssetRef.current = nextAsset;

        // pending no longer needed
        pendingFileRef.current = null;

        // once uploaded, we can remove preview safely
        revokePendingPreview();

        // signature is now saved; clear canvas ink state
        setHasCanvasInk(false);
        try {
          canvasRef.current?.clear();
        } catch {
          // Best-effort: ignore canvas clear failures
        }
        setCanvasKey((k) => k + 1);
        setSavedPulse((n) => n + 1);

        if (signedAtName) {
          setValue(signedAtName, nowIso() as any, { shouldDirty: true });
        }

        setStatus("idle");
        setMessage("");
        return nextAsset;
      } catch (err: any) {
        return fail(
          err?.message || "Signature upload failed. Please try again."
        );
      }
    }

    // 2) Canvas ink → upload canvas
    if (hasCanvasInk) {
      const sig = canvasRef.current;
      if (!sig || typeof sig.isEmpty !== "function" || sig.isEmpty()) {
        return fail("Please sign inside the box or upload an image.");
      }

      setStatus("uploading");
      try {
        const dataUrl = sig.toDataURL("image/png");
        const blob = await dataUrlToBlob(dataUrl);
        const file = new File([blob], "signature.png", { type: "image/png" });

        const nextAsset = await uploadFileToS3({
          file,
          namespace,
          folder,
          docId,
          maxSizeMB,
        });

        if (currentAsset) {
          try {
            await deleteTempFile(currentAsset);
          } catch {
            // Best-effort: ignore temp file cleanup failures
          }
        }

        onChange?.(nextAsset as any);
        latestAssetRef.current = nextAsset;

        if (signedAtName) {
          setValue(signedAtName, nowIso() as any, { shouldDirty: true });
        }

        // signature is now saved; clear canvas ink state
        setHasCanvasInk(false);
        try {
          canvasRef.current?.clear();
        } catch {
          // Best-effort: ignore canvas clear failures
        }
        setCanvasKey((k) => k + 1);
        setSavedPulse((n) => n + 1);

        setStatus("idle");
        setMessage("");
        return nextAsset;
      } catch (err: any) {
        return fail(
          err?.message || "Signature upload failed. Please try again."
        );
      }
    }

    // 3) No pending signature and no uploaded asset
    if (!currentAsset?.url) {
      return fail("Please sign inside the box or upload an image.");
    }

    setStatus("idle");
    setMessage("");
    return currentAsset;
  }, [
    disabled,
    namespace,
    folder,
    docId,
    maxSizeMB,
    hasCanvasInk,
    signedAtName,
    setValue,
    revokePendingPreview,
    fail,
  ]);

  React.useImperativeHandle(
    ref,
    () => ({
      ensureUploaded,
      clear: clearAll,
      hasSignature,
    }),
    [ensureUploaded, clearAll, hasSignature]
  );

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        latestOnChangeRef.current = field.onChange;

        const asset = (field.value as IFileAsset | null | undefined) ?? null;
        latestAssetRef.current = asset;

        // Show RHF/Zod error only when:
        // 1. forceShowErrors is true (parent says submit was clicked), OR
        // 2. showTouchedErrors is true (parent says user interacted)
        // NOTE: We removed the submitCount check because our form uses a custom submit
        // flow that doesn't increment RHF's submitCount reliably. Parent components
        // (like DeclarationSection) control error visibility via forceShowErrors.
        const shouldShowError = forceShowErrors || showTouchedErrors;

        const zodMessage = fieldState.error?.message?.toString();
        const showZodError = shouldShowError ? zodMessage : undefined;

        // preview priority: pending preview first, else uploaded asset
        const previewUrl = pendingFilePreview || asset?.url || null;
        const showHint = !previewUrl && !hasCanvasInk;

        // internal message only after submit/touch
        const showInternalMsg = shouldShowError ? message : "";

        const saved = isSaved();
        const unsaved = hasUnsavedChanges();
        const canSave = !disabled && unsaved && status !== "uploading" && status !== "deleting";

        const handleSave = async () => {
          if (!canSave) return;
          setMessage("");
          await ensureUploaded();
        };

        return (
          <FormField
            label={label}
            htmlFor={String(name)}
            error={showZodError}
            description={description}
            className="w-full"
            errorClassName="w-full text-center"
          >
            <div data-field={dataField || String(name)} className="space-y-3">
              <div
                className={cn(
                  "relative mx-auto h-48 w-full rounded-2xl border bg-white shadow-sm overflow-hidden",
                  showZodError ? "border-red-500" : "border-slate-200",
                  disabled && "opacity-80"
                )}
              >
                {previewUrl ? (
                  // <img> avoids Next/Image remote host config issues
                  <img
                    src={previewUrl}
                    alt="Signature preview"
                    className="h-full w-full object-contain bg-white p-2"
                    draggable={false}
                  />
                ) : (
                  <div
                    ref={wrapperRef}
                    className={cn(
                      "absolute inset-0",
                      disabled && "pointer-events-none"
                    )}
                  >
                    <DynamicSignatureCanvas
                      key={canvasKey}
                      ref={(r) => {
                        canvasRef.current = r;
                      }}
                      penColor="black"
                      backgroundColor="#ffffff"
                      onBegin={() => {
                        if (disabled) return;
                        drawingRef.current = true;
                        setMessage("");
                        onInteraction?.();
                      }}
                      onEnd={() => {
                        if (disabled) return;
                        drawingRef.current = false;

                        const sig = canvasRef.current;
                        const ink =
                          !!sig &&
                          typeof sig.isEmpty === "function" &&
                          !sig.isEmpty();

                        setHasCanvasInk(ink);

                        if (ink) {
                          // drawing becomes the active source
                          pendingFileRef.current = null;
                          revokePendingPreview();
                          setMessage("");
                        }

                        // ensure size is correct after returning from preview/clear
                        requestAnimationFrame(() => measureNow());
                      }}
                      canvasProps={{
                        width: Math.max(1, canvasSize.width),
                        height: Math.max(1, canvasSize.height),
                        className:
                          "w-full h-full rounded-2xl [touch-action:none] block",
                      }}
                    />

                    {showHint && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="text-sm text-slate-400">
                          Sign inside the box
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!disabled && (
                <div className="mx-auto flex w-full flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 sm:w-auto",
                      canSave
                        ? "bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700"
                        : "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
                    )}
                  >
                    <Check size={16} />
                    Save signature
                  </button>

                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={status === "uploading" || status === "deleting"}
                    className="w-full rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                  >
                    Upload image
                  </button>

                  <button
                    type="button"
                    onClick={() => void clearAll()}
                    disabled={status === "uploading" || status === "deleting"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                  >
                    <X size={16} />
                    Clear
                  </button>
                </div>
              )}

              {/* Saved / Unsaved indicator (helps users understand they must save) */}
              {hasSignature() && (
                <p
                  key={savedPulse}
                  className={cn(
                    "text-xs text-center",
                    saved
                      ? "text-emerald-700"
                      : "text-amber-700"
                  )}
                >
                  {saved
                    ? "Signature saved."
                    : requireExplicitSave
                      ? "Signature not saved yet. Click “Save signature” before submitting."
                      : "Signature not saved yet."}
                </p>
              )}

              {status === "uploading" && (
                <p className="text-amber-700 text-xs text-center flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-700" />
                  Uploading signature...
                </p>
              )}

              {status === "deleting" && (
                <p className="text-amber-700 text-xs text-center flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-700" />
                  Removing...
                </p>
              )}

              {status === "error" && showInternalMsg && (
                <p className="text-xs text-red-600 text-center">
                  {showInternalMsg}
                </p>
              )}
            </div>
          </FormField>
        );
      }}
    />
  );
});
