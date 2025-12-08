// src/lib/utils/auth/authUtils.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { IUser } from "@/types/user.types";
import { AUTH_COOKIE_NAME, DISABLE_AUTH, NEXTAUTH_SECRET } from "@/config/env";
import { AppError } from "@/types/api.types";

interface AppJWT {
  userId?: string;
  email?: string;
  name?: string;
  picture?: string;
  // roles?: string[];
}

// Dummy admin user used when auth is disabled
const DUMMY_ADMIN_USER: IUser = {
  id: "dev-admin",
  email: "dev-admin@npt.local",
  name: "Dev Admin",
  picture: undefined,
};

/**
 * Builds a minimal NextRequest carrying the cookie header,
 * so `getToken` can correctly parse the session token in App Router.
 */
async function buildNextRequest(): Promise<NextRequest> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest("https://internal.local/", { headers });
}

/**
 * Returns the currently authenticated user from the session token.
 *
 * - Reads cookies via `cookies()`
 * - Uses `getToken` from NextAuth to verify/decode the JWT
 * - When `DISABLE_AUTH` is true and no valid user is found, returns a dummy admin user
 * - Otherwise returns a strongly typed `IUser` object or `null`
 */
export const currentUser = cache(async (): Promise<IUser | null> => {
  const jar = await cookies();
  const raw = jar.get(AUTH_COOKIE_NAME)?.value;

  let token: AppJWT | null = null;

  if (raw) {
    const req = await buildNextRequest();
    token = (await getToken({
      req,
      secret: NEXTAUTH_SECRET,
      cookieName: AUTH_COOKIE_NAME,
    })) as AppJWT | null;
  }

  if (!token?.userId || !token?.email || !token?.name) {
    // If auth is disabled, fall back to dummy admin when no real user
    if (DISABLE_AUTH) {
      return DUMMY_ADMIN_USER;
    }
    return null;
  }

  const user: IUser = {
    id: token.userId,
    email: token.email,
    name: token.name,
    picture: token.picture,
  };

  return user;
});

/**
 * Guard method: ensures a user is authenticated.
 *
 * - Calls `currentUser`
 * - Throws `AppError(401)` if no valid user is found and auth is enabled
 * - When `DISABLE_AUTH` is true, effectively behaves as always logged in
 *   (returns the dummy admin user)
 */
export const guard = cache(async (): Promise<IUser> => {
  const user = await currentUser();

  if (!user) {
    // When auth is enabled and no user, this is a real unauthenticated case
    throw new AppError(401, "Unauthenticated");
  }

  return user;
});
