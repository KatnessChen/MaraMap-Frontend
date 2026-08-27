// Fixture for the admin edit-post e2e suite. Deliberately valid/complete
// (cover_image set, all required fields filled) so a save with no edits
// exercises the plain success path rather than the "missing cover image"
// warning-confirmation step (see validate() in admin/edit/[id]/page.tsx).

export const POST_ID = "test-post-1";

export const fixturePost = {
  id: POST_ID,
  title: "東京馬拉松 2025",
  event_date: "2025-03-02",
  content: "今年天氣很好，PB 了！",
  category: "馬拉松",
  sub_categories: ["海外馬"],
  tags: ["東京", "全馬"],
  is_hidden: false,
  is_personal_best: true,
  cover_image: "https://example.com/cover.jpg",
  trip_id: null,
  media: [],
  metadata: {
    race_name: "Tokyo Marathon",
    continent: "亞洲",
    country: "日本",
    city: "東京",
    trip_id: null,
    mountains: [],
    participants: [],
    fallback_lat: 35.6812,
    fallback_lng: 139.7671,
  },
};

// A fake but well-formed JWT with a future `exp`, matching what
// useAdminAuth's isTokenExpired() checks — see src/hooks/useAdminAuth.ts.
export function makeFakeAdminToken(expiresInSeconds = 3600): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "admin", exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  return `${header}.${payload}.fakesig`;
}

export async function seedAdminToken(page: import("@playwright/test").Page, expiresInSeconds = 3600) {
  await page.addInitScript((token) => {
    window.localStorage.setItem("maramap_admin_token", token);
  }, makeFakeAdminToken(expiresInSeconds));
}
