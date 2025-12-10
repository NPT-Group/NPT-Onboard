// src/types/onboarding.types.ts

import { HydratedDocument } from "mongoose";
import type {
  IFileAsset,
  IGeoLocation,
  IResidentialAddress,
} from "./shared.types";
import { ESubsidiary } from "./shared.types";

/**
 * High-level onboarding method:
 * - digital: OTP-verified, multi-step online form
 * - manual: HR fills data from returned PDF + documents
 */
export enum EOnboardingMethod {
  DIGITAL = "digital",
  MANUAL = "manual",
}

/**
 * Lifecycle statuses for an onboarding record.
 * Mirrors the spec and dashboard chips.
 */
export enum EOnboardingStatus {
  InviteGenerated = "InviteGenerated",
  ManualPDFSent = "ManualPDFSent",
  ModificationRequested = "ModificationRequested",
  Submitted = "Submitted",
  Resubmitted = "Resubmitted",
  Approved = "Approved",
  Terminated = "Terminated",
}

/**
 * Gender options (per spec, binary for now).
 */
export enum EGender {
  MALE = "Male",
  FEMALE = "Female",
}

/**
 * Highest education level.
 */
export enum EEducationLevel {
  PRIMARY_SCHOOL = "PrimarySchool",
  HIGH_SCHOOL = "HighSchoolSecondary",
  DIPLOMA = "Diploma",
  BACHELORS = "Bachelors",
  MASTERS = "Masters",
  DOCTORATE = "Doctorate",
  OTHER = "Other",
}

/**
 * US bank account type (Checking / Savings).
 */
export enum EAccountType {
  CHECKING = "Checking",
  SAVINGS = "Savings",
}

/**
 * Invite metadata for digital onboarding.
 */
export interface IOnboardingInvite {
  tokenHash: string;
  expiresAt: Date | string; // ISO date string
  lastSentAt: Date | string; // ISO date string
}

/**
 * OTP metadata for digital onboarding.
 */
export interface IOnboardingOtp {
  otpHash: string;
  expiresAt: Date | string; // ISO date string
  attempts: number;
  lockedAt?: Date | string; // optional lock timestamp if you implement lockout
  lastSentAt?: Date | string;
}

/**
 * Common contact & personal info (applies to all subsidiaries, per spec).
 */
export interface IPersonalInfo {
  firstName: string;
  lastName: string;
  email: string; // prefilled, non-editable in UI
  gender: EGender;
  dateOfBirth: Date | string; // ISO
  canProvideProofOfAge: boolean;
  residentialAddress: IResidentialAddress;

  phoneHome?: string;
  phoneMobile: string;

  emergencyContactName: string;
  emergencyContactNumber: string;
}

/* ------------------------------------------------------------------ */
/* Document base shapes (internal reuse only)                         */
/* ------------------------------------------------------------------ */

/**
 * Base for single-file documents.
 * Keep this very stable; add new fields to concrete document interfaces instead.
 */
interface IFileDocumentBase {
  file: IFileAsset;
}

/**
 * Base for front/back documents (passports, licenses, etc.).
 * Keep this very stable; add new fields to concrete document interfaces instead.
 */
interface IFrontBackDocumentBase {
  frontFile?: IFileAsset | null;
  backFile?: IFileAsset | null;
}

/* ------------------------------------------------------------------ */
/* INDIA: Government IDs & Bank Details                               */
/* ------------------------------------------------------------------ */

// Concrete INDIA document interfaces (future-safe)

export interface IIndiaAadhaarCardDocument extends IFileDocumentBase {
  aadhaarNumber: string;
  // future India-specific Aadhaar fields can go here (e.g. last4, expiryDate)
}

export interface IIndiaPanCardDocument extends IFileDocumentBase {
  // future PAN-specific fields go here
}

export interface IIndiaPassportDocument extends IFrontBackDocumentBase {
  frontFile: IFileAsset;
  backFile: IFileAsset;
  // future passport-specific fields go here (e.g. passportNumber, expiryDate)
}

export interface IIndiaDriversLicenseDocument extends IFrontBackDocumentBase {
  frontFile: IFileAsset;
  backFile: IFileAsset;
  // future license-specific fields go here (e.g. licenseNumber, class)
}

export interface IIndiaVoidChequeDocument extends IFileDocumentBase {
  // future void-cheque-specific fields go here
}

export interface IIndiaGovernmentIds {
  aadhaar: IIndiaAadhaarCardDocument;
  panCard: IIndiaPanCardDocument;
  passport: IIndiaPassportDocument; // required front/back in validation
  driversLicense?: IIndiaDriversLicenseDocument; // optional
}

export interface IIndiaBankDetails {
  bankName: string;
  branchName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;
  voidCheque?: IIndiaVoidChequeDocument;
}

/* ------------------------------------------------------------------ */
/* CANADA: Government IDs & Bank Details                              */
/* ------------------------------------------------------------------ */

