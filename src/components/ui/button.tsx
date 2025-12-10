/**
 * Button Component
 * 
 * Reusable button component with multiple variants and loading state support.
 * Extends native button HTML attributes for full compatibility.
 * 
 * @fileoverview Button UI component with variants, loading states, and accessibility features.
 * 
 * @component
 * @example
 * // Primary button
 * <Button onClick={handleClick}>Submit</Button>
 * 
 * @example
 * // Button with loading state
 * <Button isLoading={isSubmitting}>Save Changes</Button>
 * 
 * @example
 * // Secondary variant
 * <Button variant="secondary">Cancel</Button>
 * 
 * @example
 * // Ghost variant (minimal styling)
 * <Button variant="ghost">Skip</Button>
 */

import { cn } from "@/lib/utils/cn";
import * as React from "react";

/**
 * Button visual variant types
 * 
 * - `primary`: Dark background, primary call-to-action style
 * - `secondary`: Light background, secondary action style
 * - `ghost`: Transparent background, minimal styling
 */
export type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * Button Component Props
 * 
 * Extends all standard HTML button attributes and adds custom props.
 * 
 * @interface ButtonProps
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** When true, displays a loading spinner and disables the button */
  isLoading?: boolean;
  /** Visual style variant for the button */
  variant?: ButtonVariant;
};

/**
 * Button Component
 * 
 * A flexible button component that supports multiple visual variants,
 * loading states, and all standard HTML button attributes.
 * 
 * Features:
 * - Three visual variants (primary, secondary, ghost)
 * - Loading state with spinner animation
 * - Automatic disabled state when loading
 * - Full accessibility support (keyboard navigation, focus states)
 * - Responsive design with proper focus indicators
 * 
 * The button automatically becomes disabled when `isLoading` is true or
 * when the `disabled` prop is provided.
 * 
 * @param {ButtonProps} props - Button configuration and event handlers
 * @returns {JSX.Element} Styled button element with optional loading spinner
 */
export function Button({
  className,
  isLoading,
  disabled,
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  // Base styles: layout, typography, transitions, and disabled states
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium " +
    "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-slate-900/50 disabled:opacity-60 disabled:cursor-not-allowed";

  // Variant-specific color schemes and hover states
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100",
  };

  return (
    <button
      className={cn(base, variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Loading spinner - displayed when isLoading is true */}
      {isLoading && (
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
      )}
      {children}
    </button>
  );
}
