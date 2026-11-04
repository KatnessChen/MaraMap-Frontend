// Fixture for the admin glossary e2e suite.
import type { Page } from "@playwright/test";

export { seedAdminToken } from "./adminEditPost";

export const fixtureRaces = [
  { zh: "東京馬拉松", en: "Tokyo Marathon", source: "official", needs_review: false },
  { zh: "田溪水超馬", en: "Tianxishui Ultramarathon", source: "machine", needs_review: true },
  { zh: "台北馬拉松", en: "Taipei Marathon", source: "human", needs_review: false },
  { zh: "柏林馬拉松", en: "Berlin Marathon", source: "wikipedia", needs_review: false },
  { zh: "測試賽事", en: "Test Race", source: "unknown_source", needs_review: false },
];

export async function mockAdminGlossaryApi(page: Page): Promise<void> {
  await page.route("**://*:3016/api/v1/admin/translations/races**", (route) =>
    route.fulfill({ json: fixtureRaces }),
  );
  await page.route("**://*:3016/api/v1/admin/location-translations/**", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**://*:3016/api/v1/admin/translations/mountains**", (route) =>
    route.fulfill({ json: [] }),
  );
}
