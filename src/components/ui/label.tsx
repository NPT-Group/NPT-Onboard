/**
 * Label Component
 * 
 * Reusable label component for form fields with consistent typography and spacing.
 * Provides semantic HTML labeling for accessibility and screen reader support.
 * 
 * @fileoverview Form label UI component with accessibility best practices.
 * 
 * @component
 * @example
 * // Basic usage with input
 * <Label htmlFor="email">Email Address</Label>
 * <Input id="email" type="email" />
 * 
 * @example
 * // With custom styling
 * <Label htmlFor="name" className="text-blue-600">
 *   Full Name
 * </Label>
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Label Component Props
 * 
 * Extends all standard HTML label element attributes.
 * 
 * @type LabelProps
 * @extends React.LabelHTMLAttributes<HTMLLabelElement>
 */
export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Label Component
 * 
 * A styled label component for form fields that ensures consistent typography
 * and proper association with form inputs for accessibility.
 * 
 * Features:
 * - Uppercase text styling for visual hierarchy
 * - Consistent spacing (margin-bottom) for form layout
 * - Medium font weight for readability
 * - Block display for proper layout flow
 * - Accessible when paired with `htmlFor` attribute
 * 
 * Always use the `htmlFor` prop to associate the label with its corresponding
 * input field using the input's `id`. This improves accessibility and allows
 * users to click the label to focus the input.
 * 
 * @param {LabelProps} props - Standard HTML label attributes
 * @returns {JSX.Element} Styled label element
 */
export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        // Layout: block display for full-width, bottom margin for spacing
        "mb-1 block",
        // Typography: small uppercase text with medium weight
        "text-xs font-medium uppercase text-slate-500",
        className
      )}
      {...props}
    />
  );
}
