// src/lib/utils/encryption.ts
import crypto from "crypto";
import { ENC_KEY, HASH_SECRET } from "@/config/env";

// =============================
// Symmetric Encryption (AES-GCM)
// =============================

// ENC_KEY must be 32 bytes when decoded. For simplicity, assume it's hex.
const KEY = Buffer.from(ENC_KEY, "hex");
const ALGO = "aes-256-gcm";

if (KEY.length !== 32) {
  throw new Error("ENC_KEY must be a 32-byte hex string for AES-256-GCM");
}

export const encryptString = (plain?: string | null): string | undefined => {
  if (plain == null || plain === "") return undefined;

  const iv = crypto.randomBytes(12); // GCM recommended 12 bytes
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);

  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Encode as: iv:ciphertext:tag (all base64)
  return [iv.toString("base64"), ciphertext.toString("base64"), authTag.toString("base64")].join(":");
};

export const decryptString = (encrypted?: string | null): string | undefined => {
  if (encrypted == null || encrypted === "") return undefined;

  const [ivB64, cipherB64, tagB64] = encrypted.split(":");
  if (!ivB64 || !cipherB64 || !tagB64) return undefined;

  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
};

/**
 * Helper used in schemas as { type: String, set: encryptField, get: decryptField }
 * These MUST return string | undefined for Mongoose.
 */
export const encryptField = (value: string | null | undefined): string | undefined => {
  return encryptString(value);
};

export const decryptField = (value: string | null | undefined): string | undefined => {
  return decryptString(value);
};

// =============================
// One-way Hashing (HMAC-SHA256)
// =============================

/**
 * Deterministic HMAC-SHA256 hash with HASH_SECRET.
 *
 * Intended for opaque tokens (invite tokens, OTP secrets, etc.),
 * NOT for user passwords (for those, prefer bcrypt/argon2).
 */
export const hashString = (value?: string | null): string | undefined => {
  if (value == null || value === "") return undefined;

  return crypto.createHmac("sha256", HASH_SECRET).update(value, "utf8").digest("hex");
};

/**
 * Convenience helper for use in Mongoose schema setters:
 *   { type: String, set: hashField }
 */
export const hashField = (value: string | null | undefined): string | undefined => {
  return hashString(value);
};
