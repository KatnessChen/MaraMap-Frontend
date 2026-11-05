"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Loader2, MessageSquarePlus, MessagesSquare, X } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { authFetch } from "@/utils/authFetch";
import ChatView from "./ChatView";
import GuestChatView from "./GuestChatView";

interface SessionSummary {
  id: string;
  title: string;
  last_message_at: string;
  last_answer_status?: string | null;
  has_unread_answer?: boolean;
}

interface GuestSessionSummary {
  id: string;
  title: string;
  guest_nickname: string | null;
  archived_at: string | null;
}

const GUEST_PAGE_SIZE = 30;

const STATUS_LABELS: Record<string, string> = {
  stopped: "已中斷",
  failed: "回答失敗",
};

interface ChatShellProps {
  token: string;
  isChatRoute: boolean;
  pathname: string;
  /** Where this chat lives in the site, for example /admin/chat. */
  routeBase: string;
  /** The API it talks to, for example /api/v1/admin/chat. */
  apiPath: string;
  /** Shown at the end of the header, for example who is signed in. */
  headerAside?: string | null;
  /** Admin only: lists guests' conversations, which open read-only. */
  showGuestChats?: boolean;
  onUnauthorized: () => void;
}

/**
 * Moving between conversations swaps only the chat view: the session list stays
 * mounted and isn't fetched again. A view that is answering stays mounted out of
 * sight, on other admin pages too, so the answer isn't cut off.
 */
