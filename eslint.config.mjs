import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // Global ignores (Flat config replaces .eslintignore)
  {
    ignores: [
      ".next/**",
      "node_modules/**",

      // Ignore build/packaging scripts + lambda artifacts
      "scripts/**",
      ".lambda-build/**",

      // optional: common artifacts
      "dist/**",
      "build/**",
      "coverage/**",
    ],
  },

  js.configs.recommended,

  // TypeScript (non-typechecked, fast)
  ...tseslint.configs.recommended,

  // Next.js core-web-vitals (flat)
  {
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // Project overrides
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-empty-object-type": "off",

      // These extra React hooks rules are currently too noisy for this codebase.
      // We still keep the core rules-of-hooks + exhaustive-deps via Next's config.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",

      // This codebase uses <img> for client-side previews (data URLs, object URLs).
      "@next/next/no-img-element": "off",
    },
  },
];
