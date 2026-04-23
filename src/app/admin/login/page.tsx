"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("maramap_admin_token", data.token);
        localStorage.setItem("maramap_admin_login_time", Date.now().toString());
        router.push(redirect);
      } else {
        setError("帳號或密碼錯誤。");
      }
    } catch {
      setError("連線錯誤，請稍後再試。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <header className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-base font-bold mb-10 transition-colors">
            <ArrowLeft size={18} /> 回網站首頁
          </Link>
          <div className="w-20 h-20 bg-ink text-paper rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Lock size={32} />
          </div>
          <h1 className="font-serif font-black text-4xl text-ink tracking-tight">管理員 <span className="text-brand">登入</span></h1>
          {redirect !== "/admin" && (
            <p className="font-sans text-sm text-ink/40 mt-3">登入後將自動跳轉至目標頁面</p>
          )}
        </header>

        <form onSubmit={handleLogin} className="space-y-8">
          <div>
            <label className="block font-sans text-sm font-black uppercase tracking-widest text-ink/60 mb-3">帳號</label>
            <input
              type="text"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white border border-line p-5 font-sans text-xl focus:outline-none focus:border-brand transition-colors shadow-sm"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block font-sans text-sm font-black uppercase tracking-widest text-ink/60 mb-3">密碼</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white border border-line p-5 font-sans text-xl focus:outline-none focus:border-brand transition-colors shadow-sm"
              placeholder="請輸入密碼"
            />
          </div>

          {error && <div className="text-brand font-sans text-base font-bold text-center">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-ink text-paper py-5 rounded-full font-sans text-xl font-bold tracking-[0.3em] hover:bg-brand transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-xl"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : "登入系統"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
