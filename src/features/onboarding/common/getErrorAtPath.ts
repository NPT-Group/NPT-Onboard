import type { FieldErrors } from "react-hook-form";

/**
 * Tiny helper to safely read a nested error from RHF using a dot path.
 */
export function getErrorAtPath(errors: FieldErrors, path: string): any {
  const segments = path.split(".");
  let current: any = errors;

  for (const segment of segments) {
    if (!current) return undefined;
    current = current[segment];
  }

  return current;
}
