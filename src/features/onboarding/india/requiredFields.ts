import { z } from "zod";
import { indiaOnboardingFormSchema } from "./indiaFormSchema";

type ZodTypeAny = z.ZodTypeAny;

type UnwrapResult = {
  schema: ZodTypeAny;
  isOptional: boolean;
};

function normalizePath(path: string): string {
  // Convert array indices to wildcard so `education.0.foo` matches `education.*.foo`
  return String(path).replace(/\.\d+(?=\.|$)/g, ".*");
}

function unwrap(schema: ZodTypeAny): UnwrapResult {
  let s: any = schema;
  let optional = false;

  // IMPORTANT (Zod v4):
  // Do NOT call `schema.isOptional()` in general — for some wrapper types (e.g. ZodTransform)
  // it can execute transform functions with `undefined` and crash the app.
  //
  // Instead, detect optionality by unwrapping only the specific optional wrappers.
  while (s && typeof s === "object") {
    // Optional/default wrappers => not required
    if (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
      optional = true;
      s = (s as any)._def?.innerType ?? (s as any)._def?.schema ?? s;
      continue;
    }

    // Nullable does NOT mean optional (still required but can be null)
    if (s instanceof z.ZodNullable) {
      s = (s as any)._def?.innerType ?? s;
      continue;
    }

    // Pipes/preprocess/refine/transform chains:
    // IMPORTANT: optionality may exist on the *output* side (e.g. preprocess(..., z.string().optional())).
    // We must detect that without calling `.isOptional()` (Zod v4 can execute transforms).
    if (s instanceof z.ZodPipe) {
      const out = (s as any)._def?.out;
      if (out instanceof z.ZodOptional || out instanceof z.ZodDefault) {
        optional = true;
        s = (out as any)._def?.innerType ?? (out as any)._def?.schema ?? out;
        continue;
      }

      // Prefer output for traversal (it preserves object/array structure), fall back to input.
      s = out ?? (s as any)._def?.in ?? s;
      continue;
    }

    break;
  }

  return { schema: s as ZodTypeAny, isOptional: optional };
}

function collectRequiredPatterns(
  schema: ZodTypeAny,
  prefix: string,
  out: Set<string>,
  ancestorsRequired: boolean
) {
  const { schema: unwrapped, isOptional } = unwrap(schema);
  const requiredHere = ancestorsRequired && !isOptional;

  // If this node (or any ancestor) is optional, don't mark descendants as required.
  if (!requiredHere) return;

  // ZodObject: traverse its shape
  const anySchema: any = unwrapped as any;
  if (anySchema && typeof anySchema.shape === "object" && anySchema.shape) {
    // Mark the object field itself as required (important for composite controls like file uploads),
    // not just its leaf keys (url/s3Key/etc). Skip the root object (prefix="").
    if (prefix) out.add(prefix);

    Object.entries(anySchema.shape).forEach(([key, child]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      collectRequiredPatterns(child as ZodTypeAny, nextPrefix, out, requiredHere);
    });
    return;
  }

  // ZodArray: traverse element
  if (anySchema && anySchema.element) {
    const nextPrefix = prefix ? `${prefix}.*` : "*";
    collectRequiredPatterns(anySchema.element as ZodTypeAny, nextPrefix, out, requiredHere);
    return;
  }

  // Leaf (string/number/boolean/union/etc.) => required if we got here.
  if (prefix) out.add(prefix);
}

const REQUIRED_PATTERNS = (() => {
  const out = new Set<string>();
  try {
    collectRequiredPatterns(indiaOnboardingFormSchema as any, "", out, true);
  } catch {
    // Fail-safe: never crash the app because of required-field introspection.
    // If this fails, required indicators simply won't render.
  }
  return out;
})();

export function isIndiaRequiredField(path: string): boolean {
  const norm = normalizePath(path);
  return REQUIRED_PATTERNS.has(norm);
}


