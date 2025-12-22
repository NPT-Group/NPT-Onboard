// src/features/onboarding/india/indiaFormSchema.ts
import { z } from "zod";
import { EEducationLevel, EGender, type IIndiaOnboardingFormData } from "@/types/onboarding.types";

/**
 * Backend treats many fields as optional-but-non-empty when provided.
 * In RHF we often hold empty string ("") for untouched inputs, so we normalize
 * optional strings: "" / whitespace -> undefined.
 */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim().length === 0 ? undefined : v);

const optionalTrimmedString = () => z.preprocess(emptyToUndefined, z.string().optional());

const requiredTrimmedString = (message: string) => z.string().trim().min(1, message);

const requiredDateString = (requiredMessage: string, invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((v) => !Number.isNaN(new Date(v).valueOf()), { message: invalidMessage });

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

/**
 * Wraps fileAssetSchema with a friendly "required upload" message,
 * instead of Zod's default "expected object, received undefined".
 */
const requiredFileAsset = (message: string) =>
  z
    .any()
    .refine((v) => v != null && typeof v === "object", { message })
    .pipe(fileAssetSchema);

/* ------------------------------------------------------------------ */
/* Personal Info (IPersonalInfo)                                      */
/* ------------------------------------------------------------------ */

const personalInfoSchema = z.object({
  // Backend rejects whitespace-only strings; enforce trim here so UI can't pass invalid payloads.
  firstName: requiredTrimmedString("First name is required."),
  lastName: requiredTrimmedString("Last name is required."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  gender: z.string().refine((val): val is EGender => val === EGender.MALE || val === EGender.FEMALE, { message: "Gender is required." }),

  dateOfBirth: requiredDateString("Date of birth is required.", "Enter a valid date of birth."),
  canProvideProofOfAge: z.boolean().refine((v) => v === true, {
    message: "You must confirm that you can provide proof of age.",
  }),
  residentialAddress: z
    .object({
      addressLine1: requiredTrimmedString("Address line 1 is required."),
      // Frontend requirement (product): require full address details
      city: requiredTrimmedString("City is required."),
      state: requiredTrimmedString("State / Province is required."),
      postalCode: requiredTrimmedString("Postal code is required."),
      fromDate: requiredDateString("From date is required.", "Enter a valid from date."),
      toDate: requiredDateString("Until date is required.", "Enter a valid until date."),
    })
    .superRefine((addr, ctx) => {
      // Industry-standard: prevent inverted ranges (backend doesn't enforce, but improves UX)
      const from = new Date(addr.fromDate).valueOf();
      const to = new Date(addr.toDate).valueOf();
      if (!Number.isNaN(from) && !Number.isNaN(to) && to < from) {
        ctx.addIssue({
          path: ["toDate"],
          code: z.ZodIssueCode.custom,
          message: "Until date must be on or after the from date.",
        });
      }
    }),
  phoneHome: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{10}$/, { message: "Enter a valid 10-digit phone number." })
      .optional()
  ),

  phoneMobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .regex(/^\d{10}$/, { message: "Enter a valid 10-digit mobile number." }),

  emergencyContactName: z.string().trim().min(1, "Emergency contact name is required."),
  emergencyContactNumber: z
    .string()
    .trim()
    .min(1, "Emergency contact number is required.")
    .regex(/^\d{10}$/, {
      message: "Enter a valid 10-digit emergency contact number.",
    }),
});

/* ------------------------------------------------------------------ */
/* Government IDs (IIndiaGovernmentIds)                               */
/* ------------------------------------------------------------------ */

const indiaAadhaarSchema = z.object({
  aadhaarNumber: z
    .string()
    .min(1, "Aadhaar number is required.")
    .regex(/^\d{12}$/, { message: "Enter a valid 12-digit Aadhaar number." }),
  file: requiredFileAsset("Please upload your Aadhaar PDF."),
});

const indiaPanSchema = z.object({
  panNumber: requiredTrimmedString("PAN number is required."),
  file: requiredFileAsset("Please upload your PAN PDF."),
});

