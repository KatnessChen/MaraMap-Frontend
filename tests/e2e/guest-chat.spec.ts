import { test, expect, type Page } from '@playwright/test';
import { fixtureSession, fixtureSessions, fulfillAnswer, SESSION_ID } from './fixtures/adminChat';

const LOGIN_API = '**://*:3016/api/v1/auth/chat-guest';
const CHAT_API = '**://*:3016/api/v1/chat';
const SESSIONS_API = '**://*:3016/api/v1/chat/sessions';
const FUTURE_EXP = 4102444800;
const GUEST_TOKEN = `h.${Buffer.from(JSON.stringify({ exp: FUTURE_EXP })).toString('base64')}.s`;

async function mockSessions(page: Page, sessions: unknown = { data: [], total: 0 }) {
  await page.route(SESSIONS_API, (route) => route.fulfill({ json: sessions }));
  await page.route(`${SESSIONS_API}/*/read`, (route) => route.fulfill({ json: {} }));
}

const seedGuestToken = (page: Page) =>
  page.addInitScript((token) => localStorage.setItem('maramap_chat_token', token), GUEST_TOKEN);

test.describe('Guest chat page — passcode', () => {
  test('asks for a passcode and accepts digits only', async ({ page }) => {
    await page.goto('/chat');
    const input = page.getByLabel('數字密碼');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(input).toHaveAttribute('type', 'password');
    await input.pressSequentially('11a1');
    await expect(input).toHaveValue('111');
    await expect(page).toHaveURL(/\/chat$/);
  });

  test('needs both a nickname and a passcode, and says the chat is saved', async ({ page }) => {
    await page.goto('/chat');
    const enter = page.getByRole('button', { name: '進入' });
    await expect(enter).toBeDisabled();
    await page.getByLabel('數字密碼').fill('111111');
    await expect(enter).toBeDisabled();
    await page.getByLabel('暱稱').fill('   ');
    await expect(enter).toBeDisabled();
    await page.getByLabel('暱稱').fill('小明');
    await expect(enter).toBeEnabled();
    await expect(page.getByLabel('暱稱')).toHaveAttribute('maxlength', '20');
    await expect(page.getByText('問答內容會保存，網站管理者可以查看。')).toBeVisible();
  });

  test('keeps the passcode when only the nickname is rejected', async ({ page }) => {
    await page.route(LOGIN_API, (route) => route.fulfill({ status: 400, json: { statusCode: 400 } }));
    await page.goto('/chat');
    await page.getByLabel('暱稱').fill('小明');
    await page.getByLabel('數字密碼').fill('111111');
    await page.getByRole('button', { name: '進入' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '暱稱不能使用' })).toBeVisible();
    await expect(page.getByLabel('數字密碼')).toHaveValue('111111');
  });

  test('tells search engines not to index it, without blocking them from reading that', async ({ page, request }) => {
    await page.goto('/chat');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).not.toMatch(/Disallow: \/chat/);
  });

  test('shows an error for a wrong passcode and stays on the form', async ({ page }) => {
    await page.route(LOGIN_API, (route) => route.fulfill({ status: 401, json: { statusCode: 401 } }));
    await page.goto('/chat');
    await page.getByLabel('暱稱').fill('小明');
    await page.getByLabel('數字密碼').fill('000000');
    await page.getByRole('button', { name: '進入' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '密碼不正確，請再試一次。' })).toBeVisible();
    await expect(page.getByLabel('數字密碼')).toHaveValue('');
  });

  test('tells the user to wait after too many attempts', async ({ page }) => {
    await page.route(LOGIN_API, (route) => route.fulfill({ status: 429, json: { statusCode: 429 } }));
    await page.goto('/chat');
    await page.getByLabel('暱稱').fill('小明');
    await page.getByLabel('數字密碼').fill('000000');
    await page.getByRole('button', { name: '進入' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '嘗試太多次了，請一分鐘後再試。' })).toBeVisible();
  });

  test('the right passcode opens chat, and it stays open after a reload', async ({ page }) => {
    let loginBody: unknown;
    await page.route(LOGIN_API, (route) => {
      loginBody = route.request().postDataJSON();
      return route.fulfill({ json: { token: GUEST_TOKEN, nickname: '小明' } });
    });
    await mockSessions(page);
    await page.goto('/chat');
    await page.getByLabel('暱稱').fill('  小明  ');
    await page.getByLabel('數字密碼').fill('111111');
    await page.getByRole('button', { name: '進入' }).click();

    await expect(page.getByLabel('輸入問題')).toBeVisible();
    await expect(page.getByRole('banner').getByText('小明')).toBeVisible();
    expect(loginBody).toEqual({ passcode: '111111', nickname: '小明' });

    await page.reload();
    await expect(page.getByLabel('輸入問題')).toBeVisible();
    await expect(page.getByRole('banner').getByText('小明')).toBeVisible();
    await expect(page.getByLabel('數字密碼')).toHaveCount(0);
  });
});

test.describe('Guest chat page', () => {
  test.beforeEach(async ({ page }) => {
    await seedGuestToken(page);
  });

  test('has no admin menu and uses the guest API with public links', async ({ page }) => {
    await mockSessions(page);
    let authorization: string | undefined;
    await page.route(CHAT_API, (route) => {
      authorization = route.request().headers().authorization;
      return fulfillAnswer(route, '作者在東京馬拉松抽筋 [a1b2c3d4]。', [
        {
          ref: 'a1b2c3d4',
          post_id: 'a1b2c3d4-0000-4000-8000-000000000001',
          title: '東京馬拉松',
          event_date: '2019-03-03',
          is_hidden: false,
        },
      ]);
    });

    await page.goto('/chat');
    await expect(page.getByText('MaraMap 後台')).toHaveCount(0);
    await page.getByLabel('輸入問題').fill('哪場比賽有抽筋？');
    await page.getByRole('button', { name: '送出問題' }).click();

    const answer = page.getByTestId('chat-assistant-message');
    await expect(answer.getByRole('link', { name: '來源 1：東京馬拉松' })).toHaveAttribute(
      'href',
      '/log/a1b2c3d4-0000-4000-8000-000000000001',
    );
    expect(authorization).toBe(`Bearer ${GUEST_TOKEN}`);
  });

  test('opens a saved conversation at its own address', async ({ page }) => {
    await mockSessions(page, fixtureSessions);
    await page.route(`${SESSIONS_API}/${SESSION_ID}`, (route) => route.fulfill({ json: fixtureSession }));
    await page.goto('/chat');
    await page.getByRole('link', { name: '哪場比賽有抽筋？' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/chat/${SESSION_ID}$`));
    await expect(page.getByTestId('chat-assistant-message')).toContainText('作者在東京馬拉松抽筋');
  });

  test('shows the daily limit message when the budget is used up', async ({ page }) => {
    await mockSessions(page);
    await page.route(CHAT_API, (route) =>
      route.fulfill({
        status: 429,
        json: { statusCode: 429, message: '今天的問答次數用完了，明天再來問吧。' },
      }),
    );
    await page.goto('/chat');
    await page.getByLabel('輸入問題').fill('問題');
    await page.getByRole('button', { name: '送出問題' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '今天的問答次數用完了，明天再來問吧。' })).toBeVisible();
  });

  test('goes back to the passcode form when the token stops working', async ({ page }) => {
    await page.route(SESSIONS_API, (route) => route.fulfill({ status: 401, json: { statusCode: 401 } }));
    await page.goto('/chat');
    await expect(page.getByLabel('數字密碼')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('maramap_chat_token'))).toBeNull();
  });
});
