"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send, Square } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { authFetch, authHeaders } from "@/utils/authFetch";
import type { ChatCitation } from "@/utils/chatCitations";
import ChatMessageBubble from "./ChatMessageBubble";

interface ChatMetadata {
  sessionId?: string;
  citations?: ChatCitation[];
  status?: string;
  replacementText?: string;
  createdAt?: string;
  stepLimitReached?: boolean;
}
type ChatMessage = UIMessage<ChatMetadata>;

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[] | null;
  status: string;
  created_at?: string;
  step_limit_reached?: boolean;
}

const CONTINUE_QUESTION = "繼續查詢";

const SUGGESTIONS = ["哪幾場比賽有提到抽筋？", "跑得最痛苦的是哪一場？", "2019 年有幾篇馬拉松文章？"];

function toChatMessage(stored: StoredMessage): ChatMessage {
  return {
    id: stored.id,
    role: stored.role,
    parts: [{ type: "text", text: stored.content }],
    metadata: {
      citations: stored.citations ?? [],
      status: stored.status,
      createdAt: stored.created_at,
      stepLimitReached: stored.step_limit_reached,
    },
  };
}

function textOf(message: ChatMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** What the model is doing right now, for the waiting indicator. */
function activityLabel(message: ChatMessage | undefined): string {
  const running = message?.parts.filter(
    (part) => part.type.startsWith("tool-") && "state" in part && part.state !== "output-available",
  );
  if (running?.some((part) => part.type === "tool-get_posts")) return "正在閱讀文章…";
  if (running?.some((part) => part.type === "tool-search_posts")) return "正在搜尋文章…";
  return "正在翻閱文章…";
}

/** A failed request's body is JSON from Nest; show its message, not the raw text. */
function errorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { message?: unknown };
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Not JSON, so it's already a readable message from the stream.
  }
  return error.message || "回答時發生問題，請再試一次。";
}

interface ChatViewProps {
  token: string;
  apiPath: string;
  viewKey: string;
  isActive: boolean;
  initialSessionId?: string;
  onBusyChange: (viewKey: string, isBusy: boolean, sessionId?: string) => void;
  onSessionStarted: (viewKey: string, sessionId: string) => void;
  onSessionsChanged: () => void;
  onMarkRead: (sessionId: string) => Promise<void>;
  onUnauthorized: () => void;
}

