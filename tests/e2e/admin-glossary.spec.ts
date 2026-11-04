import { test, expect } from '@playwright/test';
import { mockAdminGlossaryApi, seedAdminToken } from './fixtures/adminGlossary';

test.describe('Admin glossary tables', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminToken(page);
    await mockAdminGlossaryApi(page);
    await page.goto('/admin/glossary');
  });

  test('numbers the rows and names every column', async ({ page }) => {
    const races = page.getByRole('table').first();

    await expect(races.getByRole('columnheader')).toHaveText([
      '編號',
      '中文名稱',
      '英文名稱',
      '來源',
      '審核狀態',
      '操作',
    ]);
    const rows = races.locator('tbody tr');
    await expect(rows.nth(0).locator('td').first()).toHaveText('1');
    await expect(rows.nth(1).locator('td').first()).toHaveText('2');
  });

  test('shows source and review status in separate columns', async ({ page }) => {
    const rows = page.getByRole('table').first().locator('tbody tr');

    await expect(rows.nth(0).locator('td').nth(3)).toHaveText('官方');
    await expect(rows.nth(0).locator('td').nth(4)).toHaveText('已審核');
    await expect(rows.nth(1).locator('td').nth(3)).toHaveText('AI');
    await expect(rows.nth(1).locator('td').nth(4)).toHaveText('待審核');
  });

  test('labels every source in Chinese and keeps unknown values visible', async ({ page }) => {
    const rows = page.getByRole('table').first().locator('tbody tr');

    await expect(rows.nth(2).locator('td').nth(3)).toHaveText('作者');
    await expect(rows.nth(3).locator('td').nth(3)).toHaveText('維基');
    await expect(rows.nth(4).locator('td').nth(3)).toHaveText('unknown_source');
  });

  test('renumbers from 1 when filtered', async ({ page }) => {
    await page.getByPlaceholder('搜尋中文或英文…').first().fill('田溪水');

    const rows = page.getByRole('table').first().locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').first()).toHaveText('1');
  });

  test('switches between race, mountain and city tabs', async ({ page }) => {
    const panel = (name: string) => page.getByRole('tabpanel', { name });

    await expect(page.getByRole('tab')).toHaveText(['賽事', '山岳', '城市']);
    await expect(panel('賽事')).toBeVisible();
    await expect(panel('城市')).toBeHidden();

    await page.getByRole('tab', { name: '城市' }).click();

    await expect(page).toHaveURL(/tab=cities$/);
    await expect(panel('城市')).toBeVisible();
    await expect(panel('賽事')).toBeHidden();

    await page.reload();
    await expect(panel('城市')).toBeVisible();
    await expect(page.getByRole('tab', { name: '城市' })).toHaveAttribute('aria-selected', 'true');
  });

  test('keeps a typed search when switching tabs', async ({ page }) => {
    await page.getByPlaceholder('搜尋中文或英文…').first().fill('田溪水');
    await page.getByRole('tab', { name: '山岳' }).click();
    await page.getByRole('tab', { name: '賽事' }).click();

    await expect(page.getByPlaceholder('搜尋中文或英文…').first()).toHaveValue('田溪水');
  });

  test('moves between tabs with the arrow keys', async ({ page }) => {
    await page.getByRole('tab', { name: '賽事' }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByRole('tab', { name: '山岳' })).toBeFocused();
    await expect(page.getByRole('tab', { name: '山岳' })).toHaveAttribute('aria-selected', 'true');
  });

  test('no longer shows the metadata key explanation', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /賽事名稱/ })).toBeVisible();
    await expect(page.getByText('鍵值須與文章')).toHaveCount(0);
  });
});
