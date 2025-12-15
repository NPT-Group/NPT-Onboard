import type React from "react";

export type SectionRefs<TStepId extends string> = Record<TStepId, HTMLElement | null>;

export function scrollToSection<TStepId extends string>(
  stepId: TStepId,
  sectionRefs: React.MutableRefObject<SectionRefs<TStepId>>,
  opts: { delayMs?: number } = {}
) {
  const el = sectionRefs.current[stepId];
  if (!el) return;
  const delayMs = opts.delayMs ?? 100;
  window.setTimeout(() => {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, delayMs);
}

export function scrollToField<TStepId extends string>(
  path: string,
  fallbackStep: TStepId,
  sectionRefs: React.MutableRefObject<SectionRefs<TStepId>>,
  opts: { delayMs?: number } = {}
) {
  const delayMs = opts.delayMs ?? 100;
  const el = document.querySelector<HTMLElement>(`[data-field="${path}"]`);

  if (el) {
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      try {
        const focusable = el.querySelector<HTMLElement>(
          "input, textarea, select, button, [tabindex]:not([tabindex='-1'])"
        );
        if (focusable) focusable.focus();
        else if (el.tabIndex >= 0 || el.getAttribute("tabindex") != null) el.focus();
      } catch {
        // ignore focus errors
      }
    }, delayMs);
    return;
  }

  scrollToSection(fallbackStep, sectionRefs, { delayMs });
}


