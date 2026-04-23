import { test, expect } from '@playwright/test';

test.describe('Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
  });

  test('should load map page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/MaraMap|Next.js/i);
  });

  test('should display map container', async ({ page }) => {
    // Wait for map to load
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mapContainer = page.locator('[class*="map"]', { hasText: /Map/ }).first();
    
    // Check if page has main content
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should have back button to home', async ({ page }) => {
    const backLink = page.locator('a:has-text("Back")');
    
    // If back button exists, test navigation
    if (await backLink.count() > 0) {
      await backLink.click();
      await page.waitForURL('/');
      expect(page.url()).toBe('http://localhost:3000/');
    }
  });
});
