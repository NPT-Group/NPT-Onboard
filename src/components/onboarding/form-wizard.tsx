/**
 * Form Wizard Component
 * 
 * Visual step indicator component for multi-step onboarding forms.
 * Displays progress through form steps with animated transitions,
 * checkmarks for completed steps, and connecting lines between steps.
 * 
 * Features:
 * - Animated step transitions using Framer Motion
 * - Visual states: active (current), completed, and upcoming
 * - Responsive sizing (regular and compact variants)
 * - Accessible ARIA labels and attributes
 * - Smooth progress line animation
 * 
 * @fileoverview Step wizard/progress indicator for onboarding forms.
 * 
 * @component
 * @example
 * // Regular size wizard
 * <FormWizard
 *   steps={ONBOARDING_STEPS}
 *   currentIndex={2}
 *   size="regular"
 * />
 * 
 * @example
 * // Compact size for navbar
 * <FormWizard
 *   steps={ONBOARDING_STEPS}
 *   currentIndex={2}
 *   size="compact"
 * />
 */

"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { WizardStep } from "@/config/onboardingSteps";

/**
 * Form Wizard Component Props
 * 
 * @interface FormWizardProps
 */
type FormWizardProps = {
  /** Array of wizard step definitions */
  steps: WizardStep[];
  /** Zero-based index of the currently active step */
  currentIndex: number;
  /** Visual size variant: "regular" for main display, "compact" for navbar */
  size?: "regular" | "compact";
};

/**
 * Form Wizard Component
 * 
 * Renders a horizontal step indicator showing progress through the onboarding form.
 * Each step is represented by a numbered circle that transforms to a checkmark
 * when completed. Steps are connected by animated progress lines.
 * 
 * Visual States:
 * - Active: Current step with red background and white text, slightly scaled up
 * - Completed: Steps before current with red accent, showing checkmark icon
 * - Upcoming: Steps after current with muted gray styling
 * 
 * The component uses Framer Motion for smooth animations when steps change
 * and progress lines fill in as steps are completed.
 * 
 * @param {FormWizardProps} props - Wizard configuration props
 * @returns {JSX.Element} Horizontal step wizard navigation element
 */
export function FormWizard({
  steps,
  currentIndex,
  size = "regular",
}: FormWizardProps) {
  // ==================================================================
  // Size Configuration
  // ==================================================================

  /**
   * Base circle size classes based on size variant
   * Compact: smaller circles for navbar usage
   * Regular: larger circles for main form display
   */
  const circleBase =
    size === "compact"
      ? "h-7 w-7 text-[11px]"
      : "h-8 w-8 text-xs sm:h-9 sm:w-9";

  /**
   * Gap between step elements based on size variant
   */
  const gap = size === "compact" ? "gap-2" : "gap-3";
  
  /**
   * Connector line width based on size variant
   */
  const lineWidth = size === "compact" ? "w-6 sm:w-8" : "w-8 sm:w-10";

  // ==================================================================
  // Render
  // ==================================================================

  return (
    <nav aria-label="Onboarding steps" className={cn("flex items-center", gap)}>
      {steps.map((step, index) => {
        // Step state determination
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        // Connector logic: show connector after each step except the last
        const showConnector = index < steps.length - 1;
        const connectorIndex = index;

        return (
          <div
            key={step.id}
            className={cn("flex items-center", gap)}
            aria-current={isActive ? "step" : undefined}
          >
            {/* Step Circle Indicator */}
            <motion.div
              className={cn(
                // Base styles: layout, shape, typography
                "flex items-center justify-center rounded-full border font-semibold",
                // Subtle shadow for depth
                "shadow-[0_0_0_1px_rgba(15,23,42,0.03)] transition-colors",
                // Size variant classes
                circleBase,
                // State-based styling
                isActive
                  ? "border-red-600 bg-red-600 text-white shadow-sm"
                  : isCompleted
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              )}
              initial={false}
              animate={{
                // Subtle scale animation for active step
                scale: isActive ? 1.05 : 1,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {/* Completed steps show checkmark, others show step number */}
              {isCompleted ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : (
                index + 1
              )}
            </motion.div>

            {/* Connector Line Between Steps */}
            {showConnector && (
              <div
                className={cn(
                  "relative h-[2px] rounded-full bg-slate-200/80",
                  lineWidth
                )}
                aria-hidden="true"
              >
                {/* Animated progress fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-red-500"
                  initial={false}
                  animate={{
                    // Fill line if step is completed
                    width: currentIndex > connectorIndex ? "100%" : "0%",
                  }}
                  transition={{
                    duration: 0.25,
                    ease: "easeInOut",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
