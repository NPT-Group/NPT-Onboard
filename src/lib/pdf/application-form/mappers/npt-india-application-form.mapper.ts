// src/lib/pdf/application-form/mappers/npt-india-application-form.mapper.ts

import type { PDFForm } from "pdf-lib";
import { EEducationLevel, EGender, type IIndiaOnboardingFormData } from "@/types/onboarding.types";
import { ENptIndiaApplicationFormFields as F, type NptIndiaApplicationFormPayload } from "./npt-india-application-form.types";

type MaybeDate = Date | string | undefined | null;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fmtDateDMY(date: MaybeDate): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  // Use UTC date to avoid timezone shifting the day
  const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function fmtYear(n?: number | null): string {
  if (n == null) return "";
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return String(Math.trunc(x));
}

function safeStr(v: any): string {
  return v == null ? "" : String(v).trim();
}

function boolFileExists(file?: any | null): boolean {
  return Boolean(file?.s3Key || file?.url);
}

function digitsOnly(v?: string | null): string {
  const s = safeStr(v);
  return s.replace(/\D+/g, "");
}

/**
 * NEW TEMPLATE: phone fields are split into (AAA) and BBBBBBB.
 * - We take the last 10 digits (handles +91, etc.)
 * - If < 10 digits, we best-effort: first 3 as area, rest as remaining.
 */
function splitPhone(phone?: string | null): { area: string; rest: string } {
  const d = digitsOnly(phone);
  if (!d) return { area: "", rest: "" };

  const ten = d.length > 10 ? d.slice(-10) : d;
  const area = ten.slice(0, Math.min(3, ten.length));
  const rest = ten.length > 3 ? ten.slice(3) : "";
  return { area, rest };
}