const indiaPassportSchema = z
  .object({
    passportNumber: optionalTrimmedString(),
    issueDate: z.preprocess(emptyToUndefined, z.string().optional()),
    expiryDate: z.preprocess(emptyToUndefined, z.string().optional()),
    frontFile: fileAssetSchema.optional(),
    backFile: fileAssetSchema.optional(),
  })
  .superRefine((p, ctx) => {
    const hasAny = !!p.passportNumber || !!p.issueDate || !!p.expiryDate || !!p.frontFile || !!p.backFile;

    if (!hasAny) return;

    if (!p.passportNumber) {
      ctx.addIssue({
        path: ["passportNumber"],
        code: z.ZodIssueCode.custom,
        message: "Passport number is required.",
      });
    }

    if (!p.issueDate || Number.isNaN(new Date(p.issueDate).valueOf())) {
      ctx.addIssue({
        path: ["issueDate"],
        code: z.ZodIssueCode.custom,
        message: !p.issueDate ? "Issue date is required." : "Enter a valid issue date.",
      });
    }

    if (!p.expiryDate || Number.isNaN(new Date(p.expiryDate).valueOf())) {
      ctx.addIssue({
        path: ["expiryDate"],
        code: z.ZodIssueCode.custom,
        message: !p.expiryDate ? "Expiry date is required." : "Enter a valid expiry date.",
      });
    }

    if (!p.frontFile) {
      ctx.addIssue({
        path: ["frontFile"],
        code: z.ZodIssueCode.custom,
        message: "Please upload your passport front PDF.",
      });
    }

    if (!p.backFile) {
      ctx.addIssue({
        path: ["backFile"],
        code: z.ZodIssueCode.custom,
        message: "Please upload your passport back PDF.",
      });
    }

    // optional: range check once both dates are valid
    const issue = p.issueDate ? new Date(p.issueDate).valueOf() : NaN;
    const expiry = p.expiryDate ? new Date(p.expiryDate).valueOf() : NaN;
    if (!Number.isNaN(issue) && !Number.isNaN(expiry) && expiry < issue) {
      ctx.addIssue({
        path: ["expiryDate"],
        code: z.ZodIssueCode.custom,
        message: "Expiry date must be on or after the issue date.",
      });
    }
  });

