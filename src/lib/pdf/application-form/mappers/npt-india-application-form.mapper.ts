import type { PDFForm } from "pdf-lib";

import { EEducationLevel, EGender, type IIndiaOnboardingFormData } from "@/types/onboarding.types";
import { ENptIndiaApplicationFormFields as F, type NptIndiaApplicationFormPayload } from "./npt-india-application-form.types";

type MaybeDate = Date | string | undefined | null;

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
  if (!n || !Number.isFinite(n)) return "";
  return String(Math.trunc(n));
}

function safeStr(v: any): string {
  return v == null ? "" : String(v).trim();
}

function boolFileExists(file?: any | null): boolean {
  return Boolean(file?.s3Key || file?.url);
}

/* ------------------------------- builder ------------------------------- */

export function buildNptIndiaApplicationFormPayload(formData: IIndiaOnboardingFormData): NptIndiaApplicationFormPayload {
  const payload: NptIndiaApplicationFormPayload = {};

  const p = formData.personalInfo;
  const g = formData.governmentIds;
  const edu = Array.isArray(formData.education) ? formData.education[0] : undefined; // schema enforces exactly 1
  const bank = formData.bankDetails;
  const dec = formData.declaration;

  /* ------------------------------ Page 1 ------------------------------ */

  payload[F.FIRST_NAME] = safeStr(p.firstName);
  payload[F.LAST_NAME] = safeStr(p.lastName);
  payload[F.EMAIL] = safeStr(p.email);

  // Gender checkboxes
  payload[F.GENDER_MALE] = p.gender === EGender.MALE;
  payload[F.GENDER_FEMALE] = p.gender === EGender.FEMALE;

  payload[F.DATE_OF_BIRTH] = fmtDateDMY(p.dateOfBirth);

  // Proof of age (Yes/No)
  payload[F.PROOF_OF_AGE_YES] = !!p.canProvideProofOfAge;
  payload[F.PROOF_OF_AGE_NO] = !p.canProvideProofOfAge;

  // Residential address
  payload[F.ADDRESS_LINE_1] = safeStr(p.residentialAddress?.addressLine1);
  payload[F.CITY] = safeStr(p.residentialAddress?.city);
  payload[F.STATE] = safeStr(p.residentialAddress?.state);
  payload[F.ZIP_POSTAL] = safeStr(p.residentialAddress?.postalCode);
  payload[F.ADDRESS_FROM] = fmtDateDMY(p.residentialAddress?.fromDate);
  payload[F.ADDRESS_TO] = fmtDateDMY(p.residentialAddress?.toDate);

  // Contact numbers
  payload[F.PHONE_HOME] = safeStr(p.phoneHome);
  payload[F.PHONE_MOBILE] = safeStr(p.phoneMobile);
  payload[F.EMERGENCY_CONTACT_NAME] = safeStr(p.emergencyContactName);
  payload[F.EMERGENCY_CONTACT_PHONE] = safeStr(p.emergencyContactNumber);

  // ID info
  payload[F.AADHAAR_NUMBER] = safeStr(g.aadhaar?.aadhaarNumber);
  payload[F.AADHAAR_CARD_ATTACHED] = boolFileExists(g.aadhaar?.file);

  // PAN: your DB model doesn’t store panNumber, but the PDF has a PAN Number line.
  // Leave blank; HR can optionally hand-write or you can later add panNumber to schema.
  payload[F.PAN_NUMBER] = "";
  payload[F.PAN_CARD_ATTACHED] = boolFileExists(g.panCard?.file);

  payload[F.PASSPORT_FRONT_ATTACHED] = boolFileExists(g.passport?.frontFile);
  payload[F.PASSPORT_BACK_ATTACHED] = boolFileExists(g.passport?.backFile);

  payload[F.LICENSE_FRONT_ATTACHED] = boolFileExists(g.driversLicense?.frontFile);
  payload[F.LICENSE_BACK_ATTACHED] = boolFileExists(g.driversLicense?.backFile);

  /* ------------------------------ Page 2 ------------------------------ */

  const jobs = Array.isArray(formData.employmentHistory) ? formData.employmentHistory : [];

  const setEmployment = (idx: number, fields: { org: F; role: F; start: F; end: F; reason: F; yes: F; no: F }) => {
    const e = jobs[idx];
    if (!e) {
      // If missing, keep empty and mark "No" for certificate by default
      payload[fields.org] = "";
      payload[fields.role] = "";
      payload[fields.start] = "";
      payload[fields.end] = "";
      payload[fields.reason] = "";
      payload[fields.yes] = false;
      payload[fields.no] = true;
      return;
    }

    payload[fields.org] = safeStr(e.organizationName);
    payload[fields.role] = safeStr(e.designation);
    payload[fields.start] = fmtDateDMY(e.startDate);
    payload[fields.end] = fmtDateDMY(e.endDate);
    payload[fields.reason] = safeStr(e.reasonForLeaving);

    const hasCert = boolFileExists(e.experienceCertificateFile);
    payload[fields.yes] = hasCert;
    payload[fields.no] = !hasCert;
  };

  setEmployment(0, {
    org: F.EMP1_ORG_NAME,
    role: F.EMP1_ROLE,
    start: F.EMP1_START_DATE,
    end: F.EMP1_END_DATE,
    reason: F.EMP1_REASON_FOR_LEAVING,
    yes: F.EMP1_EXP_CERT_YES,
    no: F.EMP1_EXP_CERT_NO,
  });

  setEmployment(1, {
    org: F.EMP2_ORG_NAME,
    role: F.EMP2_ROLE,
    start: F.EMP2_START_DATE,
    end: F.EMP2_END_DATE,
    reason: F.EMP2_REASON_FOR_LEAVING,
    yes: F.EMP2_EXP_CERT_YES,
    no: F.EMP2_EXP_CERT_NO,
  });

  setEmployment(2, {
    org: F.EMP3_ORG_NAME,
    role: F.EMP3_ROLE,
    start: F.EMP3_START_DATE,
    end: F.EMP3_END_DATE,
    reason: F.EMP3_REASON_FOR_LEAVING,
    yes: F.EMP3_EXP_CERT_YES,
    no: F.EMP3_EXP_CERT_NO,
  });

  /* ------------------------------ Page 3 ------------------------------ */

  // Education level checkboxes (choose one)
  const level = edu?.highestLevel;

  payload[F.EDU_PRIMARY_SCHOOL] = level === EEducationLevel.PRIMARY_SCHOOL;
  payload[F.EDU_HIGH_SCHOOL] = level === EEducationLevel.HIGH_SCHOOL;
  payload[F.EDU_DIPLOMA] = level === EEducationLevel.DIPLOMA;
  payload[F.EDU_BACHELORS] = level === EEducationLevel.BACHELORS;
  payload[F.EDU_MASTERS] = level === EEducationLevel.MASTERS;
  payload[F.EDU_DOCTORATE] = level === EEducationLevel.DOCTORATE;
  payload[F.EDU_OTHER] = level === EEducationLevel.OTHER;

  // If OTHER, you may want to store user-provided text later; schema currently doesn’t have it.
  payload[F.EDU_OTHER_TEXT] = "";

  // Primary school block
  payload[F.PRIMARY_SCHOOL_NAME] = safeStr(edu?.schoolName);
  payload[F.PRIMARY_SCHOOL_LOCATION] = safeStr(edu?.schoolLocation);
  payload[F.PRIMARY_YEAR_COMPLETED] = fmtYear(edu?.primaryYearCompleted);

  // High school / secondary block
  payload[F.HIGH_SCHOOL_NAME] = safeStr(edu?.highSchoolInstitutionName);
  payload[F.HIGH_SCHOOL_BOARD] = safeStr(edu?.highSchoolBoard);
  payload[F.HIGH_SCHOOL_YEAR_COMPLETED] = fmtYear(edu?.highSchoolYearCompleted);
  payload[F.HIGH_SCHOOL_STREAM] = safeStr(edu?.highSchoolStream);
  payload[F.HIGH_SCHOOL_GRADE] = safeStr(edu?.highSchoolGradeOrPercentage);

  // Diploma/Bachelors/Masters/Doctorate/Other block
  payload[F.INSTITUTION_NAME] = safeStr(edu?.institutionName);
  payload[F.UNIVERSITY_OR_BOARD] = safeStr(edu?.universityOrBoard);
  payload[F.FIELD_OF_STUDY] = safeStr(edu?.fieldOfStudy);
  payload[F.START_YEAR] = fmtYear(edu?.startYear);
  payload[F.END_YEAR] = fmtYear(edu?.endYear);
  payload[F.GRADE_OR_PERCENTAGE] = safeStr(edu?.gradeOrCgpa);

  // Bank details
  payload[F.BANK_NAME] = safeStr(bank.bankName);
  payload[F.BRANCH_NAME] = safeStr(bank.branchName);
  payload[F.ACCOUNT_HOLDER_NAME] = safeStr(bank.accountHolderName);
  payload[F.ACCOUNT_NUMBER] = safeStr(bank.accountNumber);
  payload[F.IFSC_CODE] = safeStr(bank.ifscCode);
  payload[F.UPI_ID] = safeStr(bank.upiId);

  const hasVoid = boolFileExists(bank.voidCheque?.file);
  payload[F.VOID_CHEQUE_ATTACHED_YES] = hasVoid;
  payload[F.VOID_CHEQUE_ATTACHED_NO] = !hasVoid;

  // Declaration checkbox + date
  payload[F.DECLARATION_ACCEPTED] = !!dec?.hasAcceptedDeclaration;
  payload[F.DECLARATION_DATE] = fmtDateDMY(dec?.declarationDate || dec?.signature?.signedAt);

  return payload;
}

/**
 * Apply payload to pdf-lib form.
 * Booleans → checkboxes; strings → text fields.
 */
export function applyNptIndiaApplicationFormPayloadToForm(form: PDFForm, payload: NptIndiaApplicationFormPayload): void {
  for (const [name, value] of Object.entries(payload)) {
    if (value == null) continue;

    try {
      if (typeof value === "boolean") {
        try {
          const cb = form.getCheckBox(name);
          if (value) cb.check();
          else cb.uncheck();
          cb.updateAppearances();
          continue;
        } catch {
          // field isn't a checkbox, fall through to text
        }
      }

      const tf = form.getTextField(name);
      tf.setText(String(value));
    } catch {
      // ignore missing/mismatched fields (common while field names are being wired up)
    }
  }
}
