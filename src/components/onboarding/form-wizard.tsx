"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { WizardStep } from "@/config/onboardingSteps";

type FormWizardProps = {
  steps: WizardStep[];
  currentIndex: number;
  /** Visual size variant: "regular" for main display, "compact" for navbar */
  size?: "regular" | "compact";
};

/**
 * Drivedock-style responsive wizard:
 * - Always centered within its container
 * - On very small widths it becomes compact enough that horizontal scroll
 *   is almost never needed
 * - Internal overflow-x-auto guard only kicks in in extreme cases
 */
export function FormWizard({
  steps,
  currentIndex,
  size = "regular",
}: FormWizardProps) {
  const circleClass =
    size === "compact"
      ? "w-6 h-6 text-[11px]"
      : "w-7 h-7 text-xs sm:w-8 sm:h-8 sm:text-sm";

  const connectorWidth = size === "compact" ? "w-4 sm:w-6" : "w-5 sm:w-8";

  return (
    <nav aria-label="Onboarding steps" className="flex w-full items-center">
      <div className="flex w-full justify-center">
        <div className="flex flex-row items-center justify-between bg-transparent">
          <div className="flex-1 overflow-x-auto sm:overflow-visible">
            <div className="flex items-center gap-1 min-w-max sm:gap-2 sm:justify-center sm:min-w-0">
              {steps.map((step, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                const isLast = index === steps.length - 1;

                return (
                  <div
                    key={step.id}
                    className="relative flex items-center"
                    aria-current={isActive ? "step" : undefined}
                  >
                    {/* Step circle */}
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.04 }}
                      className={cn(
                        "flex items-center justify-center rounded-full font-semibold",
                        "transition-colors shadow-[0_0_0_1px_rgba(15,23,42,0.03)]",
                        circleClass,
                        isActive
                          ? "bg-red-600 text-white"
                          : isCompleted
                          ? "bg-red-500 text-white"
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {isCompleted ? (
                        <Check
                          className="h-3 w-3 sm:h-4 sm:w-4"
                          strokeWidth={2.4}
                        />
                      ) : (
                        index + 1
                      )}
                    </motion.div>

                    {/* Connector to next step */}
                    {!isLast && (
                      <div
                        className={cn(
                          "relative mx-0.5 h-1 rounded-full bg-slate-200 sm:mx-1",
                          connectorWidth
                        )}
                        aria-hidden="true"
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: isCompleted ? "100%" : "0%",
                          }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="absolute left-0 top-0 h-full rounded-full bg-red-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