const indiaDriversLicenseSchema = z
  .object({
    licenseNumber: optionalTrimmedString(),
    issueDate: z.preprocess(emptyToUndefined, z.string().optional()),
    expiryDate: z.preprocess(emptyToUndefined, z.string().optional()),
    frontFile: fileAssetSchema.optional(),
    backFile: fileAssetSchema.optional(),
  })
  .superRefine((val, ctx) => {
    const hasAny = !!val.licenseNumber || !!val.issueDate || !!val.expiryDate || !!val.frontFile || !!val.backFile;

    if (!hasAny) return;

    if (!val.licenseNumber) {
      ctx.addIssue({
        path: ["licenseNumber"],
        code: z.ZodIssueCode.custom,
        message: "License number is required.",
      });
    }

    if (!val.issueDate || Number.isNaN(new Date(val.issueDate).valueOf())) {
      ctx.addIssue({
        path: ["issueDate"],
        code: z.ZodIssueCode.custom,
        message: !val.issueDate ? "Issue date is required." : "Enter a valid issue date.",
      });
    }

    if (!val.expiryDate || Number.isNaN(new Date(val.expiryDate).valueOf())) {
      ctx.addIssue({
        path: ["expiryDate"],
        code: z.ZodIssueCode.custom,
        message: !val.expiryDate ? "Expiry date is required." : "Enter a valid expiry date.",
      });
    }

    if (!val.frontFile) {
      ctx.addIssue({
        path: ["frontFile"],
        code: z.ZodIssueCode.custom,
        message: "Front of driver's license is required.",
      });
    }
    if (!val.backFile) {
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
  passport: indiaPassportSchema.optional(),
  driversLicense: indiaDriversLicenseSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Education (IEducationDetails[])                                    */
/* ------------------------------------------------------------------ */

const educationEntrySchemaBase = z.object({
  highestLevel: z
    .nativeEnum(EEducationLevel)
    .or(z.literal(""))
    .refine((val) => Object.values(EEducationLevel).includes(val as any), {
      message: "Please select your highest level of education.",
    }),

  schoolName: optionalTrimmedString(),
  schoolLocation: optionalTrimmedString(),
  primaryYearCompleted: z.number().int().min(1900).max(2100).optional(),

  highSchoolInstitutionName: optionalTrimmedString(),
  highSchoolBoard: optionalTrimmedString(),
  highSchoolStream: optionalTrimmedString(),
  highSchoolYearCompleted: z.number().int().min(1900).max(2100).optional(),
  highSchoolGradeOrPercentage: optionalTrimmedString(),

  institutionName: optionalTrimmedString(),
  universityOrBoard: optionalTrimmedString(),
  fieldOfStudy: optionalTrimmedString(),
  startYear: z.number().int().min(1900).max(2100).optional(),
  endYear: z.number().int().min(1900).max(2100).optional(),
  gradeOrCgpa: optionalTrimmedString(),
});

const educationEntrySchema = educationEntrySchemaBase.superRefine((entry, ctx) => {
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

  // Mirror backend strictness: disallow fields not applicable to selected level.
  const disallow = (value: unknown, path: string) => {
    if (value != null) {
      ctx.addIssue({
        path: [path],
        code: z.ZodIssueCode.custom,
        message: "This field must be empty for the selected education level.",
      });
    }
  };

  if (level === EEducationLevel.PRIMARY_SCHOOL) {
    // Disallow high-school + diploma/bachelor+ fields
    disallow(entry.highSchoolInstitutionName, "highSchoolInstitutionName");
    disallow(entry.highSchoolBoard, "highSchoolBoard");
    disallow(entry.highSchoolStream, "highSchoolStream");
    disallow(entry.highSchoolYearCompleted, "highSchoolYearCompleted");
    disallow(entry.highSchoolGradeOrPercentage, "highSchoolGradeOrPercentage");

    disallow(entry.institutionName, "institutionName");
    disallow(entry.universityOrBoard, "universityOrBoard");
    disallow(entry.fieldOfStudy, "fieldOfStudy");
    disallow(entry.startYear, "startYear");
    disallow(entry.endYear, "endYear");
    disallow(entry.gradeOrCgpa, "gradeOrCgpa");
  } else if (level === EEducationLevel.HIGH_SCHOOL) {
    // Disallow primary + diploma/bachelor+ fields
    disallow(entry.schoolName, "schoolName");
    disallow(entry.schoolLocation, "schoolLocation");
    disallow(entry.primaryYearCompleted, "primaryYearCompleted");

    disallow(entry.institutionName, "institutionName");
    disallow(entry.universityOrBoard, "universityOrBoard");
    disallow(entry.fieldOfStudy, "fieldOfStudy");
    disallow(entry.startYear, "startYear");
    disallow(entry.endYear, "endYear");
    disallow(entry.gradeOrCgpa, "gradeOrCgpa");
  } else {
    // Diploma / Bachelor / Masters / Doctorate / Other
    // Disallow primary + high-school fields
    disallow(entry.schoolName, "schoolName");
    disallow(entry.schoolLocation, "schoolLocation");
    disallow(entry.primaryYearCompleted, "primaryYearCompleted");

    disallow(entry.highSchoolInstitutionName, "highSchoolInstitutionName");
    disallow(entry.highSchoolBoard, "highSchoolBoard");
    disallow(entry.highSchoolStream, "highSchoolStream");
    disallow(entry.highSchoolYearCompleted, "highSchoolYearCompleted");
    disallow(entry.highSchoolGradeOrPercentage, "highSchoolGradeOrPercentage");
  }
});

const educationArraySchema = z.array(educationEntrySchema).min(1, "At least one education entry is required.").max(1, "You can only enter up to 1 education entry.");

/* ------------------------------------------------------------------ */
/* Employment (IEmploymentHistoryEntry[])                             */
/* ------------------------------------------------------------------ */

const employmentHistoryEntrySchema = z
  .object({
    organizationName: requiredTrimmedString("Organization name is required."),
    designation: requiredTrimmedString("Designation is required."),
    startDate: requiredDateString("Start date is required.", "Enter a valid start date."),
    endDate: requiredDateString("End date is required.", "Enter a valid end date."),
    reasonForLeaving: requiredTrimmedString("Reason for leaving is required."),
    experienceCertificateFile: fileAssetSchema.nullable().optional(),
  })
  .superRefine((entry, ctx) => {
    // Industry-standard UX: prevent inverted ranges (backend doesn't enforce)
    const start = new Date(entry.startDate).valueOf();
    const end = new Date(entry.endDate).valueOf();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
      ctx.addIssue({
        path: ["endDate"],
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date.",
      });
    }
  });

const employmentHistoryArraySchema = z.array(employmentHistoryEntrySchema).max(3, "You can only enter up to 3 employment history entries.");

/* ------------------------------------------------------------------ */
/* Bank Details (IIndiaBankDetails)                                   */
/* ------------------------------------------------------------------ */

const indiaBankDetailsSchema = z.object({
  bankName: requiredTrimmedString("Bank name is required."),
  branchName: requiredTrimmedString("Branch name is required."),
  accountHolderName: requiredTrimmedString("Account holder name is required."),
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required.")
    .regex(/^\d{6,18}$/, { message: "Enter a valid account number." }),
  ifscCode: z
    .string()
    .trim()
    .min(1, "IFSC code is required.")
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, {
      message: "Enter a valid IFSC code (e.g. HDFC0001234).",
    })
    .transform((v) => v.toUpperCase()),
  upiId: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine((v) => /^[a-z0-9.\-_]{2,256}@[a-z0-9.\-_]{2,64}$/i.test(v), { message: "Enter a valid UPI ID (e.g. name@bank)." })
      .optional()
  ),

  voidCheque: fileAssetSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Declaration (IDeclarationAndSignature)                             */
/* ------------------------------------------------------------------ */

const declarationSchema = z
  .object({
    hasAcceptedDeclaration: z.boolean(),
    signature: z.object({
      file: requiredFileAsset("Please provide your signature.").refine(
        (file) => {
          // Backend requires image file for signature (vImageFile)
          if (!file || typeof file !== "object") return false;
          const mimeType = (file as any).mimeType || "";
          return typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/");
        },
        { message: "Signature must be an image file." }
      ),
      signedAt: requiredDateString("Signature date is required.", "Enter a valid signature date."),
    }),
    declarationDate: requiredDateString("Declaration date is required.", "Enter a valid declaration date."),
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

    hasPreviousEmployment: z
      .preprocess((val) => {
        if (val === "" || val == null) return undefined;
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
      }, z.boolean().optional())
      .refine((v) => typeof v === "boolean", {
        message: "A selection is required.",
      })
      .transform((v) => v as boolean),

    employmentHistory: employmentHistoryArraySchema,
    bankDetails: indiaBankDetailsSchema,
    declaration: declarationSchema,
  })
  .superRefine((data, ctx) => {
    if (data.hasPreviousEmployment && data.employmentHistory.length === 0) {
      ctx.addIssue({
        path: ["employmentHistory"],
        code: z.ZodIssueCode.custom,
        message: "At least one employment history entry is required when you have previous employment.",
      });
    }
  });

export type IndiaOnboardingFormInput = z.input<typeof indiaOnboardingFormSchema>;
export type IndiaOnboardingFormValues = z.output<typeof indiaOnboardingFormSchema>;
export type IndiaFormDataT = IIndiaOnboardingFormData;
