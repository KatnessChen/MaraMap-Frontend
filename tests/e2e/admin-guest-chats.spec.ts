import { test, expect, type Page } from '@playwright/test';
import { fixtureSession, fixtureSessions, fulfillAnswer, SESSION_ID, seedAdminToken } from './fixtures/adminChat';

const GUEST_LIST_API = '**://*:3016/api/v1/admin/chat/guest-sessions?*';
const GUEST_ID = '33333333-3333-4333-8333-333333333333';
const GUEST_API = `**://*:3016/api/v1/admin/chat/guest-sessions/${GUEST_ID}`;

const guestSession = (index: number, overrides = {}) => ({
  id: index === 0 ? GUEST_ID : `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
  title: `訪客問題 ${index}`,
  guest_nickname: index === 0 ? '小明' : '小華',
  last_message_at: '2026-11-05T10:00:00Z',
  archived_at: null,
  ...overrides,
});

const guestConversation = {
  ...guestSession(0),
  messages: [
    { id: 'g1', role: 'user', content: '訪客問題 0', citations: [], status: 'done', created_at: '2026-11-05T10:00:00Z' },
    {
      id: 'g2',
      role: 'assistant',
      content: '作者在東京馬拉松抽筋 [a1b2c3d4]。',
      citations: [
        {
          ref: 'a1b2c3d4',
          post_id: 'a1b2c3d4-0000-4000-8000-000000000001',
          title: '東京馬拉松',
          event_date: '2019-03-03',
          is_hidden: false,
        },
      ],
      status: 'done',
      created_at: '2026-11-05T10:00:05Z',
    },
  ],
};

async function mockAdminChat(page: Page, guests: unknown = { data: [guestSession(0)], total: 1 }) {
  await page.route('**://*:3016/api/v1/admin/chat/sessions', (route) => route.fulfill({ json: fixtureSessions }));
  await page.route(`**://*:3016/api/v1/admin/chat/sessions/${SESSION_ID}`, (route) =>
    route.fulfill({ json: fixtureSession }),
  );
  await page.route('**://*:3016/api/v1/admin/chat/sessions/*/read', (route) => route.fulfill({ json: {} }));
  await page.route(GUEST_LIST_API, (route) => route.fulfill({ json: guests }));
  await page.route(GUEST_API, (route) => route.fulfill({ json: guestConversation }));
}

const list = (page: Page) => page.getByRole('navigation', { name: '對話列表' });
const guestTab = (page: Page) => page.getByRole('button', { name: '訪客問答' }).filter({ visible: true });
const ownTab = (page: Page) => page.getByRole('button', { name: '我的對話' }).filter({ visible: true });

