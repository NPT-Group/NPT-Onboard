import type { FieldErrors } from "react-hook-form";
import type { StepDef } from "../form-engine/types";
import type { IndiaOnboardingFormInput } from "./indiaFormSchema";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";
import {
  PERSONAL_INFO_FIELD_PATHS,
} from "./sections/PersonalInfoSection";
import { GOVERNMENT_IDS_FIELD_PATHS } from "./sections/GovernmentIdsSection";
import { EDUCATION_FIELD_PATHS } from "./sections/EducationSection";
import { DECLARATION_FIELD_PATHS } from "./sections/DeclarationSection";

export type IndiaStepId = (typeof ONBOARDING_STEPS)[number]["id"];

function findFirstEmploymentErrorPath(
  errs: FieldErrors<IndiaOnboardingFormInput>
): string | null {
  if ((errs as any).hasPreviousEmployment?.message) return "hasPreviousEmployment";

  const arr: any = (errs as any).employmentHistory;
  if (!arr) return null;
  if (arr?.message) return "employmentHistory";

  if (Array.isArray(arr)) {
    const order = [
      "organizationName",
      "designation",
      "startDate",
      "endDate",
      "reasonForLeaving",
      "experienceCertificateFile",
      "employerReferenceCheck",
    ];
    for (let i = 0; i < arr.length; i++) {
      const row = arr[i];
      if (!row) continue;
      for (const key of order) {
        if (row?.[key]?.message) return `employmentHistory.${i}.${key}`;
      }
    }
  }
  return null;
}

export const INDIA_STEPS: StepDef<IndiaOnboardingFormInput, IndiaStepId>[] =
  ONBOARDING_STEPS.map((s) => {
    if (s.id === "personal") {
      return { id: s.id as IndiaStepId, label: s.label, fieldPaths: PERSONAL_INFO_FIELD_PATHS };
    }
    if (s.id === "governmentIds") {
      return {
        id: s.id as IndiaStepId,
        label: s.label,
        fieldPaths: GOVERNMENT_IDS_FIELD_PATHS as any,
        nestedScrollPaths: [
          "governmentIds.aadhaar.aadhaarNumber",
          "governmentIds.aadhaar.file",
          "governmentIds.panCard.file",
          "governmentIds.passport.frontFile",
          "governmentIds.passport.backFile",
          "governmentIds.driversLicense.frontFile",
          "governmentIds.driversLicense.backFile",
        ],
      };
    }
    if (s.id === "education") {
      return { id: s.id as IndiaStepId, label: s.label, fieldPaths: EDUCATION_FIELD_PATHS };
    }
    if (s.id === "employment") {
      return {
        id: s.id as IndiaStepId,
        label: s.label,
        fieldPaths: ["hasPreviousEmployment", "employmentHistory"] as any,
        findFirstErrorPath: findFirstEmploymentErrorPath as any,
      };
    }
    if (s.id === "banking") {
      return {
        id: s.id as IndiaStepId,
        label: s.label,
        fieldPaths: ["bankDetails"] as any,
        nestedScrollPaths: [
          "bankDetails.bankName",
          "bankDetails.branchName",
          "bankDetails.accountHolderName",
          "bankDetails.accountNumber",
          "bankDetails.ifscCode",
          "bankDetails.upiId",
          "bankDetails.voidCheque",
        ],
      };
    }
    // declaration
    return {
      id: s.id as IndiaStepId,
      label: s.label,
      fieldPaths: DECLARATION_FIELD_PATHS,
      nestedScrollPaths: ["declaration.turnstile"],
    };
  });



