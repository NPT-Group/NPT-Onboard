/**
 * Navigation Bar Component
 *
 * Global navigation bar component that appears at the top of application pages.
 * Shows logo + subsidiary on the left, help link on the right, and an optional
 * center slot for things like a compact form wizard.
 *
 * Behaviour:
 * - Sticky at the top on all screen sizes
 * - When centerSlot is provided:
 *   - On desktop (md+): centered inline over the header row
 *   - On mobile (<md): rendered on a second row below the logo bar
 */

"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { ESubsidiary } from "@/types/shared.types";
import { cn } from "@/lib/utils/cn";
import { NEXT_PUBLIC_NPT_HR_EMAIL } from "@/config/publicEnv";

type NavbarProps = {
  subsidiaryDisplayName: string;
  subsidiaryCode: ESubsidiary;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  helpEmail?: string;
  className?: string;
};

export function Navbar({
  subsidiaryDisplayName,
  subsidiaryCode,
  centerSlot,
  rightSlot,
  helpEmail = NEXT_PUBLIC_NPT_HR_EMAIL,
  className,
}: NavbarProps) {
  return (
    <header
      className={cn(
        "sticky inset-x-0 top-0 z-40",
        "bg-white/80 backdrop-blur-sm",
        "shadow-[0_1px_8px_rgba(15,23,42,0.03)]",
        "transition-colors transition-shadow duration-200",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top row: logo + subsidiary on the left, help on the right */}
        <div className="relative flex h-14 items-center sm:h-16">
          {/* Left: Logo + subsidiary */}
          <div className="flex flex-none items-center gap-3">
            <Image
              src="/assets/logos/NPTlogo.png"
              alt="NPT Group Logo"
              width={0}
              height={0}
              sizes="100vw"
              className="h-auto w-[70px] object-contain sm:w-[90px] md:w-[110px]"
              priority
            />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                {subsidiaryDisplayName}
              </span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {subsidiaryCode}
              </span>
            </div>
          </div>

          {/* Desktop center: compact wizard centered over the row */}
          {centerSlot && (
            <div className="pointer-events-none absolute inset-x-0 hidden items-center justify-center md:flex">
              <div className="pointer-events-auto flex items-center justify-center">
                {centerSlot}
              </div>
            </div>
          )}

          {/* Right: help or custom content */}
          <div className="ml-auto flex flex-none items-center justify-end gap-4">
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

        {/* Mobile center row: compact wizard below the top bar */}
        {centerSlot && (
          <div className="pb-2 pt-1 md:hidden">
            <div className="flex items-center justify-center">{centerSlot}</div>
          </div>
        )}
      </div>
    </header>
  );
}
