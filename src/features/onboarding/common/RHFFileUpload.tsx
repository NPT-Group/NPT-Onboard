// src/features/onboarding/common/RHFFileUpload.tsx
"use client";

import * as React from "react";
import {
  Controller,
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { X } from "lucide-react";

import UploadPicker from "@/components/media/UploadPicker";
import { FormField } from "./FormField";
import { cn } from "@/lib/utils/cn";

import { ES3Folder, ES3Namespace } from "@/types/aws.types";
import { EFileMimeType, type IFileAsset } from "@/types/shared.types";
import {
  deleteTempFile,
  getDownloadUrlFromS3Key,
  uploadToS3Presigned,
} from "@/lib/utils/s3Upload.client";

type RHFFileUploadProps<TForm extends FieldValues> = {
  name: FieldPath<TForm>;
  label: string;
  namespace: ES3Namespace;
  folder: ES3Folder;
  docId?: string;
  disabled?: boolean;
  description?: string;
  accept?: string;
  maxSizeMB?: number;
  dataField?: string;
  placeholderLabel?: string;
};

export function RHFFileUpload<TForm extends FieldValues>({
  name,
  label,
  namespace,
  folder,
  docId,
  disabled,
  description,
  accept = "application/pdf",
  maxSizeMB = 20,
  dataField,
  placeholderLabel = "Upload PDF (recommended: scanner app)",
}: RHFFileUploadProps<TForm>) {
  const { control } = useFormContext<TForm>();

  const [status, setStatus] = React.useState<
    "idle" | "uploading" | "deleting" | "error"
  >("idle");
  const [message, setMessage] = React.useState("");

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message?.toString();
        const hasError = Boolean(errorMessage);

        const asset = (field.value as IFileAsset | null | undefined) ?? null;

        const isPdf =
          asset?.mimeType?.toLowerCase() === EFileMimeType.PDF ||
          (asset?.url && asset.url.toLowerCase().endsWith(".pdf"));

        async function handlePick(file: File | null) {
          setMessage("");
          if (!file) return;

          const lowerType = (file.type || "").toLowerCase();
          const isPdfByMime = lowerType === EFileMimeType.PDF;
          const isPdfByName = file.name.toLowerCase().endsWith(".pdf");
          if (!isPdfByMime && !isPdfByName) {
            setStatus("error");
            setMessage("Please upload a PDF file.");
            return;
          }

          setStatus("uploading");
          try {
            const uploaded = await uploadToS3Presigned({
              file,
              namespace,
              folder,
              docId,
              allowedMimeTypes: [EFileMimeType.PDF],
              maxSizeMB,
            });

            field.onChange(uploaded as any);
            setStatus("idle");
            setMessage("Upload successful.");
          } catch (err: any) {
            setStatus("error");
            setMessage(err?.message || "Upload failed. Please try again.");
          }
        }

        async function handleRemove() {
          if (!asset) return;

          setStatus("deleting");
          setMessage("");

          try {
            await deleteTempFile(asset);
          } catch (err: any) {
            setStatus("error");
            setMessage(err?.message || "Could not delete temp file.");
          } finally {
            field.onChange(null as any);
            setStatus("idle");
          }
        }

        async function handleView() {
          if (!asset?.s3Key) return;
          try {
            const url = await getDownloadUrlFromS3Key({
              s3Key: asset.s3Key,
              filename: asset.originalName || "document",
            });
            window.open(url, "_blank", "noopener,noreferrer");
          } catch (err: any) {
            setStatus("error");
            setMessage(err?.message || "Unable to open document.");
          }
        }

        return (
          <FormField
            label={label}
            htmlFor={String(name)}
            error={errorMessage}
            description={description}
            className="w-full"
          >
            <div data-field={dataField || String(name)}>
              {asset ? (
                <div
                  className={cn(
                    "mt-1 relative flex items-center justify-between rounded-lg border bg-white px-4 py-3",
                    hasError ? "border-red-500" : "border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-8 items-center justify-center rounded-md bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                      {isPdf ? "PDF" : "FILE"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800">
                        Document uploaded
                      </span>
                      <span className="text-xs text-slate-500 truncate max-w-[220px]">
                        {asset.originalName || "PDF file"}
                      </span>

                      <button
                        type="button"
                        onClick={handleView}
                        disabled={disabled}
                        className="mt-0.5 text-left text-xs text-sky-700 hover:underline disabled:opacity-60"
                      >
                        View / download
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={
                      disabled ||
                      status === "uploading" ||
                      status === "deleting"
                    }
                    className="ml-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-60"
                    aria-label="Remove uploaded document"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <UploadPicker
                  label={placeholderLabel}
                  onPick={handlePick}
                  mode="pdf"
                  showPdfGuidance
                  accept={accept}
                  disabled={
                    disabled || status === "uploading" || status === "deleting"
                  }
                  className="w-full"
                />
              )}

              {status === "uploading" && (
                <div className="text-amber-700 text-xs mt-2 flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-700" />
                  Uploading...
                </div>
              )}

              {status === "deleting" && (
                <div className="text-amber-700 text-xs mt-2 flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-700" />
                  Removing...
                </div>
              )}

              {status === "error" && message && (
                <p className="text-xs text-red-600 mt-2">{message}</p>
              )}

              {status === "idle" && !hasError && message && (
                <p className="text-xs text-emerald-700 mt-2">{message}</p>
              )}
            </div>
          </FormField>
        );
      }}
    />
  );
}
