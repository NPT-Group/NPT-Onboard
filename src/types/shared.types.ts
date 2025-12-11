// src/types/shared.types.ts

export enum EFileMimeType {
  JPEG = "image/jpeg",
  JPG = "image/jpg",
  PNG = "image/png",
  PDF = "application/pdf",
  DOC = "application/msword",
  DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

/**
 * Generic file asset stored in S3 (images, PDFs, docs, etc.).
 * Optional metadata enables better validation/UX but is not required.
 */
export type IFileAsset = {
  url: string;
  s3Key: string;
  mimeType: EFileMimeType | string;
  sizeBytes?: number;
  originalName?: string;
};

/** Runtime helper */
export const isImageMime = (mt?: string) => typeof mt === "string" && mt.toLowerCase().startsWith("image/");

/**
 * Subsidiaries for NPT onboarding.
 * Used across dashboard, onboarding, and PDFs.
 */
export enum ESubsidiary {
  INDIA = "IN",
  CANADA = "CA",
  USA = "US",
}

/**
 * Geolocation data structure.
 */
export interface IGeoLocation {
  country?: string; // Full country name (e.g., "Canada", "United States")
  region?: string; // State/Province (e.g., "Ontario", "California")
  city?: string; // City name (e.g., "Milton", "Los Angeles")
  timezone?: string;
  latitude?: number; // GPS latitude
  longitude?: number; // GPS longitude
}

/**
 * Common residential address structure (current address).
 */
export interface IResidentialAddress {
  addressLine1: string;
  city?: string;
  state?: string;
  postalCode?: string;
  fromDate: Date | string; // ISO
  toDate: Date | string; // ISO
}
