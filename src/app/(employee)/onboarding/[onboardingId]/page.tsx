/**
 * Onboarding Form Page
 * 
 * Main page component for the multi-step onboarding form. Displays the form wizard
 * and manages step navigation. Features a sticky navbar that shows a compact wizard
 * when the full wizard scrolls out of view.
 * 
 * Route: /onboarding/[onboardingId]
 * 
 * This is a client component that manages form state, step navigation, and
 * scroll-based UI updates. The component uses Intersection Observer to detect
 * when the full wizard scrolls out of view and automatically shows a compact
 * version in the navbar.
 * 
 * @fileoverview Main onboarding form page with step wizard and navigation.
 * 
 * @component
 * @example
 * // Rendered automatically by Next.js for route /onboarding/abc123
 * <OnboardingFormPage params={{ onboardingId: "abc123" }} />
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { ESubsidiary } from "@/types/shared.types";
import { subsidiaryContent } from "@/config/subsidiaries";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";
import { FormWizard } from "@/components/onboarding/form-wizard";

/**
 * Page Component Props
 * 
 * @interface PageProps
 */
type PageProps = {
  params: {
    /** Onboarding session ID from the URL dynamic segment */
    onboardingId: string;
  };
};

/**
 * Onboarding Form Page Component
 * 
 * Renders the main onboarding form interface with:
 * - Navigation bar with subsidiary information
 * - Full form wizard at the top of the content
 * - Compact wizard in navbar when full wizard scrolls out of view
 * - Step-based form content area
 * 
 * The component uses Intersection Observer to track when the full wizard
 * scrolls out of the viewport and automatically switches to showing a
 * compact wizard version in the navbar for persistent navigation.
 * 
 * @param {PageProps} _props - Page props containing the onboarding ID
 * @returns {JSX.Element} Full onboarding form page layout
 * 
 * @todo Replace hardcoded subsidiary with backend/session data
 * @todo Wire currentIndex to actual form state/routing
 * @todo Replace placeholder content with actual form sections
 */
export default function OnboardingFormPage(_props: PageProps) {
  // ==================================================================
  // Configuration (Temporary - should come from backend/session)
  // ==================================================================

  /**
   * Subsidiary code - currently hardcoded to INDIA
   * TODO: Derive from backend API or session context
   */
  const subsidiary = ESubsidiary.INDIA;
  
  /**
   * Subsidiary-specific content configuration
   */
  const content = subsidiaryContent[subsidiary];
  
  /**
   * Display name for the region, extracted from subsidiary name
   * Example: "NPT India" -> "India"
   */
  const regionName = content.name.replace(/^NPT\s+/i, "");

  // ==================================================================
  // State Management
  // ==================================================================

  /**
   * Current step index (0-based) in the onboarding wizard
   * TODO: Wire to actual form state/routing/persistence
   */
  const [currentIndex, setCurrentIndex] = useState(0);
  
  /**
   * Whether to show the compact wizard in the navbar
   * Set to true when the full wizard scrolls out of view
   */
  const [showCompactWizard, setShowCompactWizard] = useState(false);

  /**
   * Ref to the full wizard element for Intersection Observer
   * Used to detect when the wizard scrolls out of the viewport
   */
  const wizardRef = useRef<HTMLDivElement | null>(null);

  // ==================================================================
  // Intersection Observer for Sticky Wizard
  // ==================================================================

  /**
   * Sets up Intersection Observer to detect when the full wizard
   * scrolls out of view, triggering the compact wizard display in navbar.
   * 
   * When the full wizard is visible, only the regular wizard is shown.
   * When it scrolls out of view, a compact version appears in the navbar
   * for persistent step navigation.
   */
  useEffect(() => {
    const el = wizardRef.current;
    if (!el) return;

    /**
     * Intersection Observer callback
     * When the wizard is NOT intersecting (scrolled out of view),
     * show the compact wizard in the navbar.
     */
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowCompactWizard(!entry.isIntersecting);
      },
      { root: null, threshold: 0 } // Trigger as soon as element leaves viewport
    );

    observer.observe(el);
    
    // Cleanup: disconnect observer on unmount
    return () => observer.disconnect();
  }, []);

  // ==================================================================
  // Render
  // ==================================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar with optional compact wizard */}
      <Navbar
        subsidiaryDisplayName={regionName}
        subsidiaryCode={subsidiary}
        centerSlot={
          showCompactWizard ? (
            <FormWizard
              steps={ONBOARDING_STEPS}
              currentIndex={currentIndex}
              size="compact"
            />
          ) : null
        }
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          {/* Full Form Wizard - Observed for scroll detection */}
          <div ref={wizardRef} className="mb-6 flex justify-center">
            <FormWizard
              steps={ONBOARDING_STEPS}
              currentIndex={currentIndex}
              size="regular"
            />
          </div>

          {/* ========================================================== */}
          {/* Form Content Area (Temporary Placeholder)                 */}
          {/* ========================================================== */}
          <section className="space-y-6">
            {/* Step Header */}
            <header>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Step {currentIndex + 1}: {ONBOARDING_STEPS[currentIndex].label}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Placeholder content while we build the actual form sections.
              </p>
            </header>

            {/* Placeholder content blocks for scroll testing */}
            <div className="space-y-4">
              {Array.from({ length: 14 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-16 rounded-lg border border-dashed border-slate-200 bg-slate-50/70"
                />
              ))}
            </div>

            {/* Temporary Step Navigation Controls */}
            {/* TODO: Remove these once actual form navigation is implemented */}
            <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                Prev step
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50"
                onClick={() =>
                  setCurrentIndex((i) =>
                    Math.min(ONBOARDING_STEPS.length - 1, i + 1)
                  )
                }
              >
                Next step
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
