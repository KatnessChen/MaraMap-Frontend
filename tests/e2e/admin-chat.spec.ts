import { test, expect, type Page } from '@playwright/test';
import {
  SECOND_SESSION_ID,
  secondFixtureSession,
  SESSION_ID,
  twoFixtureSessions,
  fixtureCitation,
  fixtureSession,
  fixtureSessions,
  fulfillAnswer,
  seedAdminToken,
} from './fixtures/adminChat';

const CHAT_API = '**://*:3016/api/v1/admin/chat';
const SESSIONS_API = '**://*:3016/api/v1/admin/chat/sessions';
const SESSION_API = `**://*:3016/api/v1/admin/chat/sessions/${SESSION_ID}`;

async function mockSessions(page: Page) {
  await page.route(SESSIONS_API, (route) => route.fulfill({ json: fixtureSessions }));
  await page.route(SESSION_API, (route) => route.fulfill({ json: fixtureSession }));
  await page.route('**://*:3016/api/v1/admin/chat/sessions/*/read', (route) => route.fulfill({ json: {} }));
}

test.describe('Admin chat page — auth guard', () => {
  test('redirects to login with the current path when no token is stored', async ({ page }) => {
    await page.goto('/admin/chat');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fchat/);
  });
});

test.describe('Admin chat page', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminToken(page);
    await mockSessions(page);
  });

  test('sends only the question, then shows the answer with a linked source', async ({ page }) => {
    let requestBody: unknown;
    let authorization: string | undefined;
    await page.route(CHAT_API, (route) => {
      requestBody = route.request().postDataJSON();
      authorization = route.request().headers().authorization;
      return fulfillAnswer(route, '作者在東京馬拉松抽筋 [a1b2c3d4]，還有編造的 [deadbeef]。');
    });

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('哪場比賽有抽筋？');
    await page.getByRole('button', { name: '送出問題' }).click();

    const answer = page.getByTestId('chat-assistant-message');
    await expect(answer).toContainText('作者在東京馬拉松抽筋');
    await expect(answer).not.toContainText('a1b2c3d4');
    await expect(answer).not.toContainText('deadbeef');
    await expect(answer.getByRole('link', { name: '來源 1：東京馬拉松' })).toHaveAttribute(
      'href',
      `/admin/edit/${fixtureCitation.post_id}`,
    );
    await expect(answer.getByRole('link', { name: '來源 1：東京馬拉松' })).toHaveAttribute('target', '_blank');
    await answer.getByText('來源文章（1）').click();
    await expect(answer.getByText('隱藏')).toBeVisible();
    expect(requestBody).toEqual({ question: '哪場比賽有抽筋？' });
    expect(authorization).toMatch(/^Bearer /);
  });

  test('opens a public post on its public page in a new tab', async ({ page }) => {
    const publicPost = { ...fixtureCitation, is_hidden: false };
    await page.route(CHAT_API, (route) => fulfillAnswer(route, '作者在東京馬拉松抽筋 [a1b2c3d4]。', [publicPost]));

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('哪場比賽有抽筋？');
    await page.getByRole('button', { name: '送出問題' }).click();

    const answer = page.getByTestId('chat-assistant-message');
    await answer.getByText('來源文章（1）').click();
    const links = answer.getByRole('link');
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('href', `/log/${publicPost.post_id}`);
      await expect(link).toHaveAttribute('target', '_blank');
    }
    await expect(answer.getByText('隱藏')).toHaveCount(0);
  });

  test('replaces an answer the safety filter cut off', async ({ page }) => {
    await page.route(CHAT_API, (route) =>
      fulfillAnswer(route, '我無法', [], { replacementText: '這個問題我無法回答。' }),
    );

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('不適合的問題');
    await page.getByRole('button', { name: '送出問題' }).click();

    await expect(page.getByTestId('chat-assistant-message')).toHaveText('這個問題我無法回答。');
  });

  test("shows the author's quoted words in a quote block", async ({ page }) => {
    await page.route(CHAT_API, (route) =>
      fulfillAnswer(route, '作者這樣寫：\n> 跑到 30K 雙腿開始抽筋 [a1b2c3d4]\n之後走到終點。'),
    );

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('那場比賽怎麼了？');
    await page.getByRole('button', { name: '送出問題' }).click();

    const quote = page.getByTestId('chat-assistant-message').locator('blockquote');
    await expect(quote).toContainText('跑到 30K 雙腿開始抽筋');
    await expect(quote).not.toContainText('>');
    await expect(quote.getByRole('link', { name: '來源 1：東京馬拉松' })).toBeVisible();
    await expect(page.getByTestId('chat-assistant-message')).toContainText('之後走到終點。');
  });

  test('moves a new conversation to its own URL and continues it', async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route(CHAT_API, (route) => {
      bodies.push(route.request().postDataJSON());
      return fulfillAnswer(route, '回答內容');
    });

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('第一題');
    await page.getByLabel('輸入問題').press('Enter');
    await expect(page.getByTestId('chat-assistant-message')).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`/admin/chat/${SESSION_ID}$`));

    await page.getByLabel('輸入問題').fill('追問');
    await page.getByLabel('輸入問題').press('Enter');
    await expect(page.getByTestId('chat-assistant-message')).toHaveCount(2);
    expect(bodies[1]).toEqual({ sessionId: SESSION_ID, question: '追問' });
  });

  test('Shift+Enter adds a line instead of sending', async ({ page }) => {
    let sent = false;
    await page.route(CHAT_API, (route) => {
      sent = true;
      return fulfillAnswer(route, '回答內容');
    });

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('第一行');
    await page.getByLabel('輸入問題').press('Shift+Enter');

    await expect(page.getByLabel('輸入問題')).toHaveValue('第一行\n');
    expect(sent).toBe(false);
  });

  test('a suggested question can be asked with one tap', async ({ page }) => {
    await page.route(CHAT_API, (route) => fulfillAnswer(route, '回答內容'));

    await page.goto('/admin/chat');
    await page.getByRole('button', { name: '哪幾場比賽有提到抽筋？' }).click();

    await expect(page.getByTestId('chat-user-message')).toHaveText('哪幾場比賽有提到抽筋？');
  });

  test('opening a saved conversation shows its messages and sources', async ({ page }) => {
    await page.goto(`/admin/chat/${SESSION_ID}`);

    await expect(page.getByTestId('chat-user-message')).toHaveText('哪場比賽有抽筋？');
    await expect(
      page.getByTestId('chat-assistant-message').getByRole('link', { name: '來源 1：東京馬拉松' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /哪場比賽有抽筋/ }).first()).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('switching conversations swaps only the chat view', async ({ page }) => {
    let listRequests = 0;
    await page.route(SESSIONS_API, (route) => {
      listRequests++;
      return route.fulfill({ json: twoFixtureSessions });
    });
    await page.route(`**://*:3016/api/v1/admin/chat/sessions/${SECOND_SESSION_ID}`, (route) =>
      route.fulfill({ json: secondFixtureSession }),
    );

    await page.goto(`/admin/chat/${SESSION_ID}`);
    await expect(page.getByTestId('chat-user-message')).toHaveText('哪場比賽有抽筋？');
    const secondLink = page.getByRole('navigation', { name: '對話列表' }).getByRole('link', { name: /波士頓/ });
    await expect(secondLink).toBeVisible();

    const listBefore = listRequests;
    await page.evaluate(() => {
      (window as unknown as { keptList: Element | null }).keptList = document.querySelector('aside');
    });

    await secondLink.click();

    await expect(page).toHaveURL(new RegExp(`/admin/chat/${SECOND_SESSION_ID}$`));
    await expect(page.getByTestId('chat-user-message')).toHaveText('波士頓幾篇？');
    await expect(secondLink).toHaveAttribute('aria-current', 'page');
    expect(listRequests).toBe(listBefore);
    expect(
      await page.evaluate(
        () => (window as unknown as { keptList: Element | null }).keptList === document.querySelector('aside'),
      ),
    ).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/chat/${SESSION_ID}$`));
    await expect(page.getByTestId('chat-user-message')).toHaveText('哪場比賽有抽筋？');
  });

  test('keeps answering while the user reads another conversation', async ({ page }) => {
    let finishAnswer = () => {};
    const answerHeld = new Promise<void>((resolve) => {
      finishAnswer = resolve;
    });
    let chatRequestFailed = false;
    page.on('requestfailed', (request) => {
      if (request.method() === 'POST') chatRequestFailed = true;
    });
    await page.route(SESSIONS_API, (route) => route.fulfill({ json: twoFixtureSessions }));
    await page.route(`**://*:3016/api/v1/admin/chat/sessions/${SECOND_SESSION_ID}`, (route) =>
      route.fulfill({ json: secondFixtureSession }),
    );
    const sent = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/admin/chat'));
    await page.route(CHAT_API, async (route) => {
      await answerHeld;
      await fulfillAnswer(route, '切換後繼續生成的回答');
    });
    const list = page.getByRole('navigation', { name: '對話列表' });
    const visibleQuestions = page.getByTestId('chat-user-message').filter({ visible: true });

    await page.goto(`/admin/chat/${SESSION_ID}`);
    await expect(visibleQuestions.first()).toHaveText('哪場比賽有抽筋？');
    await page.getByLabel('輸入問題').filter({ visible: true }).fill('再問一題');
    await page.getByRole('button', { name: '送出問題' }).click();
    await sent;

    await list.getByRole('link', { name: /波士頓/ }).click();
    await expect(visibleQuestions).toHaveCount(1);
    await expect(visibleQuestions).toHaveText('波士頓幾篇？');
    await expect(list.getByRole('link', { name: /哪場比賽有抽筋/ })).toContainText('生成中');

    await list.getByRole('link', { name: /哪場比賽有抽筋/ }).click();
    await expect(visibleQuestions.last()).toHaveText('再問一題');
    finishAnswer();

    await expect(page.getByTestId('chat-assistant-message').last()).toContainText('切換後繼續生成的回答');
    await expect(list.getByRole('link', { name: /哪場比賽有抽筋/ })).not.toContainText('生成中');
    expect(chatRequestFailed).toBe(false);
  });

  test('keeps answering after leaving for another admin page', async ({ page }) => {
    let finishAnswer = () => {};
    const answerHeld = new Promise<void>((resolve) => {
      finishAnswer = resolve;
    });
    let chatRequestFailed = false;
    page.on('requestfailed', (request) => {
      if (request.method() === 'POST') chatRequestFailed = true;
    });
    await page.route('**://*:3016/api/v1/posts**', (route) =>
      route.fulfill({ json: { data: [], meta: { total: 0, limit: 20, page: 1, last_page: 1 } } }),
    );
    const sent = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/admin/chat'));
    await page.route(CHAT_API, async (route) => {
      await answerHeld;
      await fulfillAnswer(route, '離開後繼續生成的回答');
    });

    await page.goto(`/admin/chat/${SESSION_ID}`);
    await expect(page.getByTestId('chat-user-message').first()).toHaveText('哪場比賽有抽筋？');
    await page.getByLabel('輸入問題').fill('再問一題');
    await page.getByRole('button', { name: '送出問題' }).click();
    await sent;

    await page.getByRole('link', { name: '文章管理' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: '文章管理' })).toBeVisible();
    await expect(page.getByTestId('chat-user-message').filter({ visible: true })).toHaveCount(0);

    await page.getByRole('link', { name: '足跡問答' }).click();
    await page.getByRole('navigation', { name: '對話列表' }).getByRole('link', { name: /哪場比賽有抽筋/ }).click();
    await expect(page.getByTestId('chat-user-message').filter({ visible: true }).last()).toHaveText('再問一題');
    finishAnswer();

    await expect(page.getByTestId('chat-assistant-message').last()).toContainText('離開後繼續生成的回答');
    expect(chatRequestFailed).toBe(false);
  });

  test('shows each conversation status in the list', async ({ page }) => {
    await page.route(SESSIONS_API, (route) =>
      route.fulfill({
        json: {
          total: 3,
          data: [
            { ...twoFixtureSessions.data[0], has_unread_answer: true, last_answer_status: 'done' },
            { ...twoFixtureSessions.data[1], has_unread_answer: false, last_answer_status: 'failed' },
          ],
        },
      }),
    );

    await page.goto('/admin/chat');

    const list = page.getByRole('navigation', { name: '對話列表' });
    await expect(list.getByRole('link', { name: /哪場比賽有抽筋/ })).toContainText('新回答');
    await expect(list.getByRole('link', { name: /波士頓/ })).toContainText('回答失敗');
  });

  test('opening a conversation clears its new-answer status', async ({ page }) => {
    const read = page.waitForRequest((request) => request.url().endsWith(`/sessions/${SESSION_ID}/read`));
    await page.route(SESSIONS_API, (route) =>
      route.fulfill({
        json: { total: 1, data: [{ ...fixtureSessions.data[0], has_unread_answer: true, last_answer_status: 'done' }] },
      }),
    );

    await page.goto('/admin/chat');
    const link = page.getByRole('navigation', { name: '對話列表' }).getByRole('link', { name: /哪場比賽有抽筋/ });
    await expect(link).toContainText('新回答');

    await link.click();

    await read;
    await expect(link).not.toContainText('新回答');
  });

  test('gives the title the whole row and shows the archive button only on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto('/admin/chat');
    const list = page.getByRole('navigation', { name: '對話列表' });
    const link = list.getByRole('link', { name: /哪場比賽有抽筋/ });
    await expect(link).toHaveText('哪場比賽有抽筋？');

    const row = (await link.boundingBox())!;
    const title = (await link.locator('span').first().boundingBox())!;
    expect(title.width).toBeGreaterThan(row.width - 30);

    const archive = list.getByRole('button', { name: '封存對話：哪場比賽有抽筋？' });
    await page.mouse.move(800, 400);
    await expect(archive).toHaveCSS('opacity', '0');
    await link.hover();
    await expect(archive).toHaveCSS('opacity', '1');
  });

  test('uses the 足跡問答 name in the menu and heading', async ({ page }) => {
    await page.goto('/admin/chat');

    await expect(page.getByRole('heading', { name: '足跡問答' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '後台選單' }).getByRole('link', { name: '足跡問答' })).toHaveAttribute('aria-current', 'page');
  });

  test('shows the article title when hovering a citation number', async ({ page }) => {
    await page.goto(`/admin/chat/${SESSION_ID}`);
    const answer = page.getByTestId('chat-assistant-message');
    const tooltip = answer.getByRole('tooltip');
    await expect(tooltip).toBeHidden();

    await answer.getByRole('link', { name: '來源 1：東京馬拉松' }).hover();

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('東京馬拉松');
    await expect(tooltip).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const number = (await answer.getByRole('link', { name: '來源 1：東京馬拉松' }).boundingBox())!;
    expect((await tooltip.boundingBox())!.y).toBeGreaterThanOrEqual(number.y + number.height);
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
  });

  test('keeps the source list collapsed until opened', async ({ page }) => {
    await page.goto(`/admin/chat/${SESSION_ID}`);
    const answer = page.getByTestId('chat-assistant-message');
    const sources = answer.getByRole('list', { name: '來源文章' });
    const summary = answer.getByText('來源文章（1）');
    await expect(summary).toBeVisible();
    await expect(sources).toBeHidden();

    await summary.click();
    await expect(sources).toBeVisible();
    await expect(sources.getByRole('link')).toHaveText(/東京馬拉松/);

    await summary.click();
    await expect(sources).toBeHidden();
  });

  test('shows when each message was sent', async ({ page }) => {
    const sentAt = '2026-11-04T06:05:00Z';
    await page.route(SESSION_API, (route) =>
      route.fulfill({
        json: {
          ...fixtureSession,
          messages: fixtureSession.messages.map((message) => ({ ...message, created_at: sentAt })),
        },
      }),
    );
    await page.goto(`/admin/chat/${SESSION_ID}`);

    await expect(page.getByTestId('chat-user-message')).toHaveText('哪場比賽有抽筋？');
    await expect(page.locator(`time[datetime="${sentAt}"]`)).toHaveCount(2);
    await expect(page.locator('time').first()).toHaveText(/^\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}$/);
  });

  test('stamps a live question and its answer', async ({ page }) => {
    await page.route(CHAT_API, (route) =>
      fulfillAnswer(route, '回答', [], { createdAt: '2026-11-04T06:06:00Z' }),
    );
    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('新問題');
    await page.getByRole('button', { name: '送出問題' }).click();

    await expect(page.getByTestId('chat-assistant-message')).toContainText('回答');
    await expect(page.locator('time')).toHaveCount(2);
  });

  test('offers to continue an answer that ran out of search steps', async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route(CHAT_API, (route) => {
      bodies.push(route.request().postDataJSON());
      return bodies.length === 1
        ? fulfillAnswer(route, '目前核對到 A–R，其餘還沒查完。', [], { stepLimitReached: true })
        : fulfillAnswer(route, '接著查完了。', []);
    });
    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('A-Z 都有嗎？');
    await page.getByRole('button', { name: '送出問題' }).click();

    const answers = page.getByTestId('chat-assistant-message');
    await expect(answers).toContainText('目前核對到 A–R');
    await page.getByRole('button', { name: '繼續查詢' }).click();

    await expect(answers.last()).toContainText('接著查完了。');
    await expect(page.getByTestId('chat-user-message').last()).toHaveText('繼續查詢');
    await expect(page.getByRole('button', { name: '繼續查詢' })).toHaveCount(0);
    expect(bodies[1]).toMatchObject({ question: '繼續查詢', sessionId: SESSION_ID });
  });

  test('offers to continue after reopening an unfinished conversation', async ({ page }) => {
    await page.route(SESSION_API, (route) =>
      route.fulfill({
        json: {
          ...fixtureSession,
          messages: fixtureSession.messages.map((message) =>
            message.role === 'assistant' ? { ...message, step_limit_reached: true } : message,
          ),
        },
      }),
    );

    await page.goto(`/admin/chat/${SESSION_ID}`);

    await expect(page.getByRole('button', { name: '繼續查詢' })).toBeVisible();
  });

  test('does not offer to continue a finished answer', async ({ page }) => {
    await page.goto(`/admin/chat/${SESSION_ID}`);

    await expect(page.getByTestId('chat-assistant-message')).toBeVisible();
    await expect(page.getByRole('button', { name: '繼續查詢' })).toHaveCount(0);
  });

  test('archives a conversation softly and restores it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    let archived = false;
    await page.route(`${SESSIONS_API}?archived=true`, (route) =>
      route.fulfill({ json: archived ? { data: fixtureSessions.data, total: 1 } : { data: [], total: 0 } }),
    );
    await page.route(SESSIONS_API, (route) =>
      route.fulfill({ json: archived ? { data: [], total: 0 } : fixtureSessions }),
    );
    await page.route(`${SESSION_API}/archive`, (route) => {
      archived = true;
      return route.fulfill({ json: { id: SESSION_ID } });
    });
    await page.route(`${SESSION_API}/restore`, (route) => {
      archived = false;
      return route.fulfill({ json: { id: SESSION_ID } });
    });

    await page.goto(`/admin/chat/${SESSION_ID}`);
    const list = page.getByRole('navigation', { name: '對話列表' });
    await expect(list.getByRole('link', { name: /哪場比賽有抽筋/ })).toBeVisible();

    await list.getByRole('button', { name: '封存對話：哪場比賽有抽筋？' }).click();

    await expect(page).toHaveURL(/\/admin\/chat$/);
    await expect(list.getByText('還沒有對話')).toBeVisible();

    await list.getByRole('button', { name: '已封存' }).click();
    await list.getByRole('button', { name: '還原對話：哪場比賽有抽筋？' }).click();

    await expect(list.getByText('沒有封存的對話')).toBeVisible();
    await expect(list.getByRole('button', { name: '封存對話：哪場比賽有抽筋？' })).toBeAttached();
  });

  test('a new conversation can be left and reopened from its URL', async ({ page }) => {
    await page.route(CHAT_API, (route) => fulfillAnswer(route, '作者在東京馬拉松抽筋 [a1b2c3d4]。'));

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('哪場比賽有抽筋？');
    await page.getByRole('button', { name: '送出問題' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/chat/${SESSION_ID}$`));
    await expect(page.getByTestId('chat-assistant-message')).toContainText('作者在東京馬拉松抽筋');

    await page.getByRole('link', { name: '新對話' }).first().click();
    await expect(page).toHaveURL(/\/admin\/chat$/);
    await expect(page.getByTestId('chat-user-message')).toHaveCount(0);
    await expect(page.getByText('想知道文章裡的什麼事？直接問我。')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/chat/${SESSION_ID}$`));
    await expect(page.getByTestId('chat-user-message')).toHaveText('哪場比賽有抽筋？');
  });

  test('explains when a saved conversation does not exist', async ({ page }) => {
    await page.route(SESSION_API, (route) =>
      route.fulfill({ status: 404, json: { message: '找不到這段對話', statusCode: 404 } }),
    );

    await page.goto(`/admin/chat/${SESSION_ID}`);

    await expect(page.getByText('找不到這段對話。')).toBeVisible();
  });

  test('shows the reason when a question is refused and keeps it visible', async ({ page }) => {
    await page.route(CHAT_API, (route) =>
      route.fulfill({
        status: 429,
        json: { message: '請求太頻繁，請稍後再試。', statusCode: 429 },
      }),
    );

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('還能問嗎？');
    await page.getByRole('button', { name: '送出問題' }).click();

    await expect(page.getByText('請求太頻繁，請稍後再試。')).toBeVisible();
    await expect(page.getByTestId('chat-user-message')).toHaveText('還能問嗎？');
  });

  test('shows progress while waiting and lets the user stop', async ({ page }) => {
    await page.route(CHAT_API, () => {
      // Never answers, so the page stays in its waiting state.
    });

    await page.goto('/admin/chat');
    await page.getByLabel('輸入問題').fill('問題');
    await page.getByRole('button', { name: '送出問題' }).click();

    await expect(page.getByRole('status')).toContainText('正在翻閱文章');
    await page.getByRole('button', { name: '停止回答' }).click();
    await expect(page.getByRole('button', { name: '送出問題' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});
