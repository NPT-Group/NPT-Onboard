// src/lib/utils/stringUtils.ts

/** Trim; return undefined if empty/nullish. */
export function trim(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t || undefined;
}

/** Uppercase+trim; return undefined if empty/nullish. */
export function upperTrim(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const t = trim(v);
  return t ? t.toUpperCase() : undefined;
}

/** LowerCase+trim; return undefined if empty/nullish. */
export function lowerTrim(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const t = trim(v);
  return t ? t.toLowerCase() : undefined;
}

/** Helper for enum messages */
export const enumMsg = (label: string, values: string[]) => `${label} must be one of: ${values.join(", ")}`;
