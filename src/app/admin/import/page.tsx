"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud, Loader2 } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";

interface SkippedPost {
  timestamp: number;
  date: string;
  title: string | null;
  text: string | null;
}

interface RescuedPost {
  timestamp: number;
  category: string;
  sub_categories?: string[];
}

type PipelineEvent =
  | { type: "stage-start"; stage: string; index: number; total: number }
  | { type: "log"; stage: string; stream: "stdout" | "stderr"; line: string }
  | { type: "stage-end"; stage: string; exitCode: number }
  | { type: "error"; stage: string; message: string }
  | { type: "ready-for-review"; batch: string; skipped: SkippedPost[] }
  | { type: "done"; success: boolean; summary: string };

type Phase = "idle" | "preparing" | "review" | "finalizing" | "done";

const CATEGORIES = ["馬拉松", "旅遊", "登山"];
const SUB_CATEGORY_MAP: Record<string, string[]> = {
  馬拉松: ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "七大馬", "普查"],
  旅遊: [],
  登山: ["大百岳", "小百岳", "海外登山"],
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
  const [skipped, setSkipped] = useState<SkippedPost[]>([]);
  const [rescueChoices, setRescueChoices] = useState<Record<number, { category: string; sub_categories: string[] }>>({});
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) router.push("/admin/login");
  }, [router]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const appendLine = (line: string) => setLines((prev) => [...prev, line]);

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
      setSkipped(event.skipped);
      if (event.skipped.length === 0) {
        void confirmImport(event.batch, []);
      } else {
        setPhase("review");
      }
    } else if (event.type === "done") {
      setResult({ success: event.success, summary: event.summary });
      setPhase("done");
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
    setSkipped([]);
    setRescueChoices({});

    const apiUrl = getApiBase();
    const formData = new FormData();
    formData.append("file", file); // don't set Content-Type manually — browser sets the multipart boundary

    try {
      await streamPipeline(
        `${apiUrl}/api/v1/admin/fb-import`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData },
        handleEvent,
        appendLine,
      );
    } catch (err) {
      appendLine(`❌ ${(err as Error).message}`);
      setResult({ success: false, summary: "連線失敗，請檢查網路狀態。" });
      setPhase("done");
    }
  };

  const confirmImport = async (targetBatch: string, rescued: RescuedPost[]) => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }

    setPhase("finalizing");
    setLines([]);

    const apiUrl = getApiBase();
    try {
      await streamPipeline(
        `${apiUrl}/api/v1/admin/fb-import/${targetBatch}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rescued }),
        },
        handleEvent,
        appendLine,
      );
    } catch (err) {
      appendLine(`❌ ${(err as Error).message}`);
      setResult({ success: false, summary: "連線失敗，請檢查網路狀態。" });
      setPhase("done");
    }
  };

  const setChoiceCategory = (timestamp: number, category: string) => {
    setRescueChoices((prev) => {
      const next = { ...prev };
      if (!category) {
        delete next[timestamp];
      } else {
        next[timestamp] = { category, sub_categories: [] };
      }
      return next;
    });
  };

  const toggleSubCategory = (timestamp: number, sub: string) => {
    setRescueChoices((prev) => {
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
  };

  const submitReview = () => {
    if (!batch) return;
    const rescued: RescuedPost[] = Object.entries(rescueChoices).map(([ts, choice]) => ({
      timestamp: Number(ts),
      category: choice.category,
      sub_categories: choice.sub_categories,
    }));
    void confirmImport(batch, rescued);
  };

  const isStreaming = phase === "preparing" || phase === "finalizing";

  return (
    <div className="min-h-screen bg-paper p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold mb-6 transition-colors">
          <ArrowLeft size={16} /> 返回文章列表
        </Link>
        <h1 className="font-serif font-black text-4xl text-ink tracking-tight mb-2">
          匯入 <span className="text-brand">Facebook</span> 資料
        </h1>
        <p className="font-sans text-sm text-ink/50 mb-8">
          上傳「下載你的資訊」匯出的 zip 檔案，系統將自動解析、分類、分析並匯入文章。此功能僅限本機開發環境使用。
        </p>

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
            <h2 className="font-serif font-black text-2xl text-ink mb-2">
              有 {skipped.length} 篇文章被 AI 判定為略過
            </h2>
            <p className="font-sans text-sm text-ink/50 mb-6">
              以下文章沒有被自動分類。若要救回，請選擇分類；不處理則維持略過（不會匯入）。其他欄位（標題、日期等）可在匯入後於後台編輯。
            </p>
            <div className="space-y-4 mb-6">
              {skipped.map((post) => {
                const choice = rescueChoices[post.timestamp];
                const subOptions = choice ? SUB_CATEGORY_MAP[choice.category] ?? [] : [];
                return (
                  <div key={post.timestamp} className="border border-line/60 p-4 rounded">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-ink/40">{post.date}</p>
                        <p className="font-serif font-bold text-ink truncate">{post.title || "（無標題）"}</p>
                        <p className="font-sans text-xs text-ink/50 line-clamp-2 mt-1">{post.text}</p>
                      </div>
                      <select
                        value={choice?.category ?? ""}
                        onChange={(e) => setChoiceCategory(post.timestamp, e.target.value)}
                        className="shrink-0 border border-line px-3 py-2 font-sans text-sm rounded"
                      >
                        <option value="">不匯入</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    {choice && subOptions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {subOptions.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => toggleSubCategory(post.timestamp, sub)}
                            className={`px-3 py-1 text-xs font-sans font-bold rounded-full border transition-all ${
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
              確認並繼續匯入
            </button>
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

        {phase !== "review" && (
          <div
            ref={logRef}
            className="bg-ink text-green-400 font-mono text-xs p-4 rounded h-[60vh] overflow-y-auto whitespace-pre-wrap"
          >
            {lines.length === 0 ? (
              <span className="text-white/30">尚未開始匯入。選擇 zip 檔案後點擊「開始匯入」。</span>
            ) : (
              lines.join("\n")
            )}
          </div>
        )}
      </div>
    </div>
  );
}
