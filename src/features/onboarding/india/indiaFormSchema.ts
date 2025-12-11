import { z } from "zod";
import {
  EEducationLevel,
  EGender,
  type IIndiaOnboardingFormData,
} from "@/types/onboarding.types";

/**
 * Minimal file-asset schema for uploaded docs.
 * Mirrors IFileAsset from shared.types in a validation-friendly way.
 */
const fileAssetSchema = z.object({
  url: z.string().url("File URL is required."),
  s3Key: z.string().min(1, "File key is required."),
  mimeType: z.string().min(1, "File type is required."),
  originalName: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

/* ------------------------------------------------------------------ */
/* Personal Info (IPersonalInfo)                                      */
/* ------------------------------------------------------------------ */

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  gender: z
    .string()
    .refine(
      (val): val is EGender => val === EGender.MALE || val === EGender.FEMALE,
      {
        message: "Gender is required.",
      }
    ),

  dateOfBirth: z.string().min(1, "Date of birth is required."),
  canProvideProofOfAge: z.boolean().refine((v) => v === true, {
    message: "You must confirm that you can provide proof of age.",
  }),
  residentialAddress: z.object({
    addressLine1: z.string().min(1, "Address line 1 is required."),
    city: z.string().min(1, "City is required."),
    state: z.string().min(1, "State / Province is required."),
    postalCode: z.string().min(1, "Postal code is required."),
    fromDate: z.string().min(1, "From date is required."),
    toDate: z.string().min(1, "Until date is required."),
  }),
  phoneHome: z.string().optional(),
  phoneMobile: z
    .string()
    .min(1, "Mobile number is required.")
    .max(32, "Mobile number is too long."),
  emergencyContactName: z
    .string()
    .min(1, "Emergency contact name is required."),
  emergencyContactNumber: z
    .string()
    .min(1, "Emergency contact number is required.")
    .max(32, "Emergency contact number is too long."),
});

/* ------------------------------------------------------------------ */
/* Government IDs (IIndiaGovernmentIds)                               */
/* ------------------------------------------------------------------ */

const indiaAadhaarSchema = z.object({
  aadhaarNumber: z
    .string()
    .min(1, "Aadhaar number is required.")
    .max(32, "Aadhaar number is too long."),
  file: fileAssetSchema,
});

const indiaPanSchema = z.object({
  file: fileAssetSchema,
});

const indiaPassportSchema = z.object({
  frontFile: fileAssetSchema,
  backFile: fileAssetSchema,
});

const indiaDriversLicenseSchema = z
  .object({
    frontFile: fileAssetSchema.optional(),
    backFile: fileAssetSchema.optional(),
  })
  .superRefine((val, ctx) => {
    const hasAny = !!val.frontFile || !!val.backFile;
    if (hasAny && !val.frontFile) {
      ctx.addIssue({
        path: ["frontFile"],
        code: z.ZodIssueCode.custom,
        message: "Front of driver's license is required.",
      });
    }
    if (hasAny && !val.backFile) {
      ctx.addIssue({
        path: ["backFile"],
        code: z.ZodIssueCode.custom,
        message: "Back of driver's license is required.",
      });
    }
  });

