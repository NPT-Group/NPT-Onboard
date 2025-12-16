"use client";

import type { FieldPath } from "react-hook-form";
import type { IndiaOnboardingFormInput } from "../indiaFormSchema";
import { RHFDigitsInput } from "../../common/RHFDigitsInput";
import { RHFFileUpload } from "../../common/RHFFileUpload";
import { ES3Folder, ES3Namespace } from "@/types/aws.types";

type Props = {
  isReadOnly?: boolean;
  docId: string;
};

// Keep this simple: section-level gating validates the whole object.
export const GOVERNMENT_IDS_FIELD_PATHS: FieldPath<IndiaOnboardingFormInput>[] =
  ["governmentIds"];

export function GovernmentIdsSection({ isReadOnly, docId }: Props) {
  const base = "governmentIds" as const;

  const formatAadhaar = (d: string) =>
    d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();

  return (
    <div className="rounded-2xl px-4 py-6 shadow-sm sm:px-6 sm:py-7">
      <header className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Government identification
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload clear PDF scans of your documents.
        </p>
      </header>

      {/* Aadhaar */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <h2 className="text-sm font-semibold text-slate-900">Aadhaar</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RHFDigitsInput<IndiaOnboardingFormInput>
            name={`${base}.aadhaar.aadhaarNumber`}
            label="Aadhaar number"
            maxDigits={12}
            formatDigits={formatAadhaar}
            placeholder="1234 5678 9012"
            disabled={isReadOnly}
          />

          <div className="sm:col-span-2">
            <RHFFileUpload<IndiaOnboardingFormInput>
              name={`${base}.aadhaar.file`}
              label="Aadhaar card (PDF)"
              namespace={ES3Namespace.ONBOARDINGS}
              folder={ES3Folder.GOV_AADHAAR}
              docId={docId}
              disabled={isReadOnly}
              dataField="governmentIds.aadhaar.file"
              placeholderLabel="Upload Aadhaar PDF"
              maxSizeMB={20}
            />
          </div>
        </div>
      </div>

      {/* PAN */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <h2 className="text-sm font-semibold text-slate-900">PAN</h2>

        <div className="mt-4">
          <RHFFileUpload<IndiaOnboardingFormInput>
            name={`${base}.panCard.file`}
            label="PAN card (PDF)"
            namespace={ES3Namespace.ONBOARDINGS}
            folder={ES3Folder.GOV_PAN}
            docId={docId}
            disabled={isReadOnly}
            dataField="governmentIds.panCard.file"
            placeholderLabel="Upload PAN PDF"
            maxSizeMB={20}
          />
        </div>
      </div>

      {/* Passport */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <h2 className="text-sm font-semibold text-slate-900">Passport</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RHFFileUpload<IndiaOnboardingFormInput>
            name={`${base}.passport.frontFile`}
            label="Passport front (PDF)"
            namespace={ES3Namespace.ONBOARDINGS}
            folder={ES3Folder.GOV_PASSPORT}
            docId={docId}
            disabled={isReadOnly}
            dataField="governmentIds.passport.frontFile"
            placeholderLabel="Upload passport front PDF"
            maxSizeMB={20}
          />

          <RHFFileUpload<IndiaOnboardingFormInput>
            name={`${base}.passport.backFile`}
            label="Passport back (PDF)"
            namespace={ES3Namespace.ONBOARDINGS}
            folder={ES3Folder.GOV_PASSPORT}
            docId={docId}
            disabled={isReadOnly}
            dataField="governmentIds.passport.backFile"
            placeholderLabel="Upload passport back PDF"
            maxSizeMB={20}
          />
        </div>
      </div>

      {/* Driver's License (optional, but if one side provided -> both required by schema) */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Driver&apos;s license (optional)
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RHFFileUpload<IndiaOnboardingFormInput>
            name={`${base}.driversLicense.frontFile`}
            label="Driver’s license front (PDF)"
            namespace={ES3Namespace.ONBOARDINGS}
            folder={ES3Folder.GOV_DRIVERS_LICENSE}
            docId={docId}
            disabled={isReadOnly}
            dataField="governmentIds.driversLicense.frontFile"
            placeholderLabel="Upload DL front PDF"
            maxSizeMB={20}
          />

          <RHFFileUpload<IndiaOnboardingFormInput>
            name={`${base}.driversLicense.backFile`}
            label="Driver’s license back (PDF)"
            namespace={ES3Namespace.ONBOARDINGS}
            folder={ES3Folder.GOV_DRIVERS_LICENSE}
            docId={docId}
            disabled={isReadOnly}
            dataField="governmentIds.driversLicense.backFile"
            placeholderLabel="Upload DL back PDF"
            maxSizeMB={20}
          />
        </div>

        <p className="mt-2 text-xs text-slate-500">
          If you upload a driver’s license, both sides are required.
        </p>
      </div>
    </div>
  );
}
