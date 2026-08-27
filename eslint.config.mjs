import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Playwright's generated test-run output — .gitignore keeps it out of
    // version control, but ESLint doesn't read .gitignore on its own, so a
    // bare `eslint` picked up the report viewer's own bundled vendor JS
    // (CodeMirror etc.) and churned through megabytes of irrelevant warnings.
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
