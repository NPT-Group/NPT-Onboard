/**
 * Footer Component
 * 
 * Global footer component displayed at the bottom of application pages.
 * Displays copyright information and platform branding.
 * 
 * @fileoverview Footer layout component for the NPT Onboarding application.
 * 
 * @component
 * @example
 * <Footer />
 */

"use client";

/**
 * Footer Component
 * 
 * Renders a dark-themed footer with copyright information and platform description.
 * The footer automatically updates the copyright year based on the current date.
 * 
 * Design:
 * - Dark background (#1D1D1F) for contrast with main content
 * - Centered text layout
 * - Two-line layout: copyright and platform description
 * 
 * @returns {JSX.Element} Footer element with copyright and branding information
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-[#1D1D1F] py-7 text-center">
      <div className="mx-auto max-w-6xl px-4 text-[#A1A1A6]">
        {/* Copyright notice with dynamic year */}
        <p className="text-[12px] font-normal text-white">
          © {new Date().getFullYear()} NPT Group of Companies. All rights
          reserved.
        </p>
        
        {/* Platform branding/subtitle */}
        <p className="mt-1 text-[11px]">
          NPT Onboarding — Secure Employee Onboarding Platform
        </p>
      </div>
    </footer>
  );
}
