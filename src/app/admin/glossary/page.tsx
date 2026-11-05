"use client";

import { KeyboardEvent, Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Loader2, Search, AlertTriangle } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { useAdminAuth, clearStoredToken } from "@/hooks/useAdminAuth";
import { authFetch } from "@/utils/authFetch";
import AdminPage from "@/components/admin/AdminPage";
import CityTranslationsSection from "@/components/admin/CityTranslationsSection";
import { SOURCE_LABELS } from "@/components/admin/glossaryLabels";

interface GlossaryRow {
  zh: string;
  en: string;
  source: string;
  needs_review: boolean;
}

type Feedback = { type: "success" | "error"; msg: string } | null;
type Kind = "races" | "mountains";

const TABS = [
  { id: "races", label: "賽事" },
  { id: "mountains", label: "山岳" },
  { id: "cities", label: "城市" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function GlossaryEditRow({
  index,
  row,
  onSave,
  onDelete,
  busy,
}: {
  index: number;
  row: GlossaryRow;
  onSave: (zh: string, en: string) => Promise<void>;
  onDelete: (zh: string) => void;
  busy: boolean;
}) {
  const [en, setEn] = useState(row.en);
  const dirty = en.trim() !== row.en && en.trim() !== "";
  // A needs_review row can be saved as-is (no edit required) to confirm the
  // AI's guess was already correct — saving always clears the flag either way.
  const canSave = en.trim() !== "" && (dirty || row.needs_review);

  return (
    <tr className="border-b border-line/40">
      <td className="py-2 pr-4 font-mono text-sm text-ink/50 text-right whitespace-nowrap">{index}</td>
      <td className="py-2 pr-4 font-mono text-sm text-ink/80 whitespace-nowrap max-w-[16rem] truncate" title={row.zh}>
        {row.zh}
      </td>
      <td className="py-2 pr-4">
        <input
          value={en}
          onChange={(e) => setEn(e.target.value)}
          className="w-full min-w-[14rem] font-mono text-sm px-2 py-1 border border-line/60 bg-paper focus:outline-none focus:border-brand/60"
        />
      </td>
      <td className="py-2 pr-4 whitespace-nowrap font-sans text-xs text-ink/50">{SOURCE_LABELS[row.source] ?? row.source}</td>
      <td className="py-2 pr-4 whitespace-nowrap">
        {row.needs_review ? (
          <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5">
            <AlertTriangle size={11} /> 待審核
          </span>
        ) : (
          <span className="font-sans text-xs text-ink/50">已審核</span>
        )}
      </td>
      <td className="py-2 pr-2 text-right whitespace-nowrap">
        <button
          onClick={() => onSave(row.zh, en.trim())}
          disabled={!canSave || busy}
          className="p-1.5 text-ink/50 hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="儲存（會標記為已審核）"
        >
          <Save size={15} />
        </button>
        <button
          onClick={() => onDelete(row.zh)}
          disabled={busy}
          className="p-1.5 text-ink/50 hover:text-red-600 disabled:opacity-30 transition-colors"
          title="刪除"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

function GlossarySection({
  kind,
  title,
  api,
  token,
  onUnauthorized,
}: {
  kind: Kind;
  title: string;
  api: string;
  token: string;
  onUnauthorized: () => void;
}) {
  const [rows, setRows] = useState<GlossaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [search, setSearch] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [newZh, setNewZh] = useState("");
  const [newEn, setNewEn] = useState("");

  const endpoint = `${api}/api/v1/admin/translations/${kind}`;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await authFetch(`${endpoint}?needsReview=${needsReviewOnly}`, token);
        if (res.status === 401) return onUnauthorized();
        if (!res.ok) throw new Error();
        setRows(await res.json());
      } catch {
        setFeedback({ type: "error", msg: "載入失敗，請重新整理頁面再試一次" });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [endpoint, needsReviewOnly, token, onUnauthorized]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.zh.includes(q) || r.en.toLowerCase().includes(q));
  }, [rows, search]);

  const save = async (zh: string, en: string) => {
    if (!en) return;
    setBusy(true);
    try {
      const res = await authFetch(endpoint, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zh, en }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error();
      // A human save always clears needs_review server-side — reflect that
      // immediately rather than waiting for a reload.
      setRows((prev) => prev.map((r) => (r.zh === zh ? { ...r, en, source: "human", needs_review: false } : r)));
      setFeedback({ type: "success", msg: `已更新「${zh}」` });
    } catch {
      setFeedback({ type: "error", msg: "儲存失敗" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (zh: string) => {
    if (!window.confirm(`確定要刪除「${zh}」嗎？`)) return;
    setBusy(true);
    try {
      const res = await authFetch(`${endpoint}?zh=${encodeURIComponent(zh)}`, token, { method: "DELETE" });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error();
      setRows((prev) => prev.filter((r) => r.zh !== zh));
      setFeedback({ type: "success", msg: `已刪除「${zh}」` });
    } catch {
      setFeedback({ type: "error", msg: "刪除失敗" });
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const zh = newZh.trim();
    const en = newEn.trim();
    if (!zh || !en) return;
    await save(zh, en);
    setRows((prev) =>
      prev.some((r) => r.zh === zh) ? prev : [...prev, { zh, en, source: "human", needs_review: false }].sort((a, b) => a.zh.localeCompare(b.zh)),
    );
    setNewZh("");
    setNewEn("");
  };

  const needsReviewCount = rows.filter((r) => r.needs_review).length;

  return (
    <section className="mb-16">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <h2 className="font-serif font-black text-xl text-ink">
          {title} <span className="font-mono text-sm text-ink/40">({rows.length})</span>
        </h2>
        {needsReviewCount > 0 && !needsReviewOnly && (
          <button
            onClick={() => setNeedsReviewOnly(true)}
            className="font-mono text-xs text-amber-700 hover:underline"
          >
            {needsReviewCount} 筆待審核
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={newZh}
          onChange={(e) => setNewZh(e.target.value)}
          placeholder="中文名稱"
          className="w-40 font-mono text-sm px-3 py-2 border border-line bg-white focus:outline-none focus:border-brand/60"
        />
        <input
          value={newEn}
          onChange={(e) => setNewEn(e.target.value)}
          placeholder="English name"
          className="flex-1 min-w-[8rem] font-mono text-sm px-3 py-2 border border-line bg-white focus:outline-none focus:border-brand/60"
        />
        <button
          onClick={add}
          disabled={busy || !newZh.trim() || !newEn.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white hover:bg-ink/80 disabled:opacity-30 disabled:cursor-not-allowed font-sans text-sm font-bold transition-colors"
        >
          <Plus size={16} /> 新增
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[10rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋中文或英文…"
            className="w-full font-mono text-sm pl-9 pr-3 py-2 border border-line/60 bg-white focus:outline-none focus:border-brand/60"
          />
        </div>
        <label className="inline-flex items-center gap-2 font-sans text-sm text-ink/60 cursor-pointer">
          <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} className="accent-brand" />
          只顯示待審核
        </label>
      </div>

      {feedback && (
        <div className={`mb-3 px-4 py-2 font-sans text-sm font-bold ${feedback.type === "success" ? "text-ink/70" : "text-red-600"}`}>
          {feedback.msg}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-ink/40">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-line max-h-[28rem] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-line font-sans text-xs font-bold text-ink/60 text-left [&>th]:px-4 [&>th]:py-2 [&>th]:whitespace-nowrap">
                <th scope="col" className="text-right">編號</th>
                <th scope="col">中文名稱</th>
                <th scope="col">英文名稱</th>
                <th scope="col">來源</th>
                <th scope="col">審核狀態</th>
                <th scope="col" className="text-right">操作</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-4">
              {filtered.map((r, i) => (
                <GlossaryEditRow key={r.zh} index={i + 1} row={r} onSave={save} onDelete={remove} busy={busy} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center font-mono text-sm text-ink/40" colSpan={6}>
                    查無符合的項目
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminGlossaryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-ink/40">
          <Loader2 size={28} className="animate-spin" />
        </div>
      }
    >
      <GlossaryTabs />
    </Suspense>
  );
}

function GlossaryTabs() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: TabId = TABS.find(({ id }) => id === requestedTab)?.id ?? "races";
  const router = useRouter();
  const { token } = useAdminAuth();
  const api = getApiBase();

  const handleUnauthorized = useCallback(() => {
    clearStoredToken();
    router.push("/admin/login");
  }, [router]);

  const selectTab = (id: TabId) => {
    router.replace(`/admin/glossary?tab=${id}`, { scroll: false });
  };

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const step = event.key === "ArrowRight" ? 1 : TABS.length - 1;
    const next = TABS[(TABS.findIndex(({ id }) => id === tab) + step) % TABS.length].id;
    selectTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center py-24 text-ink/40">
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  return (
    <AdminPage
      title="譯名"
      accent="管理"
      description="管理賽事、山岳和城市的英文名稱，會用在英文版網站。AI 翻譯的名稱會先標成「待審核」，修正後立刻套用到既有的所有文章。"
    >

        <div role="tablist" aria-label="譯名類別" className="flex gap-2 mb-8 border-b border-line">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => selectTab(id)}
              onKeyDown={handleTabKey}
              className={`min-h-11 px-5 -mb-px border-b-2 font-sans text-base font-bold transition-colors ${
                tab === id ? "border-brand text-brand" : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* All three stay mounted so switching tabs keeps searches and unsaved edits. */}
        <div id="panel-races" role="tabpanel" aria-labelledby="tab-races" hidden={tab !== "races"}>
          <GlossarySection kind="races" title="賽事名稱" api={api} token={token} onUnauthorized={handleUnauthorized} />
        </div>
        <div id="panel-mountains" role="tabpanel" aria-labelledby="tab-mountains" hidden={tab !== "mountains"}>
          <GlossarySection kind="mountains" title="山岳名稱" api={api} token={token} onUnauthorized={handleUnauthorized} />
        </div>
        <div id="panel-cities" role="tabpanel" aria-labelledby="tab-cities" hidden={tab !== "cities"}>
          <CityTranslationsSection api={api} token={token} onUnauthorized={handleUnauthorized} />
        </div>
    </AdminPage>
  );
}
