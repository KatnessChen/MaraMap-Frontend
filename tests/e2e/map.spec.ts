import { test, expect } from '@playwright/test';
import { mockHomeStatsApi } from './fixtures/homeStats';

// /map is a thin server-side redirect to `/` (see src/app/map/page.tsx) — the
// page actually under test here is home's MapView, so mock its backend calls
// the same way home.spec.ts does rather than relying on a live API. See
// CLAUDE.md's "E2E tests must never depend on a real backend".
test.describe('Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeStatsApi(page);
    await page.goto('/map');
  });

  test('redirects to the home page', async ({ page }) => {
    await expect(page).toHaveURL('/');
  });

  test('renders the map container after redirect', async ({ page }) => {
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('renders map markers from the mocked location data', async ({ page }) => {
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  });
});
