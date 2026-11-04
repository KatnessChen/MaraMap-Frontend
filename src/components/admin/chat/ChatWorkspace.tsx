"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Loader2, MessageSquarePlus, MessagesSquare, X } from "lucide-react";
import { clearStoredToken, useAdminAuth } from "@/hooks/useAdminAuth";
import { getApiBase } from "@/utils/apiBase";
import { authFetch } from "@/utils/authFetch";
import AdminMenu from "@/components/admin/AdminMenu";
import ChatView from "./ChatView";

interface SessionSummary {
  id: string;
  title: string;
  last_message_at: string;
  last_answer_status?: string | null;
  has_unread_answer?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  stopped: "已中斷",
  failed: "回答失敗",
};

function isChatPath(pathname: string): boolean {
  return pathname === "/admin/chat" || pathname.startsWith("/admin/chat/");
}

/**
 * Mounted from the admin layout. Nothing loads until chat is first opened, and
 * signing out tears it down. Other admin pages render as usual beside it.
 */
export default function ChatWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = isChatPath(pathname);
  const isLoginRoute = pathname.startsWith("/admin/login");
  const [hasOpenedChat, setHasOpenedChat] = useState(isChatRoute);

  if (isChatRoute && !hasOpenedChat) setHasOpenedChat(true);
  if (isLoginRoute && hasOpenedChat) setHasOpenedChat(false);

  return (
    <div data-admin className={isChatRoute ? "h-dvh flex flex-col bg-paper" : undefined}>
      {!isLoginRoute && <AdminMenu />}
      {children}
      {hasOpenedChat && <ChatGate isChatRoute={isChatRoute} routePathname={pathname} />}
    </div>
  );
}

function ChatGate({ isChatRoute, routePathname }: { isChatRoute: boolean; routePathname: string }) {
  const { token, isChecking } = useAdminAuth();
  if (isChecking || !token) {
    return isChatRoute ? (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-ink/40" aria-label="載入中" />
      </div>
    ) : null;
  }
  return <Workspace token={token} isChatRoute={isChatRoute} pathname={routePathname} />;
}

/**
 * Moving between conversations swaps only the chat view: the session list stays
 * mounted and isn't fetched again. A view that is answering stays mounted out of
 * sight, on other admin pages too, so the answer isn't cut off.
 */
