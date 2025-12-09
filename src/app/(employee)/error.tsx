/**
 * Employee Error Boundary Component
 * 
 * This is a Next.js error boundary component specifically for the employee route segment.
 * It catches and displays errors that occur within the (employee) route group,
 * providing a user-friendly error UI with recovery options.
 * 
 * @fileoverview Error handling UI component for employee onboarding flows.
 * 
 * @component
 * @example
 * // Automatically rendered by Next.js when an error occurs in the employee segment
 * <EmployeeError error={error} reset={reset} />
 */

"use client";

/**
 * Employee Error Boundary Component
 * 
 * Displays a user-friendly error message when something goes wrong in the
 * employee onboarding flow. Provides a "Try again" button that calls the
 * reset function to retry rendering the component tree.
 * 
 * @param {Object} props - Component props
 * @param {Error & { digest?: string }} props.error - The error object that triggered this boundary.
 *   The `digest` property is a Next.js-specific error identifier for server-side errors.
 * @param {() => void} props.reset - Callback function to reset the error boundary state
 *   and attempt to re-render the component tree. Provided by Next.js.
 * 
 * @returns {JSX.Element} A centered error message card with retry functionality
 * 
 * @remarks
 * This component should be enhanced with error logging integration (e.g., Sentry)
 * for production environments to track and diagnose errors.
 */
export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /**
   * Log the error to the console.
   * TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
   * for production error monitoring and debugging.
   */
  console.error("Employee segment error:", error);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
        {/* Error heading */}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        
        {/* Error description - user-friendly message explaining the issue */}
        <p className="mt-2 text-sm text-slate-600">
          We couldn&apos;t load your onboarding right now. This might be a
          temporary issue.
        </p>
        
        {/* Retry button - calls reset() to attempt re-rendering */}
        <button
          className="mt-4 text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