// Concrete CANADA document interfaces

export interface ICanadaSinCardDocument extends IFileDocumentBase {
  sinNumber: string;
  // future SIN-card-specific fields go here
}

export interface ICanadaPassportDocument extends IFrontBackDocumentBase {
  frontFile: IFileAsset;
  backFile: IFileAsset;
  // future passport-specific fields go here
}

export interface ICanadaPrCardDocument extends IFrontBackDocumentBase {
  // future PR-card-specific fields go here
}

export interface ICanadaWorkPermitDocument extends IFileDocumentBase {
  // future work-permit-specific fields go here
}

export interface ICanadaDriversLicenseDocument extends IFrontBackDocumentBase {
  frontFile: IFileAsset;
  backFile: IFileAsset;
  // future license-specific fields go here
}

export interface ICanadaDirectDepositDocument extends IFileDocumentBase {
  // future direct-deposit-specific fields go here
}

export interface ICanadaGovernmentIds {
  sin: ICanadaSinCardDocument;

  passport: ICanadaPassportDocument; // required front/back in validation
  prCard?: ICanadaPrCardDocument;
  workPermit?: ICanadaWorkPermitDocument;
  driversLicense?: ICanadaDriversLicenseDocument;
}

export interface ICanadaBankDetails {
  bankName: string;
  institutionNumber: string;
  transitNumber: string;
  accountNumber: string;
  accountHolderName: string;
  directDepositDoc?: ICanadaDirectDepositDocument;
}

/* ------------------------------------------------------------------ */
/* USA: Government IDs & Bank Details                                 */
/* ------------------------------------------------------------------ */

// Concrete USA document interfaces

export interface IUsSsnCardDocument extends IFileDocumentBase {
  ssnNumber: string;
  // future SSN-card-specific fields go here
}

export interface IUsPassportDocument extends IFrontBackDocumentBase {
  frontFile: IFileAsset;
  backFile: IFileAsset;
  // future passport-specific fields go here
}

export interface IUsGreenCardDocument extends IFrontBackDocumentBase {
  // future green-card-specific fields go here
}

export interface IUsWorkPermitDocument extends IFileDocumentBase {
  // future work-permit-specific fields go here
}

export interface IUsDriversLicenseDocument extends IFrontBackDocumentBase {
  frontFile: IFileAsset;
  backFile: IFileAsset;
  // future license-specific fields go here
}

export interface IUsVoidChequeOrDepositSlipDocument extends IFileDocumentBase {
  // future cheque/deposit-slip-specific fields go here
}

export interface IUsGovernmentIds {
  ssn: IUsSsnCardDocument;

  passport: IUsPassportDocument; // required front/back in validation
  greenCard?: IUsGreenCardDocument;
  workPermit?: IUsWorkPermitDocument;
  driversLicense?: IUsDriversLicenseDocument;
}

export interface IUsBankDetails {
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: EAccountType;
  accountHolderName: string;
  voidChequeOrDepositSlip?: IUsVoidChequeOrDepositSlipDocument;
}

/* ------------------------------------------------------------------ */
/* Education, Employment, Declaration & Signature                     */
/* ------------------------------------------------------------------ */

export interface IEducationDetails {
  highestLevel: EEducationLevel;

  // Primary school fields (used only if highestLevel = PrimarySchool)
  schoolName?: string; // required
  schoolLocation?: string; // optional
  primaryYearCompleted?: number; // required

  // High school fields (used only if highestLevel = HighSchoolSecondary)
  highSchoolInstitutionName?: string; // required
  highSchoolBoard?: string; // optional
  highSchoolStream?: string; // optional
  highSchoolYearCompleted?: number; // required
  highSchoolGradeOrPercentage?: string; // optional

  // Diploma / Bachelor / Master / PhD / Other (used only if highestLevel = Diploma, Bachelors, Masters, Doctorate, Other)
  institutionName?: string; // required
  universityOrBoard?: string; // optional
  fieldOfStudy?: string; // required
  startYear?: number; // optional
  endYear?: number; // required
  gradeOrCgpa?: string; // optional
}

/**
 * One employment history entry.
 */
export interface IEmploymentHistoryEntry {
  organizationName: string;
  designation: string;
  startDate: Date | string; // ISO
  endDate: Date | string; // ISO
  reasonForLeaving: string;
  experienceCertificateFile?: IFileAsset | null;
}

/**
 * Declaration & signature at the end of the form.
 * For business rules: signature files must be images (validation layer).
 */
export interface ISignatureInfo {
  file: IFileAsset; // image stored in S3
  signedAt: Date | string; // ISO date
}

export interface IDeclarationAndSignature {
  hasAcceptedDeclaration: boolean;
  signature: ISignatureInfo;
  declarationDate: Date | string; // ISO date (UI default = today)
}

/* ------------------------------------------------------------------ */
/* Per-subsidiary Form Data                                           */
/* ------------------------------------------------------------------ */