const indiaGovernmentIdsSchema = z.object({
  aadhaar: indiaAadhaarSchema,
  panCard: indiaPanSchema,
  passport: indiaPassportSchema,
  driversLicense: indiaDriversLicenseSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Education (IEducationDetails[])                                    */
/* ------------------------------------------------------------------ */

const educationEntrySchemaBase = z.object({
  highestLevel: z.nativeEnum(EEducationLevel),

  // Primary
  schoolName: z.string().optional(),
  schoolLocation: z.string().optional(),
  primaryYearCompleted: z.number().int().optional(),

  // High school
  highSchoolInstitutionName: z.string().optional(),
  highSchoolBoard: z.string().optional(),
  highSchoolStream: z.string().optional(),
  highSchoolYearCompleted: z.number().int().optional(),
  highSchoolGradeOrPercentage: z.string().optional(),

  // Diploma / Bachelor / Master / PhD / Other
  institutionName: z.string().optional(),
  universityOrBoard: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startYear: z.number().int().optional(),
  endYear: z.number().int().optional(),
  gradeOrCgpa: z.string().optional(),
});

const educationEntrySchema = educationEntrySchemaBase.superRefine(
  (entry, ctx) => {
    const level = entry.highestLevel;

    if (level === EEducationLevel.PRIMARY_SCHOOL) {
      if (!entry.schoolName) {
        ctx.addIssue({
          path: ["schoolName"],
          code: z.ZodIssueCode.custom,
          message: "School name is required for primary education.",
        });
      }
      if (entry.primaryYearCompleted == null) {
        ctx.addIssue({
          path: ["primaryYearCompleted"],
          code: z.ZodIssueCode.custom,
          message: "Year completed is required for primary education.",
        });
      }
    } else if (level === EEducationLevel.HIGH_SCHOOL) {
      if (!entry.highSchoolInstitutionName) {
        ctx.addIssue({
          path: ["highSchoolInstitutionName"],
          code: z.ZodIssueCode.custom,
          message: "Institution name is required for high school.",
        });
      }
      if (entry.highSchoolYearCompleted == null) {
        ctx.addIssue({
          path: ["highSchoolYearCompleted"],
          code: z.ZodIssueCode.custom,
          message: "Year completed is required for high school.",
        });
      }
    } else {
      // Diploma / Bachelors / Masters / Doctorate / Other
      if (!entry.institutionName) {
        ctx.addIssue({
          path: ["institutionName"],
          code: z.ZodIssueCode.custom,
          message: "Institution name is required.",
        });
      }
      if (!entry.fieldOfStudy) {
        ctx.addIssue({
          path: ["fieldOfStudy"],
          code: z.ZodIssueCode.custom,
          message: "Field of study is required.",
        });
      }
      if (entry.endYear == null) {
        ctx.addIssue({
          path: ["endYear"],
          code: z.ZodIssueCode.custom,
          message: "End year is required.",
        });
      }
    }
  }
);

const educationArraySchema = z
  .array(educationEntrySchema)
  .min(1, "At least one education entry is required.")
  .max(1, "You can only enter up to 1 education entry.");

/* ------------------------------------------------------------------ */
/* Employment (IEmploymentHistoryEntry[])                             */
/* ------------------------------------------------------------------ */

const employmentHistoryEntrySchema = z.object({
  organizationName: z.string().min(1, "Organization name is required."),
  designation: z.string().min(1, "Designation is required."),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
  reasonForLeaving: z.string().min(1, "Reason for leaving is required."),
  experienceCertificateFile: fileAssetSchema.nullable().optional(),
});

const employmentHistoryArraySchema = z
  .array(employmentHistoryEntrySchema)
  .max(3, "You can only enter up to 3 employment history entries.");

/* ------------------------------------------------------------------ */
/* Bank Details (IIndiaBankDetails)                                   */
/* ------------------------------------------------------------------ */

const indiaBankDetailsSchema = z.object({
  bankName: z.string().min(1, "Bank name is required."),
  branchName: z.string().min(1, "Branch name is required."),
  accountHolderName: z.string().min(1, "Account holder name is required."),
  accountNumber: z.string().min(1, "Account number is required."),
  ifscCode: z.string().min(1, "IFSC code is required."),
  upiId: z.string().optional(),
  voidCheque: fileAssetSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Declaration (IDeclarationAndSignature)                             */
/* ------------------------------------------------------------------ */

const declarationSchema = z
  .object({
    hasAcceptedDeclaration: z.boolean(),
    signature: z.object({
      file: fileAssetSchema,
      signedAt: z.string().min(1, "Signature date is required."),
    }),
    declarationDate: z.string().min(1, "Declaration date is required."),
  })
  .superRefine((value, ctx) => {
    if (!value.hasAcceptedDeclaration) {
      ctx.addIssue({
        path: ["hasAcceptedDeclaration"],
        code: z.ZodIssueCode.custom,
        message: "You must accept the declaration before submitting.",
      });
    }
  });

/* ------------------------------------------------------------------ */
/* Root India Onboarding Form schema                                  */
/* ------------------------------------------------------------------ */

export const indiaOnboardingFormSchema = z
  .object({
    personalInfo: personalInfoSchema,
    governmentIds: indiaGovernmentIdsSchema,
    education: educationArraySchema,
    hasPreviousEmployment: z.boolean(),
    employmentHistory: employmentHistoryArraySchema,
    bankDetails: indiaBankDetailsSchema,
    declaration: declarationSchema,
  })
  .superRefine((data, ctx) => {
    if (data.hasPreviousEmployment && data.employmentHistory.length === 0) {
      ctx.addIssue({
        path: ["employmentHistory"],
        code: z.ZodIssueCode.custom,
        message:
          "At least one employment history entry is required when you have previous employment.",
      });
    }
  });

/**
 * Strongly-typed form values used in React Hook Form.
 * Shape is intentionally aligned with IIndiaOnboardingFormData.
 */
export type IndiaOnboardingFormValues = z.infer<
  typeof indiaOnboardingFormSchema
>;

// Explicit alias to highlight alignment with backend type
export type IndiaFormDataT = IIndiaOnboardingFormData;
