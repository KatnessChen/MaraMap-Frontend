"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit2, EyeOff, Search, Loader2, ArrowLeft, LogOut, Calendar, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Tag, X, Trash2, UploadCloud, PlusCircle } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";

interface ParticipantStats {
  distance_km: number | null;
}

interface Participant {
  name: string;
  distance: string | null;
  time: string | null;
  stats: ParticipantStats;
}

interface Post {
  id: string;
  event_date: string;
  title: string;
  category: string;
  sub_categories: string[];
  is_hidden: boolean;
  source?: "facebook" | "manual";
  tags: string[];
  metadata?: {
    race_name: string | null;
    country: string | null;
    city: string | null;
    participants: Participant[];
  } | null;
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

  // 輸入狀態（表單用）
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [status, setStatus] = useState("all");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [tag, setTag] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [continent, setContinent] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  // 已套用狀態（驅動 API）
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [applied, setApplied] = useState({
    search: "", category: "全部", status: "all", order: "desc" as "asc" | "desc",
    tag: "", startDate: "", endDate: "", subCategory: "", continent: "", country: "", city: "",
  });

  // 篩選區折疊 / 跳頁輸入
  const [filterOpen, setFilterOpen] = useState(true);
  const [jumpValue, setJumpValue] = useState("");
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

