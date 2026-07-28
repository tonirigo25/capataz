import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin },
    rules: nextPlugin.configs["core-web-vitals"].rules,
  },
  {
    ignores: [
      ".next/**",
      ".worktrees/**",
      "artifacts/**",
      "test-results/**",
      ".lighthouseci/**",
      "android/**",
      "ios/**",
    ],
  },
];
