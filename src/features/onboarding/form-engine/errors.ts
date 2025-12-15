import type { FieldErrors, FieldValues } from "react-hook-form";
import { getErrorAtPath } from "../common/getErrorAtPath";
import type { StepDef } from "./types";

export function findFirstErrorInStep<TForm extends FieldValues, TStepId extends string>(
  step: StepDef<TForm, TStepId>,
  errors: FieldErrors<TForm>
): string | null {
  // Custom finder wins
  if (step.findFirstErrorPath) {
    const p = step.findFirstErrorPath(errors);
    if (p) return p;
  }

  // Nested scroll paths (strings) let us target specific UI fields for object-level validation
  if (step.nestedScrollPaths?.length) {
    for (const p of step.nestedScrollPaths) {
      const err = getErrorAtPath(errors as any, p);
      if (err?.message) return p;
    }
  }

  // Otherwise check declared fieldPaths
  for (const p of step.fieldPaths) {
    const err = getErrorAtPath(errors as any, String(p));
    if (err?.message) return String(p);
  }

  return null;
}

export function findFirstErrorAcrossSteps<TForm extends FieldValues, TStepId extends string>(
  steps: StepDef<TForm, TStepId>[],
  errors: FieldErrors<TForm>
): { stepId: TStepId; errorPath: string | null } | null {
  for (const step of steps) {
    const p = findFirstErrorInStep(step, errors);
    if (p) return { stepId: step.id, errorPath: p };
  }
  return null;
}