  const categories = ["全部", "馬拉松", "旅遊", "登山"];
  const SUB_CATEGORY_MAP: Record<string, string[]> = {
    馬拉松: ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "七大馬", "普查"],
    旅遊: [],
    登山: ["大百岳", "小百岳", "海外登山"],
  };
  const subCategories = category === "全部"
    ? ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "七大馬", "普查", "大百岳", "小百岳", "海外登山"]
    : (SUB_CATEGORY_MAP[category] || []);

  const getDavis = (post: Post) => {
    const davis = post.metadata?.participants?.find(p => p.name === "Davis");
    const hasTime = !!(davis?.time && davis.time !== '---' && davis.time !== 'N/A' && davis.time !== '0:00:00');
    return { davis, hasTime };
  };

  // Provenance chip: 手動 (manual admin entry) vs FB (Facebook import).
  const sourceBadge = (source?: "facebook" | "manual") =>
    source === "manual" ? (
      <span className="font-sans text-xs font-bold bg-brand/10 text-brand px-2 py-1 rounded-sm">手動</span>
    ) : (
      <span className="font-sans text-xs font-bold bg-ink/5 text-ink/50 px-2 py-1 rounded-sm">FB</span>
    );

  // Read-only "hidden" marker (visibility is now toggled only on the edit page).
  const hiddenBadge = (isHidden: boolean) =>
    isHidden ? (
      <span className="font-sans text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-sm inline-flex items-center gap-1">
        <EyeOff size={12} /> 隱藏
      </span>
    ) : null;

  const applyFilters = () => {
    setApplied({ search: searchQuery, category, status, order, tag, startDate, endDate, subCategory, continent, country, city });
    setPage(1);
  };

  // 已套用的篩選條件數量（給折疊狀態下的提示 badge）
  const activeFilterCount =
    [applied.search, applied.tag, applied.startDate, applied.endDate, applied.subCategory, applied.continent, applied.country, applied.city].filter(Boolean).length +
    (applied.category !== "全部" ? 1 : 0) +
    (applied.status !== "all" ? 1 : 0);

  const totalPages = meta?.last_page ?? 1;

  const goToPage = (n: number) => {
    const target = Math.min(Math.max(1, n), totalPages);
    if (target !== page) setPage(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  const submitJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!isNaN(n)) goToPage(n);
    setJumpValue("");
  };

  // JWT 過期時後端會把請求默默當成公開訪問（隱藏文章被過濾掉），
  // 所以進頁面就先驗 exp，過期直接導回登入頁。
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("maramap_admin_token");
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem("maramap_admin_token");
      router.push("/admin/login");
      return;
    }

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const apiUrl = getApiBase();
        const limit = pageSize;
        let url = "";

        if (applied.search) {
          const params = new URLSearchParams({
            q: applied.search,
            limit: limit.toString(),
            offset: ((page - 1) * limit).toString(),
            category: applied.category === "全部" ? "" : applied.category,
          });
          url = `${apiUrl}/api/v1/posts/search?${params.toString()}`;
        } else {
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            status: applied.status,
            order: applied.order,
            category: applied.category === "全部" ? "" : applied.category,
            tag: applied.tag,
            startDate: applied.startDate,
            endDate: applied.endDate,
            sub_category: applied.subCategory,
            continent: applied.continent,
            country: applied.country,
            city: applied.city,
          });
          url = `${apiUrl}/api/v1/posts?${params.toString()}&showHidden=true`;
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem("maramap_admin_token");
          router.push("/admin/login");
          return;
        }
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setPosts(json.data);
          if (applied.search) {
            setMeta({
              total: json.meta.total,
              limit: json.meta.limit,
              page: Math.floor(json.meta.offset! / json.meta.limit) + 1,
              last_page: Math.ceil(json.meta.total / json.meta.limit),
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
  }, [page, pageSize, applied, router]);

  const handleDeletePost = async (id: string, title: string) => {
    if (!window.confirm(`確定要刪除「${title || "此文章"}」嗎？此操作無法復原。`)) return;
    const token = localStorage.getItem("maramap_admin_token");
    if (!token) { router.push("/admin/login"); return; }
    try {
      const apiUrl = getApiBase();
      const res = await fetch(`${apiUrl}/api/v1/posts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
        setMeta(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
      } else if (res.status === 401) {
        router.push("/admin/login");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
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
    setSubCategory("");
    setContinent("");
    setCountry("");
    setCity("");
    setApplied({ search: "", category: "全部", status: "all", order, tag: "", startDate: "", endDate: "", subCategory: "", continent: "", country: "", city: "" });
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 md:mb-12 border-b-2 border-ink pb-6 md:pb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link href="/" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold transition-colors">
              <ArrowLeft size={16} /> 回網站首頁
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/admin/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-white hover:bg-brand/80 font-sans text-sm font-bold rounded-full transition-all shadow-sm" title="手動新增單篇文章">
                <PlusCircle size={18} /> <span className="hidden sm:inline">新增文章</span>
              </Link>
              <Link href="/admin/import" className="inline-flex items-center gap-2 px-4 py-2.5 bg-ink/5 text-ink/60 hover:bg-brand hover:text-white font-sans text-sm font-bold rounded-full transition-all" title="匯入 Facebook 資料">
                <UploadCloud size={18} /> <span className="hidden sm:inline">匯入資料</span>
              </Link>
              <button onClick={handleLogout} className="inline-flex items-center gap-2 px-4 py-2.5 bg-ink/5 text-ink/60 hover:bg-brand hover:text-white font-sans text-sm font-bold rounded-full transition-all" title="登出系統">
                <LogOut size={18} /> <span className="hidden sm:inline">登出</span>
              </button>
            </div>
          </div>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-ink tracking-tight">
            文章<span className="text-brand">管理</span>
          </h1>
        </header>

        {/* 篩選工具列 */}
        <div className="bg-white border border-line p-4 sm:p-6 md:p-8 mb-8 shadow-sm">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 text-ink/60 hover:text-ink transition-colors"
            aria-expanded={filterOpen}
          >
            <span className="flex items-center gap-2">
              <Filter size={18} />
              <span className="font-sans text-base font-black uppercase tracking-widest">篩選條件</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-white text-xs font-bold">{activeFilterCount}</span>
              )}
            </span>
            <span className="flex items-center gap-1 font-sans text-sm font-bold text-ink/40">
              {filterOpen ? "收合" : "展開"}
              {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {filterOpen && (
          <div className="space-y-6 md:space-y-8 mt-6 md:mt-8">
          {/* Row 1: 搜尋 / 類別 / 子分類 / 狀態 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">模糊搜尋</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} className="w-full pl-10 pr-10 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors" placeholder="搜尋關鍵字..." />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/20 hover:text-ink"><X size={16} /></button>}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">文章類別</label>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(""); }} className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base font-bold focus:border-brand outline-none appearance-none cursor-pointer">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">子分類</label>
              <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} disabled={subCategories.length === 0} className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base font-bold focus:border-brand outline-none appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <option value="">全部</option>
                {subCategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">文章狀態</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base font-bold focus:border-brand outline-none appearance-none cursor-pointer">
                <option value="all">顯示全部</option>
                <option value="visible">僅看公開</option>
                <option value="hidden">僅看隱藏</option>
              </select>
            </div>
          </div>

          {/* Row 2: 大洲 / 國家 / 城市 / 標籤 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 pt-4 md:pt-2 border-t border-line/50">
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">大洲</label>
              <input type="text" value={continent} onChange={(e) => setContinent(e.target.value)} className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors" placeholder="亞洲、歐洲…" />
            </div>
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">國家</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors" placeholder="台灣、日本…" />
            </div>
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">城市</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors" placeholder="台北、東京…" />
            </div>
            <div className="space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">標籤 (Tag)</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-paper/30 border border-line font-sans text-base focus:border-brand outline-none transition-colors" placeholder="輸入標籤…" />
              </div>
            </div>
          </div>

          {/* Row 3: 日期範圍 / 重置 / 排序 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 pt-4 md:pt-2 border-t border-line/50">
            <div className="lg:col-span-2 space-y-3">
              <label className="block font-sans text-sm font-bold text-ink/60 uppercase tracking-widest">日期範圍</label>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative flex-1 min-w-0">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20 pointer-events-none" size={16} />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full pl-10 pr-3 py-3 bg-paper/30 border border-line font-sans text-sm focus:border-brand outline-none" />
                </div>
                <span className="text-ink/20 font-bold shrink-0">至</span>
                <div className="relative flex-1 min-w-0">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/20 pointer-events-none" size={16} />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full pl-10 pr-3 py-3 bg-paper/30 border border-line font-sans text-sm focus:border-brand outline-none" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-wrap items-center lg:items-end justify-end gap-3 sm:gap-4 lg:gap-6">
              <button onClick={resetFilters} className="px-5 sm:px-6 py-3 font-sans text-base font-bold text-ink/40 hover:text-ink transition-colors">重置篩選</button>
              <button onClick={applyFilters} className="flex-1 sm:flex-none px-6 sm:px-8 py-3 font-sans text-base font-bold bg-brand text-white hover:bg-brand/80 transition-all shadow-sm">套用篩選條件</button>
              <button disabled={!!searchQuery} onClick={() => setOrder(order === "desc" ? "asc" : "desc")} className={`px-6 sm:px-8 py-3 font-sans text-base font-bold flex items-center justify-center gap-3 transition-all shadow-lg rounded-full ${searchQuery ? "bg-ink/5 text-ink/20 cursor-not-allowed shadow-none" : "bg-ink text-paper hover:bg-brand"}`}>
                {order === "desc" ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                {order === "desc" ? "新 → 舊" : "舊 → 新"}
              </button>
            </div>
          </div>
          </div>
          )}
        </div>

        {/* 篇數摘要 */}
        <div className="flex items-center justify-between mb-4 px-1">
          {isLoading ? (
            <span className="font-sans text-sm text-ink/30">載入中…</span>
          ) : meta ? (
            <span className="font-sans text-sm text-ink/50">
              搜尋結果：共 <span className="font-black text-ink">{meta.total}</span> 篇
              {meta.last_page! > 1 && (
                <span className="ml-2 text-ink/30">（第 {page} / {meta.last_page} 頁）</span>
              )}
            </span>
          ) : null}
        </div>

        {/* 列表卡片 (手機) */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="bg-white border border-line shadow-sm rounded-lg px-6 py-20 text-center">
              <Loader2 className="animate-spin text-brand mx-auto mb-4" size={36} />
              <span className="font-sans text-base text-ink/40">正在檢索資料...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white border border-line shadow-sm rounded-lg px-6 py-20 text-center font-sans text-base text-ink/40">
              找不到符合條件的文章。
            </div>
          ) : (
            posts.map((post) => {
              const { davis, hasTime } = getDavis(post);
              return (
                <div key={post.id} className="bg-white border border-line shadow-sm rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono text-sm text-ink/60 whitespace-nowrap">{post.event_date}</span>
                      <span className="font-sans text-xs font-bold bg-ink/5 text-ink/60 px-2.5 py-1 rounded-sm uppercase">{post.category}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {hiddenBadge(post.is_hidden)}
                      {sourceBadge(post.source)}
                    </div>
                  </div>

                  {post.sub_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {post.sub_categories.map((s, i) => (
                        <span key={i} className="font-sans text-xs font-bold text-brand/70 bg-brand/5 border border-brand/15 px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}

                  <Link href={`/admin/edit/${post.id}`} target="_blank" rel="noopener noreferrer" className="block font-serif font-black text-lg text-ink leading-snug mb-2 hover:text-brand transition-colors">{post.title || "未命名文章"}</Link>

                  {post.category === "馬拉松" && davis && (
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-sans text-xs font-bold text-ink/40 uppercase tracking-wider">{davis.distance || "—"}</span>
                      {hasTime && (
                        <>
                          <span className="text-ink/20">·</span>
                          <span className="font-mono text-sm font-bold text-ink/70">{davis.time}</span>
                        </>
                      )}
                      {post.metadata?.country && (
                        <>
                          <span className="text-ink/20">·</span>
                          <span className="font-sans text-xs text-ink/40">{post.metadata.country}</span>
                        </>
                      )}
                    </div>
                  )}

                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((t, idx) => (
                        <span key={idx} className="font-sans text-sm text-ink/40 bg-paper px-2 py-0.5 rounded-xs border border-line/50">#{t}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-3 border-t border-line/50">
                    <Link
                      href={`/admin/edit/${post.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-ink font-sans text-sm font-bold border border-ink/10 hover:bg-brand hover:text-white hover:border-brand transition-all"
                    >
                      <Edit2 size={16} /> 編輯
                    </Link>
                    <button
                      onClick={() => handleDeletePost(post.id, post.title)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-ink/50 font-sans text-sm font-bold border border-ink/10 hover:bg-brand hover:text-white hover:border-brand transition-all"
                    >
                      <Trash2 size={16} /> 刪除
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 列表表格 (平板以上) */}
        <div className="hidden md:block bg-white border border-line shadow-sm overflow-hidden rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink text-paper font-sans text-sm uppercase tracking-widest">
                <th className="px-6 py-5 font-bold w-40">日期</th>
                <th className="px-6 py-5 font-bold w-32">類別</th>
                <th className="px-6 py-5 font-bold">文章標題</th>
                <th className="px-6 py-5 font-bold text-center w-32">來源</th>
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
                posts.map((post) => {
                  const { davis, hasTime } = getDavis(post);
                  return (
                  <tr key={post.id} className="hover:bg-paper/50 transition-colors group">
                    <td className="px-6 py-6 whitespace-nowrap font-mono text-base text-ink/60">{post.event_date}</td>
                    <td className="px-6 py-6 align-top">
                      <span className="font-sans text-sm font-bold bg-ink/5 text-ink/60 px-3 py-1.5 rounded-sm uppercase block w-fit mb-2">{post.category}</span>
                      {post.sub_categories?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.sub_categories.map((s, i) => (
                            <span key={i} className="font-sans text-xs font-bold text-brand/70 bg-brand/5 border border-brand/15 px-2 py-0.5">{s}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-6">
                      <Link href={`/admin/edit/${post.id}`} target="_blank" rel="noopener noreferrer" className="block font-serif font-black text-xl text-ink leading-tight mb-2 hover:text-brand transition-colors">{post.title || "未命名文章"}</Link>
                      {post.category === "馬拉松" && davis && (
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-sans text-xs font-bold text-ink/40 uppercase tracking-wider">{davis.distance || "—"}</span>
                          {hasTime && (
                            <>
                              <span className="text-ink/20">·</span>
                              <span className="font-mono text-sm font-bold text-ink/70">{davis.time}</span>
                            </>
                          )}
                          {post.metadata?.country && (
                            <>
                              <span className="text-ink/20">·</span>
                              <span className="font-sans text-xs text-ink/40">{post.metadata.country}</span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {post.tags && post.tags.map((t, idx) => (
                          <span key={idx} className="font-sans text-sm text-ink/40 bg-paper px-2 py-0.5 rounded-xs border border-line/50">#{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col items-center gap-1.5">
                        {sourceBadge(post.source)}
                        {hiddenBadge(post.is_hidden)}
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/edit/${post.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-12 h-12 rounded-full text-ink hover:bg-brand hover:text-white transition-all border border-ink/10 hover:border-brand shadow-sm"
                          title="編輯文章"
                        >
                          <Edit2 size={20} />
                        </Link>
                        <button
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className="inline-flex items-center justify-center w-12 h-12 rounded-full text-ink/40 hover:bg-brand hover:text-white transition-all border border-ink/10 hover:border-brand shadow-sm"
                          title="刪除文章"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ); })
              )}
            </tbody>
          </table>
        </div>

        {/* 每頁筆數 + 分頁器 */}
        {meta && (
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-4 sm:gap-x-6 mt-10 md:mt-16 font-sans text-base">
            <label className="flex items-center gap-2 font-sans text-sm text-ink/50">
              每頁
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-line font-sans text-sm font-bold text-ink focus:border-brand outline-none appearance-none cursor-pointer rounded-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              筆
            </label>

            {meta.last_page! > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 sm:pl-6 sm:border-l border-line">
                <button
                  disabled={page === 1 || isLoading}
                  onClick={() => goToPage(1)}
                  title="第一頁"
                  className="p-2.5 rounded-full border border-ink/10 text-ink disabled:opacity-20 disabled:cursor-not-allowed enabled:hover:bg-brand enabled:hover:text-white enabled:hover:border-brand transition-all"
                >
                  <ChevronsLeft size={20} />
                </button>
                <button
                  disabled={page === 1 || isLoading}
                  onClick={() => goToPage(page - 1)}
                  title="上一頁"
                  className="p-2.5 rounded-full border border-ink/10 text-ink disabled:opacity-20 disabled:cursor-not-allowed enabled:hover:bg-brand enabled:hover:text-white enabled:hover:border-brand transition-all"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="flex items-center gap-2 px-2">
                  <span className="font-serif font-black text-2xl text-ink">{page}</span>
                  <span className="text-ink/20">/</span>
                  <span className="font-serif font-bold text-ink/40 text-xl">{meta.last_page}</span>
                </div>

                <button
                  disabled={page === meta.last_page || isLoading}
                  onClick={() => goToPage(page + 1)}
                  title="下一頁"
                  className="p-2.5 rounded-full border border-ink/10 text-ink disabled:opacity-20 disabled:cursor-not-allowed enabled:hover:bg-brand enabled:hover:text-white enabled:hover:border-brand transition-all"
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  disabled={page === meta.last_page || isLoading}
                  onClick={() => goToPage(totalPages)}
                  title="最後一頁"
                  className="p-2.5 rounded-full border border-ink/10 text-ink disabled:opacity-20 disabled:cursor-not-allowed enabled:hover:bg-brand enabled:hover:text-white enabled:hover:border-brand transition-all"
                >
                  <ChevronsRight size={20} />
                </button>

                <div className="flex items-center gap-2 sm:pl-3 sm:ml-1 sm:border-l border-line">
                  <span className="text-ink/40 text-sm font-bold whitespace-nowrap">跳至</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitJump()}
                    placeholder={String(page)}
                    className="w-16 px-2 py-2 bg-white border border-line text-center font-sans text-sm font-bold focus:border-brand outline-none rounded-sm"
                  />
                  <button
                    onClick={submitJump}
                    className="px-4 py-2 bg-ink text-paper text-sm font-bold rounded-full hover:bg-brand transition-colors"
                  >
                    前往
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
