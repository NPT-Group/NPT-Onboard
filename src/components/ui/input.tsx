/**
 * Input Component
 *
 * Reusable text input component with consistent styling and focus states.
 * Supports all standard HTML input attributes and can be used with React Hook Form
 * or other form libraries via ref forwarding.
 *
 * @fileoverview Input field UI component with accessibility and form integration support.
 *
 * @component
 * @example
 * // Basic usage
 * <Input type="text" placeholder="Enter your name" />
 *
 * @example
 * // With React Hook Form
 * <Input {...register("email")} type="email" />
 *
 * @example
 * // With ref forwarding
 * const inputRef = useRef<HTMLInputElement>(null);
 * <Input ref={inputRef} type="number" />
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Input Component Props
 *
 * Extends all standard HTML input element attributes.
 *
 * @type InputProps
 * @extends React.InputHTMLAttributes<HTMLInputElement>
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input Component
 *
 * A styled input field component that provides consistent styling across the application.
 *
 * Features:
 * - Full-width responsive layout
 * - Accessible focus states with ring indicators
 * - Smooth transitions for interactive states
 * - Ref forwarding for form library integration
 * - Supports all HTML input types and attributes
 *
 * The component uses forwardRef to allow parent components to access the
 * underlying input element, which is essential for form libraries like React Hook Form.
 *
 * @param {InputProps} props - Standard HTML input attributes
 * @param {React.Ref<HTMLInputElement>} ref - Ref to forward to the input element
 * @returns {JSX.Element} Styled input element with consistent design
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // Layout and sizing
        "block w-full",
        // Visual styling: border, background, text
        "rounded-lg bg-white px-3 py-2 text-sm text-slate-900",
        // Subtle shadow for depth
        "shadow-sm",
        // Remove default browser outline (replaced with custom focus ring)
        "outline-none",
        // Smooth transitions for interactive states
        "transition",
        // Focus states: border color change and ring indicator for accessibility
        "focus:border-slate-400 focus:ring-1 focus:ring-slate-300",
        className
      )}
      {...props}
    />
  )
);

// Display name for React DevTools and error messages
Input.displayName = "Input";
