import type { FieldErrors, FieldPath, FieldValues } from "react-hook-form";

export type StepDef<TForm extends FieldValues, TStepId extends string = string> = {
  id: TStepId;
  label: string;
  /** FieldPaths to validate for this step gating */
  fieldPaths: FieldPath<TForm>[];
  /** Optional ordered list of nested data-field paths to use for scrolling */
  nestedScrollPaths?: string[];
  /**
   * Optional custom error finder for complex steps (e.g. employment arrays).
   * Return a data-field path to scroll to.
   */
  findFirstErrorPath?: (errors: FieldErrors<TForm>) => string | null;
};


