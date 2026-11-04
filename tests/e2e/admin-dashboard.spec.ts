import { test, expect, type Page } from '@playwright/test';
import { mockAdminDashboardApi, seedAdminToken } from './fixtures/adminDashboard';

const MENU_ITEMS = ['文章管理', '新增文章', '足跡問答', '匯入資料', '譯名管理', '回網站首頁', '登出'];

function adminMenu(page: Page) {
  return page.getByRole('navigation', { name: '後台選單' });
}

test.describe('Admin dashboard menu', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminToken(page);
    await mockAdminDashboardApi(page);
  });

  for (const width of [640, 768, 1024, 1280]) {
    test(`shows every label without breaking it at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/admin');

      await expect(page.getByRole('button', { name: '開啟選單' })).toBeHidden();
      const items = adminMenu(page).locator('a, button');
      await expect(items).toHaveCount(MENU_ITEMS.length);
      for (const [index, label] of MENU_ITEMS.entries()) {
        await expect(items.nth(index)).toBeVisible();
        await expect(items.nth(index)).toHaveText(label);
      }

      const boxes = await items.evaluateAll((elements) =>
        elements.map((element) => {
          const { right, height } = element.getBoundingClientRect();
          return { right, height };
        }),
      );
      const headerRight = await page
        .locator('header')
        .first()
        .evaluate((header) => header.getBoundingClientRect().right);
      for (const box of boxes) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeLessThan(50);
        expect(box.right).toBeLessThanOrEqual(headerRight + 0.5);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  for (const width of [320, 375, 639]) {
    test(`uses a hamburger menu at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/admin');

      await expect(adminMenu(page)).toBeHidden();
      const open = page.getByRole('button', { name: '開啟選單' });
      await expect(open).toHaveAttribute('aria-expanded', 'false');
      const { width: tapWidth, height: tapHeight } = (await open.boundingBox())!;
      expect(tapWidth).toBeGreaterThanOrEqual(44);
      expect(tapHeight).toBeGreaterThanOrEqual(44);

      await open.click();

      const close = page.getByRole('button', { name: '關閉選單' });
      await expect(close).toHaveAttribute('aria-expanded', 'true');
      for (const name of MENU_ITEMS.slice(0, -1)) {
        await expect(adminMenu(page).getByRole('link', { name })).toBeVisible();
      }
      await expect(adminMenu(page).getByRole('button', { name: '登出' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      await close.click();
      await expect(adminMenu(page)).toBeHidden();
    });
  }

  test('stays on every admin page and marks the current one', async ({ page }) => {
    await page.route('**://*:3016/api/v1/admin/chat/sessions', (route) => route.fulfill({ json: { data: [], total: 0 } }));
    // These pages render lists, so they can't take the dashboard's posts response.
    for (const list of ['admin/translations/*', 'admin/location-translations/**', 'admin/fb-import/**']) {
      await page.route(`**://*:3016/api/v1/${list}`, (route) => route.fulfill({ json: [] }));
    }
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const [path, label] of [
      ['/admin', '文章管理'],
      ['/admin/glossary', '譯名管理'],
      ['/admin/new', '新增文章'],
      ['/admin/import', '匯入資料'],
      ['/admin/chat', '足跡問答'],
    ]) {
      await page.goto(path);
      await expect(adminMenu(page).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
      await expect(adminMenu(page).getByRole('button', { name: '登出' })).toBeVisible();
    }
  });

  test('keeps the chat input on screen below the menu', async ({ page }) => {
    await page.route('**://*:3016/api/v1/admin/chat/sessions', (route) => route.fulfill({ json: { data: [], total: 0 } }));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/chat');

    const input = page.getByLabel('輸入問題');
    await expect(input).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
  });

  test('stays visible while scrolling a long page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto('/admin/new');
    await expect(adminMenu(page)).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 2000));

    await expect(adminMenu(page)).toBeInViewport();
  });

  test('signing out leaves the menu behind', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin');
    await adminMenu(page).getByRole('button', { name: '登出' }).click();

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(adminMenu(page)).toHaveCount(0);
  });

  test('the phone menu floats over the page without moving it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/admin');
    const heading = page.getByRole('heading', { name: '文章管理' });
    // The bar only appears once the page has read the stored token.
    const open = page.getByRole('button', { name: '開啟選單' });
    await expect(open).toBeVisible();
    const before = (await heading.boundingBox())!.y;

    await open.click();
    await expect(adminMenu(page)).toBeVisible();

    expect((await heading.boundingBox())!.y).toBe(before);
    await page.mouse.click(180, 780);
    await expect(adminMenu(page)).toBeHidden();
  });

  test('shows the admin name and uses the Chinese sans font for English', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByText('MaraMap 後台')).toBeVisible();
    const font = await page.getByRole('heading', { name: '文章管理' }).evaluate(() => {
      const probe = document.createElement('span');
      probe.className = 'font-mono';
      document.querySelector('[data-admin]')?.append(probe);
      return getComputedStyle(probe).fontFamily;
    });
    expect(font).toContain('Noto Sans TC');
    expect(font).not.toContain('JetBrains');
  });

  test('menu items read as text links, not buttons', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin');
    const item = adminMenu(page).getByRole('link', { name: '新增文章' });

    await expect(item).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(item).toHaveCSS('border-top-left-radius', '0px');
    await expect(adminMenu(page).getByRole('link', { name: '回網站首頁' })).toHaveAttribute('href', '/');
  });

  test('every admin page shares the same width and heading style', async ({ page }) => {
    for (const list of ['admin/translations/*', 'admin/location-translations/**', 'admin/fb-import/**']) {
      await page.route(`**://*:3016/api/v1/${list}`, (route) => route.fulfill({ json: [] }));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const measured = [];
    for (const path of ['/admin', '/admin/new', '/admin/import', '/admin/personal-best', '/admin/glossary']) {
      await page.goto(path);
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
      measured.push(
        await heading.evaluate((element) => {
          const header = element.closest('header')!;
          const { left, width } = header.getBoundingClientRect();
          const { fontSize, fontFamily } = getComputedStyle(element);
          return { left, width, fontSize, fontFamily, border: getComputedStyle(header).borderBottomWidth };
        }),
      );
    }
    for (const result of measured) expect(result).toEqual(measured[0]);
  });

  test('Escape closes the hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/admin');

    await page.getByRole('button', { name: '開啟選單' }).click();
    await expect(adminMenu(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(adminMenu(page)).toBeHidden();
  });
});
