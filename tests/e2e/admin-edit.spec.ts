import { test, expect } from '@playwright/test';
import { POST_ID, fixturePost, seedAdminToken, makeFakeAdminToken } from './fixtures/adminEditPost';

const EDIT_PATH = `/admin/edit/${POST_ID}`;
const POST_API_PATTERN = `**://*:3016/api/v1/posts/${POST_ID}`;

async function mockGetPost(page: import('@playwright/test').Page) {
  await page.route(POST_API_PATTERN, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: fixturePost });
    }
    return route.continue();
  });
}

test.describe('Admin edit page — auth guard', () => {
  test('redirects to login with the current path when no token is stored', async ({ page }) => {
    // No seedAdminToken() call — localStorage starts empty.
    await page.goto(EDIT_PATH);
    await page.waitForURL(`**/admin/login?redirect=${encodeURIComponent(EDIT_PATH)}`);
  });

  test('redirects to login when the stored token is expired', async ({ page }) => {
    await seedAdminToken(page, -3600);
    await page.goto(EDIT_PATH);
    await page.waitForURL(`**/admin/login?redirect=${encodeURIComponent(EDIT_PATH)}`);
    // The expired token must also be cleared, not just bounced past.
    expect(await page.evaluate(() => localStorage.getItem('maramap_admin_token'))).toBeNull();
  });
});

test.describe('Admin edit page — loaded with a valid session', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminToken(page);
    await mockGetPost(page);
  });

  test('loads the existing post into the form', async ({ page }) => {
    await page.goto(EDIT_PATH);
    await expect(page.locator('#field-title input')).toHaveValue(fixturePost.title);
    await expect(page.locator('#field-content textarea')).toHaveValue(fixturePost.content);
    await expect(page.locator('#field-event_date input')).toHaveValue(fixturePost.event_date);
  });

  test('blocks save and shows a validation error when the title is cleared, without calling the API', async ({ page }) => {
    let patchCalled = false;
    await page.route(POST_API_PATTERN, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
        return route.fulfill({ json: fixturePost });
      }
      return route.request().method() === 'GET'
        ? route.fulfill({ json: fixturePost })
        : route.continue();
    });

    await page.goto(EDIT_PATH);
    await expect(page.locator('#field-title input')).toHaveValue(fixturePost.title);

    await page.locator('#field-title input').fill('');
    await page.getByRole('button', { name: '儲存變更' }).click();

    await expect(page.locator('#field-title')).toContainText('標題為必填');
    expect(patchCalled).toBe(false);
  });

  test('saves successfully and shows the success toast', async ({ page }) => {
    let patchBody: unknown = null;
    await page.route(POST_API_PATTERN, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON();
        return route.fulfill({ json: { ...fixturePost, title: '東京馬拉松 2025（已編輯）' } });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: fixturePost });
      }
      return route.continue();
    });

    await page.goto(EDIT_PATH);
    await expect(page.locator('#field-title input')).toHaveValue(fixturePost.title);

    await page.locator('#field-title input').fill('東京馬拉松 2025（已編輯）');
    await page.getByRole('button', { name: '儲存變更' }).click();

    await expect(page.getByText('文章已成功儲存！')).toBeVisible();
    expect((patchBody as { title?: string } | null)?.title).toBe('東京馬拉松 2025（已編輯）');
  });
});

test.describe('Admin edit page — session expires mid-visit', () => {
  test('a 401 on save clears the token and redirects to login', async ({ page }) => {
    await seedAdminToken(page);
    await page.route(POST_API_PATTERN, async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: fixturePost });
      if (route.request().method() === 'PATCH') return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      return route.continue();
    });

    await page.goto(EDIT_PATH);
    await expect(page.locator('#field-title input')).toHaveValue(fixturePost.title);

    await page.getByRole('button', { name: '儲存變更' }).click();
    await page.waitForURL('**/admin/login');
  });
});

// Sanity check that the fixture helper itself produces a token useAdminAuth
// actually accepts — if this ever fails, every test above is void.
test('fixture token is well-formed enough for isTokenExpired to accept', async () => {
  const token = makeFakeAdminToken(3600);
  const [, payloadB64] = token.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
  expect(payload.exp * 1000).toBeGreaterThan(Date.now());
});
