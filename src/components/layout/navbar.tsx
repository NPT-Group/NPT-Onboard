/**
 * Navigation Bar Component
 * 
 * Global navigation bar component that appears at the top of application pages.
 * Features a sticky header with logo, subsidiary information, optional center content
 * (such as a compact form wizard), and help/support links.
 * 
 * @fileoverview Top navigation bar with responsive layout and flexible content slots.
 * 
 * @component
 * @example
 * <Navbar
 *   subsidiaryDisplayName="India"
 *   subsidiaryCode={ESubsidiary.INDIA}
 *   centerSlot={<FormWizard size="compact" />}
 *   helpEmail="hr@nptgroup.com"
 * />
 */

"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { ESubsidiary } from "@/types/shared.types";
import { cn } from "@/lib/utils/cn";

/**
 * Props for the Navbar component
 * 
 * @interface NavbarProps
 */
type NavbarProps = {
  /** Human-readable subsidiary/region name (e.g., "India", "Canada") */
  subsidiaryDisplayName: string;
  /** Subsidiary code enum value for identification */
  subsidiaryCode: ESubsidiary;
  /** Optional content to display in the center of the navbar (e.g., compact wizard) */
  centerSlot?: ReactNode;
  /** Optional override for the right-hand side content (defaults to "Need help?" link) */
  rightSlot?: ReactNode;
  /** Email address for help/support link (default: "hr@example.com") */
  helpEmail?: string;
  /** Additional CSS classes to apply to the header element */
  className?: string;
};

/**
 * Navigation Bar Component
 * 
 * Renders a sticky navigation bar with three main sections:
 * 1. Left: NPT logo and subsidiary information (name + code badge)
 * 2. Center: Optional content slot (typically used for compact form wizard)
 * 3. Right: Help/support link or custom content
 * 
 * Features:
 * - Sticky positioning at top of viewport
 * - Semi-transparent background with backdrop blur for modern glass effect
 * - Responsive logo sizing
 * - Flexible content slots for different use cases
 * 
 * @param {NavbarProps} props - Component configuration props
 * @returns {JSX.Element} Sticky navigation header element
 */
export function Navbar({
  subsidiaryDisplayName,
  subsidiaryCode,
  centerSlot,
  rightSlot,
  helpEmail = "hr@example.com",
  className,
}: NavbarProps) {
  return (
    <header
      className={cn(
        // Sticky positioning with high z-index to stay above content
        "sticky top-0 z-30",
        // Semi-transparent white background with backdrop blur for glass effect
        "bg-white/80 backdrop-blur-sm",
        // Subtle shadow for depth and separation from content
        "shadow-[0_1px_8px_rgba(15,23,42,0.03)]",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        {/* ========================================================== */}
        {/* Left Section: Logo + Subsidiary Information               */}
        {/* ========================================================== */}
        <div className="flex flex-none items-center gap-3">
          {/* NPT Company Logo - responsive sizing */}
          <Image
            src="/assets/logos/NPTlogo.png"
            alt="NPT Group Logo"
            width={0}
            height={0}
            sizes="100vw"
            className="h-auto w-[70px] object-contain sm:w-[90px] md:w-[110px]"
            priority
          />

          {/* Subsidiary name and code badge */}
          <div className="flex items-center gap-2">
            {/* Subsidiary display name (e.g., "India") */}
            <span className="text-sm font-medium text-slate-900">
              {subsidiaryDisplayName}
            </span>

            {/* Subsidiary code badge with red theme */}
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {subsidiaryCode}
            </span>
          </div>
        </div>

        {/* ========================================================== */}
        {/* Center Section: Optional Content (e.g., Compact Wizard)   */}
        {/* ========================================================== */}
        <div className="flex flex-1 items-center justify-center">
          {centerSlot}
        </div>

        {/* ========================================================== */}
        {/* Right Section: Help Link or Custom Content                */}
        {/* ========================================================== */}
        <div className="flex flex-none items-center justify-end gap-4">
          {rightSlot ?? (
            <a
              href={`mailto:${helpEmail}`}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Need help?
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
