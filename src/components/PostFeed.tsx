"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

interface ApiResponse {
  data: Post[];
  meta: { total: number; limit: number; page: number; last_page: number };
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
  // 為了避免 Hydration 錯誤，初始狀態必須與伺服器端一致
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(initialMeta.page);
  const [hasMore, setHasMore] = useState(initialMeta.page < initialMeta.last_page);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // 控制恢復完成與淡入
  const [isMounted, setIsMounted] = useState(false); // 確保在客戶端才執行邏輯
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || !isReady) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    }, {
      rootMargin: '400px',
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, isReady]);

  // 1. 客戶端掛載後的資料恢復
  useEffect(() => {
    setIsMounted(true);
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const savedState = sessionStorage.getItem("maramap_feed_state");
    if (savedState) {
      try {
        const { posts: savedPosts, page: savedPage, hasMore: savedHasMore, scrollY } = JSON.parse(savedState);
        
        // 先恢復資料，再恢復捲動位置
        setPosts(savedPosts);
        setPage(savedPage);
        setHasMore(savedHasMore);
        
        const targetY = Number(scrollY);
        if (targetY > 0) {
          // 使用雙重 rAF 確保在 DOM 更新後才執行 scrollTo
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
      } catch (e) {
        console.error("Failed to restore state", e);
        setIsReady(true);
      }
    } else {
      setIsReady(true);
    }
  }, []);

  // 2. 監聽捲動位置
  useEffect(() => {
    if (!isReady || !isMounted) return;

    const handleScroll = () => {
      if (window.scrollY === 0 && posts.length > initialPosts.length) return;
      const state = { posts, page, hasMore, scrollY: window.scrollY };
      sessionStorage.setItem("maramap_feed_state", JSON.stringify(state));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [posts, page, hasMore, isReady, isMounted, initialPosts.length]);

  // 3. 載入更多
  useEffect(() => {
    if (!isReady || !isMounted) return;
    if (page === 1 && posts.length === initialPosts.length) return;

    const fetchMorePosts = async () => {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/posts?page=${page}&limit=10`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setPosts(prev => {
            const newPosts = json.data.filter(np => !prev.some(p => p.id === np.id));
            return [...prev, ...newPosts];
          });
          setHasMore(json.meta.page < json.meta.last_page);
        }
      } catch (error) {
        console.error("Failed to fetch more posts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMorePosts();
  }, [page, isReady, isMounted]);

  // 在伺服器端或恢復完成前，渲染 initialPosts 以保持 Hydration 一致性
  // 但透過 CSS 控制顯示，避免視覺跳動
  return (
    <div 
      className={`px-6 pb-20 pt-8 transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
    >
      {posts.map((post, index) => {
        const isLastElement = posts.length === index + 1;
        return (
          <div key={post.id} ref={isLastElement ? lastPostElementRef : null}>
            <Link 
              href={`/log/${post.id}`} 
              onClick={() => {
                const state = { posts, page, hasMore, scrollY: window.scrollY };
                sessionStorage.setItem("maramap_feed_state", JSON.stringify(state));
              }}
              className="group block py-10 md:py-12 border-b border-line transition-all hover:bg-[rgba(0,0,0,0.02)] -mx-6 px-6"
            >
              <div className="font-mono text-xs md:text-sm text-brand uppercase mb-4 flex items-center gap-3">
                <span className="w-2 h-2 bg-brand rounded-full inline-block shadow-[0_0_8px_rgba(230,57,70,0.5)]"></span>
                <span className="tracking-[0.15em]">{getGeoTag(post)}</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-black leading-[1.3] tracking-tight mb-5 text-ink group-hover:text-brand transition-colors">
                {getDisplayTitle(post)}
              </h2>
              <p className="font-sans text-lg md:text-xl text-ink-light leading-[1.8] text-justify line-clamp-4 font-medium whitespace-pre-wrap">
                {getDisplayContent(post)}
              </p>
              <div className="mt-6 font-mono text-sm text-ink flex items-center gap-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                READ LOG <ArrowRight size={16} />
              </div>
            </Link>
          </div>
        );
      })}
      
      {(isLoading || !isReady) && (
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-20 text-center text-ink-light font-mono text-sm uppercase tracking-widest border-t border-line mt-10">
          - End of Log -
        </div>
      )}
    </div>
  );
}
