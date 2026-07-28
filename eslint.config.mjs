import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
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
