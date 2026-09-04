import { test, expect } from '@playwright/test';
import { fixtureCountries, fixtureCities, seedAdminToken } from './fixtures/adminLocations';

const LOCATIONS_PATH = '/admin/locations';
const COUNTRIES_API_PATTERN = '**://*:3016/api/v1/admin/location-translations/countries*';
const CITIES_API_PATTERN = '**://*:3016/api/v1/admin/location-translations/cities*';

// Countries have no management UI on this page at all — the country GET
// endpoint is only fetched to populate the city form's "所屬國家" dropdown.
// Country names are locked (create-only, GeoJSON-constrained) at the API
// level; see docs/I18N_PLAN.md's "國家名稱鎖定編輯".

async function mockLists(page: import('@playwright/test').Page) {
  await page.route(COUNTRIES_API_PATTERN, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: fixtureCountries });
    }
    return route.continue();
  });
  await page.route(CITIES_API_PATTERN, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: fixtureCities });
    }
    return route.continue();
  });
}

test.describe('Admin locations page — auth guard', () => {
  test('redirects to login with the current path when no token is stored', async ({ page }) => {
    await page.goto(LOCATIONS_PATH);
    await page.waitForURL(`**/admin/login?redirect=${encodeURIComponent(LOCATIONS_PATH)}`);
  });
});

test.describe('Admin locations page — loaded with a valid session', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminToken(page);
    await mockLists(page);
  });

  test('loads and displays the city list, with countries only as the picker options', async ({ page }) => {
    await page.goto(LOCATIONS_PATH);
    await expect(page.getByText('城市', { exact: false }).first()).toBeVisible();
    for (const c of fixtureCities) {
      await expect(page.locator('tr', { hasText: c.zh }).first()).toBeVisible();
    }
    // No standalone country table — country names only surface as options in
    // the "所屬國家" combobox's dropdown once it's focused (it's a searchable
    // text input + button list, not a native <select> — see CountryCombobox
    // in admin/locations/page.tsx).
    await page.getByPlaceholder('所屬國家').click();
    for (const c of fixtureCountries) {
      await expect(page.getByRole('button', { name: c.zh, exact: true })).toBeVisible();
    }
  });

  test('adds a new city under an existing country', async ({ page }) => {
    let postBody: unknown = null;
    await page.route(CITIES_API_PATTERN, async (route) => {
      if (route.request().method() === 'POST') {
        postBody = route.request().postDataJSON();
        return route.fulfill({ json: { country_zh: '日本', zh: '大阪', en: 'Osaka' } });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: fixtureCities });
      }
      return route.continue();
    });

    await page.goto(LOCATIONS_PATH);
    await page.getByPlaceholder('所屬國家').click();
    await page.getByRole('button', { name: '日本', exact: true }).click();
    await page.getByPlaceholder('中文城市名').fill('大阪');
    await page.getByPlaceholder('English name').fill('Osaka');
    await page.getByRole('button', { name: '新增' }).click();

    await expect(page.getByText('已新增「大阪」')).toBeVisible();
    expect(postBody).toEqual({ countryZh: '日本', zh: '大阪', en: 'Osaka' });
  });

  test("edits an existing city's English name", async ({ page }) => {
    let postBody: unknown = null;
    await page.route(CITIES_API_PATTERN, async (route) => {
      if (route.request().method() === 'POST') {
        postBody = route.request().postDataJSON();
        return route.fulfill({ json: { country_zh: '台灣', zh: '台北', en: 'Taipei City' } });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: fixtureCities });
      }
      return route.continue();
    });

    await page.goto(LOCATIONS_PATH);
    const row = page.locator('tr', { hasText: '台北' }).first();
    await row.locator('input').fill('Taipei City');
    await row.getByTitle('儲存').click();

    await expect(page.getByText('已更新「台北」')).toBeVisible();
    expect(postBody).toEqual({ countryZh: '台灣', zh: '台北', en: 'Taipei City' });
  });

  test('deletes a city after confirming the browser dialog', async ({ page }) => {
    let deleteCalled = false;
    page.on('dialog', (dialog) => dialog.accept());
    await page.route(CITIES_API_PATTERN, async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        return route.fulfill({ status: 200, json: {} });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: fixtureCities });
      }
      return route.continue();
    });

    await page.goto(LOCATIONS_PATH);
    const row = page.locator('tr', { hasText: '東京' }).first();
    await row.getByTitle('刪除').click();

    await expect(page.getByText('已刪除「東京」')).toBeVisible();
    expect(deleteCalled).toBe(true);
    await expect(page.locator('tr', { hasText: '東京' })).toHaveCount(0);
  });
});

test.describe('Admin locations page — session expires mid-visit', () => {
  test('a 401 while loading clears the token and redirects to login', async ({ page }) => {
    await seedAdminToken(page);
    await page.route(COUNTRIES_API_PATTERN, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
    );
    await page.route(CITIES_API_PATTERN, (route) => route.fulfill({ json: fixtureCities }));

    await page.goto(LOCATIONS_PATH);
    await page.waitForURL('**/admin/login');
    expect(await page.evaluate(() => localStorage.getItem('maramap_admin_token'))).toBeNull();
  });
});
