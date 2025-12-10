// src/lib/validation/onboardingFormValidation.ts
/**
 * Validation helpers for per-subsidiary onboarding form data.
 *
 * Goal:
 *  - Fail early with clear, user-friendly messages.
 *  - Mirror the schema requirements (per-subsidiary sections) without
 *    depending on Mongoose.
 *  - Keep validation logic centralized, so APIs can call this before
 *    touching S3 / DB.
 */

import { EAccountType, EEducationLevel, EGender, type IIndiaOnboardingFormData, type ICanadaOnboardingFormData, type IUsOnboardingFormData } from "@/types/onboarding.types";

import type { IFileAsset } from "@/types/shared.types";
import { vAssert, isObj, vString, vBoolean, vNumber, vOneOf, vFileish } from "./validationHelpers";

/* ──────────────────────── generic helpers ──────────────────────── */

function vDate(value: any, label: string) {
  vAssert(value != null, `${label} is required`);
  const d = new Date(value);
  vAssert(!isNaN(d.valueOf()), `${label} must be a valid date`);
  return d;
}

/** Validate an IFileAsset: url, s3Key, mimeType required; sizeBytes/originalName optional. */
function vFileAsset(asset: any, label: string) {
  // Basic presence / shape check (whatever vFileish is already doing for you)
  vFileish(asset, label);

  const file = asset as IFileAsset;

  // Required core fields
  vString(file.url, `${label}.url`);
  vString(file.s3Key, `${label}.s3Key`);
  vString(file.mimeType, `${label}.mimeType`);

  // Optional: if present, must be number
  if (file.sizeBytes != null) {
    vNumber(file.sizeBytes, `${label}.sizeBytes`);
  }

  // Optional: if present, must be non-empty string
  if (file.originalName != null) {
    vOptionalString(file.originalName, `${label}.originalName`);
  }
}

