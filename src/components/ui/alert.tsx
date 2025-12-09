/**
 * Alert Component
 * 
 * Reusable alert component for displaying informational, error, or success messages.
 * Supports both title and description text with variant-based styling.
 * 
 * @fileoverview Alert UI component with multiple variants for different message types.
 * 
 * @component
 * @example
 * // Info alert
 * <Alert variant="info" description="Your form has been saved." />
 * 
 * @example
 * // Error alert with title
 * <Alert 
 *   variant="error" 
 *   title="Verification Failed"
 *   description="The code you entered is incorrect."
 * />
 * 
 * @example
 * // Success alert
 * <Alert 
 *   variant="success"
 *   title="Verified"
 *   description="Your identity has been verified successfully."
 * />
 */

"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Alert Component Props
 * 
 * @interface AlertProps
 */
interface AlertProps {
  /** Optional title text displayed prominently at the top */
  title?: string;
  /** Optional description text displayed below the title */
  description?: string;
  /** Visual variant determining color scheme and styling */
  variant?: "info" | "error" | "success";
  /** Additional CSS classes to merge with component styles */
  className?: string;
}

/**
 * Alert Component
 * 
 * Displays a contextual message box with variant-based styling.
 * 
 * Variants:
 * - `info`: Neutral slate styling for informational messages
 * - `error`: Red styling for error messages and warnings
 * - `success`: Emerald/green styling for success confirmations
 * 
 * The component supports displaying either a title, description, or both.
 * If neither is provided, the component renders an empty div.
 * 
 * @param {AlertProps} props - Alert configuration props
 * @returns {JSX.Element} Alert message box element
 */
export function Alert({
  title,
  description,
  variant = "info",
  className,
}: AlertProps) {
  // Base styles applied to all variants
  const base = "w-full rounded-lg border px-3 py-2 text-xs";

  // Variant-specific color schemes
  const variants: Record<typeof variant, string> = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={cn(base, variants[variant], className)}>
      {/* Optional title - displayed with medium font weight */}
      {title && <p className="font-medium">{title}</p>}
      
      {/* Optional description - displayed below title with spacing */}
      {description && <p className="mt-1">{description}</p>}
    </div>
  );
}