export default function ChatView({
  token,
  apiPath,
  viewKey,
  isActive,
  initialSessionId,
  onBusyChange,
  onSessionStarted,
  onSessionsChanged,
  onMarkRead,
  onUnauthorized,
}: ChatViewProps) {
  const api = `${getApiBase()}${apiPath}`;
  // A conversation started here gets its id while still on screen; only the id
  // this view opened with has history to load.
  const [historySessionId] = useState(initialSessionId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!historySessionId);
  const [input, setInput] = useState("");
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  const [stoppedMessageId, setStoppedMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isActiveRef = useRef(isActive);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api,
        headers: () => authHeaders(token),
        // The backend reads history from the DB and rejects unknown fields, so
        // only the new question goes over the wire.
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, question: textOf(messages[messages.length - 1]) },
        }),
      }),
    [api, token],
  );

  const { messages, setMessages, sendMessage, status, stop, error, clearError } = useChat<ChatMessage>({
    transport,
    // Read first, so the refreshed list doesn't flag the answer on screen as new.
    onFinish: async ({ message }) => {
      const sessionId = message.metadata?.sessionId;
      if (sessionId && isActiveRef.current) await onMarkRead(sessionId);
      onSessionsChanged();
    },
    onError: (err) => {
      if (err.message.includes('"statusCode":401')) onUnauthorized();
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const lastAssistant = lastMessage?.role === "assistant" ? lastMessage : undefined;
  const hasAnswerText = !!lastAssistant && textOf(lastAssistant).length > 0;
  const isWaiting = status === "submitted" || (status === "streaming" && !hasAnswerText);
  const startedSessionId = messages.findLast((message) => message.metadata?.sessionId)?.metadata?.sessionId;
  const currentSessionId = startedSessionId ?? historySessionId;

  useEffect(() => {
    if (!historySessionId) return;
    let cancelled = false;
    (async () => {
      const res = await authFetch(`${api}/sessions/${historySessionId}`, token);
      if (cancelled) return;
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) {
        setLoadError("找不到這段對話。");
      } else {
        const session = (await res.json()) as { messages: StoredMessage[] };
        if (!cancelled) setMessages(session.messages.map(toChatMessage));
      }
      setIsLoadingHistory(false);
    })().catch(() => {
      if (cancelled) return;
      setLoadError("無法載入這段對話，請重新整理。");
      setIsLoadingHistory(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, token, historySessionId, setMessages, onUnauthorized]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Seeing a conversation is what marks its answer as read.
  useEffect(() => {
    if (isActive && !isBusy && historySessionId) void onMarkRead(historySessionId);
  }, [isActive, isBusy, historySessionId, onMarkRead]);

  // A new conversation gets its id from the first response.
  useEffect(() => {
    if (startedSessionId && startedSessionId !== historySessionId) onSessionStarted(viewKey, startedSessionId);
  }, [viewKey, startedSessionId, historySessionId, onSessionStarted]);

  // The workspace keeps this view mounted while it answers, so moving to another
  // conversation doesn't cut the answer off.
  useEffect(() => {
    onBusyChange(viewKey, isBusy, currentSessionId);
  }, [viewKey, isBusy, currentSessionId, onBusyChange]);

  useEffect(() => {
    if (!isWaiting) return;
    const timer = setInterval(() => setWaitedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [isWaiting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, isActive]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || isBusy) return;
    clearError();
    setStoppedMessageId(null);
    setWaitedSeconds(0);
    setInput("");
    void sendMessage(
      { text, metadata: { createdAt: new Date().toISOString() } },
      { body: currentSessionId ? { sessionId: currentSessionId } : {} },
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter also confirms a Chinese IME composition, which mustn't send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      ask(input);
    }
  };

  const handleStop = () => {
    if (lastAssistant) setStoppedMessageId(lastAssistant.id);
    void stop();
  };

  return (
    <main className={`flex-1 min-w-0 min-h-0 flex-col ${isActive ? "flex" : "hidden"}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-4">
          {isLoadingHistory && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-ink/40" aria-label="載入對話中" />
            </div>
          )}

          {loadError && (
            <p role="alert" className="font-sans text-base text-brand">
              {loadError}
            </p>
          )}

          {!isLoadingHistory && !loadError && messages.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-sans text-base text-ink/60 mb-4">想知道文章裡的什麼事？直接問我。</p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="min-h-11 rounded-full border border-ink/15 bg-white px-4 py-2 font-sans text-sm font-bold text-ink hover:border-brand hover:text-brand transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const text = message.metadata?.replacementText ?? textOf(message);
            const isStopped = message.id === stoppedMessageId;
            // Nothing to show yet: the waiting indicator covers this state.
            if (message.role === "assistant" && !text && !isStopped && !message.metadata?.status) {
              return null;
            }
            return (
              <ChatMessageBubble
                key={message.id}
                role={message.role}
                text={text}
                citations={message.metadata?.citations ?? []}
                status={isStopped ? "stopped" : message.metadata?.status}
                createdAt={message.metadata?.createdAt}
                onContinue={
                  message === lastAssistant && message.metadata?.stepLimitReached && !isBusy
                    ? () => ask(CONTINUE_QUESTION)
                    : undefined
                }
              />
            );
          })}

          {isWaiting && (
            <div role="status" aria-live="polite" className="flex items-center gap-2 font-sans text-base text-ink/60">
              <Loader2 size={18} className="animate-spin" aria-hidden />
              <span>
                {activityLabel(lastAssistant)}
                {waitedSeconds > 0 && ` ${waitedSeconds} 秒`}
              </span>
            </div>
          )}

          {error && (
            <p role="alert" className="font-sans text-base text-brand">
              {errorText(error)}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-ink/10 bg-white p-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            maxLength={1000}
            aria-label="輸入問題"
            placeholder="問問文章裡的事…"
            className="flex-1 min-w-0 resize-none rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-sans text-base text-ink placeholder:text-ink/40 focus:outline-none focus:border-brand"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={handleStop}
              aria-label="停止回答"
              className="flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-ink text-white hover:bg-ink/80 transition-colors"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="送出問題"
              className="flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-brand text-white hover:bg-brand/80 disabled:bg-ink/15 disabled:text-ink/40 transition-colors"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
