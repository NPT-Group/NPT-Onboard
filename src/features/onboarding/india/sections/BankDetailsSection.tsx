"use client";

import type { FieldPath } from "react-hook-form";
import type { IndiaOnboardingFormInput } from "../indiaFormSchema";
import { RHFTextInput } from "../../common/RHFTextInput";
import { RHFFileUpload } from "../../common/RHFFileUpload";
import { ES3Folder, ES3Namespace } from "@/types/aws.types";

type BankDetailsSectionProps = {
  isReadOnly?: boolean;
  docId: string; // onboarding.id
};

export function BankDetailsSection({
  isReadOnly,
  docId,
}: BankDetailsSectionProps) {
  const base = "bankDetails" as const;

  return (
    <div className="rounded-2xl px-4 py-6 shadow-sm sm:px-6 sm:py-7">
      <header className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Bank & payment details
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Provide your bank details for payroll. Upload a void cheque (PDF) if
          available.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <RHFTextInput
          name={`${base}.bankName` as FieldPath<IndiaOnboardingFormInput>}
          label="Bank name"
          disabled={isReadOnly}
        />

        <RHFTextInput
          name={`${base}.branchName` as FieldPath<IndiaOnboardingFormInput>}
          label="Branch name"
          disabled={isReadOnly}
        />

        <RHFTextInput
          name={
            `${base}.accountHolderName` as FieldPath<IndiaOnboardingFormInput>
          }
          label="Account holder name"
          disabled={isReadOnly}
        />

        <RHFTextInput
          name={`${base}.accountNumber` as FieldPath<IndiaOnboardingFormInput>}
          label="Account number"
          inputMode="numeric"
          disabled={isReadOnly}
        />

        <RHFTextInput
          name={`${base}.ifscCode` as FieldPath<IndiaOnboardingFormInput>}
          label="IFSC code"
          placeholder="HDFC0001234"
          disabled={isReadOnly}
        />

        <RHFTextInput
          name={`${base}.upiId` as FieldPath<IndiaOnboardingFormInput>}
          label="UPI ID (optional)"
          placeholder="name@bank"
          disabled={isReadOnly}
        />
      </div>

      <div className="mt-5">
        <RHFFileUpload<IndiaOnboardingFormInput>
          name={`${base}.voidCheque` as FieldPath<IndiaOnboardingFormInput>}
          label="Void cheque (PDF) (optional)"
          description="Upload a clear PDF scan. Recommended: scanner app."
          namespace={ES3Namespace.ONBOARDINGS}
          folder={ES3Folder.BANK_VOID_CHEQUE}
          docId={docId}
          disabled={isReadOnly}
          dataField="bankDetails.voidCheque"
          placeholderLabel="Upload void cheque PDF"
          maxSizeMB={20}
        />
      </div>
    </div>
  );
}
