// src/lib/authOptions.ts
import AzureADProvider from "next-auth/providers/azure-ad";
import type { AuthOptions } from "next-auth";
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AUTH_COOKIE_NAME,
  NEXTAUTH_SECRET,
  isProd,
} from "@/config/env";
import { isAdminEmail } from "@/config/adminAuth";

export const authOptions: AuthOptions = {
  providers: [
    AzureADProvider({
      clientId: AZURE_AD_CLIENT_ID,
      clientSecret: AZURE_AD_CLIENT_SECRET,
      tenantId: "organizations",
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },

  secret: NEXTAUTH_SECRET,

  cookies: {
    // The one cookie all apps will share
    sessionToken: {
      name: AUTH_COOKIE_NAME, // e.g. "NPT_ONBOARDING_AUTH_TOKEN"
      options: {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
      },
    },
  },

  callbacks: {
    // admin allow-list
    async signIn({ user }) {
      if (!user?.email) {
        return (
          "/login?errorMsg=" +
          encodeURIComponent(
            "Unable to read email from your Microsoft account.",
          )
        );
      }

      if (!isAdminEmail(user.email)) {
        return (
          "/login?errorMsg=" +
          encodeURIComponent(
            "You are not authorized to access this application.",
          )
        );
      }

      return true;
    },

    async jwt({ token, account, user }) {
      // original logic + keep what you added in route.ts
      if (account || user) {
        token.userId =
          (user as any)?.id ?? token.sub ?? (token as any).userId ?? undefined;
        token.email = user?.email ?? token.email;
        token.name = user?.name ?? token.name;
        token.picture = token.picture ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      const userId =
        (token as any).userId ??
        (typeof token.sub === "string" ? token.sub : "");

      session.user = {
        ...(session.user ?? {}),
        id: userId,
        email:
          (token.email as string | null | undefined) ??
          session.user?.email ??
          null,
        name:
          (token.name as string | null | undefined) ??
          session.user?.name ??
          null,
        image:
          (token.picture as string | null | undefined) ??
          session.user?.image ??
          null,
      };

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {
        // ignore parse errors
      }
      return baseUrl;
    },
  },
};
