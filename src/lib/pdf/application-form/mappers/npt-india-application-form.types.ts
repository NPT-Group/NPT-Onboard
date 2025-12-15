/**
 * ======================================================================
 * NPT INDIA - Hiring Application (3-page) - Fillable PDF Field Names
 * ----------------------------------------------------------------------
 * IMPORTANT:
 * - Update these string values to match the *actual* field names inside:
 *   npt-india-application-form-fillable.pdf
 * - You can inspect them by opening the PDF in Acrobat/Preview (form field
 *   properties) or via pdf-lib form.getFields() during dev.
 * ======================================================================
 */
export enum ENptIndiaApplicationFormFields {
  /* ============================ Page 1: Personal ============================ */

  FIRST_NAME = "first_name",
  LAST_NAME = "last_name",
  EMAIL = "email",

  // Gender checkboxes
  GENDER_MALE = "gender_male",
  GENDER_FEMALE = "gender_female",

  DATE_OF_BIRTH = "date_of_birth",

  // Proof of age available (Yes/No checkboxes)
  PROOF_OF_AGE_YES = "proof_of_age_yes",
  PROOF_OF_AGE_NO = "proof_of_age_no",

  // Residential address
  ADDRESS_LINE_1 = "address_line_1",
  CITY = "city",
  STATE = "state",
  ZIP_POSTAL = "zip_postal",
  ADDRESS_FROM = "address_from",
  ADDRESS_TO = "address_to",

  // Contact numbers
  PHONE_HOME = "phone_home",
  PHONE_MOBILE = "phone_mobile",
  EMERGENCY_CONTACT_NAME = "emergency_contact_name",
  EMERGENCY_CONTACT_PHONE = "emergency_contact_phone",

  // ID info
  AADHAAR_NUMBER = "aadhaar_number",
  AADHAAR_CARD_ATTACHED = "aadhaar_card_attached",

  PAN_NUMBER = "pan_number",
  PAN_CARD_ATTACHED = "pan_card_attached",

  PASSPORT_FRONT_ATTACHED = "passport_front_attached",
  PASSPORT_BACK_ATTACHED = "passport_back_attached",

  LICENSE_FRONT_ATTACHED = "license_front_attached",
  LICENSE_BACK_ATTACHED = "license_back_attached",

  /* ========================== Page 2: Employment ============================ */

  // Entry 1
  EMP1_ORG_NAME = "emp1_org_name",
  EMP1_ROLE = "emp1_role",
  EMP1_START_DATE = "emp1_start_date",
  EMP1_END_DATE = "emp1_end_date",
  EMP1_REASON_FOR_LEAVING = "emp1_reason_for_leaving",
  EMP1_EXP_CERT_YES = "emp1_exp_cert_yes",
  EMP1_EXP_CERT_NO = "emp1_exp_cert_no",

  // Entry 2
  EMP2_ORG_NAME = "emp2_org_name",
  EMP2_ROLE = "emp2_role",
  EMP2_START_DATE = "emp2_start_date",
  EMP2_END_DATE = "emp2_end_date",
  EMP2_REASON_FOR_LEAVING = "emp2_reason_for_leaving",
  EMP2_EXP_CERT_YES = "emp2_exp_cert_yes",
  EMP2_EXP_CERT_NO = "emp2_exp_cert_no",

  // Entry 3
  EMP3_ORG_NAME = "emp3_org_name",
  EMP3_ROLE = "emp3_role",
  EMP3_START_DATE = "emp3_start_date",
  EMP3_END_DATE = "emp3_end_date",
  EMP3_REASON_FOR_LEAVING = "emp3_reason_for_leaving",
  EMP3_EXP_CERT_YES = "emp3_exp_cert_yes",
  EMP3_EXP_CERT_NO = "emp3_exp_cert_no",

  /* ===================== Page 3: Education and Banking ====================== */

  // Highest education level checkboxes (Choose one)
  EDU_PRIMARY_SCHOOL = "edu_primary_school",
  EDU_HIGH_SCHOOL = "edu_high_school",
  EDU_DIPLOMA = "edu_diploma",
  EDU_BACHELORS = "edu_bachelors",
  EDU_MASTERS = "edu_masters",
  EDU_DOCTORATE = "edu_doctorate",
  EDU_OTHER = "edu_other",
  EDU_OTHER_TEXT = "edu_other_text",

  // Primary school block
  PRIMARY_SCHOOL_NAME = "primary_school_name",
  PRIMARY_SCHOOL_LOCATION = "primary_school_location",
  PRIMARY_YEAR_COMPLETED = "primary_year_completed",

  // High school / secondary block
  HIGH_SCHOOL_NAME = "high_school_name",
  HIGH_SCHOOL_BOARD = "high_school_board",
  HIGH_SCHOOL_YEAR_COMPLETED = "high_school_year_completed",
  HIGH_SCHOOL_STREAM = "high_school_stream",
  HIGH_SCHOOL_GRADE = "high_school_grade",

  // Diploma/Bachelors/Masters/Doctorate/Other block
  INSTITUTION_NAME = "institution_name",
  UNIVERSITY_OR_BOARD = "university_or_board",
  FIELD_OF_STUDY = "field_of_study",
  START_YEAR = "start_year",
  END_YEAR = "end_year",
  GRADE_OR_PERCENTAGE = "grade_or_percentage",

  // Bank details
  BANK_NAME = "bank_name",
  BRANCH_NAME = "branch_name",
  ACCOUNT_HOLDER_NAME = "account_holder_name",
  ACCOUNT_NUMBER = "account_number",
  IFSC_CODE = "ifsc_code",
  UPI_ID = "upi_id",
  VOID_CHEQUE_ATTACHED_YES = "void_cheque_attached_yes",
  VOID_CHEQUE_ATTACHED_NO = "void_cheque_attached_no",

  /* ===================== Page 3: Declaration & Signature ==================== */

  DECLARATION_ACCEPTED = "declaration_accepted",
  DECLARATION_SIGNATURE = "declaration_signature", // signature widget field name
  DECLARATION_DATE = "declaration_date",
}

export type NptIndiaApplicationFormPayload = Partial<Record<ENptIndiaApplicationFormFields, string | boolean>>;
