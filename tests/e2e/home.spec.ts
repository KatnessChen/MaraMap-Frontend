import { test, expect } from '@playwright/test';

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
