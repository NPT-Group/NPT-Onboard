/**
 * Onboarding Entry Page
 *
 * Server-side page component that handles the initial onboarding invitation route.
 * Extracts and validates the invitation token from URL search parameters,
 * then renders the invite screen or an error state.
 *
 * Route: /onboarding?token=<invitation_token>
 *
 * This is a Next.js App Router page component that runs on the server.
 * It processes search parameters asynchronously (Next.js 16+ behavior)
 * and validates the presence of the required invitation token.
 *
 * @fileoverview Entry point page for employee onboarding invitations.
 *
 * @component
 */

import { OnboardingInviteScreen } from "./invite-screen";

/**
 * Search Parameters Promise Type
 *
 * Next.js 16+ makes searchParams a Promise that must be awaited.
 * This type represents the resolved search parameters object.
 */
type SearchParamsPromise = Promise<{
  [key: string]: string | string[] | undefined;
}>;

/**
 * Onboarding Entry Page Component
 *
 * Server-side page component that:
 * 1. Extracts the invitation token from URL search parameters
 * 2. Validates that the token is present
 * 3. Renders either the invite screen (valid token) or error state (missing token)
 *
 * The token is expected in the URL as: ?token=<invitation_token>
 *
 * @param {Object} props - Next.js page component props
 * @param {SearchParamsPromise} props.searchParams - Promise resolving to URL search parameters.
 *   In Next.js 16+, searchParams is asynchronous and must be awaited.
 *
 * @returns {Promise<JSX.Element>} Either the invite screen or an error message
 *
 * @async
 */
export default async function OnboardingEntryPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  /**
   * Await searchParams promise (required in Next.js 16+)
   * Next.js changed searchParams from a synchronous object to a Promise
   * to enable better static optimization and streaming.
   */
  const resolved = await searchParams;

  /**
   * Extract token from search parameters
   * Handles both single value and array of values (URL can have ?token=abc&token=def)
   */
  const tokenParam = resolved?.token;

  /**
   * Normalize token: take first value if array, otherwise use value or empty string
   * This ensures we always have a string value for validation
   */
  const inviteToken = Array.isArray(tokenParam)
    ? tokenParam[0]
    : tokenParam ?? "";

  /**
   * Validation: If no token is present, show error state
   * This protects against direct navigation without a valid invitation link
   */
  if (!inviteToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Invalid onboarding link
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This link is missing a security token. Please open the onboarding
            link directly from the email you received, or contact NPT HR for
            help.
          </p>
        </div>
      </main>
    );
  }

  /**
   * Valid token present - render the invite screen with the token
   * The invite screen will handle OTP verification and form navigation
   */
  return <OnboardingInviteScreen inviteToken={inviteToken} />;
}