function Workspace({ token, isChatRoute, pathname }: { token: string; isChatRoute: boolean; pathname: string }) {
  const router = useRouter();
  const api = getApiBase();
  const routeSessionId = pathname.match(/^\/admin\/chat\/([^/]+)/)?.[1];
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<SessionSummary[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [draftNumber, setDraftNumber] = useState(0);
  // Which view holds each conversation started here.
  const [startedViews, setStartedViews] = useState<Record<string, string>>({});
  // Views answering right now, which stay mounted even when out of sight.
  const [busyViews, setBusyViews] = useState<Record<string, string | undefined>>({});
  const [previousRoute, setPreviousRoute] = useState(routeSessionId);

  // Coming back to the new-conversation route always starts empty.
  if (previousRoute !== routeSessionId) {
    setPreviousRoute(routeSessionId);
    if (!routeSessionId) setDraftNumber((number) => number + 1);
  }

  const draftKey = `new-${draftNumber}`;
  // A new conversation keeps its view when the URL catches up with its id, so
  // an answer in progress isn't interrupted.
  const viewKey = !routeSessionId ? draftKey : (startedViews[routeSessionId] ?? routeSessionId);
  const activeViewKey = useRef<string | null>(null);
  const backgroundViews = Object.entries(busyViews)
    .filter(([key]) => !isChatRoute || key !== viewKey)
    .map(([key, sessionId]) => ({ key, sessionId }));
  const views = isChatRoute ? [{ key: viewKey, sessionId: routeSessionId }, ...backgroundViews] : backgroundViews;
  const answeringSessions = new Set(Object.values(busyViews));

  useEffect(() => {
    activeViewKey.current = isChatRoute ? viewKey : null;
  }, [isChatRoute, viewKey]);

  // A conversation that got its id while the user was on another admin page
  // couldn't update the URL then.
  useEffect(() => {
    if (!isChatRoute || routeSessionId) return;
    const startedId = Object.keys(startedViews).find((id) => startedViews[id] === viewKey);
    if (startedId) window.history.replaceState(null, "", `/admin/chat/${startedId}`);
  }, [isChatRoute, routeSessionId, startedViews, viewKey]);

  const handleUnauthorized = useCallback(() => {
    clearStoredToken();
    router.push(`/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [router]);

  const fetchSessions = useCallback(
    async (archived: boolean): Promise<SessionSummary[] | null> => {
      const res = await authFetch(`${api}/api/v1/admin/chat/sessions${archived ? "?archived=true" : ""}`, token);
      if (res.status === 401) {
        handleUnauthorized();
        return null;
      }
      return res.ok ? (await res.json()).data : null;
    },
    [api, token, handleUnauthorized],
  );

  const refreshSessions = useCallback(() => {
    void fetchSessions(false).then((data) => {
      if (data) setSessions(data);
    });
  }, [fetchSessions]);

  const refreshArchived = useCallback(() => {
    void fetchSessions(true).then((data) => {
      if (data) setArchivedSessions(data);
    });
  }, [fetchSessions]);

  // Answers may have finished while the user was on another admin page.
  useEffect(() => {
    if (isChatRoute) refreshSessions();
  }, [isChatRoute, refreshSessions]);

  useEffect(() => {
    if (isArchiveOpen) refreshArchived();
  }, [isArchiveOpen, refreshArchived]);

  const handleSessionStarted = useCallback(
    (key: string, id: string) => {
      setStartedViews((current) => ({ ...current, [id]: key }));
      // Not a navigation: that would swap the view mid-answer. A view the user
      // has already left must not pull the URL back.
      if (activeViewKey.current === key) window.history.replaceState(null, "", `/admin/chat/${id}`);
      refreshSessions();
    },
    [refreshSessions],
  );

  const handleBusyChange = useCallback((key: string, isBusy: boolean, sessionId?: string) => {
    setBusyViews((current) => {
      if (isBusy) return { ...current, [key]: sessionId };
      if (!(key in current)) return current;
      const remaining = { ...current };
      delete remaining[key];
      return remaining;
    });
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      setSessions((current) =>
        current.map((session) => (session.id === id ? { ...session, has_unread_answer: false } : session)),
      );
      await authFetch(`${api}/api/v1/admin/chat/sessions/${id}/read`, token, { method: "POST" }).catch(() => undefined);
    },
    [api, token],
  );

  const archive = async (id: string) => {
    setListError(null);
    const res = await authFetch(`${api}/api/v1/admin/chat/sessions/${id}/archive`, token, { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) return setListError("封存失敗，請再試一次。");
    setSessions((current) => current.filter((session) => session.id !== id));
    if (isArchiveOpen) refreshArchived();
    if (id === routeSessionId) router.push("/admin/chat");
  };

  const restore = async (id: string) => {
    setListError(null);
    const res = await authFetch(`${api}/api/v1/admin/chat/sessions/${id}/restore`, token, { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) return setListError("還原失敗，請再試一次。");
    setArchivedSessions((current) => current.filter((session) => session.id !== id));
    refreshSessions();
  };

  const statusOf = (session: SessionSummary) => {
    if (answeringSessions.has(session.id)) {
      return (
        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold">
          <Loader2 size={12} className="animate-spin" aria-hidden /> 生成中
        </span>
      );
    }
    if (session.has_unread_answer && session.id !== routeSessionId) {
      return (
        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-brand">
          <span className="w-2 h-2 rounded-full bg-brand" aria-hidden /> 新回答
        </span>
      );
    }
    const label = session.last_answer_status ? STATUS_LABELS[session.last_answer_status] : undefined;
    return label ? <span className="shrink-0 text-xs font-bold">{label}</span> : null;
  };

  const sessionRow = (session: SessionSummary, action: "archive" | "restore") => {
    const isCurrent = session.id === routeSessionId;
    // Touch screens can't hover, so there the action shows where it's relevant.
    const showsOnTouch = isCurrent || action === "restore";
    return (
      <div key={session.id} className="group relative">
        <Link
          href={`/admin/chat/${session.id}`}
          aria-current={isCurrent ? "page" : undefined}
          onClick={() => setIsListOpen(false)}
          className={`flex items-center gap-2 min-h-11 rounded-lg px-3 py-2 font-sans text-sm transition-colors ${
            isCurrent ? "bg-ink text-white" : "text-ink hover:bg-ink/5"
          } ${showsOnTouch ? "[@media(hover:none)]:pr-12" : ""}`}
        >
          <span className="flex-1 min-w-0 truncate font-bold">{session.title}</span>
          {statusOf(session)}
        </Link>
        <button
          type="button"
          onClick={() => void (action === "archive" ? archive(session.id) : restore(session.id))}
          aria-label={`${action === "archive" ? "封存" : "還原"}對話：${session.title}`}
          title={action === "archive" ? "封存" : "還原"}
          className={`absolute right-0 top-0 flex items-center justify-center w-11 h-11 rounded-lg transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 ${
            isCurrent ? "bg-ink text-white/70 hover:text-white" : "bg-white text-ink/50 hover:text-ink"
          } ${showsOnTouch ? "" : "[@media(hover:none)]:hidden"}`}
        >
          {action === "archive" ? <Archive size={16} /> : <ArchiveRestore size={16} />}
        </button>
      </div>
    );
  };

  const newConversationLink = (
    <Link
      href="/admin/chat"
      onClick={() => setIsListOpen(false)}
      className="flex items-center gap-2 min-h-11 rounded-lg px-3 font-sans text-sm font-bold text-ink hover:bg-ink/5 transition-colors"
    >
      <MessageSquarePlus size={18} className="text-ink/60" /> 新對話
    </Link>
  );

  const sessionList = (
    <nav aria-label="對話列表" className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
      {sessions.length === 0 && <p className="px-3 py-2 font-sans text-sm text-ink/50">還沒有對話</p>}
      {sessions.map((session) => sessionRow(session, "archive"))}
      {listError && (
        <p role="alert" className="px-3 py-2 font-sans text-sm text-brand">
          {listError}
        </p>
      )}
      <button
        type="button"
        onClick={() => setIsArchiveOpen((open) => !open)}
        aria-expanded={isArchiveOpen}
        className="w-full flex items-center justify-between min-h-11 mt-2 rounded-lg px-3 font-sans text-sm font-bold text-ink/60 hover:bg-ink/5 transition-colors"
      >
        已封存
        {isArchiveOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
      </button>
      {isArchiveOpen && archivedSessions.length === 0 && (
        <p className="px-3 py-2 font-sans text-sm text-ink/50">沒有封存的對話</p>
      )}
      {isArchiveOpen && archivedSessions.map((session) => sessionRow(session, "restore"))}
    </nav>
  );

  return (
    <div className={isChatRoute ? "flex-1 min-h-0 flex bg-paper" : "hidden"}>
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-ink/10 bg-white">
        <div className="p-3 border-b border-ink/10">{newConversationLink}</div>
        {sessionList}
      </aside>

      {isListOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-ink/10">
            <div className="flex-1">{newConversationLink}</div>
            <button
              type="button"
              onClick={() => setIsListOpen(false)}
              aria-label="關閉對話列表"
              className="flex items-center justify-center w-11 h-11 rounded-full text-ink/60 hover:bg-ink/5"
            >
              <X size={20} />
            </button>
          </div>
          {sessionList}
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 flex items-center gap-2 px-3 sm:px-6 min-h-14 border-b border-ink/10 bg-white">
          <button
            type="button"
            onClick={() => setIsListOpen(true)}
            aria-label="開啟對話列表"
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-full text-ink/60 hover:bg-ink/5"
          >
            <MessagesSquare size={20} />
          </button>
          <h1 className="flex-1 min-w-0 truncate font-serif font-black text-xl text-ink">
            足跡<span className="text-brand">問答</span>
          </h1>
        </header>

        {views.map((view) => (
          <ChatView
            key={view.key}
            token={token}
            viewKey={view.key}
            isActive={isChatRoute && view.key === viewKey}
            initialSessionId={view.sessionId}
            onBusyChange={handleBusyChange}
            onSessionStarted={handleSessionStarted}
            onSessionsChanged={refreshSessions}
            onMarkRead={markRead}
            onUnauthorized={handleUnauthorized}
          />
        ))}
      </div>
    </div>
  );
}
