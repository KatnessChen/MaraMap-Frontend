"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Search, AlertTriangle } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { useAdminAuth, clearStoredToken } from "@/hooks/useAdminAuth";
import { authFetch } from "@/utils/authFetch";

interface GlossaryRow {
  zh: string;
  en: string;
  source: string;
  needs_review: boolean;
}

type Feedback = { type: "success" | "error"; msg: string } | null;
type Kind = "races" | "mountains";

function GlossaryEditRow({
  row,
  onSave,
  onDelete,
  busy,
}: {
  row: GlossaryRow;
  onSave: (zh: string, en: string) => Promise<void>;
  onDelete: (zh: string) => void;
  busy: boolean;
}) {
  const [en, setEn] = useState(row.en);
  const dirty = en.trim() !== row.en && en.trim() !== "";

  return (
    <tr className="border-b border-line/40">
      <td className="py-2 pr-4 font-mono text-sm text-ink/80 whitespace-nowrap max-w-[16rem] truncate" title={row.zh}>
        {row.zh}
      </td>
      <td className="py-2 pr-4">
        <input
          value={en}
          onChange={(e) => setEn(e.target.value)}
          className="w-full font-mono text-sm px-2 py-1 border border-line/60 bg-paper focus:outline-none focus:border-brand/60"
        />
      </td>
      <td className="py-2 pr-4 whitespace-nowrap">
        {row.needs_review ? (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5">
            <AlertTriangle size={11} /> 待審核 · {row.source}
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/30">{row.source}</span>
        )}
      </td>
      <td className="py-2 pr-2 text-right whitespace-nowrap">
        <button
          onClick={() => onSave(row.zh, en.trim())}
          disabled={!dirty || busy}
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
  hint,
  api,
  token,
  onUnauthorized,
}: {
  kind: Kind;
  title: string;
  hint: string;
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
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
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
      <p className="font-sans text-sm text-ink/60 mb-4">{hint}</p>

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
            <tbody className="[&>tr>td]:px-4">
              {filtered.map((r) => (
                <GlossaryEditRow key={r.zh} row={r} onSave={save} onDelete={remove} busy={busy} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center font-mono text-sm text-ink/40" colSpan={4}>
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
  const router = useRouter();
  const { token } = useAdminAuth();
  const api = getApiBase();

  const handleUnauthorized = useCallback(() => {
    clearStoredToken();
    router.push("/admin/login");
  }, [router]);

  if (!token) {
    return (
      <div className="flex items-center justify-center py-24 text-ink/40">
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b-2 border-ink pb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold transition-colors mb-4"
          >
            <ArrowLeft size={16} /> 回文章管理
          </Link>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-ink tracking-tight mb-2">
            賽事 / 山岳<span className="text-brand">名稱審核</span>
          </h1>
          <p className="font-sans text-sm text-ink/60">
            AI 翻譯猜不到官方英文名稱時會先存一筆「待審核」的猜測，讓同一場賽事之後的文章維持名稱一致；
            這裡review、修正這些猜測。修正後的名稱立刻套用到既有的所有文章。
          </p>
        </header>

        <GlossarySection
          kind="races"
          title="賽事名稱"
          hint="鍵值須與文章 metadata.race_name 完全一致（去除年份前綴、臺/台變體後）才會套用。"
          api={api}
          token={token}
          onUnauthorized={handleUnauthorized}
        />
        <GlossarySection
          kind="mountains"
          title="山岳名稱"
          hint="鍵值須與文章 metadata.mountain_name 完全一致（去除臺/台變體後）才會套用。"
          api={api}
          token={token}
          onUnauthorized={handleUnauthorized}
        />
      </div>
    </div>
  );
}
