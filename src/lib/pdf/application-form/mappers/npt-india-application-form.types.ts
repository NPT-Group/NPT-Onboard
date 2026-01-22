// src/lib/pdf/application-form/mappers/npt-india-application-form.types.ts

// Enums for NPT India Application Form PDF fields (UPDATED for new template)
export enum ENptIndiaApplicationFormFields {
  /* ====================== Page 1: Checklist / Instructions ====================== */
  // (No fields)

  /* ===================== Page 2: Personal Details / Address / Contact / Govt ID ===================== */

  // Personal Details
  FULL_NAME = "full_name",
  EMAIL = "email",

  // Gender
  GENDER = "gender",

  DATE_OF_BIRTH = "date_of_birth",

  // NEW TEMPLATE: Proof of age is a text field (not Yes/No checkboxes)
  PROOF_OF_AGE = "proof_of_age",

  // Residential address
  ADDRESS_LINE_1 = "address_line_1",
  CITY = "city",
  STATE = "state",
  ZIP_POSTAL = "zip_postal",
  ADDRESS_FROM = "address_from",
  ADDRESS_TO = "address_to",

  // Contact numbers (each phone now split into (AAA) + BBBBBBB)
  PHONE_HOME_AREA = "phone_home_area",
  PHONE_HOME_REST = "phone_home_rest",

  PHONE_MOBILE_AREA = "phone_mobile_area",
  PHONE_MOBILE_REST = "phone_mobile_rest",

  EMERGENCY_CONTACT_NAME = "emergency_contact_name",
  EMERGENCY_PHONE_AREA = "emergency_phone_area",
  EMERGENCY_PHONE_REST = "emergency_phone_rest",

  REFERENCE1_NAME = "reference1_name",
  REFERENCE1_PHONE_AREA = "reference1_phone_area",
  REFERENCE1_PHONE_REST = "reference1_phone_rest",

  REFERENCE2_NAME = "reference2_name",
  REFERENCE2_PHONE_AREA = "reference2_phone_area",
  REFERENCE2_PHONE_REST = "reference2_phone_rest",

  CONSENT_TO_CONTACT = "consent_to_contact", // checkbox

  // Government ID
  AADHAAR_NUMBER = "aadhaar_number",
  AADHAAR_CARD_ATTACHED = "aadhaar_card_attached", // checkbox

  PAN_NUMBER = "pan_number",
  PAN_CARD_ATTACHED = "pan_card_attached", // checkbox

  PASSPORT_NUMBER = "passport_number",
  PASSPORT_ISSUE_DATE = "passport_issue_date",
  PASSPORT_EXPIRY_DATE = "passport_expiry_date",
  PASSPORT_FRONT_ATTACHED = "passport_front_attached", // checkbox
  PASSPORT_BACK_ATTACHED = "passport_back_attached", // checkbox (PDF calls it “Data Page”)

  LICENSE_NUMBER = "license_number",
  LICENSE_ISSUE_DATE = "license_issue_date",
  LICENSE_EXPIRY_DATE = "license_expiry_date",
  LICENSE_FRONT_ATTACHED = "license_front_attached", // checkbox
  LICENSE_BACK_ATTACHED = "license_back_attached", // checkbox

  /* ============================ Page 3: Education ============================= */

  // Highest qualification checkboxes
  EDU_PRIMARY_SCHOOL = "edu_primary_school",
  EDU_HIGH_SCHOOL = "edu_high_school",
  EDU_DIPLOMA = "edu_diploma",
  EDU_BACHELORS = "edu_bachelors",
  EDU_MASTERS = "edu_masters",
  EDU_DOCTORATE = "edu_doctorate",
  EDU_OTHER = "edu_other",
  EDU_OTHER_TEXT = "edu_other_text",

  // Primary School (UPDATED: removed location)
  PRIMARY_SCHOOL_NAME = "primary_school_name",
  PRIMARY_YEAR_COMPLETED = "primary_year_completed",

  // High School / Secondary (UPDATED: removed board/stream/grade)
  HIGH_SCHOOL_NAME = "high_school_name",
  HIGH_SCHOOL_YEAR_COMPLETED = "high_school_year_completed",

  // Diploma / Bachelor / Master / Doctorate / Other (UPDATED: fewer fields)
  COLLEGE_UNIVERSITY_NAME = "college_university_name",
  START_YEAR = "start_year",
  YEAR_COMPLETED_OR_EXPECTED = "year_completed_or_expected",

  /* ======================= Page 4: Employment History ========================= */

  // Each employment section has N/A checkbox now
  EMP1_NA = "emp1_na",
  EMP1_ORG_NAME = "emp1_org_name",
  EMP1_ROLE = "emp1_role",
  EMP1_START_DATE = "emp1_start_date",
  EMP1_END_DATE = "emp1_end_date",
  EMP1_REASON_FOR_LEAVING = "emp1_reason_for_leaving",
  // NEW: Reference Check (Yes/No)
  EMP1_REF_CHECK_YES = "emp1_ref_check_yes",
  EMP1_REF_CHECK_NO = "emp1_ref_check_no",
  // Experience cert photo (Yes/No)
  EMP1_EXP_CERT_YES = "emp1_exp_cert_yes",
  EMP1_EXP_CERT_NO = "emp1_exp_cert_no",

  EMP2_NA = "emp2_na",
  EMP2_ORG_NAME = "emp2_org_name",
  EMP2_ROLE = "emp2_role",
  EMP2_START_DATE = "emp2_start_date",
  EMP2_END_DATE = "emp2_end_date",
  EMP2_REASON_FOR_LEAVING = "emp2_reason_for_leaving",
  EMP2_REF_CHECK_YES = "emp2_ref_check_yes",
  EMP2_REF_CHECK_NO = "emp2_ref_check_no",
  EMP2_EXP_CERT_YES = "emp2_exp_cert_yes",
  EMP2_EXP_CERT_NO = "emp2_exp_cert_no",

  EMP3_NA = "emp3_na",
  EMP3_ORG_NAME = "emp3_org_name",
  EMP3_ROLE = "emp3_role",
  EMP3_START_DATE = "emp3_start_date",
  EMP3_END_DATE = "emp3_end_date",
  EMP3_REASON_FOR_LEAVING = "emp3_reason_for_leaving",
  EMP3_REF_CHECK_YES = "emp3_ref_check_yes",
  EMP3_REF_CHECK_NO = "emp3_ref_check_no",
  EMP3_EXP_CERT_YES = "emp3_exp_cert_yes",
  EMP3_EXP_CERT_NO = "emp3_exp_cert_no",

  /* ===================== Page 5: Banking + Declaration ======================= */

  BANK_NAME = "bank_name",
  BRANCH_NAME = "branch_name",
  ACCOUNT_HOLDER_NAME = "account_holder_name",
  ACCOUNT_NUMBER = "account_number",
  IFSC_CODE = "ifsc_code",
  UPI_ID = "upi_id",
  VOID_CHEQUE_ATTACHED_YES = "void_cheque_attached_yes",
  VOID_CHEQUE_ATTACHED_NO = "void_cheque_attached_no",

  DECLARATION_ACCEPTED = "declaration_accepted",
  DECLARATION_SIGNATURE = "declaration_signature",
  DECLARATION_DATE = "declaration_date",
}

export type NptIndiaApplicationFormPayload = Partial<Record<ENptIndiaApplicationFormFields, string | boolean>>;
