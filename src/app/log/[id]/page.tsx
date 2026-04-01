"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, Timer, Gauge, Edit2 } from "lucide-react";
import { notFound } from "next/navigation";

// --- API Data Interfaces ---
interface Media {
  lat: number | null;
  lng: number | null;
  uri: string;
  type: string;
  taken_at: number;
}

interface ParticipantStats {
  FM_count: number | null;
  HM_count: number | null;
  UM_count: number | null;
  distance_km: number | null;
}

interface Participant {
  name: string;
  distance: string | null;
  time: string | null;
  stats: ParticipantStats;
}

interface MarathonMetadata {
  race_name: string | null;
  country: string | null;
  city: string | null;
  participants: Participant[];
}

interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  cover_image?: string;
  media?: Media[];
  metadata?: MarathonMetadata | null;
}

// --- Helper Functions ---
function getNormalizedDistance(distStr: string | null, distKm: number | null): string {
  if (distKm && distKm >= 42 && distKm <= 45) return "全馬";
  if (distKm && distKm >= 21 && distKm <= 22) return "半馬";
  if (distKm && distKm > 45) return "超馬";
  return distStr || "跑步";
}

function calculatePace(timeStr: string | null, distStr: string | null, distKm?: number | null): string | null {
  const normalizedDist = getNormalizedDistance(distStr, distKm || null);
  let distance = distKm || 0;
  
  if (distance === 0) {
    if (normalizedDist === "全馬") distance = 42.195;
    else if (normalizedDist === "半馬") distance = 21.0975;
  }
  
  if (!timeStr || !distance || distance === 0) return null;

  try {
    let totalSeconds = 0;
    const hMatch = timeStr.match(/(\d+)小時/);
    const mMatch = timeStr.match(/(\d+)分/);
    const sMatch = timeStr.match(/(\d+)秒/);
    if (hMatch || mMatch || sMatch) {
      if (hMatch) totalSeconds += parseInt(hMatch[1] || '0') * 3600;
      if (mMatch) totalSeconds += parseInt(mMatch[1] || '0') * 60;
      if (sMatch) totalSeconds += parseInt(sMatch[1] || '0');
    } else {
      const parts = timeStr.split(':').map(Number);
      if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    }
    if (totalSeconds === 0) return null;

    const paceSecondsPerKm = totalSeconds / distance;
    const paceMin = Math.floor(paceSecondsPerKm / 60);
    const paceSec = Math.round(paceSecondsPerKm % 60);
    return `${paceMin}'${paceSec.toString().padStart(2, '0')}"`;
  } catch { return null; }
}

function getRaceTypeInfo(distName: string) {
  if (distName === "超馬") 
    return { label: "超", theme: "ultra", bg: "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950", border: "border-zinc-600", text: "text-white/10", dataText: "text-white", labelColor: "text-zinc-400", shine: "bg-white/10" };
  if (distName === "全馬") 
    return { label: "全", theme: "gold", bg: "bg-gradient-to-br from-amber-100 via-amber-50 to-amber-400", border: "border-amber-500", text: "text-amber-900/10", dataText: "text-amber-950", labelColor: "text-amber-700/60", shine: "bg-white/40" };
  if (distName === "半馬") 
    return { label: "半", theme: "silver", bg: "bg-gradient-to-br from-slate-100 via-white to-slate-400", border: "border-slate-400", text: "text-slate-900/10", dataText: "text-slate-900", labelColor: "text-slate-600/60", shine: "bg-white/50" };
  return { label: "跑", theme: "rose", bg: "bg-gradient-to-br from-rose-100 via-rose-50 to-rose-300", border: "border-rose-400", text: "text-rose-900/10", dataText: "text-rose-950", labelColor: "text-rose-700/60", shine: "bg-white/40" };
}

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
  if (match) { text = text.replace(match[0], '').trim(); }
  return text;
}

function extractCoordinates(media: Media[] | undefined) {
  if (!media || media.length === 0) return null;
  const loc = media.find(m => m.lat !== null && m.lng !== null);
  return loc ? `${loc.lat?.toFixed(4)}° N, ${loc.lng?.toFixed(4)}° E` : null;
}

