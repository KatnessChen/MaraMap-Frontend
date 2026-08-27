import { test, expect } from '@playwright/test';
import { mockHomeStatsApi, locations } from './fixtures/homeStats';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load home page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/MaraMap|Next.js/i);
  });

  test('should display sidebar with branding', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Davis & Rose');
    await expect(sidebar).toContainText('環球跑旅');
  });

  test('should display stat tiles', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('button', { hasText: '全馬' })).toBeVisible();
    await expect(sidebar.locator('button', { hasText: '百岳' })).toBeVisible();
  });

  test('should display visited countries section', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toContainText('已到訪國家');
  });
});

// Unlike the tests above (which only check static labels are present and
// pass whether or not real data ever loads), these mock the backend so the
// numbers themselves are verified — this is the class of bug docs/TODO.md
// already caught once: a value computed correctly but never reaching the
// screen.
test.describe('Home Page — data-driven stats (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeStatsApi(page);
    await page.goto('/');
  });

  test('shows the distinct visited-country count, not the post count', async ({ page }) => {
    // 3 posts, but only 2 distinct countries (Japan x2, France x1).
    const countryTile = page.locator('aside button', { hasText: '已到訪國家' });
    await expect(countryTile).toContainText('2');
  });

  test('shows the total post count across all categories', async ({ page }) => {
    const allPostsTile = page.locator('aside button', { hasText: '所有文章' });
    await expect(allPostsTile).toContainText('3');
  });

  test('shows the overseas-marathon count from the categories endpoint', async ({ page }) => {
    // "海外馬" also matches the hero's "海外馬拉松" secondary stat — match the
    // grid tile's exact accessible name instead of a loose substring.
    const overseasTile = page.getByRole('button', { name: '2 場 海外馬', exact: true });
    await expect(overseasTile).toBeVisible();
  });

  test('renders map markers from the mocked location data', async ({ page }) => {
    // Not asserting an exact count: Tokyo and Osaka are close enough to
    // cluster into one icon at world zoom, so the true count depends on
    // MarkerClusterGroup's radius, not just how many points were fetched.
    // The real thing under test is "did the fetched data reach Leaflet at
    // all" — toBeVisible() auto-waits for that, unlike a raw .count() snapshot.
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    const markerCount = await page.locator('.leaflet-marker-icon').count();
    expect(markerCount).toBeLessThanOrEqual(locations.length);
  });
});
