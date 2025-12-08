// src/lib/utils/auth/attachCookie.ts
import { NextResponse } from "next/server";

/** Append one or more Set-Cookie header strings to a NextResponse */
export function attachCookies(res: NextResponse, cookies: string | string[]) {
  const list = Array.isArray(cookies) ? cookies : [cookies];
  for (const c of list) res.headers.append("set-cookie", c);
  return res;
}
