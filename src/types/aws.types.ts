// src/types/aws.types.ts
import { EFileMimeType } from "./shared.types";

/** High-level “bucket namespaces” you can extend any time. */
export enum ES3Namespace {
  /** Employee onboarding documents (IDs, bank docs, signatures, etc.). */
  ONBOARDINGS = "onboardings",
  // Add more later: REPORTS = "reports", SETTINGS = "settings", etc.
}

/**
 * Logical folder fragments (NO namespace or IDs).
 * Reusable across namespaces.
 *
 * These align with onboarding sections: government IDs, bank docs,
 * employment history, declaration/signature, and generated PDFs.
 */
export enum ES3Folder {
  // Government IDs (India / Canada / US)
  GOV_AADHAAR = "government-ids/aadhaar",
  GOV_PAN = "government-ids/pan",
  GOV_PASSPORT = "government-ids/passport",
  GOV_DRIVERS_LICENSE = "government-ids/drivers-license",
  GOV_SIN = "government-ids/sin",
  GOV_SSN = "government-ids/ssn",
  GOV_PR_CARD = "government-ids/pr-card",
  GOV_GREEN_CARD = "government-ids/green-card",
  GOV_WORK_PERMIT = "government-ids/work-permit",

  // Bank & payment details
  BANK_VOID_CHEQUE = "bank/void-cheque",
  BANK_DIRECT_DEPOSIT = "bank/direct-deposit",
  BANK_VOID_CHEQUE_OR_DEPOSIT_SLIP = "bank/void-cheque-or-deposit-slip",

  // Education & employment
  EDUCATION = "education",
  EMPLOYMENT_CERTIFICATES = "employment/certificates",

  // Declaration & signature (final step)
  DECLARATION_SIGNATURE = "declaration/signature",
}

export interface IPresignRequest {
  /** Top-level namespace (e.g., "onboardings"). */
  namespace: ES3Namespace;

  /** Folder fragment (no namespace/id inside). */
  folder: ES3Folder;

  /** Optional client-suggested filename (server still appends a UUID). */
  filename?: string;

  /** Content-Type (e.g., "image/jpeg", "application/pdf"). */
  mimeType: EFileMimeType;

  /**
   * Optional entity id (e.g., onboardingId).
   * Typical shapes (server-side convention):
   *  - with id:    onboardings/{namespace}/{docId}/{folder}/{file}
   *  - without id: onboardings/{namespace}/{folder}/{file}
   */
  docId?: string;

  /** Optional size guard in bytes (the API will validate). */
  filesize?: number;
}

export interface IPresignResponse {
  /** Resolved S3 key (relative path in the bucket). */
  key: string;

  /** One-time upload URL. */
  url: string;

  /** Public or signed-access URL to use in IFileAsset.url. */
  publicUrl: string;

  /** Expiry in seconds for the presigned URL. */
  expiresIn: number;

  /** Echoed/normalized MIME type. */
  mimeType: EFileMimeType;
}
