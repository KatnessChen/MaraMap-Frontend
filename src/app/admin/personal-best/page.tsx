"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { useAdminAuth, getStoredToken, clearStoredToken } from "@/hooks/useAdminAuth";
import { authFetch } from "@/utils/authFetch";
import AdminPage from "@/components/admin/AdminPage";

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
      const res = await authFetch(
        `${getApiBase()}/api/v1/personal-best/recompute`,
        token,
        { method: "POST" },
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
    <AdminPage
      title="個人"
      accent="最佳成績"
      description="個人最佳成績為即時計算並暫存。匯入資料或在系統外異動後，可在此手動重新計算，讓前台立即反映。"
    >

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
    </AdminPage>
  );
}
