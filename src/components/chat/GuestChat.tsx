"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import ChatShell from "@/components/admin/chat/ChatShell";
import { isTokenExpired } from "@/hooks/useAdminAuth";
import { getApiBase } from "@/utils/apiBase";

// Separate from the admin token: this one only opens the /chat API.
const TOKEN_KEY = "maramap_chat_token";
const NICKNAME_KEY = "maramap_chat_nickname";
const NICKNAME_MAX_LENGTH = 20;

function PasscodeForm({ onEntered }: { onEntered: (token: string, nickname: string) => void }) {
  const [nickname, setNickname] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = !!nickname.trim() && !!passcode && !isSubmitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/v1/auth/chat-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, nickname: nickname.trim() }),
      });
      if (res.ok) {
        const entered = (await res.json()) as { token: string; nickname: string };
        return onEntered(entered.token, entered.nickname);
      }
      if (res.status === 400) return setError("暱稱不能使用換行或特殊控制字元，請換一個。");
      setPasscode("");
      setError(res.status === 429 ? "嘗試太多次了，請一分鐘後再試。" : "密碼不正確，請再試一次。");
    } catch {
      setError("連線失敗，請再試一次。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-paper px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
        <h1 className="font-serif font-black text-3xl text-ink text-center">
          足跡<span className="text-brand">問答</span>
        </h1>
        <p className="mt-2 mb-6 font-sans text-base text-ink/60 text-center">輸入暱稱和密碼，開始問文章裡的事。</p>
        <label htmlFor="chat-nickname" className="block mb-2 font-sans text-sm font-bold text-ink">
          暱稱
        </label>
        <input
          id="chat-nickname"
          type="text"
          autoComplete="nickname"
          autoFocus
          maxLength={NICKNAME_MAX_LENGTH}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          className="w-full min-h-12 mb-4 rounded-xl border border-ink/15 bg-paper px-4 font-sans text-base text-ink focus:outline-none focus:border-brand"
        />
        <label htmlFor="chat-passcode" className="block mb-2 font-sans text-sm font-bold text-ink">
          數字密碼
        </label>
        <input
          id="chat-passcode"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={32}
          value={passcode}
          onChange={(event) => setPasscode(event.target.value.replace(/\D/g, ""))}
          aria-invalid={!!error}
          aria-describedby={error ? "chat-passcode-error" : undefined}
          className="w-full min-h-12 rounded-xl border border-ink/15 bg-paper px-4 font-sans text-base text-ink focus:outline-none focus:border-brand"
        />
        {error && (
          <p id="chat-passcode-error" role="alert" className="mt-2 font-sans text-sm text-brand">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 w-full min-h-12 rounded-full bg-brand font-sans text-base font-bold text-white hover:bg-brand/80 disabled:bg-ink/15 disabled:text-ink/40 transition-colors"
        >
          {isSubmitting ? "確認中…" : "進入"}
        </button>
        <p className="mt-4 font-sans text-sm text-ink/60 text-center">問答內容會保存，網站管理者可以查看。</p>
      </form>
    </main>
  );
}

export default function GuestChat() {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkToken = () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored && !isTokenExpired(stored)) {
        setToken(stored);
        setNickname(localStorage.getItem(NICKNAME_KEY));
      }
      setIsChecking(false);
    };
    checkToken();
  }, []);

  const handleEntered = (entered: string, enteredNickname: string) => {
    localStorage.setItem(TOKEN_KEY, entered);
    localStorage.setItem(NICKNAME_KEY, enteredNickname);
    setToken(entered);
    setNickname(enteredNickname);
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NICKNAME_KEY);
    setToken(null);
    setNickname(null);
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-ink/40" aria-label="載入中" />
      </div>
    );
  }
  if (!token) return <PasscodeForm onEntered={handleEntered} />;

  return (
    <div data-admin className="h-dvh flex flex-col bg-paper">
      <ChatShell
        token={token}
        isChatRoute
        pathname={pathname}
        routeBase="/chat"
        apiPath="/api/v1/chat"
        headerAside={nickname}
        onUnauthorized={handleUnauthorized}
      />
    </div>
  );
}
