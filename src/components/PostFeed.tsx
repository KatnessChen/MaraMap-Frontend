"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Search, X } from "lucide-react";

interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  cover_image?: string;
}

interface ApiResponse {
  data: Post[];
  meta: { total: number; limit: number; page?: number; last_page?: number; offset?: number };
}

interface Category {
  name: string;
  count: number;
}

interface PostFeedProps {
  initialPosts: Post[];
  initialMeta: ApiResponse["meta"];
}

// --- Helper Functions ---
function getDisplayTitle(post: Post) {
  const match = post.content.match(/^\[(.*?)\]/);
  if (match) return match[1];
  if (post.tags && post.tags.length > 0) return post.tags.slice(0, 2).join(" • ");
  const firstLine = post.content.split('\n')[0].trim();
  return firstLine || "MaraMap 運動日誌";
}

function getDisplayContent(post: Post) {
  const match = post.content.match(/^\[(.*?)\]/);
  let text = post.content;
  if (match) {
      text = text.replace(match[0], '').trim();
  }
  return text;
}

function getGeoTag(post: Post) {
  const cat = post.category ? post.category.toUpperCase() : 'LOG';
  return `${cat} / ${post.event_date}`;
}

export default function PostFeed({ initialPosts, initialMeta }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(initialMeta.page || 1);
  const [hasMore, setHasMore] = useState((initialMeta.page || 1) < (initialMeta.last_page || 1));
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || !isReady || searchQuery) return; // 搜尋模式下暫時停用無限捲動（或需額外處理）
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    }, {
      rootMargin: '400px',
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, isReady, searchQuery]);

  // Debounce 邏輯
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 取得分類統計
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/categories`);
        if (res.ok) {
          const data: Category[] = await res.json();
          const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);
          const allCategories = [{ name: "全部", count: totalCount }, ...data];
          setCategories(allCategories);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // 客戶端掛載後的資料恢復
  useEffect(() => {
    setIsMounted(true);
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const savedState = sessionStorage.getItem("maramap_feed_state");
    if (savedState && !searchQuery) {
      try {
        const { posts: savedPosts, page: savedPage, hasMore: savedHasMore, scrollY, activeCategory: savedCategory } = JSON.parse(savedState);
        if (savedCategory) setActiveCategory(savedCategory);
        setPosts(savedPosts);
        setPage(savedPage);
        setHasMore(savedHasMore);
        
        const targetY = Number(scrollY);
        if (targetY > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: targetY, behavior: 'auto' });
            requestAnimationFrame(() => {
              window.scrollTo({ top: targetY, behavior: 'auto' });
              setIsReady(true);
            });
          });
        } else {
          setIsReady(true);
        }
      } catch {
        setIsReady(true);
      }
    } else {
      setIsReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 監聽捲動位置與狀態 (搜尋時不儲存狀態)
  useEffect(() => {
    if (!isReady || !isMounted || searchQuery) return;

    const handleScroll = () => {
      const state = { posts, page, hasMore, scrollY: window.scrollY, activeCategory };
      sessionStorage.setItem("maramap_feed_state", JSON.stringify(state));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [posts, page, hasMore, isReady, isMounted, activeCategory, searchQuery]);

  // 當分類或搜尋改變時，重置列表
  useEffect(() => {
    if (!isMounted || !isReady) return;
    
    const isInitialState = activeCategory === "全部" && !debouncedSearch && posts.length === initialPosts.length && page === 1;
    if (isInitialState) return;

    const resetAndFetch = async () => {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        let url = "";
        
        if (debouncedSearch) {
          // 使用模糊搜尋 API
          const categoryParam = activeCategory === "全部" ? "" : `&category=${encodeURIComponent(activeCategory)}`;
          url = `${apiUrl}/api/v1/posts/search?q=${encodeURIComponent(debouncedSearch)}${categoryParam}&limit=20`;
        } else {
          // 使用一般列表 API
          const categoryParam = activeCategory === "全部" ? "" : `&category=${encodeURIComponent(activeCategory)}`;
          url = `${apiUrl}/api/v1/posts?page=1&limit=10${categoryParam}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setPosts(json.data);
          if (!debouncedSearch) {
            setPage(1);
            setHasMore(json.meta.page! < json.meta.last_page!);
          } else {
            setHasMore(false); // 搜尋模式暫時不支援分頁載入更多
          }
          if (!debouncedSearch) sessionStorage.removeItem("maramap_feed_state");
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    resetAndFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, debouncedSearch, isMounted, isReady]);

  // 載入更多 (分頁 - 僅在非搜尋模式下)
  useEffect(() => {
    if (!isReady || !isMounted || page === 1 || debouncedSearch) return;

    const fetchMorePosts = async () => {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const categoryParam = activeCategory === "全部" ? "" : `&category=${encodeURIComponent(activeCategory)}`;
        const res = await fetch(`${apiUrl}/api/v1/posts?page=${page}&limit=10${categoryParam}`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setPosts(prev => {
            const newPosts = json.data.filter(np => !prev.some(p => p.id === np.id));
            return [...prev, ...newPosts];
          });
          setHasMore(json.meta.page! < json.meta.last_page!);
        }
      } catch (error) {
        console.error("Failed to fetch more posts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMorePosts();
  }, [page, isReady, isMounted, activeCategory, debouncedSearch]);

  return (
    <div className={`px-6 pb-20 pt-8 transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* 搜尋框 */}
      <div className="mb-10 relative">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20 group-focus-within:text-brand transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="搜尋標題、內容或賽事關鍵字..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-line p-5 pl-14 font-sans text-xl focus:outline-none focus:border-brand transition-all shadow-sm rounded-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/20 hover:text-ink"
            >
              <X size={20} />
            </button>
          )}
        </div>
        {debouncedSearch && (
          <div className="mt-3 font-sans text-sm text-ink/40 font-bold">
            正在搜尋：「{debouncedSearch}」... 找到 {posts.length} 篇結果
          </div>
        )}
      </div>

      {/* 分類切換器 */}
      <div className="mb-8 border-b border-line pb-6 overflow-x-auto no-scrollbar flex items-center gap-2 text-sm font-bold">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(cat.name)}
            className={`px-4 py-2 transition-all duration-300 border flex items-center gap-2 whitespace-nowrap ${activeCategory === cat.name ? "bg-ink text-paper border-ink" : "text-ink/60 border-ink/10 hover:border-ink hover:text-ink"}`}
          >
            <span>{cat.name}</span>
            <span className={`opacity-40 ${activeCategory === cat.name ? "text-paper" : ""}`}>({cat.count})</span>
          </button>
        ))}
      </div>

      {posts.length === 0 && !isLoading ? (
        <div className="py-24 text-center">
          <div className="font-serif text-2xl text-ink/20 font-black mb-4 italic">No matching logs found.</div>
          <button onClick={() => {setSearchQuery(""); setActiveCategory("全部");}} className="text-brand font-sans font-bold underline">重設搜尋條件</button>
        </div>
      ) : (
        posts.map((post, index) => {
          const isLastElement = posts.length === index + 1;
          return (
            <div key={post.id} ref={isLastElement ? lastPostElementRef : null}>
              <Link 
                href={`/log/${post.id}`} 
                className="group block py-12 border-b border-line transition-all hover:bg-[rgba(0,0,0,0.01)] -mx-6 px-6"
              >
                <div className="font-sans text-sm text-brand font-bold uppercase tracking-widest mb-4 flex items-center gap-3">
                  <span className="w-2 h-2 bg-brand rounded-full inline-block shadow-[0_0_8px_rgba(230,57,70,0.5)]"></span>
                  <span className="tracking-[0.15em]">{getGeoTag(post)}</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl font-black leading-[1.2] tracking-tight mb-6 text-ink group-hover:text-brand transition-colors">
                  {getDisplayTitle(post)}
                </h2>
                
                {post.cover_image && (
                  <div className="mb-8 overflow-hidden rounded-sm border border-line shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.cover_image} alt="Featured" className="w-full h-auto aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                )}

                <p className="font-sans text-lg md:text-xl text-ink-light leading-[1.8] text-justify line-clamp-4 font-medium whitespace-pre-wrap">
                  {getDisplayContent(post)}
                </p>
                <div className="mt-8 font-sans text-sm font-black text-ink flex items-center gap-2 opacity-40 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                  閱讀全文 <ArrowRight size={16} />
                </div>
              </Link>
            </div>
          );
        })
      )}
      
      {(isLoading || !isReady) && (
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-20 text-center text-ink-light font-sans text-base font-bold uppercase tracking-widest border-t border-line mt-10 opacity-30">
          - 賽事紀錄結束 -
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
