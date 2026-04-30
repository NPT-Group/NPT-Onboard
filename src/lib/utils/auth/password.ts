import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= 12;
}
