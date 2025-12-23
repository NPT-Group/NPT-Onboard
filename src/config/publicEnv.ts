/**
 * Client-safe environment values.
 *
 * Only read from NEXT_PUBLIC_* env vars here.
 * Provide sensible fallbacks so the UI doesn't regress if an env var is missing.
 */

export const NEXT_PUBLIC_NPT_HR_EMAIL =
  process.env.NEXT_PUBLIC_NPT_HR_EMAIL || "hr@nptgroup.com";


