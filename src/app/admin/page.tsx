"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit2, Eye, EyeOff, Search, Loader2, ArrowLeft, LogOut, Calendar, Filter, ChevronUp, ChevronDown, Tag, X } from "lucide-react";

interface Post {
  id: string;
  event_date: string;
  title: string;
  category: string;
  is_hidden: boolean;
  tags: string[];
}

interface ApiResponse {
  data: Post[];
  meta: { total: number; limit: number; page?: number; last_page?: number; offset?: number };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 篩選與排序狀態
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [status, setStatus] = useState("all");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [tag, setTag] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const categories = ["全部", "馬拉松", "海外馬", "國內馬", "旅遊", "跑步訓練", "日常生活"];

  // Debounce 邏輯
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) {
      router.push("/admin/login");
      return;
    }

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        
        let url = "";
        const limit = 20;
        
        if (debouncedSearch) {
          // 使用模糊搜尋 API
          const params = new URLSearchParams({
            q: debouncedSearch,
            limit: limit.toString(),
            offset: ((page - 1) * limit).toString(),
            category: category === "全部" ? "" : category,
            // 注意：後端模糊搜尋 API 可能不支援所有管理後台的進階篩選（如日期範圍），
            // 這裡視後端實作而定。目前先傳入關鍵欄位。
          });
          url = `${apiUrl}/api/v1/posts/search?${params.toString()}`;
        } else {
          // 使用管理列表 API
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            status,
            order,
            category: category === "全部" ? "" : category,
            tag,
            startDate,
            endDate
          });
          url = `${apiUrl}/api/v1/posts?${params.toString()}&showHidden=true`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setPosts(json.data);
          
          // 統一 Meta 結構以便分頁器使用
          if (debouncedSearch) {
            setMeta({
              total: json.meta.total,
              limit: json.meta.limit,
              page: Math.floor(json.meta.offset! / json.meta.limit) + 1,
              last_page: Math.ceil(json.meta.total / json.meta.limit)
            });
          } else {
            setMeta(json.meta);
          }
        }
      } catch (error) {
        console.error("Failed to fetch admin posts:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPosts();
  }, [page, debouncedSearch, category, status, order, tag, startDate, endDate, router]);

  const toggleHidden = async (id: string, currentHidden: boolean) => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
      const res = await fetch(`${apiUrl}/api/v1/posts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ is_hidden: !currentHidden }),
      });
      if (res.ok) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, is_hidden: !currentHidden } : p));
      }
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("maramap_admin_token");
    router.push("/admin/login");
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCategory("全部");
    setStatus("all");
    setTag("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-paper p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b-2 border-ink pb-8">
          <div className="flex items-center gap-6">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold mb-4 transition-colors">
                <ArrowLeft size={16} /> 回網站首頁
              </Link>
              <h1 className="font-serif font-black text-4xl text-ink tracking-tight flex items-baseline gap-3">
                文章<span className="text-brand">管理</span>
                {meta && <span className="font-sans text-base text-ink/30 font-normal">共 {meta.total} 篇</span>}
              </h1>
            </div>
            <button onClick={handleLogout} className="p-3 bg-ink/5 text-ink/40 hover:text-brand transition-all rounded-full" title="登出系統">
              <LogOut size={24} />
            </button>
          </div>
        </header>

        {/* 篩選工具列 */}
        <div className="bg-white border border-line p-8 mb-8 shadow-sm space-y-8">
          <div className="flex items-center gap-2 text-ink/60 mb-2">
            <Filter size={18} />
            <span className="font-sans text-base font-black uppercase tracking-widest">篩選條件</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 模糊搜尋 */}
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">模糊搜尋</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-10 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors"
                  placeholder="搜尋關鍵字..."
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/20 hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* 分類篩選 */}
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">文章類別</label>
              <select 
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base font-bold focus:border-brand outline-none appearance-none cursor-pointer"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 標籤篩選 */}
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">標籤篩選 (Tag)</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
                <input 
                  type="text" 
                  value={tag}
                  onChange={(e) => { setTag(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors"
                  placeholder="輸入標籤..."
                />
              </div>
            </div>

            {/* 狀態篩選 */}
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">文章狀態</label>
              <select 
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base font-bold focus:border-brand outline-none appearance-none cursor-pointer"
              >
                <option value="all">顯示全部</option>
                <option value="visible">僅看公開</option>
                <option value="hidden">僅看隱藏</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pt-2 border-t border-line/50">
            {/* 日期篩選 */}
            <div className="lg:col-span-2 space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">日期範圍</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-4 py-3 bg-paper/30 border border-line font-sans text-sm focus:border-brand outline-none"
                  />
                </div>
                <span className="text-ink/20 font-bold">至</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-4 py-3 bg-paper/30 border border-line font-sans text-sm focus:border-brand outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 flex items-end justify-end gap-6">
              <button 
                onClick={resetFilters}
                className="px-6 py-3 font-sans text-base font-bold text-ink/40 hover:text-ink transition-colors"
              >
                重置篩選
              </button>
              <button 
                disabled={!!debouncedSearch}
                onClick={() => setOrder(order === "desc" ? "asc" : "desc")}
                className={`px-8 py-3 font-sans text-base font-bold flex items-center gap-3 transition-all shadow-lg rounded-full ${debouncedSearch ? "bg-ink/5 text-ink/20 cursor-not-allowed shadow-none" : "bg-ink text-paper hover:bg-brand"}`}
              >
                {order === "desc" ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                {order === "desc" ? "新 → 舊" : "舊 → 新"}
              </button>
            </div>
          </div>
        </div>

        {/* 列表表格 */}
        <div className="bg-white border border-line shadow-sm overflow-hidden rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink text-paper font-sans text-sm uppercase tracking-widest">
                <th className="px-6 py-5 font-bold w-40">日期</th>
                <th className="px-6 py-5 font-bold w-32">類別</th>
                <th className="px-6 py-5 font-bold">文章標題</th>
                <th className="px-6 py-5 font-bold text-center w-32">狀態</th>
                <th className="px-6 py-5 font-bold text-right w-32">編輯</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <Loader2 className="animate-spin text-brand mx-auto mb-4" size={40} />
                    <span className="font-sans text-base text-ink/40">正在檢索資料...</span>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center font-sans text-base text-ink/40">
                    找不到符合條件的文章。
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-paper/50 transition-colors group">
                    <td className="px-6 py-6 whitespace-nowrap font-mono text-base text-ink/60">{post.event_date}</td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="font-sans text-sm font-bold bg-ink/5 text-ink/60 px-3 py-1.5 rounded-sm uppercase">{post.category}</span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="font-serif font-black text-xl text-ink leading-tight mb-2">{post.title || "未命名文章"}</div>
                      <div className="flex flex-wrap gap-2">
                        {post.tags && post.tags.map((t, idx) => (
                          <span key={idx} className="font-sans text-sm text-ink/40 bg-paper px-2 py-0.5 rounded-xs border border-line/50">#{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <button 
                        onClick={() => toggleHidden(post.id, post.is_hidden)}
                        className={`transition-colors p-3 rounded-full hover:bg-paper ${post.is_hidden ? "text-ink/20 hover:text-ink/40" : "text-brand hover:text-brand/80"}`}
                        title={post.is_hidden ? "隱藏" : "公開"}
                      >
                        {post.is_hidden ? <EyeOff size={24} /> : <Eye size={24} />}
                      </button>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <Link 
                        href={`/admin/edit/${post.id}`}
                        className="inline-flex items-center justify-center w-12 h-12 rounded-full text-ink hover:bg-brand hover:text-white transition-all border border-ink/10 hover:border-brand shadow-sm"
                        title="編輯文章"
                      >
                        <Edit2 size={20} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁器 */}
        {meta && meta.last_page! > 1 && (
          <div className="flex justify-center items-center gap-12 mt-16 font-sans text-base">
            <button 
              disabled={page === 1 || isLoading}
              onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="disabled:opacity-20 hover:text-brand transition-colors font-black flex items-center gap-3"
            >
              ← 上一頁
            </button>
            <div className="flex items-center gap-4">
              <span className="text-ink/30 uppercase tracking-widest text-xs font-bold">頁碼</span>
              <span className="font-serif font-black text-2xl text-ink">{page}</span>
              <span className="text-ink/20">/</span>
              <span className="font-serif font-bold text-ink/40 text-xl">{meta.last_page}</span>
            </div>
            <button 
              disabled={page === meta.last_page || isLoading}
              onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="disabled:opacity-20 hover:text-brand transition-colors font-black flex items-center gap-3"
            >
              下一頁 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
