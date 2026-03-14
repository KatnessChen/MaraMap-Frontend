import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load home page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/MaraMap|Next.js/i);
    
    // Check for main heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Mara');
  });

  test('should display header with navigation', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    // Check for Explore Map button
    const mapButton = page.locator('a:has-text("Explore Map")');
    await expect(mapButton).toBeVisible();
  });

  test('should navigate to map page', async ({ page }) => {
    const mapLink = page.locator('a:has-text("Explore Map")');
    await mapLink.click();
    
    // Wait for navigation
    await page.waitForURL(/\/map/);
    expect(page.url()).toContain('/map');
  });

  test('should display post feed', async ({ page }) => {
    // Wait for posts to load
    await page.waitForSelector('article, div:has-text("MaraMap")', { timeout: 10000 });
    
    // Check if page has content
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});
