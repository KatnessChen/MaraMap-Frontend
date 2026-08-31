"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { List, MapPin, Search, X, PlusCircle, Star, Sparkles } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { getStoredToken } from "@/hooks/useAdminAuth";
import { authFetch } from "@/utils/authFetch";
import type { Post, TripPost, PostSummary, TripSuggestion } from "./types";

// The "同行程文章" section of the post editor: shows the current post's trip
// siblings and lets the admin search for or get suggestions to add more.
// Split out of page.tsx because it's a self-contained subsystem — its own
// state, its own handlers, all reachable only through this UI — with the one
// exception of `tripPosts`/`setTripPosts`, which the parent also needs to
// seed from the initial post fetch (see fetchPost's trip/${tripId} call).
export default function TripPanel({
  post,
  setPost,
  tripPosts,
  setTripPosts,
  setFeedback,
}: {
  post: Post;
  setPost: Dispatch<SetStateAction<Post | null>>;
  tripPosts: TripPost[];
  setTripPosts: Dispatch<SetStateAction<TripPost[]>>;
  setFeedback: Dispatch<SetStateAction<{ type: "success" | "error" | null; msg: string }>>;
}) {
  const [showTripSearch, setShowTripSearch] = useState(false);
  const [tripSearchQuery, setTripSearchQuery] = useState("");
  const [tripSearchResults, setTripSearchResults] = useState<PostSummary[]>([]);
  const [isTripSearching, setIsTripSearching] = useState(false);
  const [tripSuggestions, setTripSuggestions] = useState<TripSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const searchForTripAdd = async (q: string) => {
    if (!q.trim()) { setTripSearchResults([]); return; }
    setIsTripSearching(true);
    try {
      const apiUrl = getApiBase();
      const res = await fetch(`${apiUrl}/api/v1/posts/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const json = await res.json();
        const results: PostSummary[] = json.data || json;
        const existingIds = new Set([post.id, ...tripPosts.map(tp => tp.postId)]);
        setTripSearchResults(results.filter(p => !existingIds.has(p.id)));
      }
    } catch { /* non-critical */ }
    finally { setIsTripSearching(false); }
  };

  // Smart recommendations — same country + within ±14 days, not already in this trip.
  const fetchTripSuggestions = async () => {
    const token = getStoredToken();
    if (!token) return;
    setIsLoadingSuggestions(true);
    try {
      const apiUrl = getApiBase();
      const res = await authFetch(`${apiUrl}/api/v1/posts/${post.id}/trip-suggestions`, token, {
        cache: "no-store",
      });
      if (res.ok) {
        const data: TripSuggestion[] = await res.json();
        const existing = new Set([post.id, ...tripPosts.map(tp => tp.postId)]);
        setTripSuggestions(data.filter(s => !existing.has(s.postId)));
      }
    } catch { /* non-critical */ }
    finally { setIsLoadingSuggestions(false); }
  };

  const openTripAdd = () => {
    setShowTripSearch(true);
    fetchTripSuggestions();
  };

  const handleAddToTrip = async (targetPostId: string) => {
    const token = getStoredToken();
    if (!token) return;
    const apiUrl = getApiBase();
    const res = await authFetch(`${apiUrl}/api/v1/posts/${post.id}/trip/add`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: targetPostId }),
    });
    if (res.ok) {
      const tripArr: TripPost[] = await res.json();
      const newTripId = post.trip_id ?? post.id; // trip auto-created with this post as primary
      setPost(prev => prev ? { ...prev, trip_id: newTripId } : prev);
      setTripPosts(tripArr.filter(p => p.postId !== post.id));
      setTripSuggestions(prev => prev.filter(s => s.postId !== targetPostId));
      setTripSearchResults(prev => prev.filter(p => p.id !== targetPostId));
      setFeedback({ type: "success", msg: "已加入同行文章" });
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: "error", msg: err.message || "加入失敗" });
    }
  };

  const handleRemoveFromTrip = async (targetPostId: string) => {
    const token = getStoredToken();
    if (!token) return;
    const apiUrl = getApiBase();
    const res = await authFetch(`${apiUrl}/api/v1/posts/${targetPostId}/trip/remove`, token, {
      method: "POST",
    });
    if (res.ok) {
      const tripArr: TripPost[] = await res.json();
      if (targetPostId === post.id) {
        setPost(prev => prev ? { ...prev, trip_id: null } : prev);
        setTripPosts([]);
      } else {
        setTripPosts(tripArr.filter(p => p.postId !== post.id));
      }
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: "error", msg: err.message || "移除失敗" });
    }
  };

  const handleMakePrimary = async (targetPostId: string) => {
    const token = getStoredToken();
    if (!token) return;
    const apiUrl = getApiBase();
    const res = await authFetch(`${apiUrl}/api/v1/posts/${targetPostId}/make-primary`, token, {
      method: "POST",
    });
    if (res.ok) {
      const tripArr: TripPost[] = await res.json();
      setPost(prev => prev ? { ...prev, trip_id: targetPostId } : prev);
      setTripPosts(tripArr.filter(p => p.postId !== post.id));
      setFeedback({ type: "success", msg: "已設為主文" });
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: "error", msg: err.message || "設定主文失敗" });
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
        <List size={24} className="text-brand" /> 同行程文章
      </label>

      <>
        {/* Current post row */}
        <div className="flex items-center gap-3 px-4 py-3 bg-ink/5 border border-line">
          {post.cover_image ? (
            <div className="w-12 h-12 shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 shrink-0 bg-ink/10 flex items-center justify-center">
              <MapPin size={16} className="text-ink/20" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-sans text-sm font-black text-ink leading-tight truncate">{post.title || "（無標題）"}</p>
            <p className="font-mono text-xs text-ink/30 mt-0.5">{post.event_date}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-ink/10 text-ink/50">本文</span>
            {!post.trip_id
              ? <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-dashed border-line text-ink/30">尚未組行程</span>
              : post.id === post.trip_id
                ? <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-brand text-white">主文</span>
                : <>
                    <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-ink/40">次文</span>
                    <button onClick={() => handleMakePrimary(post.id)} title="設為主文" className="p-1 text-ink/30 hover:text-brand transition-colors"><Star size={14} /></button>
                    <button onClick={() => handleRemoveFromTrip(post.id)} title="移出行程" className="p-1 text-ink/20 hover:text-brand transition-colors"><X size={14} /></button>
                  </>
            }
          </div>
        </div>

        {/* Other trip posts */}
        {tripPosts.length > 0 && (
          <ul className="divide-y divide-line border border-line">
            {tripPosts.map(tp => (
              <li key={tp.postId} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5 transition-colors group">
                <Link href={`/admin/edit/${tp.postId}`} className="flex items-center gap-3 flex-1 min-w-0">
                  {tp.coverImage ? (
                    <div className="w-12 h-12 shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tp.coverImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 shrink-0 bg-ink/5 flex items-center justify-center">
                      <MapPin size={16} className="text-ink/20" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-black text-ink leading-tight truncate group-hover:text-brand transition-colors">
                      {tp.title || "（無標題）"}
                    </p>
                    <p className="font-mono text-xs text-ink/30 mt-0.5">{tp.date}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {tp.isPrimary
                    ? <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-brand text-white">主文</span>
                    : <>
                        <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-ink/40">次文</span>
                        <button onClick={() => handleMakePrimary(tp.postId)} title="設為主文" className="p-1 text-ink/30 hover:text-brand transition-colors"><Star size={14} /></button>
                      </>
                  }
                  <button
                    onClick={() => handleRemoveFromTrip(tp.postId)}
                    title="從行程移除"
                    className="p-1 text-ink/20 hover:text-brand transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add / recommend panel */}
        {showTripSearch ? (
          <div className="space-y-3 border border-line p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" size={14} />
              <input
                type="text"
                autoFocus
                value={tripSearchQuery}
                onChange={e => { setTripSearchQuery(e.target.value); searchForTripAdd(e.target.value); }}
                placeholder="輸入關鍵字模糊搜尋…"
                className="w-full pl-8 pr-8 py-2 border border-line font-sans text-sm focus:border-brand outline-none bg-white"
              />
              {tripSearchQuery && (
                <button onClick={() => { setTripSearchQuery(""); setTripSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/20 hover:text-ink">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Keyword search results (when typing) */}
            {tripSearchQuery ? (
              <>
                {isTripSearching && <p className="font-sans text-xs text-ink/30 text-center py-2">搜尋中…</p>}
                {!isTripSearching && tripSearchResults.length === 0 && (
                  <p className="font-sans text-xs text-ink/30 text-center py-2">找不到結果</p>
                )}
                {tripSearchResults.length > 0 && (
                  <ul className="divide-y divide-line border border-line max-h-64 overflow-y-auto">
                    {tripSearchResults.map(p => (
                      <li key={p.id}>
                        <button onClick={() => handleAddToTrip(p.id)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ink/5 transition-colors text-left">
                          {p.cover_image ? (
                            <div className="w-10 h-10 shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.cover_image} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 shrink-0 bg-ink/5 flex items-center justify-center"><MapPin size={12} className="text-ink/20" /></div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-xs font-black text-ink truncate">{p.title || "（無標題）"}</p>
                            <p className="font-mono text-[10px] text-ink/30 mt-0.5">{p.event_date}</p>
                          </div>
                          <PlusCircle size={14} className="shrink-0 text-brand ml-auto" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              /* Smart recommendations (when not typing) */
              <div>
                <p className="flex items-center gap-1.5 font-sans text-xs font-bold text-ink/40 mb-2">
                  <Sparkles size={12} className="text-brand" /> 推薦（同國・鄰近日期）
                </p>
                {isLoadingSuggestions && <p className="font-sans text-xs text-ink/30 text-center py-2">載入推薦中…</p>}
                {!isLoadingSuggestions && tripSuggestions.length === 0 && (
                  <p className="font-sans text-xs text-ink/30 text-center py-2">沒有符合同國・鄰近日期的推薦，可用上方關鍵字搜尋。</p>
                )}
                {tripSuggestions.length > 0 && (
                  <ul className="divide-y divide-line border border-line max-h-64 overflow-y-auto">
                    {tripSuggestions.map(s => (
                      <li key={s.postId}>
                        <button onClick={() => handleAddToTrip(s.postId)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ink/5 transition-colors text-left">
                          {s.coverImage ? (
                            <div className="w-10 h-10 shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={s.coverImage} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 shrink-0 bg-ink/5 flex items-center justify-center"><MapPin size={12} className="text-ink/20" /></div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-xs font-black text-ink truncate">{s.title || "（無標題）"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-ink/30">{s.date}</span>
                              <span className="font-sans text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-sm">{s.reason}</span>
                              {s.alreadyInOtherTrip && <span className="font-sans text-[10px] text-ink/30">已屬其他行程</span>}
                            </div>
                          </div>
                          <PlusCircle size={14} className="shrink-0 text-brand ml-auto" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              onClick={() => { setShowTripSearch(false); setTripSearchQuery(""); setTripSearchResults([]); setTripSuggestions([]); }}
              className="font-sans text-xs text-ink/30 hover:text-ink transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={openTripAdd}
            className="flex items-center gap-2 font-sans text-sm font-bold text-ink/40 hover:text-brand transition-colors"
          >
            <PlusCircle size={16} /> 增加同行文章
          </button>
        )}
      </>
    </div>
  );
}
