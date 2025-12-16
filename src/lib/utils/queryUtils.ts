// src/lib/utils/queryUtils.ts

/** Parse boolean-ish query values like 1/0, true/false, yes/no, y/n */
export function parseBool(v: string | null): boolean | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(t)) return true;
  if (["0", "false", "no", "n"].includes(t)) return false;
  return null;
}

/** Case-insensitive, escaped regex from user input */
export function rx(s: string) {
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/** Safe ISO date parse; returns Date or null (no throw) */
export function parseIsoDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** If input looked like YYYY-MM-DD, make it inclusive end-of-day */
export function inclusiveEndOfDay(d: Date, original: string | null): Date {
  if (original && /^\d{4}-\d{2}-\d{2}$/.test(original)) {
    const to = new Date(d);
    to.setHours(23, 59, 59, 999);
    return to;
  }
  return d;
}

/** Type guard: is val one of the allowed literal strings? (works with readonly arrays) */
function isOneOf<T extends string>(val: string, allowed: readonly T[]): val is T {
  return allowed.some((a) => a === val);
}

/** Strict enum/union parser for string query params; returns T or throws */
export function parseEnumParam<T extends string>(raw: string | null, allowed: readonly T[], label: string): T | null {
  if (raw == null) return null;
  if (!isOneOf(raw, allowed)) {
    throw new Error(`Invalid ${label}. Allowed: ${allowed.join(", ")}`);
  }
  return raw;
}

/** Pagination with hard guards */
export function parsePagination(pageRaw: string | null, limitRaw: string | null, max = 100) {
  const page = Math.max(parseInt(pageRaw || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(limitRaw || "20", 10), 1), max);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/** Generic sort key picker using a map of allowed keys (readonly-safe) */
export function parseSort<SORT_KEY extends string>(sortByRaw: string | null, sortDirRaw: string | null, allowedKeys: readonly SORT_KEY[], defaultKey: SORT_KEY): { sortBy: SORT_KEY; sortDir: 1 | -1 } {
  // sortBy: strict if provided, otherwise default
  let sortBy = defaultKey;
  if (sortByRaw != null) {
    if (!(allowedKeys as readonly string[]).includes(sortByRaw)) {
      throw new Error(`Invalid sortBy. Allowed: ${allowedKeys.join(", ")}`);
    }
    sortBy = sortByRaw as SORT_KEY;
  }

  // sortDir: strict if provided, otherwise default "desc"
  let sortDir: 1 | -1 = -1;
  if (sortDirRaw != null) {
    const dir = sortDirRaw.toLowerCase();
    if (dir !== "asc" && dir !== "desc") {
      throw new Error(`Invalid sortDir. Allowed: asc, desc`);
    }
    sortDir = dir === "asc" ? 1 : -1;
  }

  return { sortBy, sortDir };
}

/** Build “meta” for list responses */
export function buildMeta<TFilter extends object>(args: { page: number; pageSize: number; total: number; sortBy: string; sortDir: 1 | -1; filters: TFilter; extra?: Record<string, unknown> }) {
  const totalPages = Math.max(Math.ceil(args.total / args.pageSize), 1);
  return {
    page: args.page,
    pageSize: args.pageSize,
    total: args.total,
    totalPages,
    hasPrev: args.page > 1,
    hasNext: args.page < totalPages,
    sortBy: args.sortBy,
    sortDir: args.sortDir === 1 ? "asc" : "desc",
    ...args.extra,
    filters: args.filters,
  };
}

/** Safe int parsing with clamp */
export function parseIntClamp(v: string | null, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return def;
}
