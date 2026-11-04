// Fixture for the admin chat e2e suite. The chat POST answers with the AI SDK's
// UI message stream, written out here as the server-sent events it really is.
import type { Page } from "@playwright/test";

export const SESSION_ID = "11111111-1111-4111-8111-111111111111";

export const fixtureCitation = {
  ref: "a1b2c3d4",
  post_id: "a1b2c3d4-0000-4000-8000-000000000001",
  title: "東京馬拉松",
  event_date: "2019-03-03",
  is_hidden: true,
};

export const fixtureSessions = {
  data: [
    {
      id: SESSION_ID,
      title: "哪場比賽有抽筋？",
      created_at: "2026-11-03T10:00:00Z",
      last_message_at: "2026-11-03T10:01:00Z",
    },
  ],
  total: 1,
};

export const fixtureSession = {
  ...fixtureSessions.data[0],
  messages: [
    { id: "m1", role: "user", content: "哪場比賽有抽筋？", citations: [], status: "done" },
    {
      id: "m2",
      role: "assistant",
      content: "作者在東京馬拉松抽筋 [a1b2c3d4]。",
      citations: [fixtureCitation],
      status: "done",
    },
  ],
};

export const SECOND_SESSION_ID = "22222222-2222-4222-8222-222222222222";

export const twoFixtureSessions = {
  data: [
    ...fixtureSessions.data,
    {
      id: SECOND_SESSION_ID,
      title: "波士頓幾篇？",
      created_at: "2026-11-03T11:00:00Z",
      last_message_at: "2026-11-03T11:01:00Z",
    },
  ],
  total: 2,
};

export const secondFixtureSession = {
  ...twoFixtureSessions.data[1],
  messages: [{ id: "m3", role: "user", content: "波士頓幾篇？", citations: [], status: "done" }],
};

export function answerStream(
  text: string,
  citations: unknown[] = [fixtureCitation],
  finishMetadata: Record<string, unknown> = {},
): string {
  const events = [
    { type: "start", messageMetadata: { sessionId: SESSION_ID } },
    { type: "start-step" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish-step" },
    { type: "finish", messageMetadata: { sessionId: SESSION_ID, citations, ...finishMetadata } },
  ];
  return [...events.map((event) => `data: ${JSON.stringify(event)}\n\n`), "data: [DONE]\n\n"].join("");
}

export async function fulfillAnswer(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  text: string,
  citations?: unknown[],
  finishMetadata?: Record<string, unknown>,
): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
    body: answerStream(text, citations, finishMetadata),
  });
}

export { seedAdminToken } from "./adminEditPost";