export default function LogDetail({ params }: { params: Promise<{ id: string }> }) {
  const [post, setPost] = useState<Post | null>(null);
  const [nav, setNav] = useState<{ prev: Post | null, next: Post | null }>({ prev: null, next: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 檢查是否具備管理員權限
    const token = localStorage.getItem("maramap_admin_token");
    if (token) setIsAdmin(true);

    const fetchPostAndNav = async () => {
      try {
        const { id } = await (params as Promise<{ id: string }>);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/posts/${id}`, { cache: 'no-store' });
        if (!res.ok) { setIsLoading(false); return; }
        const data = await res.json();
        setPost(data);

        const listRes = await fetch(`${apiUrl}/api/v1/posts?limit=100`, { cache: 'no-store' });
        if (listRes.ok) {
          const listJson = await listRes.json();
          const list: Post[] = listJson.data;
          const idx = list.findIndex(p => p.id === id);
          if (idx !== -1) {
            setNav({ next: list[idx - 1] || null, prev: list[idx + 1] || null });
          }
        }
      } catch (error) {
        console.error("Failed to fetch post detail or navigation:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPostAndNav();
    const toggleVisibility = () => { setIsVisible(window.pageYOffset > 500); };
    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, [params]);

  if (isLoading) return <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-lg animate-pulse text-ink/40">正在載入紀錄...</div>;
  if (!post) notFound();

  const title = getDisplayTitle(post);
  const content = getDisplayContent(post);
  const coords = extractCoordinates(post.media);
  const locationLabel = post.metadata 
    ? (post.metadata.country && post.metadata.city ? `${post.metadata.country} / ${post.metadata.city}` : (post.metadata.race_name || '探索軌跡'))
    : null;

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-24 bg-paper text-ink">
      <div 
        className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none mix-blend-multiply opacity-[0.03]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 150 200 400 50' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 200 Q 200 300 400 150' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 300 Q 250 400 400 250' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3C/svg%3E")` }}
      />
      
      <div className="w-full h-[45vh] md:h-[60vh] bg-paper-dark border-b-[6px] border-brand relative overflow-hidden flex items-center justify-center">
        {post.cover_image ? (
          <img src={post.cover_image} alt="Cover" className="w-full h-full object-cover animate-in fade-in duration-1000" />
        ) : (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%231a1a1a' stroke-width='0.5' stroke-opacity='0.2'%3E%3Cpath d='M0 100h400M0 200h400M0 300h400M100 0v400M200 0v400M300 0v400'/%3E%3C/g%3E%3Cpath d='M80 320 Q 150 200 200 150 T 320 80' stroke='%23E63946' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='80' cy='320' r='6' fill='%231a1a1a'/%3E%3Ccircle cx='320' cy='80' r='6' fill='%23E63946'/%3E%3C/svg%3E")`, backgroundSize: 'cover' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-paper/40 to-transparent" />
        {coords && <div className="absolute bottom-6 right-6 bg-ink text-white font-mono text-sm px-4 py-1.5 tracking-widest shadow-2xl">{coords}</div>}
        
        {/* 管理員快速編輯按鈕 */}
        {isAdmin && (
          <Link 
            href={`/admin/edit/${post.id}`}
            className="absolute top-6 right-6 z-[1000] bg-brand text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group"
          >
            <Edit2 size={20} />
            <span className="font-sans text-sm font-bold max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap">編輯此篇</span>
          </Link>
        )}
      </div>

      <div className="max-w-4xl mx-auto -mt-16 relative z-10">
        <div className="bg-paper p-8 md:p-16 shadow-[0_-20px_60px_rgba(0,0,0,0.08)] border-t border-line">
          <Link href="/" scroll={false} className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-base font-black mb-10 transition-colors">
            <ArrowLeft size={18} /> 返回日誌列表
          </Link>
          
          <header className="mb-16">
            <div className="font-sans text-sm md:text-base text-brand font-black uppercase tracking-[0.2em] mb-6 flex flex-wrap gap-3 items-center">
              <span>{post.category || '日誌'}</span>
              <span className="text-line">/</span>
              <span>{post.event_date}</span>
              {locationLabel && ( <> <span className="text-line">/</span> <span className="text-ink/60">{locationLabel}</span> </> )}
            </div>
            <h1 className="font-serif text-4xl md:text-6xl font-black leading-[1.2] text-ink mb-10 tracking-tight">{title}</h1>
            
            {post.metadata && post.metadata.participants && Array.isArray(post.metadata.participants) && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                {post.metadata.participants.map((p, idx) => {
                  const displayTime = p.time && p.time !== '---' && p.time !== 'N/A' ? p.time : '進行中';
                  const normalizedDist = getNormalizedDistance(p.distance, p.stats?.distance_km);
                  const displayPace = calculatePace(p.time, p.distance, p.stats?.distance_km);
                  const info = getRaceTypeInfo(normalizedDist);
                  
                  return (
                    <div key={idx} className={`group relative overflow-hidden p-8 border-2 shadow-xl transition-all duration-500 hover:-translate-y-1 ${info.bg} ${info.border}`}>
                      {/* 浮水印字樣 */}
                      <div className={`absolute -right-4 -bottom-4 font-serif font-black text-[140px] leading-none select-none pointer-events-none transition-all duration-1000 group-hover:scale-110 group-hover:-rotate-6 ${info.text}`}>
                        {info.label}
                      </div>

                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8 border-b border-black/5 pb-4">
                          <div className="flex flex-col">
                            <span className={`font-serif text-3xl font-black italic tracking-tighter leading-none mb-3 ${info.dataText}`}>{p.name}</span>
                            
                            {/* 呈現所有場數資訊 */}
                            <div className="flex flex-wrap gap-4">
                              {p.stats?.FM_count && (
                                <div className="flex flex-col">
                                  <span className={`font-sans text-[9px] uppercase font-black opacity-40 leading-none mb-1 ${info.dataText}`}>全馬累計</span>
                                  <span className="font-mono text-sm font-black leading-none text-brand">第 {p.stats.FM_count} 場</span>
                                </div>
                              )}
                              {p.stats?.HM_count && (
                                <div className="flex flex-col border-l border-black/5 pl-4">
                                  <span className={`font-sans text-[9px] uppercase font-black opacity-40 leading-none mb-1 ${info.dataText}`}>半馬累計</span>
                                  <span className="font-mono text-sm font-black leading-none text-brand">第 {p.stats.HM_count} 場</span>
                                </div>
                              )}
                              {p.stats?.UM_count && (
                                <div className="flex flex-col border-l border-black/5 pl-4">
                                  <span className={`font-sans text-[9px] uppercase font-black opacity-40 leading-none mb-1 ${info.dataText}`}>超馬累計</span>
                                  <span className="font-mono text-sm font-black leading-none text-brand">第 {p.stats.UM_count} 場</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className={`font-sans text-sm font-black uppercase tracking-widest ${info.labelColor} pt-1`}>{normalizedDist}</span>
                        </div>
                        
                        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
                          <div className="flex flex-col">
                            <div className={`flex items-center gap-2 opacity-40 mb-2 ${info.dataText}`}><Timer size={14} /><span className="font-sans text-[10px] uppercase font-black tracking-widest">完賽時間</span></div>
                            <span className={`font-mono text-4xl font-black tabular-nums leading-none ${info.dataText}`}>{displayTime}</span>
                          </div>
                          {displayPace && (
                            <div className="flex flex-col">
                              <div className={`flex items-center gap-2 opacity-40 mb-2 ${info.dataText}`}><Gauge size={14} /><span className="font-sans text-[10px] uppercase font-black tracking-widest">平均配速</span></div>
                              <span className={`font-mono text-4xl font-black italic tabular-nums leading-none text-brand`}>{displayPace}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </header>

          <article className="prose max-w-none">
            {content.split('\n\n').map((paragraph, index) => {
              const pText = paragraph.trim();
              if (!pText) return null;
              if (index === 0) return <p key={index} className="font-sans text-2xl text-ink leading-relaxed text-justify mb-10"><span className="float-left font-serif text-7xl md:text-8xl leading-[0.8] pt-2 pr-4 pb-0 text-brand font-black">{pText.charAt(0)}</span>{pText.slice(1)}</p>;
              return <p key={index} className="font-sans text-xl md:text-2xl text-ink-light leading-[1.8] text-justify mb-8 whitespace-pre-wrap">{pText}</p>;
            })}
          </article>

          {post.media && post.media.length > 0 && (
            <div className="mt-20 mb-12">
              <h3 className="font-sans text-base text-ink/40 font-black uppercase tracking-widest mb-8 border-b border-line pb-4 flex items-center gap-3">
                現場捕捉的照片 <span className="font-mono text-sm font-normal">({post.media.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {post.media.map((mediaItem, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden bg-paper-dark border border-line shadow-sm group">
                    {mediaItem.type === 'video' ? (
                      <video src={mediaItem.uri} controls playsInline className="w-full h-full object-cover bg-ink" />
                    ) : (
                      <img src={mediaItem.uri} alt={`Moment ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-32 pt-16 border-t-2 border-ink flex flex-col md:flex-row justify-between gap-16">
            {nav.prev ? (
              <Link href={`/log/${nav.prev.id}`} className="group flex-1">
                <span className="font-sans text-xs text-ink/30 font-black uppercase tracking-widest block mb-3 group-hover:text-brand transition-colors">← 上一篇紀錄</span>
                <h4 className="font-serif text-xl font-black text-ink leading-tight group-hover:text-brand transition-colors">{getDisplayTitle(nav.prev)}</h4>
              </Link>
            ) : (
              <div className="flex-1 opacity-20"><span className="font-sans text-xs font-black uppercase tracking-widest block mb-3">首篇紀錄</span><h4 className="font-serif text-xl font-black">這是日誌的開端</h4></div>
            )}
            <div className="w-px h-16 bg-line hidden md:block"></div>
            {nav.next ? (
              <Link href={`/log/${nav.next.id}`} className="group flex-1 md:text-right">
                <span className="font-sans text-xs text-ink/30 font-black uppercase tracking-widest block mb-3 group-hover:text-brand transition-colors">下一篇紀錄 →</span>
                <h4 className="font-serif text-xl font-black text-ink leading-tight group-hover:text-brand transition-colors">{getDisplayTitle(nav.next)}</h4>
              </Link>
            ) : (
              <div className="flex-1 md:text-right opacity-20"><span className="font-sans text-xs font-black uppercase tracking-widest block mb-3">最新紀錄</span><h4 className="font-serif text-xl font-black">目前已是最新</h4></div>
            )}
          </div>
        </div>
      </div>

      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={`fixed bottom-10 right-10 z-[1000] p-5 bg-ink text-paper rounded-full shadow-2xl transition-all duration-500 hover:bg-brand hover:-translate-y-2 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        <div className="flex flex-col items-center gap-1 font-sans text-[10px] font-black uppercase tracking-widest"><ArrowUp size={20} /><span>置頂</span></div>
      </button>
    </main>
  );
}
