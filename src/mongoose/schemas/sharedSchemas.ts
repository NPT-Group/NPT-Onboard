// src/mongoose/schemas/sharedSchemas.ts
import { Schema, SchemaTypeOptions } from "mongoose";
import { IPersonalInfo, IEducationDetails, IEmploymentHistoryEntry, ISignatureInfo, IDeclarationAndSignature } from "@/types/onboarding.types";
import { IFileAsset, IGeoLocation, IResidentialAddress } from "@/types/shared.types";
import { encryptField, decryptField } from "@/lib/utils/encryption";
import { EEducationLevel } from "@/types/onboarding.types";

export const fileAssetSchema = new Schema<IFileAsset>(
  {
    url: { type: String, required: true },
    s3Key: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number },
    originalName: { type: String },
  },
  { _id: false }
);

export const geoLocationSchema = new Schema<IGeoLocation>(
  {
    country: String,
    region: String,
    city: String,
    timezone: String,
    latitude: Number,
    longitude: Number,
  },
  { _id: false }
);

export const residentialAddressSchema = new Schema<IResidentialAddress>(
  {
    addressLine1: { type: String, required: true },
    city: String,
    state: String,
    postalCode: String,
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
  },
  { _id: false }
);

export const signatureInfoSchema = new Schema<ISignatureInfo>(
  {
    file: { type: fileAssetSchema, required: true },
    signedAt: { type: Date, required: true },
  },
  { _id: false }
);

export const declarationAndSignatureSchema = new Schema<IDeclarationAndSignature>(
  {
    hasAcceptedDeclaration: { type: Boolean, required: true },
    signature: { type: signatureInfoSchema, required: true },
    declarationDate: { type: Date, required: true },
  },
  { _id: false }
);

export const employmentHistoryEntrySchema = new Schema<IEmploymentHistoryEntry>(
  {
    organizationName: { type: String, required: true },
    designation: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reasonForLeaving: { type: String, required: true },
    experienceCertificateFile: { type: fileAssetSchema, required: false },
    employerReferenceCheck: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

export const educationDetailsSchema = new Schema<IEducationDetails>(
  {
    highestLevel: {
      type: String,
      enum: Object.values(EEducationLevel),
      required: true,
    },

    schoolName: String,
    primaryYearCompleted: Number,

    highSchoolInstitutionName: String,
    highSchoolYearCompleted: Number,

    institutionName: String,
    startYear: Number,
    endYear: Number,
  },
  { _id: false }
);

export const personalInfoSchema = new Schema<IPersonalInfo>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    dateOfBirth: { type: Date, required: true },
    canProvideProofOfAge: { type: Boolean, required: true },

    residentialAddress: {
      type: residentialAddressSchema,
      required: true,
    },

    phoneHome: String,
    phoneMobile: { type: String, required: true },

    emergencyContactName: { type: String, required: true },
    emergencyContactNumber: { type: String, required: true },

    reference1Name: { type: String, required: true },
    reference1PhoneNumber: { type: String, required: true },
    reference2Name: { type: String, required: true },
    reference2PhoneNumber: { type: String, required: true },

    hasConsentToContactReferencesOrEmergencyContact: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

export const encryptedStringField: SchemaTypeOptions<string> = {
  type: String,
  set: encryptField,
  get: decryptField,
};
