// src/mongoose/schemas/onboardingFormDataSchemas.ts
import { Schema } from "mongoose";
import { fileAssetSchema, personalInfoSchema, educationDetailsSchema, employmentHistoryEntrySchema, declarationAndSignatureSchema, encryptedStringField } from "./sharedSchemas";
import {
  IIndiaOnboardingFormData,
  ICanadaOnboardingFormData,
  IUsOnboardingFormData,
  IIndiaAadhaarDetails,
  IIndiaPanCard,
  IIndiaGovernmentIds,
  IIndiaBankDetails,
  ICanadaSinDetails,
  ICanadaGovernmentIds,
  ICanadaBankDetails,
  IUsSsnDetails,
  IUsGovernmentIds,
  IUsBankDetails,
} from "@/types/onboarding.types";
import { EAccountType } from "@/types/onboarding.types";

/* Common small shapes */

// front/back doc (passport, license, etc.)
interface IFrontBackDoc {
  frontFile?: any;
  backFile?: any;
}

const frontBackDocumentSchema = new Schema<IFrontBackDoc>(
  {
    frontFile: { type: fileAssetSchema, required: false },
    backFile: { type: fileAssetSchema, required: false },
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/* INDIA                                                              */
/* ------------------------------------------------------------------ */

interface IIndiaSimpleFileDoc {
  file: any;
}

const indiaAadhaarCardDocumentSchema = new Schema<IIndiaSimpleFileDoc>(
  {
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const indiaPanCardDocumentSchema = new Schema<IIndiaSimpleFileDoc>(
  {
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const indiaVoidChequeDocumentSchema = new Schema<IIndiaSimpleFileDoc>(
  {
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const indiaAadhaarDetailsSchema = new Schema<IIndiaAadhaarDetails>(
  {
    aadhaarNumber: {
      ...encryptedStringField,
      required: true,
    },
    card: { type: indiaAadhaarCardDocumentSchema, required: true },
  },
  { _id: false }
);

const indiaPanCardSchema = new Schema<IIndiaPanCard>(
  {
    card: { type: indiaPanCardDocumentSchema, required: true },
  },
  { _id: false }
);

const indiaGovernmentIdsSchema = new Schema<IIndiaGovernmentIds>(
  {
    aadhaar: { type: indiaAadhaarDetailsSchema, required: true },
    panCard: { type: indiaPanCardSchema, required: true },
    passport: { type: frontBackDocumentSchema, required: true },
    driversLicense: { type: frontBackDocumentSchema, required: false },
  },
  { _id: false }
);

const indiaBankDetailsSchema = new Schema<IIndiaBankDetails>(
  {
    bankName: { type: String, required: true },
    branchName: { type: String, required: true },

    accountHolderName: { type: String, required: true },
    accountNumber: {
      ...encryptedStringField,
      required: true,
    },
    ifscCode: {
      ...encryptedStringField,
      required: true,
    },
    upiId: encryptedStringField,

    voidCheque: { type: indiaVoidChequeDocumentSchema, required: false },
  },
  { _id: false }
);

export const indiaOnboardingFormDataSchema = new Schema<IIndiaOnboardingFormData>(
  {
    personalInfo: { type: personalInfoSchema, required: true },
    governmentIds: { type: indiaGovernmentIdsSchema, required: true },
    education: { type: [educationDetailsSchema], required: true },
    employmentHistory: {
      type: [employmentHistoryEntrySchema],
      required: true,
    },
    bankDetails: { type: indiaBankDetailsSchema, required: true },
    declaration: { type: declarationAndSignatureSchema, required: true },
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/* CANADA                                                             */
/* ------------------------------------------------------------------ */

const canadaSimpleFileDocSchema = new Schema<IIndiaSimpleFileDoc>(
  {
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const canadaSinCardDocumentSchema = canadaSimpleFileDocSchema;
const canadaWorkPermitDocumentSchema = canadaSimpleFileDocSchema.clone();
const canadaDirectDepositDocumentSchema = canadaSimpleFileDocSchema.clone();

const canadaPassportDocumentSchema = frontBackDocumentSchema.clone();
const canadaPrCardDocumentSchema = frontBackDocumentSchema.clone();
const canadaDriversLicenseDocumentSchema = frontBackDocumentSchema.clone();

const canadaSinDetailsSchema = new Schema<ICanadaSinDetails>(
  {
    sinNumber: {
      ...encryptedStringField,
      required: true,
    },
    card: { type: canadaSinCardDocumentSchema, required: true },
  },
  { _id: false }
);

const canadaGovernmentIdsSchema = new Schema<ICanadaGovernmentIds>(
  {
    sin: { type: canadaSinDetailsSchema, required: true },
    passport: { type: canadaPassportDocumentSchema, required: true },
    prCard: { type: canadaPrCardDocumentSchema, required: false },
    workPermit: { type: canadaWorkPermitDocumentSchema, required: false },
    driversLicense: {
      type: canadaDriversLicenseDocumentSchema,
      required: false,
    },
  },
  { _id: false }
);

const canadaBankDetailsSchema = new Schema<ICanadaBankDetails>(
  {
    bankName: { type: String, required: true },
    institutionNumber: {
      ...encryptedStringField,
      required: true,
    },
    transitNumber: {
      ...encryptedStringField,
      required: true,
    },
    accountNumber: {
      ...encryptedStringField,
      required: true,
    },
    accountHolderName: { type: String, required: true },
    directDepositDoc: {
      type: canadaDirectDepositDocumentSchema,
      required: false,
    },
  },
  { _id: false }
);

export const canadaOnboardingFormDataSchema = new Schema<ICanadaOnboardingFormData>(
  {
    personalInfo: { type: personalInfoSchema, required: true },
    governmentIds: { type: canadaGovernmentIdsSchema, required: true },
    education: { type: [educationDetailsSchema], required: true },
    employmentHistory: {
      type: [employmentHistoryEntrySchema],
      required: true,
    },
    bankDetails: { type: canadaBankDetailsSchema, required: true },
    declaration: { type: declarationAndSignatureSchema, required: true },
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/* USA                                                                */
/* ------------------------------------------------------------------ */

const usSimpleFileDocSchema = new Schema<IIndiaSimpleFileDoc>(
  {
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const usSsnCardDocumentSchema = usSimpleFileDocSchema;
const usWorkPermitDocumentSchema = usSimpleFileDocSchema.clone();
const usVoidChequeOrDepositSlipDocumentSchema = usSimpleFileDocSchema.clone();

const usPassportDocumentSchema = frontBackDocumentSchema.clone();
const usGreenCardDocumentSchema = frontBackDocumentSchema.clone();
const usDriversLicenseDocumentSchema = frontBackDocumentSchema.clone();

const usSsnDetailsSchema = new Schema<IUsSsnDetails>(
  {
    ssnNumber: {
      ...encryptedStringField,
      required: true,
    },
    card: { type: usSsnCardDocumentSchema, required: true },
  },
  { _id: false }
);

const usGovernmentIdsSchema = new Schema<IUsGovernmentIds>(
  {
    ssn: { type: usSsnDetailsSchema, required: true },
    passport: { type: usPassportDocumentSchema, required: true },
    greenCard: { type: usGreenCardDocumentSchema, required: false },
    workPermit: { type: usWorkPermitDocumentSchema, required: false },
    driversLicense: {
      type: usDriversLicenseDocumentSchema,
      required: false,
    },
  },
  { _id: false }
);

const usBankDetailsSchema = new Schema<IUsBankDetails>(
  {
    bankName: { type: String, required: true },
    routingNumber: {
      ...encryptedStringField,
      required: true,
    },
    accountNumber: {
      ...encryptedStringField,
      required: true,
    },
    accountType: {
      type: String,
      enum: Object.values(EAccountType),
      required: true,
    },
    accountHolderName: { type: String, required: true },
    voidChequeOrDepositSlip: {
      type: usVoidChequeOrDepositSlipDocumentSchema,
      required: false,
    },
  },
  { _id: false }
);

export const usOnboardingFormDataSchema = new Schema<IUsOnboardingFormData>(
  {
    personalInfo: { type: personalInfoSchema, required: true },
    governmentIds: { type: usGovernmentIdsSchema, required: true },
    education: { type: [educationDetailsSchema], required: true },
    hasPreviousEmployment: { type: Boolean, required: true },
    employmentHistory: {
      type: [employmentHistoryEntrySchema],
      required: true,
    },
    bankDetails: { type: usBankDetailsSchema, required: true },
    declaration: { type: declarationAndSignatureSchema, required: true },
  },
  { _id: false }
);
