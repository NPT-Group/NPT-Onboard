// lib/utils/urlHelper.ts

/** Remove trailing slashes. */
export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Remove leading slashes. */
export function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

/** Ensure a single leading slash. */
export function ensureLeadingSlash(path: string): string {
  if (!path) return "/";
  return `/${trimLeadingSlash(path)}`;
}

/** True if absolute http(s) URL. */
export function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Join base + path with exactly one slash between. */
export function joinUrl(base: string, path: string): string {
  const b = trimTrailingSlash(base || "");
  const p = ensureLeadingSlash(path || "");
  return `${b}${p}`;
}

/** Append query params; ignores null/undefined. */
export function withQuery<T extends Record<string, unknown>>(url: string, params?: T): string {
  if (!params) return url;
  const isAbs = isAbsoluteUrl(url);
  const u = new URL(url, isAbs ? undefined : "http://local");
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    u.searchParams.set(k, String(v));
  }
  if (!isAbs && url.startsWith("/")) {
    // return relative without fake origin
    return `${u.pathname}${u.search}${u.hash}`;
  }
  return u.toString();
}
