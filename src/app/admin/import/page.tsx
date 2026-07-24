"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud, Loader2, RotateCcw, Trash2, ChevronDown, ChevronUp, Info, Check } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";

interface ReviewMedia {
  url: string;
  type: string;
}

interface ReviewPost {
  timestamp: number;
  date: string;
  title: string | null;
  text: string | null;
  category: string;
  sub_categories: string[];
  media?: ReviewMedia[];
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

type Phase = "idle" | "uploading" | "preparing" | "review" | "finalizing" | "done";

const CATEGORIES = ["馬拉松", "登山", "旅遊"];
const SUB_CATEGORY_MAP: Record<string, string[]> = {
  馬拉松: ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "九大馬", "普查"],
  登山: ["大百岳", "小百岳", "海外登山"],
  旅遊: [],
};

// XHR instead of fetch — fetch still has no upload progress events, and an
// 800MB direct-to-R2 PUT with no feedback looks frozen.
function uploadToR2(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/zip"); // must match the presigned Content-Type
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`上傳到雲端儲存失敗（HTTP ${xhr.status}）`));
    xhr.onerror = () => reject(new Error("上傳到雲端儲存失敗（網路或 CORS 問題）"));
    xhr.send(file);
  });
}

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
  // Timestamps the admin chose to skip — dropped from the import entirely.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  // Cards expanded to show full text + media preview.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState<ImportState[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  // Any click anywhere dismisses the help tooltip. The listener is added only
  // while it's open, and on the next tick so the click that opened it (which is
  // still propagating) doesn't immediately close it again.
  useEffect(() => {
    if (!helpOpen) return;
    const close = () => setHelpOpen(false);
    const id = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [helpOpen]);

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
    setSkipped(new Set());
    setExpanded(new Set());
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
        ? "\n\n注意：這個批次上次中斷在匯入階段，可能已有部分文章寫入資料庫。取消只會刪掉雲端暫存檔，不會移除已匯入的文章。"
        : "";
    if (!window.confirm(`確定要取消批次 ${targetBatch}？\n雲端暫存檔（zip、媒體、分類結果）將被刪除，需要重新上傳 zip 才能再匯入。${warning}`)) {
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
      const data: { removed: string[]; r2Objects: number } = await res.json();
      appendLine(`🗑️ 已取消批次 ${targetBatch}，刪除 ${data.r2Objects} 個雲端暫存物件。`);
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
      setSkipped(new Set());
      setExpanded(new Set());
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

    setPhase("uploading");
    setLines([]);
    setResult(null);
    setBatch(null);
    setPosts([]);
    setEdits({});
    setSkipped(new Set());
    setExpanded(new Set());

    try {
      // 1. Ask the backend for a presigned URL, then PUT the zip straight to
      //    R2 — Cloud Run's request body cap (32MB) never sees the file.
      const urlRes = await fetch(`${getApiBase()}/api/v1/admin/fb-import/upload-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!urlRes.ok) throw new Error(`無法取得上傳位址（HTTP ${urlRes.status}）`);
      const { batch: newBatch, url } = (await urlRes.json()) as { batch: string; url: string };

      appendLine(`⬆️ 直接上傳到雲端儲存（${(file.size / 1e6).toFixed(0)} MB）…`);
      let lastLogged = -10;
      await uploadToR2(url, file, (pct) => {
        if (pct >= lastLogged + 10) {
          lastLogged = pct;
          appendLine(`   上傳進度 ${pct}%`);
        }
      });
      appendLine("✅ 上傳完成，開始雲端解析…");

      // 2. Kick off the prepare pipeline against the uploaded zip.
      setPhase("preparing");
      await streamPipeline(
        `${getApiBase()}/api/v1/admin/fb-import/${newBatch}/prepare`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        handleEvent,
        appendLine,
      );
    } catch (err) {
      appendLine(`❌ ${(err as Error).message}`);
      setResult({ success: false, summary: "連線中斷。若分類已完成，可重新整理頁面接續未完成的批次。" });
      setPhase("done");
    }
  };

  // A batch whose prepare half failed keeps its zip in R2 — retry the parse
  // without re-uploading anything.
  const retryPrepare = async (targetBatch: string) => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }

    setPhase("preparing");
    setLines([`🔁 重試批次 ${targetBatch} 的雲端解析（zip 已在雲端，不需重新上傳）…`]);
    setResult(null);
    setBatch(null);
    setPosts([]);
    setEdits({});
    setSkipped(new Set());
    setExpanded(new Set());

    try {
      await streamPipeline(
        `${getApiBase()}/api/v1/admin/fb-import/${targetBatch}/prepare`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        handleEvent,
        appendLine,
      );
    } catch (err) {
      appendLine(`❌ ${(err as Error).message}`);
      setResult({ success: false, summary: "連線中斷。重新整理頁面可再次重試這個批次。" });
      setPhase("done");
    }
  };

  const confirmImport = async (targetBatch: string, categoryEdits: CategoryEdit[], skippedTimestamps: number[]) => {
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
          body: JSON.stringify({ edits: categoryEdits, skipped: skippedTimestamps }),
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

  const toggleSkip = (timestamp: number) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) next.delete(timestamp);
      else next.add(timestamp);
      return next;
    });

  const toggleExpand = (timestamp: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) next.delete(timestamp);
      else next.add(timestamp);
      return next;
    });

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
    // Send every post as the authoritative classification (no diff to get wrong)
    // plus the explicit skip list — the server drops skipped ones from the import.
    void confirmImport(
      batch,
      posts.map((p) => ({
        timestamp: p.timestamp,
        category: edits[p.timestamp]?.category ?? p.category,
        sub_categories: edits[p.timestamp]?.sub_categories ?? p.sub_categories ?? [],
      })),
      [...skipped],
    );
  };

  const isStreaming = phase === "uploading" || phase === "preparing" || phase === "finalizing";
  // An unresolved batch must be resumed or cancelled before a new one starts —
  // one import at a time keeps the batch/state model unambiguous.
  const hasPending = phase === "idle" && pending.length > 0;
  // Review list shown newest-first; a copy so the submit payload keeps every post.
  const orderedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);
  // Category tallies count only posts that will actually be imported.
  const importCount = posts.filter((p) => !skipped.has(p.timestamp)).length;
  const counts = CATEGORIES.map((c) => ({
    category: c,
    count: posts.filter((p) => !skipped.has(p.timestamp) && (edits[p.timestamp]?.category ?? p.category) === c).length,
  }));

  return (
    <div className="min-h-screen bg-paper p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold mb-6 transition-colors">
          <ArrowLeft size={16} /> 返回後台首頁
        </Link>
        <h1 className="font-serif font-black text-4xl text-ink tracking-tight mb-8">
          匯入 <span className="text-brand">Facebook</span> 資料
        </h1>

        {hasPending && (
          <div className="bg-amber-50 border border-amber-200 p-6 mb-4 rounded">
            <h2 className="font-sans font-bold text-base text-amber-900 mb-3">有未完成的匯入</h2>
            <div className="space-y-2">
              {pending.map((s) => (
                <div key={s.batch} className="flex items-center justify-between gap-4 bg-white border border-amber-200 px-4 py-3 rounded">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink/50 truncate mb-1.5">{s.batch}</p>
                    <p className="font-sans text-sm text-ink">
                      {s.postCount} 篇 · {new Date(s.updatedAt).toLocaleString()}
                      {s.phase === "finalizing" && " · 上次中斷於匯入階段"}
                      {s.phase === "failed" && " · 解析失敗，可重試"}
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
                      onClick={() =>
                        s.phase === "failed" ? void retryPrepare(s.batch) : void resumeBatch(s.batch)
                      }
                      disabled={cancelling === s.batch}
                      className="px-4 py-2 bg-amber-600 text-white font-sans font-bold text-sm rounded-full inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-40 transition-colors"
                    >
                      <RotateCcw size={14} /> {s.phase === "failed" ? "重試解析" : "繼續匯入"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase !== "review" && !hasPending && (
          <div className="bg-white border border-line p-8 shadow-sm mb-4 flex flex-wrap items-center gap-4">
            <label
              className={`inline-flex items-center gap-2 px-5 py-3 bg-paper border border-line font-sans font-bold text-sm rounded-full transition-colors ${
                isStreaming ? "opacity-40 pointer-events-none" : "cursor-pointer hover:border-brand/50 hover:text-brand"
              }`}
            >
              選擇 zip 檔案
              <input
                type="file"
                accept=".zip"
                disabled={isStreaming}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            <span className="flex-1 min-w-0 font-sans text-sm text-ink/50 truncate">
              {file ? file.name : "尚未選擇檔案"}
            </span>
            <button
              onClick={startImport}
              disabled={!file || isStreaming}
              className="px-6 py-3 bg-brand text-white font-sans font-bold text-sm rounded-full disabled:opacity-40 inline-flex items-center gap-2 transition-all hover:bg-brand/80"
            >
              {isStreaming ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
              {phase === "uploading" ? "上傳中…" : phase === "preparing" ? "解析中…" : phase === "finalizing" ? "匯入中…" : "開始匯入"}
            </button>
          </div>
        )}

        {phase === "review" && (
          <div className="bg-white border border-line p-8 shadow-sm mb-4">
            <h2 className="font-serif font-black text-2xl text-ink mb-2">確認分類</h2>
            <p className="font-sans text-sm text-ink/60 mb-6">
              共 {posts.length} 篇 · {counts.map((c) => `${c.category} ${c.count}`).join(" · ")} · 略過 {skipped.size}
            </p>

            <div className="space-y-3 mb-6">
              {orderedPosts.map((post) => {
                const choice = edits[post.timestamp] ?? { category: post.category, sub_categories: post.sub_categories ?? [] };
                const subOptions = SUB_CATEGORY_MAP[choice.category] ?? [];
                const changed = choice.category !== post.category;
                const isSkipped = skipped.has(post.timestamp);
                const isImported = !isSkipped;
                const isExpanded = expanded.has(post.timestamp);
                const media = post.media ?? [];
                return (
                  <div
                    key={post.timestamp}
                    className={`relative rounded-lg border-2 p-4 transition-all ${
                      isImported ? "border-brand bg-white" : "border-line/40 bg-ink/[0.02] opacity-60"
                    }`}
                  >
                    {/* 選取＝匯入（預設選取）；取消＝略過。凸出卡片左上角的圓形徽章 */}
                    <button
                      type="button"
                      onClick={() => toggleSkip(post.timestamp)}
                      title={isImported ? "取消選取以略過此篇" : "選取以匯入此篇"}
                      className={`absolute -top-3 -left-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-all ${
                        isImported
                          ? "border-white bg-brand text-white hover:scale-110"
                          : "border-line bg-white text-transparent hover:border-brand hover:text-brand/40"
                      }`}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>

                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(post.timestamp)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-mono text-xs text-ink/50">{post.date}</p>
                        <p className="font-sans font-bold text-base text-ink truncate">{post.title || "（無標題）"}</p>
                      </button>
                      <select
                        value={choice.category}
                        onChange={(e) => setCategory(post.timestamp, e.target.value)}
                        disabled={isSkipped}
                        className="shrink-0 px-4 py-2 bg-paper border border-line font-sans font-bold text-sm rounded focus:border-brand outline-none appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleExpand(post.timestamp)}
                        title={isExpanded ? "收合" : "展開看全文與圖片"}
                        className="shrink-0 p-2 text-ink/40 hover:text-brand transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    <div>
                      <p className={`font-sans text-sm text-ink/60 mt-2 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.text}
                      </p>

                      {isExpanded && media.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                          {media.map((m, i) =>
                            m.type === "video" ? (
                              <video key={i} src={m.url} controls preload="none" className="h-24 w-full rounded bg-ink/5 object-cover" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={m.url} loading="lazy" alt="" className="h-24 w-full rounded bg-ink/5 object-cover" />
                            ),
                          )}
                        </div>
                      )}

                      {isImported && changed && (
                        <p className="font-sans text-xs text-amber-700 mt-2">已改為「{choice.category}」（AI 原判為「{post.category}」）</p>
                      )}
                      {isImported && subOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {subOptions.map((sub) => (
                            <button
                              key={sub}
                              onClick={() => toggleSubCategory(post.timestamp, sub)}
                              className={`px-2.5 py-0.5 text-xs font-sans font-medium rounded-full border transition-all ${
                                choice.sub_categories.includes(sub)
                                  ? "bg-brand/10 text-brand border-brand/40"
                                  : "bg-transparent text-ink/40 border-line hover:border-brand/40 hover:text-ink/60"
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHelpOpen((o) => !o)}
                  title="接下來會發生什麼"
                  className="p-2 text-ink/40 hover:text-brand transition-colors"
                >
                  <Info size={18} />
                </button>
                {helpOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-72 rounded bg-ink p-3 text-xs font-sans leading-relaxed text-paper shadow-lg z-10">
                    接下來會執行分析 → 格式化 → 合併 → 匯入資料庫 → 發佈媒體 → 行程歸戶 → 座標補齊，需要數分鐘。
                  </div>
                )}
              </div>
              <button
                onClick={submitReview}
                disabled={importCount === 0}
                className="px-6 py-3 bg-brand text-white font-sans font-bold text-sm rounded-full inline-flex items-center gap-2 transition-all hover:bg-brand/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                確認並匯入 {importCount} 篇{skipped.size > 0 ? `（略過 ${skipped.size}）` : ""}
              </button>
            </div>
            {importCount === 0 && (
              <p className="font-sans text-xs text-red-600 mt-2 text-right">所有文章都被略過了，至少要保留一篇才能匯入。</p>
            )}
          </div>
        )}

        {result && (
          <div
            className={`p-4 mb-4 rounded font-sans font-bold text-sm ${
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
