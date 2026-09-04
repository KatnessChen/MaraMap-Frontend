// Canonical production domain — confirmed 2026-09-03 (see docs/I18N_PLAN.md,
// "SEO 與 URL"). Used for metadataBase, sitemap/robots absolute URLs, and
// hreflang alternates. Not env-driven on purpose: this value isn't expected
// to change again, and every consumer (sitemap.ts, robots.ts, per-page
// metadata) needs the exact same constant regardless of where it's rendered.
export const SITE_URL = "https://maramap.vizino.ai";