function fullName(first?: string, last?: string): string {
  return [safeStr(first), safeStr(last)].filter(Boolean).join(" ").trim();
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

export function buildNptIndiaApplicationFormPayload(formData: IIndiaOnboardingFormData): NptIndiaApplicationFormPayload {
  const payload: NptIndiaApplicationFormPayload = {};

  const p = formData.personalInfo;
  const g = formData.governmentIds;
  const edu = Array.isArray(formData.education) ? formData.education[0] : undefined; // schema enforces exactly 1
  const bank = formData.bankDetails;
  const dec = formData.declaration;

  /* ======================================================================== */
  /* Page 2: Personal Details / Address / Contact / Govt ID                    */
  /* ======================================================================== */

  payload[F.FULL_NAME] = fullName(p.firstName, p.lastName);
  payload[F.EMAIL] = safeStr(p.email);

  // Gender
  payload[F.GENDER] = p.gender === EGender.MALE ? "Male" : "Female";

  payload[F.DATE_OF_BIRTH] = fmtDateDMY(p.dateOfBirth);

  // proof of age is a text field
  payload[F.PROOF_OF_AGE] = p.canProvideProofOfAge ? "Yes" : "No";

  // Residential address
  payload[F.ADDRESS_LINE_1] = safeStr(p.residentialAddress?.addressLine1);
  payload[F.CITY] = safeStr(p.residentialAddress?.city);
  payload[F.STATE] = safeStr(p.residentialAddress?.state);
  payload[F.ZIP_POSTAL] = safeStr(p.residentialAddress?.postalCode);
  payload[F.ADDRESS_FROM] = fmtDateDMY(p.residentialAddress?.fromDate);
  payload[F.ADDRESS_TO] = fmtDateDMY(p.residentialAddress?.toDate);

  // Contact numbers (split)
  const home = splitPhone(p.phoneHome);
  payload[F.PHONE_HOME_AREA] = home.area;
  payload[F.PHONE_HOME_REST] = home.rest;

  const mobile = splitPhone(p.phoneMobile);
  payload[F.PHONE_MOBILE_AREA] = mobile.area;
  payload[F.PHONE_MOBILE_REST] = mobile.rest;

  payload[F.EMERGENCY_CONTACT_NAME] = safeStr(p.emergencyContactName);
  const emer = splitPhone(p.emergencyContactNumber);
  payload[F.EMERGENCY_PHONE_AREA] = emer.area;
  payload[F.EMERGENCY_PHONE_REST] = emer.rest;

  payload[F.REFERENCE1_NAME] = safeStr(p.reference1Name);
  const r1 = splitPhone(p.reference1PhoneNumber);
  payload[F.REFERENCE1_PHONE_AREA] = r1.area;
  payload[F.REFERENCE1_PHONE_REST] = r1.rest;

  payload[F.REFERENCE2_NAME] = safeStr(p.reference2Name);
  const r2 = splitPhone(p.reference2PhoneNumber);
  payload[F.REFERENCE2_PHONE_AREA] = r2.area;
  payload[F.REFERENCE2_PHONE_REST] = r2.rest;

  // checkbox -> boolean (worker will draw checkmark image)
  payload[F.CONSENT_TO_CONTACT] = !!p.hasConsentToContactReferencesOrEmergencyContact;

  // Government IDs
  payload[F.AADHAAR_NUMBER] = safeStr(g.aadhaar?.aadhaarNumber);
  payload[F.AADHAAR_CARD_ATTACHED] = boolFileExists(g.aadhaar?.file);

  payload[F.PAN_NUMBER] = safeStr(g.panCard?.panNumber);
  payload[F.PAN_CARD_ATTACHED] = boolFileExists(g.panCard?.file);

  payload[F.PASSPORT_NUMBER] = safeStr(g.passport?.passportNumber);
  payload[F.PASSPORT_ISSUE_DATE] = fmtDateDMY(g.passport?.issueDate);
  payload[F.PASSPORT_EXPIRY_DATE] = fmtDateDMY(g.passport?.expiryDate);
  payload[F.PASSPORT_FRONT_ATTACHED] = boolFileExists(g.passport?.frontFile);
  payload[F.PASSPORT_BACK_ATTACHED] = boolFileExists(g.passport?.backFile);

  payload[F.LICENSE_NUMBER] = safeStr(g.driversLicense?.licenseNumber);
  payload[F.LICENSE_ISSUE_DATE] = fmtDateDMY(g.driversLicense?.issueDate);
  payload[F.LICENSE_EXPIRY_DATE] = fmtDateDMY(g.driversLicense?.expiryDate);
  payload[F.LICENSE_FRONT_ATTACHED] = boolFileExists(g.driversLicense?.frontFile);
  payload[F.LICENSE_BACK_ATTACHED] = boolFileExists(g.driversLicense?.backFile);

  /* ======================================================================== */
  /* Page 3: Education                                                        */
  /* ======================================================================== */

  const level = edu?.highestLevel;

  payload[F.EDU_PRIMARY_SCHOOL] = level === EEducationLevel.PRIMARY_SCHOOL;
  payload[F.EDU_HIGH_SCHOOL] = level === EEducationLevel.HIGH_SCHOOL;
  payload[F.EDU_DIPLOMA] = level === EEducationLevel.DIPLOMA;
  payload[F.EDU_BACHELORS] = level === EEducationLevel.BACHELORS;
  payload[F.EDU_MASTERS] = level === EEducationLevel.MASTERS;
  payload[F.EDU_DOCTORATE] = level === EEducationLevel.DOCTORATE;
  payload[F.EDU_OTHER] = level === EEducationLevel.OTHER;

  payload[F.EDU_OTHER_TEXT] = "";

  payload[F.PRIMARY_SCHOOL_NAME] = safeStr(edu?.schoolName);
  payload[F.PRIMARY_YEAR_COMPLETED] = fmtYear(edu?.primaryYearCompleted);

  payload[F.HIGH_SCHOOL_NAME] = safeStr(edu?.highSchoolInstitutionName);
  payload[F.HIGH_SCHOOL_YEAR_COMPLETED] = fmtYear(edu?.highSchoolYearCompleted);

  payload[F.COLLEGE_UNIVERSITY_NAME] = safeStr(edu?.institutionName);
  payload[F.START_YEAR] = fmtYear(edu?.startYear);
  payload[F.YEAR_COMPLETED_OR_EXPECTED] = fmtYear(edu?.endYear);

  /* ======================================================================== */
  /* Page 4: Employment History                                               */
  /* ======================================================================== */

  const hasPrevEmployment = !!formData.hasPreviousEmployment;
  const jobs = Array.isArray(formData.employmentHistory) ? formData.employmentHistory : [];

  const setEmployment = (
    idx: number,
    fields: {
      na: F;
      org: F;
      role: F;
      start: F;
      end: F;
      reason: F;
      refYes: F;
      refNo: F;
      certYes: F;
      certNo: F;
    }
  ) => {
    const e: any = jobs[idx]; // employerReferenceCheck not in onboarding.types.ts yet

    if (!hasPrevEmployment || !e) {
      payload[fields.na] = true;

      payload[fields.org] = "";
      payload[fields.role] = "";
      payload[fields.start] = "";
      payload[fields.end] = "";
      payload[fields.reason] = "";

      payload[fields.refYes] = false;
      payload[fields.refNo] = false;
      payload[fields.certYes] = false;
      payload[fields.certNo] = false;
      return;
    }

    payload[fields.na] = false;

    payload[fields.org] = safeStr(e.organizationName);
    payload[fields.role] = safeStr(e.designation);
    payload[fields.start] = fmtDateDMY(e.startDate);
    payload[fields.end] = fmtDateDMY(e.endDate);
    payload[fields.reason] = safeStr(e.reasonForLeaving);

    const refOk = !!e.employerReferenceCheck;
    payload[fields.refYes] = refOk;
    payload[fields.refNo] = !refOk;

    const hasCert = boolFileExists(e.experienceCertificateFile);
    payload[fields.certYes] = hasCert;
    payload[fields.certNo] = !hasCert;
  };

  setEmployment(0, {
    na: F.EMP1_NA,
    org: F.EMP1_ORG_NAME,
    role: F.EMP1_ROLE,
    start: F.EMP1_START_DATE,
    end: F.EMP1_END_DATE,
    reason: F.EMP1_REASON_FOR_LEAVING,
    refYes: F.EMP1_REF_CHECK_YES,
    refNo: F.EMP1_REF_CHECK_NO,
    certYes: F.EMP1_EXP_CERT_YES,
    certNo: F.EMP1_EXP_CERT_NO,
  });

  setEmployment(1, {
    na: F.EMP2_NA,
    org: F.EMP2_ORG_NAME,
    role: F.EMP2_ROLE,
    start: F.EMP2_START_DATE,
    end: F.EMP2_END_DATE,
    reason: F.EMP2_REASON_FOR_LEAVING,
    refYes: F.EMP2_REF_CHECK_YES,
    refNo: F.EMP2_REF_CHECK_NO,
    certYes: F.EMP2_EXP_CERT_YES,
    certNo: F.EMP2_EXP_CERT_NO,
  });

  setEmployment(2, {
    na: F.EMP3_NA,
    org: F.EMP3_ORG_NAME,
    role: F.EMP3_ROLE,
    start: F.EMP3_START_DATE,
    end: F.EMP3_END_DATE,
    reason: F.EMP3_REASON_FOR_LEAVING,
    refYes: F.EMP3_REF_CHECK_YES,
    refNo: F.EMP3_REF_CHECK_NO,
    certYes: F.EMP3_EXP_CERT_YES,
    certNo: F.EMP3_EXP_CERT_NO,
  });

  /* ======================================================================== */
  /* Page 5: Banking + Declaration                                             */
  /* ======================================================================== */

  payload[F.BANK_NAME] = safeStr(bank.bankName);
  payload[F.BRANCH_NAME] = safeStr(bank.branchName);
  payload[F.ACCOUNT_HOLDER_NAME] = safeStr(bank.accountHolderName);
  payload[F.ACCOUNT_NUMBER] = safeStr(bank.accountNumber);
  payload[F.IFSC_CODE] = safeStr(bank.ifscCode);
  payload[F.UPI_ID] = safeStr(bank.upiId);

  const hasVoid = boolFileExists(bank.voidCheque?.file);
  payload[F.VOID_CHEQUE_ATTACHED_YES] = hasVoid;
  payload[F.VOID_CHEQUE_ATTACHED_NO] = !hasVoid;

  payload[F.DECLARATION_ACCEPTED] = !!dec?.hasAcceptedDeclaration;
  payload[F.DECLARATION_DATE] = fmtDateDMY(dec?.declarationDate || dec?.signature?.signedAt);

  return payload;
}

/* -------------------------------------------------------------------------- */
/* Apply payload to pdf-lib form                                              */
/* - strings => setText                                                       */
/* - booleans => ignored here (worker draws checkmark image)                   */
/* -------------------------------------------------------------------------- */

export function applyNptIndiaApplicationFormPayloadToForm(form: PDFForm, payload: NptIndiaApplicationFormPayload): void {
  for (const [name, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (typeof value === "boolean") continue;

    try {
      const tf = form.getTextField(name);
      tf.setText(String(value));
    } catch {
      // ignore missing/mismatched fields
    }
  }
}
