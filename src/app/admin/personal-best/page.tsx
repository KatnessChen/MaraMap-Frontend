"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { useAdminAuth, getStoredToken, clearStoredToken } from "@/hooks/useAdminAuth";

type Status = "idle" | "loading" | "success" | "error";

export default function AdminPersonalBestPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  useAdminAuth();

  const recompute = async () => {
    const token = getStoredToken();
    if (!token) {
      router.push("/admin/login");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(
        `${getApiBase()}/api/v1/personal-best/recompute`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.status === 401) {
        clearStoredToken();
        router.push("/admin/login");
        return;
      }
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-paper">
      <main className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-ink/50 hover:text-brand font-sans text-base font-bold mb-10 transition-colors"
        >
          <ArrowLeft size={18} /> 回文章管理
        </Link>

        <h1 className="font-serif font-black text-3xl text-ink tracking-tight mb-2">
          個人<span className="text-brand">最佳成績</span>
        </h1>
        <p className="font-sans text-base text-ink/60 mb-8">
          個人最佳成績為即時計算並暫存。匯入資料或在系統外異動後，可在此手動重新計算，讓前台立即反映。
        </p>

        <div className="bg-white border border-line p-6 sm:p-8">
          <button
            onClick={recompute}
            disabled={status === "loading"}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-brand text-white hover:bg-brand/85 disabled:opacity-60 disabled:cursor-not-allowed font-sans text-base font-bold rounded-full transition-all shadow-sm"
          >
            {status === "loading" ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <RefreshCw size={20} />
            )}
            重新計算個人最佳成績
          </button>

          {status === "success" && (
            <p className="mt-6 inline-flex items-center gap-2 font-sans text-base font-bold text-green-700">
              <CheckCircle2 size={20} /> 成功
            </p>
          )}
          {status === "error" && (
            <p className="mt-6 inline-flex items-center gap-2 font-sans text-base font-bold text-brand">
              <XCircle size={20} /> 失敗
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
