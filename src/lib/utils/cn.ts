// src/lib/utils/cn.ts
export function cn(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}
