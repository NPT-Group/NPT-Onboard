import type { DeepPartial } from "react-hook-form";
import type { TOnboardingContext } from "@/types/onboarding.types";
import type { IndiaOnboardingFormInput } from "./indiaFormSchema";

function toYmd(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    // If it's already YYYY-MM-DD, keep it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function buildIndiaDefaultValuesFromOnboarding(
  onboarding: TOnboardingContext,
  today: string
): DeepPartial<IndiaOnboardingFormInput> {
  const existing = (onboarding as any).indiaFormData as any | undefined;

  // If this is a modification request, we want to prefill the last submitted data.
  // (Backend preserves indiaFormData; it only rotates the invite token.)
  if (existing && typeof existing === "object") {
    const vc = existing?.bankDetails?.voidCheque;
    const voidCheque =
      vc?.url && vc?.s3Key ? vc : vc?.file && (vc.file.url && vc.file.s3Key) ? vc.file : undefined;

    return {
      personalInfo: {
        ...existing.personalInfo,
        // Always enforce canonical identity from onboarding context.
        firstName: onboarding.firstName ?? existing.personalInfo?.firstName ?? "",
        lastName: onboarding.lastName ?? existing.personalInfo?.lastName ?? "",
        email: onboarding.email ?? existing.personalInfo?.email ?? "",
        dateOfBirth: toYmd(existing.personalInfo?.dateOfBirth),
        residentialAddress: {
          ...existing.personalInfo?.residentialAddress,
          fromDate: toYmd(existing.personalInfo?.residentialAddress?.fromDate),
          toDate: toYmd(existing.personalInfo?.residentialAddress?.toDate),
        },
      },
      governmentIds: {
        ...existing.governmentIds,
      },
      education: Array.isArray(existing.education) && existing.education.length
        ? [existing.education[0]]
        : [{ highestLevel: "" as any }],
      hasPreviousEmployment:
        typeof existing.hasPreviousEmployment === "boolean"
          ? existing.hasPreviousEmployment
          : (Array.isArray(existing.employmentHistory) && existing.employmentHistory.length > 0) as any,
      employmentHistory: Array.isArray(existing.employmentHistory)
        ? existing.employmentHistory.map((e: any) => ({
            ...e,
            startDate: toYmd(e?.startDate),
            endDate: toYmd(e?.endDate),
          }))
        : [],
      bankDetails: {
        ...existing.bankDetails,
        voidCheque,
      },
      declaration: {
        ...existing.declaration,
        declarationDate: toYmd(existing.declaration?.declarationDate) || today,
        signature: {
          ...existing.declaration?.signature,
          signedAt: toYmd(existing.declaration?.signature?.signedAt),
        },
      },
    };
  }

  return {
    personalInfo: {
      firstName: onboarding.firstName ?? "",
      lastName: onboarding.lastName ?? "",
      email: onboarding.email ?? "",
      gender: "" as any,
      dateOfBirth: "",
      canProvideProofOfAge: false,
      residentialAddress: {
        addressLine1: "",
        city: "",
        state: "",
        postalCode: "",
        fromDate: "",
        toDate: "",
      },
      phoneHome: undefined,
      phoneMobile: "",
      emergencyContactName: "",
      emergencyContactNumber: "",
    },
    governmentIds: {
      aadhaar: { aadhaarNumber: "", file: undefined as any },
      panCard: { file: undefined as any },
      passport: { frontFile: undefined as any, backFile: undefined as any },
      driversLicense: undefined,
    },
    // Backend expects exactly 1 education entry; keep a single placeholder row.
    education: [{ highestLevel: "" as any }],
    hasPreviousEmployment: undefined as any,
    employmentHistory: [],
    bankDetails: {
      bankName: "",
      branchName: "",
      accountHolderName: "",
      accountNumber: "",
      ifscCode: "",
      upiId: undefined,
      voidCheque: undefined,
    },
    declaration: {
      hasAcceptedDeclaration: false,
      declarationDate: today,
      signature: {
        file: undefined as any,
        signedAt: today,
      },
    },
  };
}