test.describe('Guest chats inside admin chat', () => {
  test('sends a signed-out visitor to login', async ({ page }) => {
    await page.goto(`/admin/chat/guests/${GUEST_ID}`);
    await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
  });

  test.describe('signed in', () => {
    test.beforeEach(async ({ page }) => {
      await seedAdminToken(page);
    });

    test('has no menu item of its own, and loads nothing until the section opens', async ({ page }) => {
      await mockAdminChat(page);
      let listRequests = 0;
      page.on('request', (request) => {
        if (request.url().includes('/guest-sessions')) listRequests += 1;
      });
      await page.goto('/admin/chat');
      await expect(page.getByRole('navigation', { name: '後台選單' }).getByText('訪客問答')).toHaveCount(0);
      await expect(guestTab(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(ownTab(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(list(page).getByRole('link', { name: /訪客問題/ })).toHaveCount(0);
      expect(listRequests).toBe(0);
    });

    test('lists guests with nicknames, separately from the admin conversations', async ({ page }) => {
      await mockAdminChat(page, {
        data: [guestSession(0), guestSession(1, { archived_at: '2026-11-05T11:00:00Z' })],
        total: 2,
      });
      await page.goto('/admin/chat');
      await guestTab(page).click();

      const rows = list(page).getByRole('link', { name: /訪客問題/ });
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText('小明');
      await expect(rows.nth(1)).toContainText('訪客已封存');
      await expect(list(page).getByRole('link', { name: /哪場比賽有抽筋/ })).toHaveCount(0);
      await expect(list(page).getByRole('button', { name: '載入更多' })).toHaveCount(0);

      await ownTab(page).click();
      await expect(list(page).getByRole('link', { name: /哪場比賽有抽筋/ })).toBeVisible();
      await expect(list(page).getByRole('link', { name: /訪客問題/ })).toHaveCount(0);
    });

    test('shows an empty state', async ({ page }) => {
      await mockAdminChat(page, { data: [], total: 0 });
      await page.goto('/admin/chat');
      await guestTab(page).click();
      await expect(list(page).getByText('還沒有訪客問答')).toBeVisible();
    });

    test('loads the next page after the current one', async ({ page }) => {
      await mockAdminChat(page);
      const offsets: string[] = [];
      await page.route(GUEST_LIST_API, (route) => {
        const offset = new URL(route.request().url()).searchParams.get('offset')!;
        offsets.push(offset);
        return route.fulfill({ json: { data: offset === '0' ? [guestSession(0)] : [guestSession(1)], total: 2 } });
      });
      await page.goto('/admin/chat');
      await guestTab(page).click();
      await list(page).getByRole('button', { name: '載入更多' }).click();
      await expect(list(page).getByRole('link', { name: /訪客問題/ })).toHaveCount(2);
      await expect(list(page).getByRole('button', { name: '載入更多' })).toHaveCount(0);
      expect(offsets).toEqual(['0', '1']);
    });

    test('opens a conversation read-only, with its sources', async ({ page }) => {
      await mockAdminChat(page);
      await page.goto('/admin/chat');
      await guestTab(page).click();
      await list(page).getByRole('link', { name: /訪客問題 0/ }).click();

      await expect(page).toHaveURL(new RegExp(`/admin/chat/guests/${GUEST_ID}$`));
      await expect(page.getByText('這是訪客「小明」的對話，只能查看。')).toBeVisible();
      await expect(page.getByTestId('chat-user-message').filter({ visible: true })).toHaveText('訪客問題 0');
      const answer = page.getByTestId('chat-assistant-message').filter({ visible: true });
      await expect(answer.getByRole('link', { name: '來源 1：東京馬拉松' })).toHaveAttribute(
        'href',
        '/log/a1b2c3d4-0000-4000-8000-000000000001',
      );
      await expect(page.getByLabel('輸入問題').filter({ visible: true })).toHaveCount(0);
    });

    test('a direct link opens the section and marks the conversation', async ({ page }) => {
      await mockAdminChat(page);
      await page.goto(`/admin/chat/guests/${GUEST_ID}`);
      await expect(guestTab(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(list(page).getByRole('link', { name: /訪客問題 0/ })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByText('這是訪客「小明」的對話，只能查看。')).toBeVisible();
    });

    test('says so when a conversation does not exist', async ({ page }) => {
      await mockAdminChat(page);
      await page.route(GUEST_API, (route) => route.fulfill({ status: 404, json: { statusCode: 404 } }));
      await page.goto(`/admin/chat/guests/${GUEST_ID}`);
      await expect(page.getByRole('alert').filter({ hasText: '找不到這段對話。' })).toBeVisible();
    });

    test('keeps an answer generating while a guest conversation is open', async ({ page }) => {
      await mockAdminChat(page);
      let finishAnswer = () => {};
      const answerHeld = new Promise<void>((resolve) => {
        finishAnswer = resolve;
      });
      const sent = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/admin/chat'));
      await page.route('**://*:3016/api/v1/admin/chat', async (route) => {
        await answerHeld;
        await fulfillAnswer(route, '切換後繼續生成的回答');
      });

      await page.goto(`/admin/chat/${SESSION_ID}`);
      await expect(page.getByTestId('chat-user-message').filter({ visible: true }).first()).toHaveText('哪場比賽有抽筋？');
      await page.getByLabel('輸入問題').filter({ visible: true }).fill('再問一題');
      await page.getByRole('button', { name: '送出問題' }).click();
      await sent;

      await guestTab(page).click();
      await list(page).getByRole('link', { name: /訪客問題 0/ }).click();
      await expect(page.getByText('這是訪客「小明」的對話，只能查看。')).toBeVisible();
      await ownTab(page).click();
      await expect(list(page).getByRole('link', { name: /哪場比賽有抽筋/ })).toContainText('生成中');

      await list(page).getByRole('link', { name: /哪場比賽有抽筋/ }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/chat/${SESSION_ID}$`));
      finishAnswer();
      await expect(page.getByTestId('chat-assistant-message').filter({ visible: true }).last()).toContainText(
        '切換後繼續生成的回答',
      );
    });

    test('works from the phone list without sideways scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await mockAdminChat(page);
      await page.goto('/admin/chat');
      await page.getByRole('button', { name: '開啟對話列表' }).click();
      await guestTab(page).click();
      await page.getByRole('link', { name: /訪客問題 0/ }).filter({ visible: true }).click();
      await expect(page.getByText('這是訪客「小明」的對話，只能查看。')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });
});

test('a guest on /chat never sees the section', async ({ page }) => {
  const token = `h.${Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64')}.s`;
  await page.addInitScript((value) => localStorage.setItem('maramap_chat_token', value), token);
  await page.route('**://*:3016/api/v1/chat/sessions', (route) => route.fulfill({ json: { data: [], total: 0 } }));
  await page.goto('/chat');
  await expect(page.getByLabel('輸入問題').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '訪客問答' })).toHaveCount(0);
});
