"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useFormContext, type FieldPath } from "react-hook-form";

import type { IndiaOnboardingFormInput } from "../indiaFormSchema";
import { RHFTextInput } from "../../common/RHFTextInput";
import {
  RHFSignatureBox,
  type RHFSignatureBoxHandle,
} from "../../common/RHFSignatureBox";
import { FormField } from "../../common/FormField";
import { cn } from "@/lib/utils/cn";

import { ES3Folder, ES3Namespace } from "@/types/aws.types";

export const DECLARATION_FIELD_PATHS: FieldPath<IndiaOnboardingFormInput>[] = [
  "declaration.hasAcceptedDeclaration",
  "declaration.declarationDate",
  "declaration.signature.file",
  "declaration.signature.signedAt",
];

type Props = {
  isReadOnly?: boolean;
  docId: string;

  // Turnstile
  turnstileToken: string;
  onTurnstileToken: (token: string) => void;

  // Submission error from parent (optional)
  submitError?: string | null;

  // parent ref for upload-on-submit
  signatureRef?: React.Ref<RHFSignatureBoxHandle>;

  /**
   * Our submit flow is custom (not RHF handleSubmit), so submitCount may not increment.
   * This flag forces errors to show after the user clicks Submit.
   */
  showErrors?: boolean;
};

