// English labels for taxonomy values (category / sub-category / continent).
//
// These Chinese strings are also database field values and part of the
// backend API whitelist (MaraMap-Backend `fb-posts.service.ts`
// `VALID_CATEGORIES` / `SUB_CATEGORY_MAP`). Translation must stay display-only
// — never rename a key here without also checking those two lists, or this
// repeats the 七大馬→九大馬 compatibility incident (see docs/I18N_PLAN.md).
//
// Lookups fall back to the original Chinese string when a value has no
// translation yet, so an unmapped enum addition never renders blank.

export const CATEGORY_EN: Record<string, string> = {
  馬拉松: "Marathon",
  旅遊: "Travel",
  登山: "Hiking",
};

export const SUB_CATEGORY_EN: Record<string, string> = {
  // 馬拉松
  海外馬: "Overseas Marathon",
  國內馬: "Domestic Marathon",
  "超馬(44K+)": "Ultramarathon (44K+)",
  高山馬: "Mountain Marathon",
  九大馬: "Major Marathons", // "九大馬" has no fixed English equivalent — worth customer/domain review before publishing.
  普查: "Certified Marathon", // domain term (marathon-census verified list) — approximate translation, flag for review.
  // 登山
  大百岳: "Taiwan's Hundred Peaks", // 百岳, Taiwan's canonical 100-peak list
  小百岳: "Taiwan's Lesser Hundred Peaks",
  海外登山: "Overseas Hiking",
};

export const CONTINENT_EN: Record<string, string> = {
  亞洲: "Asia",
  歐洲: "Europe",
  北美洲: "North America",
  南美洲: "South America",
  大洋洲: "Oceania",
  非洲: "Africa",
  南極洲: "Antarctica",
  其他: "Other", // ListView/TimelineView's fallback bucket for posts with no continent tag
};

// Race-distance labels — a separate enum from category/sub-category, but
// same display-only-translation rule, reused across CountryModal, MapView,
// personal-best, and log/[id] (kept here rather than duplicated per file).
// "50K" / "100K" / "6H" / "12H" bucket keys used alongside these need no
// translation — they're already locale-neutral.
export const DISTANCE_TYPE_EN: Record<string, string> = {
  超馬: "Ultra",
  全馬: "Full Marathon",
  半馬: "Half Marathon",
  跑步: "Run",
};

export type Locale = "zh" | "en";

export function translateCategory(zh: string, locale: Locale): string {
  return locale === "en" ? CATEGORY_EN[zh] ?? zh : zh;
}

export function translateSubCategory(zh: string, locale: Locale): string {
  return locale === "en" ? SUB_CATEGORY_EN[zh] ?? zh : zh;
}

export function translateContinent(zh: string, locale: Locale): string {
  return locale === "en" ? CONTINENT_EN[zh] ?? zh : zh;
}

export function translateDistanceType(zh: string, locale: Locale): string {
  return locale === "en" ? DISTANCE_TYPE_EN[zh] ?? zh : zh;
}

// Generic helper for zh/en pairs that don't come from a fixed dictionary —
// e.g. a post's country_en, sourced per-record from the backend rather than
// a static enum. Falls back to zh whenever no en value is available, same
// "never blank" rule as the dictionary-backed translate* functions above.
export function translatePairedName(
  zh: string,
  en: string | null | undefined,
  locale: Locale,
): string {
  return locale === "en" && en ? en : zh;
}

// Category and sub-category value sets are disjoint, so a single lookup can
// serve call sites that display "whichever of the two is currently active"
// (e.g. a filter header showing subCategory ?? category) without the caller
// needing to know which kind of value it's holding.
export function translateTaxonomyLabel(zh: string, locale: Locale): string {
  if (locale !== "en") return zh;
  return CATEGORY_EN[zh] ?? SUB_CATEGORY_EN[zh] ?? zh;
}
