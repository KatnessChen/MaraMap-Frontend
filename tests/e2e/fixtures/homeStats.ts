// Fixture data for the "Home Page — data-driven stats" e2e suite. Three
// posts across two countries, matching what a real /api/v1/locations
// response looks like (see FlattenedPoint in src/components/MapView.tsx).

export const locations = [
  {
    id: "1",
    postId: "p1",
    lat: 35.6812,
    lng: 139.7671,
    title: "東京馬拉松",
    date: "2025-03-02",
    cat: "馬拉松",
    sub_cats: ["海外馬"],
    uri: "",
    country: "日本",
    country_en: "Japan",
  },
  {
    id: "2",
    postId: "p2",
    lat: 34.6937,
    lng: 135.5023,
    title: "大阪馬拉松",
    date: "2025-11-30",
    cat: "馬拉松",
    sub_cats: ["海外馬"],
    uri: "",
    country: "日本",
    country_en: "Japan",
  },
  {
    id: "3",
    postId: "p3",
    lat: 48.8566,
    lng: 2.3522,
    title: "巴黎鐵塔",
    date: "2025-06-10",
    cat: "旅遊",
    sub_cats: [],
    uri: "",
    country: "法國",
    country_en: "France",
  },
];

export const categories = [
  {
    name: "馬拉松",
    count: 2,
    sub_categories: [
      { name: "海外馬", count: 2 },
      { name: "九大馬", count: 0 },
    ],
  },
  { name: "旅遊", count: 1, sub_categories: [] },
  { name: "登山", count: 0, sub_categories: [] },
];

export const raceStats = { fm_count: 2 };
export const visitStats = { total_human: 100 };

// Registers mocked responses for every backend call MapView makes on mount.
// getApiBase() resolves to the page's own hostname on port 3016 in a real
// browser (see src/utils/apiBase.ts), which is what these routes match —
// /countries.geojson is left unmocked since it's a real static asset served
// by the Next.js dev server itself.
export async function mockHomeStatsApi(page: import("@playwright/test").Page) {
  await page.route("**://*:3016/api/v1/locations*", (route) => route.fulfill({ json: locations }));
  await page.route("**://*:3016/api/v1/categories", (route) => route.fulfill({ json: categories }));
  await page.route("**://*:3016/api/v1/stats?participant=Davis", (route) => route.fulfill({ json: raceStats }));
  await page.route("**://*:3016/api/v1/stats/visits", (route) => route.fulfill({ json: visitStats }));
}
