import { EEducationLevel } from "@/types/onboarding.types";
import type { IndiaOnboardingFormValues } from "./indiaFormSchema";

export function normalizeIndiaFormDataForSubmit(values: IndiaOnboardingFormValues) {
  // Deep clone to avoid mutating RHF state
  const form: any = JSON.parse(JSON.stringify(values));

  const toUndef = (v: any) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;

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
  }

  // education strictness
  if (Array.isArray(form.education) && form.education[0]) {
    const e = form.education[0];
    const level = e.highestLevel as EEducationLevel | undefined;

    // Backend rejects optional-but-empty strings; normalize common optional fields.
    // (Required fields remain required by frontend validation before submit.)
    [
      "schoolLocation",
      "highSchoolBoard",
      "highSchoolStream",
      "highSchoolGradeOrPercentage",
      "universityOrBoard",
      "gradeOrCgpa",
    ].forEach((k) => {
      e[k] = toUndef(e[k]);
      if (e[k] === undefined) delete e[k];
    });

    const del = (k: string) => {
      if (k in e) delete e[k];
    };

    if (level === EEducationLevel.PRIMARY_SCHOOL) {
      [
        "highSchoolInstitutionName",
        "highSchoolBoard",
        "highSchoolStream",
        "highSchoolYearCompleted",
        "highSchoolGradeOrPercentage",
        "institutionName",
        "universityOrBoard",
        "fieldOfStudy",
        "startYear",
        "endYear",
        "gradeOrCgpa",
      ].forEach(del);
    } else if (level === EEducationLevel.HIGH_SCHOOL) {
      [
        "schoolName",
        "schoolLocation",
        "primaryYearCompleted",
        "institutionName",
        "universityOrBoard",
        "fieldOfStudy",
        "startYear",
        "endYear",
        "gradeOrCgpa",
      ].forEach(del);
    } else if (level) {
      [
        "schoolName",
        "schoolLocation",
        "primaryYearCompleted",
        "highSchoolInstitutionName",
        "highSchoolBoard",
        "highSchoolStream",
        "highSchoolYearCompleted",
        "highSchoolGradeOrPercentage",
      ].forEach(del);
    }
  }

  // governmentIds driversLicense empty-object protection
  if (form.governmentIds?.driversLicense) {
    const dl = form.governmentIds.driversLicense;
    const hasFront = Boolean(dl?.frontFile);
    const hasBack = Boolean(dl?.backFile);
    if (!hasFront && !hasBack) delete form.governmentIds.driversLicense;
  }

  return form;
}

