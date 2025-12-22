// src/mongoose/schemas/onboardingFormDataSchemas.ts
import { Schema } from "mongoose";
import { fileAssetSchema, personalInfoSchema, educationDetailsSchema, employmentHistoryEntrySchema, declarationAndSignatureSchema, encryptedStringField } from "./sharedSchemas";
import {
  IIndiaOnboardingFormData,
  ICanadaOnboardingFormData,
  IUsOnboardingFormData,
  IIndiaGovernmentIds,
  IIndiaBankDetails,
  ICanadaGovernmentIds,
  ICanadaBankDetails,
  IUsGovernmentIds,
  IUsBankDetails,
  IIndiaAadhaarCardDocument,
  IIndiaPanCardDocument,
  ICanadaSinCardDocument,
  IUsSsnCardDocument,
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

const issueExpiryFields = {
  issueDate: { type: Date, required: false },
  expiryDate: { type: Date, required: false },
};

/* ------------------------------------------------------------------ */
/* INDIA                                                              */
/* ------------------------------------------------------------------ */

interface IIndiaSimpleFileDoc {
  file: any;
}

const indiaPassportDocumentSchema = new Schema(
  {
    passportNumber: { type: String, required: true },
    ...issueExpiryFields,
    frontFile: { type: fileAssetSchema, required: true },
    backFile: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const indiaDriversLicenseDocumentSchema = new Schema(
  {
    licenseNumber: { type: String, required: true },
    ...issueExpiryFields,
    frontFile: { type: fileAssetSchema, required: true },
    backFile: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const indiaAadhaarCardDocumentSchema = new Schema<IIndiaAadhaarCardDocument>(
  {
    aadhaarNumber: {
      ...encryptedStringField,
      required: true,
    },
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const indiaPanCardDocumentSchema = new Schema<IIndiaPanCardDocument>(
  {
    panNumber: {
      ...encryptedStringField,
      required: true,
    },
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

const indiaGovernmentIdsSchema = new Schema<IIndiaGovernmentIds>(
  {
    aadhaar: { type: indiaAadhaarCardDocumentSchema, required: true },
    panCard: { type: indiaPanCardDocumentSchema, required: true },

    passport: { type: indiaPassportDocumentSchema, required: false },
    driversLicense: { type: indiaDriversLicenseDocumentSchema, required: false },
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

    education: {
      type: [educationDetailsSchema],
      required: true,
      validate: {
        validator: (val: any[]) => Array.isArray(val) && val.length >= 1 && val.length <= 1,
        message: "education must have exactly 1 entry",
      },
    },

    hasPreviousEmployment: { type: Boolean, required: true },

    employmentHistory: {
      type: [employmentHistoryEntrySchema],
      required: true,
      validate: {
        validator: (val: any[]) => Array.isArray(val) && val.length <= 3,
        message: "employmentHistory cannot have more than 3 entries",
      },
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

// SIN card now has sinNumber + file
const canadaSinCardDocumentSchema = new Schema<ICanadaSinCardDocument>(
  {
    sinNumber: {
      ...encryptedStringField,
      required: true,
    },
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const canadaWorkPermitDocumentSchema = canadaSimpleFileDocSchema.clone();
const canadaDirectDepositDocumentSchema = canadaSimpleFileDocSchema.clone();

const canadaPassportDocumentSchema = new Schema(
  {
    passportNumber: { type: String, required: true },
    ...issueExpiryFields,
    frontFile: { type: fileAssetSchema, required: true },
    backFile: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const canadaPrCardDocumentSchema = frontBackDocumentSchema.clone();
const canadaDriversLicenseDocumentSchema = new Schema(
  {
    licenseNumber: { type: String, required: true },
    ...issueExpiryFields,
    frontFile: { type: fileAssetSchema, required: true },
    backFile: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const canadaGovernmentIdsSchema = new Schema<ICanadaGovernmentIds>(
  {
    sin: { type: canadaSinCardDocumentSchema, required: true },
    passport: { type: canadaPassportDocumentSchema, required: false },
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

    education: {
      type: [educationDetailsSchema],
      required: true,
      validate: {
        validator: (val: any[]) => Array.isArray(val) && val.length >= 1 && val.length <= 1,
        message: "education must have exactly 1 entry",
      },
    },

    hasPreviousEmployment: { type: Boolean, required: true },

    employmentHistory: {
      type: [employmentHistoryEntrySchema],
      required: true,
      validate: {
        validator: (val: any[]) => Array.isArray(val) && val.length <= 3,
        message: "employmentHistory cannot have more than 3 entries",
      },
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

// SSN card now has ssnNumber + file
const usSsnCardDocumentSchema = new Schema<IUsSsnCardDocument>(
  {
    ssnNumber: {
      ...encryptedStringField,
      required: true,
    },
    file: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const usWorkPermitDocumentSchema = usSimpleFileDocSchema.clone();
const usVoidChequeOrDepositSlipDocumentSchema = usSimpleFileDocSchema.clone();

const usPassportDocumentSchema = new Schema(
  {
    passportNumber: { type: String, required: false },
    ...issueExpiryFields,
    frontFile: { type: fileAssetSchema, required: true },
    backFile: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const usGreenCardDocumentSchema = frontBackDocumentSchema.clone();
const usDriversLicenseDocumentSchema = new Schema(
  {
    licenseNumber: { type: String, required: true },
    ...issueExpiryFields,
    frontFile: { type: fileAssetSchema, required: true },
    backFile: { type: fileAssetSchema, required: true },
  },
  { _id: false }
);

const usGovernmentIdsSchema = new Schema<IUsGovernmentIds>(
  {
    ssn: { type: usSsnCardDocumentSchema, required: true },
    passport: { type: usPassportDocumentSchema, required: false },
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

    education: {
      type: [educationDetailsSchema],
      required: true,
      validate: {
        validator: (val: any[]) => Array.isArray(val) && val.length >= 1 && val.length <= 1,
        message: "education must have exactly 1 entry",
      },
    },

    hasPreviousEmployment: { type: Boolean, required: true },

    employmentHistory: {
      type: [employmentHistoryEntrySchema],
      required: true,
      validate: {
        validator: (val: any[]) => Array.isArray(val) && val.length <= 3,
        message: "employmentHistory cannot have more than 3 entries",
      },
    },

    bankDetails: { type: usBankDetailsSchema, required: true },
    declaration: { type: declarationAndSignatureSchema, required: true },
  },
  { _id: false }
);