// Minimal Turnstile render (no dependency).
function TurnstileWidget({
  disabled,
  onToken,
}: {
  disabled?: boolean;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (disabled) return;

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      console.error("Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      return;
    }

    const existing = document.querySelector(
      'script[data-turnstile="1"]'
    ) as HTMLScriptElement | null;

    const ensureScript = async () => {
      if (existing) return;
      const s = document.createElement("script");
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "1";
      document.head.appendChild(s);
      await new Promise<void>((resolve) => {
        s.onload = () => resolve();
      });
    };

    const render = async () => {
      await ensureScript();

      // @ts-expect-error - provided by turnstile script
      const turnstile = window.turnstile as any;
      if (!turnstile || !ref.current) return;

      ref.current.innerHTML = "";
      widgetIdRef.current = turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    void render();

    return () => {
      // Best-effort cleanup to avoid multiple widgets leaking across navigations.
      try {
        // @ts-expect-error - provided by turnstile script
        const turnstile = window.turnstile as any;
        const widgetId = widgetIdRef.current;
        if (turnstile && widgetId) {
          if (typeof turnstile.remove === "function") turnstile.remove(widgetId);
          else if (typeof turnstile.reset === "function") turnstile.reset(widgetId);
        }
      } catch {
        // ignore
      } finally {
        widgetIdRef.current = null;
        if (ref.current) ref.current.innerHTML = "";
      }
    };
  }, [disabled, onToken]);

  return (
    <div className="flex justify-center">
      <div ref={ref} />
    </div>
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function DeclarationSection({
  isReadOnly,
  docId,
  turnstileToken,
  onTurnstileToken,
  submitError,
  signatureRef,
  showErrors,
}: Props) {
  const { control, watch, setValue } = useFormContext<IndiaOnboardingFormInput>();

  const declarationDate = watch("declaration.declarationDate");

  // Prefill date if empty (still editable)
  useEffect(() => {
    if (!declarationDate) {
      setValue("declaration.declarationDate", todayIsoDate(), {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [declarationDate, setValue]);

  // Keep signedAt in sync when signature exists but signedAt missing
  const sigFile = watch("declaration.signature.file");
  const sigAt = watch("declaration.signature.signedAt");

  useEffect(() => {
    if (sigFile && !sigAt) {
      setValue("declaration.signature.signedAt", new Date().toISOString(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [sigFile, sigAt, setValue]);

  // IMPORTANT:
  // With resolver-based trigger() we may have errors populated for future steps
  // before the user reaches this section. We only show errors when:
  // - user clicked submit (showErrors from parent's submitAttempted state)
  // NOTE: We removed the submitCount check because our form uses a custom submit
  // flow that doesn't increment RHF's submitCount. Parent controls via showErrors.
  const showAfterSubmit = Boolean(showErrors);

  // Track real user interaction *within this section* (separately per control),
  // so we can show field-level errors after interaction without "screaming on entry".
  const [dateInteracted, setDateInteracted] = useState(false);
  const [signatureInteracted, setSignatureInteracted] = useState(false);
  const [acceptInteracted, setAcceptInteracted] = useState(false);

  return (
    <div className="rounded-2xl px-4 py-6 shadow-sm sm:px-6 sm:py-7">
      <header className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Declaration & signature
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Confirm the declaration, sign, and submit.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-700">
        I confirm that all information provided is true and has been filled by
        me.
      </div>

      {submitError ? (
        <p className="mt-4 text-center text-sm text-red-600">{submitError}</p>
      ) : null}

      <div className="mt-6 space-y-6">
        <RHFTextInput
          name={
            "declaration.declarationDate" as FieldPath<IndiaOnboardingFormInput>
          }
          label="Declaration date"
          type="date"
          disabled={isReadOnly}
          showErrors={showAfterSubmit || dateInteracted}
          onBlur={() => setDateInteracted(true)}
        />

        <RHFSignatureBox<IndiaOnboardingFormInput>
          ref={signatureRef}
          name={
            "declaration.signature.file" as FieldPath<IndiaOnboardingFormInput>
          }
          signedAtName={
            "declaration.signature.signedAt" as FieldPath<IndiaOnboardingFormInput>
          }
          label="Digital signature"
          description="Draw your signature in the box or upload an image of your signature."
          namespace={ES3Namespace.ONBOARDINGS}
          folder={ES3Folder.DECLARATION_SIGNATURE}
          docId={docId}
          disabled={isReadOnly}
          dataField="declaration.signature.file"
          forceShowErrors={showAfterSubmit}
          showTouchedErrors={signatureInteracted}
          requireExplicitSave
          onInteraction={() => setSignatureInteracted(true)}
        />

        <div className="space-y-2">
          <p className="text-xs text-slate-600 text-center">
            Please complete verification to submit.
          </p>

          <div data-field="declaration.turnstile">
            <TurnstileWidget disabled={isReadOnly} onToken={onTurnstileToken} />
          </div>

          {/* Only show as error after submit attempt */}
          {showAfterSubmit && !turnstileToken ? (
            <p className="text-xs text-red-600 text-center">
              Verification is required to submit.
            </p>
          ) : null}
        </div>

        {/* Controlled checkbox so it doesn’t scream on entry */}
        <Controller
          control={control}
          name={
            "declaration.hasAcceptedDeclaration" as FieldPath<IndiaOnboardingFormInput>
          }
          render={({ field, fieldState }) => {
            const showError = showAfterSubmit || acceptInteracted;
            const errorMsg = showError
              ? fieldState.error?.message?.toString()
              : undefined;

            return (
              <FormField
                label=""
                htmlFor="declaration.hasAcceptedDeclaration"
                error={errorMsg}
                className="w-full"
                errorClassName="w-full text-center"
              >
                <label className="flex items-start justify-center gap-3">
                  <input
                    id="declaration.hasAcceptedDeclaration"
                    type="checkbox"
                    className={cn(
                      "mt-1 h-4 w-4 rounded border-slate-300",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40",
                      isReadOnly && "cursor-not-allowed opacity-70"
                    )}
                    checked={!!field.value}
                    onChange={(e) => {
                      setAcceptInteracted(true);
                      field.onChange(e.target.checked);
                    }}
                    onBlur={field.onBlur}
                    disabled={isReadOnly}
                    data-field="declaration.hasAcceptedDeclaration"
                  />
                  <span className="text-sm text-slate-800 max-w-[38rem]">
                    I accept the declaration and confirm my information is true
                    and complete.
                  </span>
                </label>
              </FormField>
            );
          }}
        />
      </div>
    </div>
  );
}
