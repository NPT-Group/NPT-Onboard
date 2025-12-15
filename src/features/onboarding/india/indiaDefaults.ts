import type { DeepPartial } from "react-hook-form";
import type { TOnboardingContext } from "@/types/onboarding.types";
import type { IndiaOnboardingFormInput } from "./indiaFormSchema";

export function buildIndiaDefaultValuesFromOnboarding(
  onboarding: TOnboardingContext,
  today: string
): DeepPartial<IndiaOnboardingFormInput> {
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
        signedAt: "",
      },
    },
  };
}


