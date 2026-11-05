"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/utils/authFetch";
import type { ChatCitation } from "@/utils/chatCitations";
import ChatMessageBubble from "./ChatMessageBubble";

interface GuestConversation {
  guest_nickname: string | null;
  archived_at: string | null;
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: ChatCitation[] | null;
    status: string;
    created_at: string;
  }[];
}

interface GuestChatViewProps {
  token: string;
  /** The admin chat API, which also serves guests' conversations. */
  api: string;
  sessionId: string;
  onUnauthorized: () => void;
}

/** A guest's conversation, read-only: admins can't add to it. */
export default function GuestChatView({ token, api, sessionId, onUnauthorized }: GuestChatViewProps) {
  const [conversation, setConversation] = useState<GuestConversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authFetch(`${api}/guest-sessions/${sessionId}`, token);
      if (cancelled) return;
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) return setError("找不到這段對話。");
      const body = (await res.json()) as GuestConversation;
      if (!cancelled) setConversation(body);
    })().catch(() => {
      if (!cancelled) setError("無法載入這段對話，請重新整理。");
    });
    return () => {
      cancelled = true;
    };
  }, [api, token, sessionId, onUnauthorized]);

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-4">
          {error && (
            <p role="alert" className="font-sans text-base text-brand">
              {error}
            </p>
          )}
          {!error && !conversation && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-ink/40" aria-label="載入對話中" />
            </div>
          )}
          {conversation?.messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              role={message.role}
              text={message.content}
              citations={message.citations ?? []}
              status={message.status}
              createdAt={message.created_at}
            />
          ))}
        </div>
      </div>
      {conversation && (
        <p className="border-t border-ink/10 bg-white px-3 sm:px-6 py-4 font-sans text-sm text-ink/60 text-center">
          這是訪客「{conversation.guest_nickname ?? "未具名"}」的對話{conversation.archived_at ? "（訪客已封存）" : ""}，只能查看。
        </p>
      )}
    </main>
  );
}