export default function ChatShell({
  token,
  isChatRoute,
  pathname,
  routeBase,
  apiPath,
  headerAside,
  showGuestChats = false,
  onUnauthorized,
}: ChatShellProps) {
  const router = useRouter();
  const api = `${getApiBase()}${apiPath}`;
  const guestRoutePrefix = `${routeBase}/guests/`;
  const guestSessionId =
    showGuestChats && pathname.startsWith(guestRoutePrefix) ? pathname.slice(guestRoutePrefix.length).split("/")[0] : undefined;
  const routeSessionId =
    !guestSessionId && pathname.startsWith(`${routeBase}/`) ? pathname.slice(routeBase.length + 1).split("/")[0] : undefined;
  // On a guest's conversation, the admin's own chat views stay out of sight.
  const isOwnChatRoute = isChatRoute && !guestSessionId;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<SessionSummary[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [guestSessions, setGuestSessions] = useState<GuestSessionSummary[]>([]);
  const [guestTotal, setGuestTotal] = useState(0);
  const [isGuestTab, setIsGuestTab] = useState(!!guestSessionId);
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
    .filter(([key]) => !isOwnChatRoute || key !== viewKey)
    .map(([key, sessionId]) => ({ key, sessionId }));
  const views = isOwnChatRoute ? [{ key: viewKey, sessionId: routeSessionId }, ...backgroundViews] : backgroundViews;
  const answeringSessions = new Set(Object.values(busyViews));

  useEffect(() => {
    activeViewKey.current = isOwnChatRoute ? viewKey : null;
  }, [isOwnChatRoute, viewKey]);

  // A conversation that got its id while the user was on another admin page
  // couldn't update the URL then.
  useEffect(() => {
    if (!isOwnChatRoute || routeSessionId) return;
    const startedId = Object.keys(startedViews).find((id) => startedViews[id] === viewKey);
    if (startedId) window.history.replaceState(null, "", `${routeBase}/${startedId}`);
  }, [isOwnChatRoute, routeBase, routeSessionId, startedViews, viewKey]);

  const fetchSessions = useCallback(
    async (archived: boolean): Promise<SessionSummary[] | null> => {
      const res = await authFetch(`${api}/sessions${archived ? "?archived=true" : ""}`, token);
      if (res.status === 401) {
        onUnauthorized();
        return null;
      }
      return res.ok ? (await res.json()).data : null;
    },
    [api, token, onUnauthorized],
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

  const loadGuestSessions = useCallback(
    async (offset: number) => {
      const res = await authFetch(`${api}/guest-sessions?limit=${GUEST_PAGE_SIZE}&offset=${offset}`, token).catch(() => null);
      if (res?.status === 401) return onUnauthorized();
      if (!res?.ok) return setListError("無法載入訪客問答，請再試一次。");
      setListError(null);
      const page = (await res.json()) as { data: GuestSessionSummary[]; total: number };
      setGuestSessions((current) => (offset === 0 ? page.data : [...current, ...page.data]));
      setGuestTotal(page.total);
    },
    [api, token, onUnauthorized],
  );

  useEffect(() => {
    if (!isGuestTab) return;
    const loadFirstPage = () => void loadGuestSessions(0);
    loadFirstPage();
  }, [isGuestTab, loadGuestSessions]);

  const handleSessionStarted = useCallback(
    (key: string, id: string) => {
      setStartedViews((current) => ({ ...current, [id]: key }));
      // Not a navigation: that would swap the view mid-answer. A view the user
      // has already left must not pull the URL back.
      if (activeViewKey.current === key) window.history.replaceState(null, "", `${routeBase}/${id}`);
      refreshSessions();
    },
    [routeBase, refreshSessions],
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
      await authFetch(`${api}/sessions/${id}/read`, token, { method: "POST" }).catch(() => undefined);
    },
    [api, token],
  );

  const archive = async (id: string) => {
    setListError(null);
    const res = await authFetch(`${api}/sessions/${id}/archive`, token, { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) return setListError("封存失敗，請再試一次。");
    setSessions((current) => current.filter((session) => session.id !== id));
    if (isArchiveOpen) refreshArchived();
    if (id === routeSessionId) router.push(routeBase);
  };

  const restore = async (id: string) => {
    setListError(null);
    const res = await authFetch(`${api}/sessions/${id}/restore`, token, { method: "POST" }).catch(
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
          href={`${routeBase}/${session.id}`}
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

  const guestSessionRow = (session: GuestSessionSummary) => {
    const isCurrent = session.id === guestSessionId;
    return (
      <Link
        key={session.id}
        href={`${guestRoutePrefix}${session.id}`}
        aria-current={isCurrent ? "page" : undefined}
        onClick={() => setIsListOpen(false)}
        className={`block min-h-11 rounded-lg px-3 py-2 font-sans text-sm transition-colors ${
          isCurrent ? "bg-ink text-white" : "text-ink hover:bg-ink/5"
        }`}
      >
        <span className="block truncate font-bold">{session.title}</span>
        <span className={`flex items-center gap-2 text-xs ${isCurrent ? "text-white/70" : "text-ink/60"}`}>
          <span className="min-w-0 truncate">{session.guest_nickname ?? "未具名"}</span>
          {session.archived_at && <span className="shrink-0">訪客已封存</span>}
        </span>
      </Link>
    );
  };

  const newConversationLink = (
    <Link
      href={routeBase}
      onClick={() => setIsListOpen(false)}
      className="flex items-center gap-2 min-h-11 rounded-lg px-3 font-sans text-sm font-bold text-ink hover:bg-ink/5 transition-colors"
    >
      <MessageSquarePlus size={18} className="text-ink/60" /> 新對話
    </Link>
  );

  const listTab = (label: string, isGuests: boolean) => (
    <button
      type="button"
      aria-pressed={isGuestTab === isGuests}
      onClick={() => setIsGuestTab(isGuests)}
      className={`flex-1 min-h-11 border-b-2 font-sans text-sm font-bold transition-colors ${
        isGuestTab === isGuests ? "border-brand text-ink" : "border-transparent text-ink/60 hover:text-brand"
      }`}
    >
      {label}
    </button>
  );

  const ownSessionList = (
    <>
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
    </>
  );

  const guestSessionList = (
    <>
      {guestSessions.length === 0 && !listError && (
        <p className="px-3 py-2 font-sans text-sm text-ink/50">還沒有訪客問答</p>
      )}
      {guestSessions.map(guestSessionRow)}
      {listError && (
        <p role="alert" className="px-3 py-2 font-sans text-sm text-brand">
          {listError}
        </p>
      )}
      {guestSessions.length < guestTotal && (
        <button
          type="button"
          onClick={() => void loadGuestSessions(guestSessions.length)}
          className="w-full min-h-11 rounded-lg px-3 font-sans text-sm font-bold text-ink/60 hover:bg-ink/5 transition-colors"
        >
          載入更多
        </button>
      )}
    </>
  );

  const sessionList = (
    <>
      {showGuestChats && (
        <div role="group" aria-label="對話類型" className="shrink-0 flex px-3 border-b border-ink/10">
          {listTab("我的對話", false)}
          {listTab("訪客問答", true)}
        </div>
      )}
      <nav aria-label="對話列表" className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {isGuestTab ? guestSessionList : ownSessionList}
      </nav>
    </>
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
          {headerAside && (
            <span className="shrink-0 max-w-[40%] truncate font-sans text-sm font-bold text-ink/60">{headerAside}</span>
          )}
        </header>

        {views.map((view) => (
          <ChatView
            key={view.key}
            token={token}
            apiPath={apiPath}
            viewKey={view.key}
            isActive={isOwnChatRoute && view.key === viewKey}
            initialSessionId={view.sessionId}
            onBusyChange={handleBusyChange}
            onSessionStarted={handleSessionStarted}
            onSessionsChanged={refreshSessions}
            onMarkRead={markRead}
            onUnauthorized={onUnauthorized}
          />
        ))}
        {guestSessionId && (
          <GuestChatView key={guestSessionId} token={token} api={api} sessionId={guestSessionId} onUnauthorized={onUnauthorized} />
        )}
      </div>
    </div>
  );
}
