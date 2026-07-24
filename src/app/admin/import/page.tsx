"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";

interface ReviewPost {
  timestamp: number;
  date: string;
  title: string | null;
  text: string | null;
  category: string;
  sub_categories: string[];
}

interface CategoryEdit {
  timestamp: number;
  category: string;
  sub_categories: string[];
}

interface ImportState {
  batch: string;
  phase: "review" | "finalizing" | "done" | "failed";
  postCount: number;
  updatedAt: string;
  summary?: string;
}

type PipelineEvent =
  | { type: "stage-start"; stage: string; index: number; total: number }
  | { type: "log"; stage: string; stream: "stdout" | "stderr"; line: string }
  | { type: "stage-end"; stage: string; exitCode: number }
  | { type: "error"; stage: string; message: string }
  | { type: "ready-for-review"; batch: string; posts: ReviewPost[] }
  | { type: "done"; success: boolean; summary: string };

type Phase = "idle" | "preparing" | "review" | "finalizing" | "done";

const CATEGORIES = ["馬拉松", "登山", "旅遊"];
const SUB_CATEGORY_MAP: Record<string, string[]> = {
  馬拉松: ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "九大馬", "普查"],
  登山: ["大百岳", "小百岳", "海外登山"],
  旅遊: [],
};

async function streamPipeline(
  url: string,
  init: RequestInit,
  onEvent: (event: PipelineEvent) => void,
  onLine: (line: string) => void,
): Promise<void> {
  const res = await fetch(url, init);

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    onLine(`❌ HTTP ${res.status}: ${text}`);
    onEvent({ type: "done", success: false, summary: `請求失敗（${res.status}）` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let event: PipelineEvent;
      try { event = JSON.parse(part); } catch { continue; }
      onEvent(event);
    }
  }
}