/** For simple optional string fields (non-empty only when present). */
function vOptionalString(value: any, label: string) {
  if (value == null) return;
  vAssert(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string when provided`);
}

/** Simple MIME check for enforcing image-only files (e.g. signature). */
function vImageFile(asset: any, label: string) {
  vFileAsset(asset, label);

  const mime = String((asset as IFileAsset).mimeType || "").toLowerCase();
  vAssert(mime.startsWith("image/"), `${label} must be an image`);
}

/* ──────────────────────── common sections ──────────────────────── */

function validatePersonalInfo(personalInfo: any) {
  vAssert(isObj(personalInfo), "personalInfo is required");

  vString(personalInfo.firstName, "personalInfo.firstName");
  vString(personalInfo.lastName, "personalInfo.lastName");
  vString(personalInfo.email, "personalInfo.email");

  vOneOf(personalInfo.gender, "personalInfo.gender", Object.values(EGender) as readonly string[]);

  vDate(personalInfo.dateOfBirth, "personalInfo.dateOfBirth");
  vBoolean(personalInfo.canProvideProofOfAge, "personalInfo.canProvideProofOfAge");

  // residentialAddress subset – keep it simple and aligned with schema
  const addr = personalInfo.residentialAddress;
  vAssert(isObj(addr), "personalInfo.residentialAddress is required");
  vString(addr.addressLine1, "personalInfo.residentialAddress.addressLine1");
  vOptionalString(addr.addressLine2, "personalInfo.residentialAddress.addressLine2");
  vOptionalString(addr.city, "personalInfo.residentialAddress.city");
  vOptionalString(addr.state, "personalInfo.residentialAddress.state");
  vOptionalString(addr.postalCode, "personalInfo.residentialAddress.postalCode");

  vDate(addr.fromDate, "personalInfo.residentialAddress.fromDate");
  vDate(addr.toDate, "personalInfo.residentialAddress.toDate");

  // phone & emergency contact
  vOptionalString(personalInfo.phoneHome, "personalInfo.phoneHome");
  vString(personalInfo.phoneMobile, "personalInfo.phoneMobile");
  vString(personalInfo.emergencyContactName, "personalInfo.emergencyContactName");
  vString(personalInfo.emergencyContactNumber, "personalInfo.emergencyContactNumber");
}

function validateEducationEntry(entry: any, label: string) {
  vAssert(isObj(entry), `${label} is required`);

  const level = entry.highestLevel;
  vOneOf(level, `${label}.highestLevel`, Object.values(EEducationLevel) as readonly string[]);

  const disallow = (value: any, fieldPath: string) => {
    vAssert(value == null, `${fieldPath} is not allowed when ${label}.highestLevel is ${level}`);
  };

  if (level === EEducationLevel.PRIMARY_SCHOOL) {
    // Primary
    vString(entry.schoolName, `${label}.schoolName`);
    vOptionalString(entry.schoolLocation, `${label}.schoolLocation`);
    vNumber(entry.primaryYearCompleted, `${label}.primaryYearCompleted`);

    // Disallow high-school and diploma/bachelor+ fields
    disallow(entry.highSchoolInstitutionName, `${label}.highSchoolInstitutionName`);
    disallow(entry.highSchoolBoard, `${label}.highSchoolBoard`);
    disallow(entry.highSchoolStream, `${label}.highSchoolStream`);
    disallow(entry.highSchoolYearCompleted, `${label}.highSchoolYearCompleted`);
    disallow(entry.highSchoolGradeOrPercentage, `${label}.highSchoolGradeOrPercentage`);

    disallow(entry.institutionName, `${label}.institutionName`);
    disallow(entry.universityOrBoard, `${label}.universityOrBoard`);
    disallow(entry.fieldOfStudy, `${label}.fieldOfStudy`);
    disallow(entry.startYear, `${label}.startYear`);
    disallow(entry.endYear, `${label}.endYear`);
    disallow(entry.gradeOrCgpa, `${label}.gradeOrCgpa`);
  } else if (level === EEducationLevel.HIGH_SCHOOL) {
    // High school
    vString(entry.highSchoolInstitutionName, `${label}.highSchoolInstitutionName`);
    vOptionalString(entry.highSchoolBoard, `${label}.highSchoolBoard`);
    vOptionalString(entry.highSchoolStream, `${label}.highSchoolStream`);
    vNumber(entry.highSchoolYearCompleted, `${label}.highSchoolYearCompleted`);
    vOptionalString(entry.highSchoolGradeOrPercentage, `${label}.highSchoolGradeOrPercentage`);

    // Disallow primary and diploma/bachelor+ fields
    disallow(entry.schoolName, `${label}.schoolName`);
    disallow(entry.schoolLocation, `${label}.schoolLocation`);
    disallow(entry.primaryYearCompleted, `${label}.primaryYearCompleted`);

    disallow(entry.institutionName, `${label}.institutionName`);
    disallow(entry.universityOrBoard, `${label}.universityOrBoard`);
    disallow(entry.fieldOfStudy, `${label}.fieldOfStudy`);
    disallow(entry.startYear, `${label}.startYear`);
    disallow(entry.endYear, `${label}.endYear`);
    disallow(entry.gradeOrCgpa, `${label}.gradeOrCgpa`);
  } else {
    // Diploma / Bachelor / Masters / Doctorate / Other

    // Required core fields
    vString(entry.institutionName, `${label}.institutionName`);
    vString(entry.fieldOfStudy, `${label}.fieldOfStudy`);

    // Optional metadata
    vOptionalString(entry.universityOrBoard, `${label}.universityOrBoard`);

    // Dates: endYear required, startYear optional but must be a number when present
    if (entry.startYear != null) {
      vNumber(entry.startYear, `${label}.startYear`);
    }
    vNumber(entry.endYear, `${label}.endYear`);

    // Grades/GPA optional
    vOptionalString(entry.gradeOrCgpa, `${label}.gradeOrCgpa`);

    // Disallow primary + high-school-specific fields
    disallow(entry.schoolName, `${label}.schoolName`);
    disallow(entry.schoolLocation, `${label}.schoolLocation`);
    disallow(entry.primaryYearCompleted, `${label}.primaryYearCompleted`);

    disallow(entry.highSchoolInstitutionName, `${label}.highSchoolInstitutionName`);
    disallow(entry.highSchoolBoard, `${label}.highSchoolBoard`);
    disallow(entry.highSchoolStream, `${label}.highSchoolStream`);
    disallow(entry.highSchoolYearCompleted, `${label}.highSchoolYearCompleted`);
    disallow(entry.highSchoolGradeOrPercentage, `${label}.highSchoolGradeOrPercentage`);
  }
}

function validateEducationArray(education: any) {
  vAssert(Array.isArray(education), "education must be an array");
  vAssert(education.length > 0, "At least one education entry is required");

  for (let i = 0; i < education.length; i++) {
    validateEducationEntry(education[i], `education[${i}]`);
  }
}

function validateEmploymentHistoryEntry(entry: any, label: string) {
  vAssert(isObj(entry), `${label} is required`);

  vString(entry.organizationName, `${label}.organizationName`);
  vString(entry.designation, `${label}.designation`);
  vDate(entry.startDate, `${label}.startDate`);
  vDate(entry.endDate, `${label}.endDate`);
  vString(entry.reasonForLeaving, `${label}.reasonForLeaving`);

  if (entry.experienceCertificateFile != null) {
    vFileAsset(entry.experienceCertificateFile, `${label}.experienceCertificateFile`);
  }
}

function validateEmploymentHistoryArray(employmentHistory: any, opts: { requireAtLeastOne: boolean }) {
  vAssert(Array.isArray(employmentHistory), "employmentHistory must be an array");

  if (opts.requireAtLeastOne) {
    vAssert(employmentHistory.length > 0, "At least one employment history entry is required");
  }

  for (let i = 0; i < employmentHistory.length; i++) {
    validateEmploymentHistoryEntry(employmentHistory[i], `employmentHistory[${i}]`);
  }
}

function validateDeclaration(declaration: any) {
  vAssert(isObj(declaration), "declaration is required");

  vBoolean(declaration.hasAcceptedDeclaration, "declaration.hasAcceptedDeclaration");
  vAssert(declaration.hasAcceptedDeclaration === true, "You must accept the declaration before submitting");

  const sig = declaration.signature;
  vAssert(isObj(sig), "declaration.signature is required");

  vImageFile(sig.file, "declaration.signature.file");
  vDate(sig.signedAt, "declaration.signature.signedAt");
  vDate(declaration.declarationDate, "declaration.declarationDate");
}

/* ─────────────────────── INDIA-specific ─────────────────────── */

function validateIndiaGovernmentIds(gov: any) {
  vAssert(isObj(gov), "governmentIds is required");

  // Aadhaar
  const aadhaar = gov.aadhaar;
  vAssert(isObj(aadhaar), "governmentIds.aadhaar is required");
  vString(aadhaar.aadhaarNumber, "governmentIds.aadhaar.aadhaarNumber");
  vFileAsset(aadhaar.file, "governmentIds.aadhaar.file");

  // PAN
  const panCard = gov.panCard;
  vAssert(isObj(panCard), "governmentIds.panCard is required");
  vFileAsset(panCard.file, "governmentIds.panCard.file");

  // Passport (front/back both required)
  const passport = gov.passport;
  vAssert(isObj(passport), "governmentIds.passport is required");
  vAssert(passport.frontFile, "governmentIds.passport.frontFile is required");
  vAssert(passport.backFile, "governmentIds.passport.backFile is required");
  vFileAsset(passport.frontFile, "governmentIds.passport.frontFile");
  vFileAsset(passport.backFile, "governmentIds.passport.backFile");

  // Drivers license (optional doc, but if present front/back required)
  const dl = gov.driversLicense;
  if (dl) {
    vAssert(dl.frontFile, "governmentIds.driversLicense.frontFile is required");
    vAssert(dl.backFile, "governmentIds.driversLicense.backFile is required");
    vFileAsset(dl.frontFile, "governmentIds.driversLicense.frontFile");
    vFileAsset(dl.backFile, "governmentIds.driversLicense.backFile");
  }
}

// INDIA
function validateIndiaBankDetails(bank: any) {
  vAssert(isObj(bank), "bankDetails is required");

  vString(bank.bankName, "bankDetails.bankName");
  vString(bank.branchName, "bankDetails.branchName");
  vString(bank.accountHolderName, "bankDetails.accountHolderName");
  vString(bank.accountNumber, "bankDetails.accountNumber");
  vString(bank.ifscCode, "bankDetails.ifscCode");
  vOptionalString(bank.upiId, "bankDetails.upiId");

  const voidCheque = bank.voidCheque;
  if (voidCheque) {
    vFileAsset(voidCheque.file, "bankDetails.voidCheque.file");
  }
}

/**
 * Validate an India onboarding form payload.
 * Throws AppError(400, ...) with user-friendly messages on failure.
 */
export function validateIndiaOnboardingForm(data: any): asserts data is IIndiaOnboardingFormData {
  vAssert(isObj(data), "indiaFormData is required");

  validatePersonalInfo(data.personalInfo);
  validateIndiaGovernmentIds(data.governmentIds);
  validateEducationArray(data.education);
  vBoolean(data.hasPreviousEmployment, "hasPreviousEmployment");
  const requireAtLeastOne = !!data.hasPreviousEmployment;
  validateEmploymentHistoryArray(data.employmentHistory, { requireAtLeastOne });

  validateIndiaBankDetails(data.bankDetails);
  validateDeclaration(data.declaration);
}

/* ─────────────────────── CANADA-specific ─────────────────────── */

function validateCanadaGovernmentIds(gov: any) {
  vAssert(isObj(gov), "governmentIds is required");

  // SIN
  const sin = gov.sin;
  vAssert(isObj(sin), "governmentIds.sin is required");
  vString(sin.sinNumber, "governmentIds.sin.sinNumber");
  vFileAsset(sin.file, "governmentIds.sin.file");

  // Passport (front/back both required)
  const passport = gov.passport;
  vAssert(isObj(passport), "governmentIds.passport is required");
  vAssert(passport.frontFile, "governmentIds.passport.frontFile is required");
  vAssert(passport.backFile, "governmentIds.passport.backFile is required");
  vFileish(passport.frontFile, "governmentIds.passport.frontFile");
  vFileish(passport.backFile, "governmentIds.passport.backFile");

  // PR Card (optional)
  const prCard = gov.prCard;
  if (prCard) {
    if (prCard.frontFile) {
      vFileish(prCard.frontFile, "governmentIds.prCard.frontFile");
    }
    if (prCard.backFile) {
      vFileish(prCard.backFile, "governmentIds.prCard.backFile");
    }
  }

  // Work Permit (optional, single file doc)
  const workPermit = gov.workPermit;
  if (workPermit) {
    vFileish(workPermit.file, "governmentIds.workPermit.file");
  }

  // Drivers License (optional doc, but if present front/back required)
  const dl = gov.driversLicense;
  if (dl) {
    vAssert(dl.frontFile, "governmentIds.driversLicense.frontFile is required");
    vAssert(dl.backFile, "governmentIds.driversLicense.backFile is required");
    vFileish(dl.frontFile, "governmentIds.driversLicense.frontFile");
    vFileish(dl.backFile, "governmentIds.driversLicense.backFile");
  }
}

// CANADA
function validateCanadaBankDetails(bank: any) {
  vAssert(isObj(bank), "bankDetails is required");

  vString(bank.bankName, "bankDetails.bankName");
  vString(bank.institutionNumber, "bankDetails.institutionNumber");
  vString(bank.transitNumber, "bankDetails.transitNumber");
  vString(bank.accountNumber, "bankDetails.accountNumber");
  vString(bank.accountHolderName, "bankDetails.accountHolderName");

  const directDepositDoc = bank.directDepositDoc;
  if (directDepositDoc) {
    vFileish(directDepositDoc.file, "bankDetails.directDepositDoc.file");
  }
}

/**
 * Validate a Canada onboarding form payload.
 */
export function validateCanadaOnboardingForm(data: any): asserts data is ICanadaOnboardingFormData {
  vAssert(isObj(data), "canadaFormData is required");

  validatePersonalInfo(data.personalInfo);
  validateCanadaGovernmentIds(data.governmentIds);
  validateEducationArray(data.education);
  vBoolean(data.hasPreviousEmployment, "hasPreviousEmployment");
  const requireAtLeastOne = !!data.hasPreviousEmployment;
  validateEmploymentHistoryArray(data.employmentHistory, { requireAtLeastOne });

  validateCanadaBankDetails(data.bankDetails);
  validateDeclaration(data.declaration);
}

/* ─────────────────────── USA-specific ─────────────────────── */

function validateUsGovernmentIds(gov: any) {
  vAssert(isObj(gov), "governmentIds is required");

  // SSN
  const ssn = gov.ssn;
  vAssert(isObj(ssn), "governmentIds.ssn is required");
  vString(ssn.ssnNumber, "governmentIds.ssn.ssnNumber");
  vFileAsset(ssn.file, "governmentIds.ssn.file");

  // Passport (front/back both required)
  const passport = gov.passport;
  vAssert(isObj(passport), "governmentIds.passport is required");
  vAssert(passport.frontFile, "governmentIds.passport.frontFile is required");
  vAssert(passport.backFile, "governmentIds.passport.backFile is required");
  vFileish(passport.frontFile, "governmentIds.passport.frontFile");
  vFileish(passport.backFile, "governmentIds.passport.backFile");

  // Green Card (optional)
  const green = gov.greenCard;
  if (green) {
    if (green.frontFile) {
      vFileish(green.frontFile, "governmentIds.greenCard.frontFile");
    }
    if (green.backFile) {
      vFileish(green.backFile, "governmentIds.greenCard.backFile");
    }
  }

  // Work Permit (optional)
  const wp = gov.workPermit;
  if (wp) vFileish(wp.file, "governmentIds.workPermit.file");

  // Drivers License (optional doc, but if present front/back required)
  const dl = gov.driversLicense;
  if (dl) {
    vAssert(dl.frontFile, "governmentIds.driversLicense.frontFile is required");
    vAssert(dl.backFile, "governmentIds.driversLicense.backFile is required");
    vFileish(dl.frontFile, "governmentIds.driversLicense.frontFile");
    vFileish(dl.backFile, "governmentIds.driversLicense.backFile");
  }
}

// USA
function validateUsBankDetails(bank: any) {
  vAssert(isObj(bank), "bankDetails is required");

  vString(bank.bankName, "bankDetails.bankName");
  vString(bank.routingNumber, "bankDetails.routingNumber");
  vString(bank.accountNumber, "bankDetails.accountNumber");
  vString(bank.accountHolderName, "bankDetails.accountHolderName");

  vOneOf(bank.accountType, "bankDetails.accountType", Object.values(EAccountType) as readonly string[]);

  const doc = bank.voidChequeOrDepositSlip;
  if (doc) {
    vFileish(doc.file, "bankDetails.voidChequeOrDepositSlip.file");
  }
}

/**
 * Validate a US onboarding form payload.
 */
export function validateUsOnboardingForm(data: any): asserts data is IUsOnboardingFormData {
  vAssert(isObj(data), "usFormData is required");

  validatePersonalInfo(data.personalInfo);
  validateUsGovernmentIds(data.governmentIds);
  validateEducationArray(data.education);

  vBoolean(data.hasPreviousEmployment, "hasPreviousEmployment");

  const requireAtLeastOne = !!data.hasPreviousEmployment;
  validateEmploymentHistoryArray(data.employmentHistory, { requireAtLeastOne });

  validateUsBankDetails(data.bankDetails);
  validateDeclaration(data.declaration);
}