export interface IIndiaOnboardingFormData {
  personalInfo: IPersonalInfo;
  governmentIds: IIndiaGovernmentIds;
  education: IEducationDetails[];
  hasPreviousEmployment: boolean;
  employmentHistory: IEmploymentHistoryEntry[];
  bankDetails: IIndiaBankDetails;
  declaration: IDeclarationAndSignature;
}

export interface ICanadaOnboardingFormData {
  personalInfo: IPersonalInfo;
  governmentIds: ICanadaGovernmentIds;
  education: IEducationDetails[];
  hasPreviousEmployment: boolean;
  employmentHistory: IEmploymentHistoryEntry[];
  bankDetails: ICanadaBankDetails;
  declaration: IDeclarationAndSignature;
}

export interface IUsOnboardingFormData {
  personalInfo: IPersonalInfo;
  governmentIds: IUsGovernmentIds;
  education: IEducationDetails[];
  hasPreviousEmployment: boolean;
  employmentHistory: IEmploymentHistoryEntry[];
  bankDetails: IUsBankDetails;
  declaration: IDeclarationAndSignature;
}

/**
 * Convenience union for form data; use along with subsidiary discrimination.
 */
export type TOnboardingFormData =
  | IIndiaOnboardingFormData
  | ICanadaOnboardingFormData
  | IUsOnboardingFormData;

/* ------------------------------------------------------------------ */
/* Root Onboarding entity                                             */
/* ------------------------------------------------------------------ */

export interface IOnboardingBase {
  _id: string;
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;

  firstName: string;
  lastName: string;
  email: string;

  status: EOnboardingStatus;

  modificationRequestMessage?: string;
  modificationRequestedAt?: Date | string;

  employeeNumber?: string; // unique per subsidiary when set

  invite?: IOnboardingInvite; // digital only
  otp?: IOnboardingOtp; // digital only

  locationAtSubmit?: IGeoLocation;

  isCompleted: boolean; // employee has filled out their portion of the form
  createdAt: Date | string;
  updatedAt: Date | string;
  submittedAt?: Date | string;
  completedAt?: Date | string;
  approvedAt?: Date | string;
  terminatedAt?: Date | string;
}

/**
 * Subsidiary-discriminated onboarding types — lets TS narrow
 * to the correct *FormData based on subsidiary.
 */

export interface IIndiaOnboarding extends IOnboardingBase {
  subsidiary: ESubsidiary.INDIA;
  indiaFormData?: IIndiaOnboardingFormData;
}

export interface ICanadaOnboarding extends IOnboardingBase {
  subsidiary: ESubsidiary.CANADA;
  canadaFormData?: ICanadaOnboardingFormData;
}

export interface IUsOnboarding extends IOnboardingBase {
  subsidiary: ESubsidiary.USA;
  usFormData?: IUsOnboardingFormData;
}

// Union of all onboarding types
export type TOnboarding = IIndiaOnboarding | ICanadaOnboarding | IUsOnboarding;

// Mongoose hydrated document type
export type TOnboardingDoc = HydratedDocument<TOnboarding>;

/* ------------------------------------------------------------------ */
/* Sanitized Onboarding Context (employee-facing API shape)           */
/* ------------------------------------------------------------------ */

/**
 * Lightweight, sanitized view of an onboarding that is safe to return
 * from employee-facing APIs.
 *
 * Intentionally excludes:
 * - invite / otp (token and OTP hashes, attempts, etc.)
 * - locationAtSubmit (precise geo)
 * - internal timestamps not exposed to employees (approvedAt, terminatedAt)
 *
 * Uses `id` instead of Mongo `_id` for cleaner API responses.
 */
export interface IOnboardingContextBase {
  id: string;
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;

  firstName: string;
  lastName: string;
  email: string;

  status: EOnboardingStatus;

  modificationRequestMessage?: string;
  modificationRequestedAt?: Date | string;

  employeeNumber?: string;

  isCompleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  submittedAt?: Date | string;
  completedAt?: Date | string;
}

/**
 * Subsidiary-discriminated sanitized onboarding contexts.
 * These still carry full form data (including documents), but
 * without internal security/meta fields.
 */

export interface IIndiaOnboardingContext extends IOnboardingContextBase {
  subsidiary: ESubsidiary.INDIA;
  indiaFormData?: IIndiaOnboardingFormData;
}

export interface ICanadaOnboardingContext extends IOnboardingContextBase {
  subsidiary: ESubsidiary.CANADA;
  canadaFormData?: ICanadaOnboardingFormData;
}

export interface IUsOnboardingContext extends IOnboardingContextBase {
  subsidiary: ESubsidiary.USA;
  usFormData?: IUsOnboardingFormData;
}

/**
 * Union of all employee-facing onboarding contexts.
 */
export type TOnboardingContext =
  | IIndiaOnboardingContext
  | ICanadaOnboardingContext
  | IUsOnboardingContext;