export default function AdminImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; summary: string } | null>(null);
  const [batch, setBatch] = useState<string | null>(null);
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [edits, setEdits] = useState<Record<number, { category: string; sub_categories: string[] }>>({});
  const [pending, setPending] = useState<ImportState[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const appendLine = (line: string) => setLines((prev) => [...prev, line]);

  const seedEdits = (list: ReviewPost[]) =>
    setEdits(
      Object.fromEntries(
        list.map((p) => [p.timestamp, { category: p.category, sub_categories: p.sub_categories ?? [] }]),
      ),
    );

  // An unfinished batch survives a page close, so offer to pick it back up.
  const loadPending = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${getApiBase()}/api/v1/admin/fb-import/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPending(data.batches ?? []);
    } catch {
      /* the resume banner is a convenience — a failed probe shouldn't block a fresh import */
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }
    void loadPending(token);
  }, [router, loadPending]);

  const resumeBatch = async (targetBatch: string) => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }

    const res = await fetch(`${getApiBase()}/api/v1/admin/fb-import/${targetBatch}/review`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      appendLine(`❌ 無法載入批次 ${targetBatch}（HTTP ${res.status}）`);
      return;
    }
    const data: { state: ImportState; posts: ReviewPost[] } = await res.json();
    setBatch(targetBatch);
    setPosts(data.posts);
    seedEdits(data.posts);
    setResult(null);
    setLines([`已接續批次 ${targetBatch}（${data.posts.length} 篇，分類於 ${new Date(data.state.updatedAt).toLocaleString()} 完成）`]);
    setPhase("review");
  };

  const cancelBatch = async (targetBatch: string) => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }

    const state = pending.find((s) => s.batch === targetBatch);
    const warning =
      state?.phase === "finalizing"
        ? "\n\n注意：這個批次上次中斷在匯入階段，可能已有部分文章寫入資料庫。取消只會刪掉本機檔案，不會移除已匯入的文章。"
        : "";
    if (!window.confirm(`確定要取消批次 ${targetBatch}？\n解壓縮的檔案與分類結果會移到垃圾桶，需要重新上傳 zip 才能再匯入。${warning}`)) {
      return;
    }

    setCancelling(targetBatch);
    try {
      const res = await fetch(`${getApiBase()}/api/v1/admin/fb-import/${targetBatch}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        appendLine(`❌ 取消失敗（HTTP ${res.status}）：${body.message ?? ""}`);
        return;
      }
      const data: { removed: string[] } = await res.json();
      appendLine(`🗑️ 已取消批次 ${targetBatch}，${data.removed.length} 個資料夾移至垃圾桶。`);
      await loadPending(token);
    } catch (err) {
      appendLine(`❌ 取消失敗：${(err as Error).message}`);
    } finally {
      setCancelling(null);
    }
  };

  const handleEvent = (event: PipelineEvent) => {
    if (event.type === "log") {
      appendLine(`[${event.stage}] ${event.line}`);
    } else if (event.type === "stage-start") {
      appendLine(`\n=== ▶ ${event.stage} (${event.index}/${event.total}) ===`);
    } else if (event.type === "stage-end") {
      appendLine(`=== ${event.stage} exited ${event.exitCode} ===`);
    } else if (event.type === "error") {
      appendLine(`❌ [${event.stage}] ${event.message}`);
    } else if (event.type === "ready-for-review") {
      setBatch(event.batch);
      setPosts(event.posts);
      seedEdits(event.posts);
      setPhase("review");
    } else if (event.type === "done") {
      setResult({ success: event.success, summary: event.summary });
      setPhase("done");
      const token = localStorage.getItem("maramap_admin_token");
      if (token) void loadPending(token);
    }
  };

  const startImport = async () => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }
    if (!file) return;

    setPhase("preparing");
    setLines([]);
    setResult(null);
    setBatch(null);
    setPosts([]);
    setEdits({});

    const formData = new FormData();
    formData.append("file", file); // don't set Content-Type manually — browser sets the multipart boundary

    try {
      await streamPipeline(
        `${getApiBase()}/api/v1/admin/fb-import`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData },
        handleEvent,
        appendLine,
      );
    } catch (err) {
      appendLine(`❌ ${(err as Error).message}`);
      setResult({ success: false, summary: "連線中斷。若分類已完成，可重新整理頁面接續未完成的批次。" });
      setPhase("done");
    }
  };

  const confirmImport = async (targetBatch: string, categoryEdits: CategoryEdit[]) => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }

    setPhase("finalizing");
    setLines([]);

    try {
      await streamPipeline(
        `${getApiBase()}/api/v1/admin/fb-import/${targetBatch}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ edits: categoryEdits }),
        },
        handleEvent,
        appendLine,
      );
    } catch (err) {
      appendLine(`❌ ${(err as Error).message}`);
      setResult({ success: false, summary: "連線中斷。重新整理頁面可接續這個批次。" });
      setPhase("done");
    }
  };

  const setCategory = (timestamp: number, category: string) =>
    setEdits((prev) => ({ ...prev, [timestamp]: { category, sub_categories: [] } }));

  const toggleSubCategory = (timestamp: number, sub: string) =>
    setEdits((prev) => {
      const current = prev[timestamp];
      if (!current) return prev;
      const has = current.sub_categories.includes(sub);
      return {
        ...prev,
        [timestamp]: {
          ...current,
          sub_categories: has
            ? current.sub_categories.filter((s) => s !== sub)
            : [...current.sub_categories, sub],
        },
      };
    });

  const submitReview = () => {
    if (!batch) return;
    // Send every post, not just the changed ones — the server treats this as the
    // authoritative classification, so there's no diff to get wrong.
    void confirmImport(
      batch,
      posts.map((p) => ({
        timestamp: p.timestamp,
        category: edits[p.timestamp]?.category ?? p.category,
        sub_categories: edits[p.timestamp]?.sub_categories ?? p.sub_categories ?? [],
      })),
    );
  };

  const isStreaming = phase === "preparing" || phase === "finalizing";
  const counts = CATEGORIES.map((c) => ({
    category: c,
    count: posts.filter((p) => (edits[p.timestamp]?.category ?? p.category) === c).length,
  }));

  return (
    <div className="min-h-screen bg-paper p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold mb-6 transition-colors">
          <ArrowLeft size={16} /> 返回後台首頁
        </Link>
        <h1 className="font-serif font-black text-4xl text-ink tracking-tight mb-2">
          匯入 <span className="text-brand">Facebook</span> 資料
        </h1>

        {phase === "idle" && pending.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-6 mb-8 rounded">
            <h2 className="font-sans font-bold text-base text-amber-900 mb-1">有未完成的匯入</h2>
            <p className="font-sans text-sm text-amber-800/80 mb-4">
              分類結果已保存在本機，可直接接續，不需重新上傳 zip。
            </p>
            <div className="space-y-2">
              {pending.map((s) => (
                <div key={s.batch} className="flex items-center justify-between gap-4 bg-white border border-amber-200 px-4 py-3 rounded">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink/50 truncate">{s.batch}</p>
                    <p className="font-sans text-sm text-ink">
                      {s.postCount} 篇 · {new Date(s.updatedAt).toLocaleString()}
                      {s.phase === "finalizing" && " · 上次中斷於匯入階段"}
                    </p>
                    {s.summary && <p className="font-sans text-xs text-red-700 mt-1">{s.summary}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => void cancelBatch(s.batch)}
                      disabled={cancelling === s.batch}
                      className="px-4 py-2 bg-white text-ink/60 font-sans font-bold text-sm rounded-full border border-line inline-flex items-center gap-2 hover:text-red-700 hover:border-red-300 disabled:opacity-40 transition-colors"
                    >
                      {cancelling === s.batch ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />} 取消
                    </button>
                    <button
                      onClick={() => void resumeBatch(s.batch)}
                      disabled={cancelling === s.batch}
                      className="px-4 py-2 bg-amber-600 text-white font-sans font-bold text-sm rounded-full inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-40 transition-colors"
                    >
                      <RotateCcw size={14} /> 接續
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase !== "review" && (
          <div className="bg-white border border-line p-8 shadow-sm mb-8 flex items-center gap-4">
            <input
              type="file"
              accept=".zip"
              disabled={isStreaming}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="flex-1 font-sans text-sm"
            />
            <button
              onClick={startImport}
              disabled={!file || isStreaming}
              className="px-6 py-3 bg-brand text-white font-sans font-bold text-sm rounded-full disabled:opacity-40 inline-flex items-center gap-2 transition-all hover:bg-brand/80"
            >
              {isStreaming ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
              {phase === "preparing" ? "解析中…" : phase === "finalizing" ? "匯入中…" : "開始匯入"}
            </button>
          </div>
        )}

        {phase === "review" && (
          <div className="bg-white border border-line p-8 shadow-sm mb-8">
            <h2 className="font-serif font-black text-2xl text-ink mb-1">確認分類</h2>
            <p className="font-sans text-sm text-ink/60 mb-2">
              共 {posts.length} 篇，全部都會匯入。AI 已先給每篇一個分類，不確定的一律歸為「旅遊」，請逐篇確認後再繼續。
            </p>
            <p className="font-sans text-sm text-ink/60 mb-6">
              {counts.map((c) => `${c.category} ${c.count}`).join(" · ")}
            </p>

            <div className="space-y-4 mb-6">
              {posts.map((post) => {
                const choice = edits[post.timestamp] ?? { category: post.category, sub_categories: post.sub_categories ?? [] };
                const subOptions = SUB_CATEGORY_MAP[choice.category] ?? [];
                const changed = choice.category !== post.category;
                return (
                  <div key={post.timestamp} className="border border-line/60 p-4 rounded">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-ink/50">{post.date}</p>
                        <p className="font-sans font-bold text-base text-ink truncate">{post.title || "（無標題）"}</p>
                        <p className="font-sans text-sm text-ink/60 line-clamp-3 mt-1 whitespace-pre-wrap">{post.text}</p>
                      </div>
                      <div className="shrink-0 flex gap-1">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c}
                            onClick={() => setCategory(post.timestamp, c)}
                            className={`px-3 py-2 font-sans font-bold text-sm rounded border transition-all ${
                              choice.category === c
                                ? "bg-brand text-white border-brand"
                                : "bg-paper text-ink/70 border-line hover:border-brand/50"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    {changed && (
                      <p className="font-sans text-xs text-amber-700 mb-2">已改為「{choice.category}」（AI 原判為「{post.category}」）</p>
                    )}
                    {subOptions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {subOptions.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => toggleSubCategory(post.timestamp, sub)}
                            className={`px-3 py-1.5 text-sm font-sans font-bold rounded-full border transition-all ${
                              choice.sub_categories.includes(sub)
                                ? "bg-brand text-white border-brand"
                                : "bg-paper text-ink/60 border-line"
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={submitReview}
              className="px-6 py-3 bg-brand text-white font-sans font-bold text-sm rounded-full inline-flex items-center gap-2 transition-all hover:bg-brand/80"
            >
              確認分類並繼續匯入
            </button>
            <p className="font-sans text-xs text-ink/50 mt-3">
              接下來會執行分析 → 格式化 → 合併 → 匯入資料庫 → 上傳圖片 → 行程歸戶 → 座標補齊，需要數分鐘。
            </p>
          </div>
        )}

        {result && (
          <div
            className={`p-4 mb-6 rounded font-sans font-bold text-sm ${
              result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.success ? "✅ " : "❌ "}{result.summary}
          </div>
        )}

        <div
          ref={logRef}
          className="bg-ink text-green-400 font-mono text-xs p-4 rounded h-[60vh] overflow-y-auto whitespace-pre-wrap"
        >
          {lines.length === 0 ? (
            <span className="text-white/40">尚未開始匯入。選擇 zip 檔案後點擊「開始匯入」。</span>
          ) : (
            lines.join("\n")
          )}
        </div>
      </div>
    </div>
  );
}
