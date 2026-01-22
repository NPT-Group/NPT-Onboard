// src/features/onboarding/india/normalizeIndiaFormData.ts
import { EEducationLevel } from "@/types/onboarding.types";
import type { IndiaOnboardingFormValues } from "./indiaFormSchema";

export function normalizeIndiaFormDataForSubmit(values: IndiaOnboardingFormValues) {
  // Deep clone to avoid mutating RHF state
  const form: any = JSON.parse(JSON.stringify(values));

  const toUndef = (v: any) => (typeof v === "string" && v.trim() === "" ? undefined : v);

  // personalInfo optionals
  if (form.personalInfo) {
    form.personalInfo.phoneHome = toUndef(form.personalInfo.phoneHome);
  }

  // bankDetails optionals + voidCheque quirk
  if (form.bankDetails) {
    form.bankDetails.upiId = toUndef(form.bankDetails.upiId);

    // Backend quirk: validator checks voidCheque like IFileAsset, while finalizer expects { file: IFileAsset }.
    // Satisfy both by sending { file, ...file }.
    const vc = form.bankDetails.voidCheque;
    if (vc) {
      if (vc.file) form.bankDetails.voidCheque = { ...vc, ...vc.file };
      else form.bankDetails.voidCheque = { file: vc, ...vc };
    }
  }

  // employment: if user says "no previous employment", guarantee empty array
  // to avoid accidental stale entries being submitted.
  if (form.hasPreviousEmployment === false) {
    form.employmentHistory = [];
  } else if (Array.isArray(form.employmentHistory)) {
    // Ensure employerReferenceCheck is always present for each entry (required field)
    form.employmentHistory = form.employmentHistory.map((entry: any) => ({
      ...entry,
      employerReferenceCheck: typeof entry.employerReferenceCheck === "boolean" ? entry.employerReferenceCheck : false,
    }));
  }

  // education strictness
  if (Array.isArray(form.education) && form.education[0]) {
    const e = form.education[0];
    const level = e.highestLevel as EEducationLevel | undefined;

    // Backend rejects optional-but-empty strings; normalize common optional fields.
    // (Required fields remain required by frontend validation before submit.)
    // No optional string fields to normalize for higher education

    const del = (k: string) => {
      if (k in e) delete e[k];
    };

    if (level === EEducationLevel.PRIMARY_SCHOOL) {
      [
        "highSchoolInstitutionName",
        "highSchoolYearCompleted",
        "institutionName",
        "startYear",
        "endYear",
      ].forEach(del);
    } else if (level === EEducationLevel.HIGH_SCHOOL) {
      ["schoolName", "primaryYearCompleted", "institutionName", "startYear", "endYear"].forEach(del);
    } else if (level) {
      ["schoolName", "primaryYearCompleted", "highSchoolInstitutionName", "highSchoolYearCompleted"].forEach(
        del
      );
    }
  }

  // governmentIds: normalize optional groups + delete empty ones
  if (form.governmentIds) {
    // PAN: normalize empty string
    if (form.governmentIds.panCard) {
      form.governmentIds.panCard.panNumber = toUndef(form.governmentIds.panCard.panNumber);
    }

    const isEmptyObj = (o: any) => o && typeof o === "object" && Object.keys(o).length === 0;

    const hasAnyValue = (o: any) => {
      if (!o || typeof o !== "object") return false;
      return Object.values(o).some((v) => {
        if (v == null) return false;
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "object") return !isEmptyObj(v);
        return true;
      });
    };

    // Passport optional: drop it if user left it blank
    if (form.governmentIds.passport && !hasAnyValue(form.governmentIds.passport)) {
      delete form.governmentIds.passport;
    }

    // Drivers license optional: drop it if user left it blank
    if (form.governmentIds.driversLicense && !hasAnyValue(form.governmentIds.driversLicense)) {
      delete form.governmentIds.driversLicense;
    }
  }

  return form;
}
