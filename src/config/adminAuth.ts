// src/config/adminAuth.ts

/**
 * Single source of truth for who counts as an admin.
 * Everything (NextAuth, authUtils, middleware) should import from here.
 */

export const ADMIN_EMAILS: string[] = ["ridoy@sspgroup.com", "faruq.atanda@sspgroup.com"];

const ADMIN_EMAIL_SET = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAIL_SET.has(email.toLowerCase());
}
