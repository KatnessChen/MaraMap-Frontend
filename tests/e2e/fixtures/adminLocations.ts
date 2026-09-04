// Fixture for the admin location-translations e2e suite.

export const fixtureCountries = [
  { zh: "台灣", en: "Taiwan" },
  { zh: "日本", en: "Japan" },
];

export const fixtureCities = [
  { country_zh: "台灣", zh: "台北", en: "Taipei" },
  { country_zh: "日本", zh: "東京", en: "Tokyo" },
];

// Re-exported from the sibling fixture rather than duplicated — both admin
// suites need the same fake-JWT shape useAdminAuth's isTokenExpired() checks.
export { seedAdminToken, makeFakeAdminToken } from "./adminEditPost";
