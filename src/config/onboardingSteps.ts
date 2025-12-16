// src/config/onboardingSteps.ts
export type WizardStep = {
  id: string;
  label: string;
};
export const ONBOARDING_STEPS: WizardStep[] = [
  { id: "personal", label: "Personal Information" },
  { id: "governmentIds", label: "Government Identification" },
  { id: "education", label: "Education" },
  { id: "employment", label: "Employment History" },
  { id: "banking", label: "Bank & Payment Details" },
  { id: "declaration", label: "Declaration & Signature" },
];
