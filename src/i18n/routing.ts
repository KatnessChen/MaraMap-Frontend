import { defineRouting } from "next-intl/routing";

// Chinese stays at the existing unprefixed URLs (localePrefix: "as-needed")
// so indexed zh pages and backlinks don't move. English gets an explicit
// /en prefix. Admin (`src/app/admin/`) is intentionally outside this routing
// — the middleware matcher below excludes it — since it's single-language
// and only the client uses it (see docs/I18N_PLAN.md, Layer 1).
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "as-needed",
  // Site's core audience is 60+ Taiwanese runners — a device set to an
  // English OS/browser locale should not silently redirect them to /en.
  // Visiting "/" always resolves to zh; English is opt-in via /en only.
  // See docs/I18N_PLAN.md, "尚未決定".
  localeDetection: false,
});
