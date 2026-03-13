"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUp, Timer, Route, Gauge } from "lucide-react";
import { notFound } from "next/navigation";

// --- API Data Interfaces ---
interface Media {
  lat: number | null;
  lng: number | null;
  uri: string;
  type: string;
  taken_at: number;
}

interface Participant {
  name: string;
  distance: string | null;
  time: string | null;
  pace: string | null;
  race_count?: number | string | null;
}

interface MarathonMetadata {
  race_name: string | null;
  country: string | null;
  city: string | null;
  participants?: (Participant | string)[];
}

interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  media?: Media[];
  metadata?: MarathonMetadata | null;
}

// --- Helper Functions ---
function calculatePace(timeStr: string | null, distStr: string | null): string | null {
  if (!timeStr || !distStr) return null;
  try {
    let distance = 0;
    const d = distStr.toUpperCase();

    // 1. 識別標稱距離
    if (d.includes("全馬")) distance = 42.195;
    else if (d.includes("半馬")) distance = 21.0975;
    else if (d.includes("K")) {
      const match = d.match(/(\d+(\.\d+)?)/);
      if (match) distance = parseFloat(match[1]);
    } else {
      const match = d.match(/(\d+(\.\d+)?)/);
      if (match) distance = parseFloat(match[1]);
    }

    if (distance === 0) return null;

    // 2. 解析時間 (例如 "4小時31分47秒" 或 "04:31:47")
    let totalSeconds = 0;
    const hMatch = timeStr.match(/(\d+)小時/);
    const mMatch = timeStr.match(/(\d+)分/);
    const sMatch = timeStr.match(/(\d+)秒/);
    
    if (hMatch || mMatch || sMatch) {
      if (hMatch) totalSeconds += parseInt(hMatch[1]) * 3600;
      if (mMatch) totalSeconds += parseInt(mMatch[1]) * 60;
      if (sMatch) totalSeconds += parseInt(sMatch[1]);
    } else {
      // 嘗試解析時分秒格式 00:00:00
      const parts = timeStr.split(':').map(Number);
      if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    }

    if (totalSeconds === 0) return null;

    // 3. 計算配速 (秒/公里)
    const paceSecondsPerKm = totalSeconds / distance;
    const paceMin = Math.floor(paceSecondsPerKm / 60);
    const paceSec = Math.round(paceSecondsPerKm % 60);
    return `${paceMin}'${paceSec.toString().padStart(2, '0')}"`;
  } catch (e) { return null; }
}

function getRaceTypeInfo(distance: string | null) {
  if (!distance) return { label: "跑", theme: "zinc", bg: "bg-zinc-50", border: "border-zinc-300", text: "text-zinc-900/10", dataText: "text-ink" };
  
  const d = distance.toUpperCase();
  // 超馬判定：數值 > 42.195 或包含 "超"
  const distNumMatch = d.match(/(\d+(\.\d+)?)/);
  const distNum = distNumMatch ? parseFloat(distNumMatch[1]) : 0;

  if (distNum > 43 || d.includes("超馬") || d.includes("超")) 
    return { label: "超", theme: "ultra", bg: "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950", border: "border-zinc-600", text: "text-white/10", dataText: "text-white", labelColor: "text-zinc-400", shine: "bg-white/10" };
  
  if (d.includes("全馬") || distNum >= 42) 
    return { label: "全", theme: "gold", bg: "bg-gradient-to-br from-amber-100 via-amber-50 to-amber-400", border: "border-amber-500", text: "text-amber-900/10", dataText: "text-amber-950", labelColor: "text-amber-700/60", shine: "bg-white/40" };
  
  if (d.includes("半馬") || distNum >= 21) 
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

export default function LogDetail({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null);
  const [nav, setNav] = useState<{ prev: Post | null, next: Post | null }>({ prev: null, next: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchPostAndNav = async () => {
      try {
        const { id } = await (params as any);
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

  if (isLoading) return <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-xs uppercase tracking-widest animate-pulse text-ink/40">Loading Log...</div>;
  if (!post) notFound();

  const title = getDisplayTitle(post);
  const content = getDisplayContent(post);
  const coords = extractCoordinates(post.media);

  const locationLabel = post.metadata 
    ? (post.metadata.country && post.metadata.city 
        ? `${post.metadata.country} / ${post.metadata.city}` 
        : (post.metadata.race_name || '台灣 / 探索'))
    : null;

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-24 bg-paper">
      
      <div 
        className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none mix-blend-multiply opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 150 200 400 50' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 200 Q 200 300 400 150' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 300 Q 250 400 400 250' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3C/svg%3E")`
        }}
      />

      <div className="w-full h-[40vh] md:h-[50vh] bg-paper-dark border-b-[6px] border-brand relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%231a1a1a' stroke-width='0.5' stroke-opacity='0.2'%3E%3Cpath d='M0 100h400M0 200h400M0 300h400M100 0v400M200 0v400M300 0v400'/%3E%3C/g%3E%3Cpath d='M80 320 Q 150 200 200 150 T 320 80' stroke='%23E63946' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='80' cy='320' r='6' fill='%231a1a1a'/%3E%3Ccircle cx='320' cy='80' r='6' fill='%23E63946'/%3E%3C/svg%3E")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {coords && <div className="absolute bottom-4 right-4 bg-ink text-white font-mono text-xs px-3 py-1 tracking-widest shadow-lg">{coords}</div>}
      </div>

      <div className="max-w-3xl mx-auto -mt-10 relative z-10">
        <div className="bg-paper p-6 md:p-12 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-line">
          
          <Link href="/" scroll={false} className="inline-flex items-center gap-2 text-ink-light hover:text-brand font-mono text-sm uppercase tracking-widest mb-8 transition-colors">
            <ArrowLeft size={16} /> Back to Log
          </Link>

          <header className="mb-12">
            <div className="font-mono text-xs md:text-sm text-brand uppercase tracking-[0.15em] mb-4 flex flex-wrap gap-2 items-center">
              <span>{post.category || 'LOG'}</span>
              <span className="text-line">•</span>
              <span>{post.event_date}</span>
              {locationLabel && ( <> <span className="text-line">•</span> <span className="text-ink/60">{locationLabel}</span> </> )}
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-black leading-[1.2] text-ink mb-6 tracking-tight">{title}</h1>
            
            {/* Marathon Race Performance - Metallic Medal Style */}
            {post.metadata && post.metadata.participants && Array.isArray(post.metadata.participants) && post.metadata.participants.some(p => {
              const pData = typeof p === 'string' ? { name: p, time: null, distance: null, pace: null } : p;
              return pData.time && pData.time !== '---' && pData.time !== 'N/A';
            }) && (
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                {post.metadata.participants.map((p, idx) => {
                  const pData = typeof p === 'string' ? { name: p, time: null, distance: null, pace: null } : p;
                  
                  // 如果沒有完賽時間，則不顯示此圖卡
                  if (!pData.time || pData.time === '---' || pData.time === 'N/A') return null;

                  const displayPace = calculatePace(pData.time, pData.distance);
                  const info = getRaceTypeInfo(pData.distance);
                  return (
                    <div key={idx} className={`group relative overflow-hidden p-6 border-2 shadow-[0_10px_30px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] ${info.bg} ${info.border}`}>
                      <div className={`absolute -inset-full top-0 h-[200%] w-[200%] rotate-[35deg] translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[1500ms] ease-in-out pointer-events-none ${info.shine} opacity-20 blur-xl`}></div>
                      <div className={`absolute -right-4 -bottom-4 font-serif font-black text-[140px] leading-none select-none pointer-events-none transition-all duration-1000 group-hover:scale-110 group-hover:-rotate-6 ${info.text}`}>
                        {info.label}
                      </div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-baseline mb-6 border-b border-black/5 pb-2">
                          <div className="flex items-end gap-3">
                            <span className={`font-serif text-2xl font-black italic tracking-tighter leading-none ${info.dataText}`}>{pData.name}</span>
                            {pData.race_count && (
                              <div className="flex flex-col mb-0.5">
                                <span className={`font-mono text-[7px] uppercase tracking-[0.2em] opacity-40 leading-none mb-0.5 ${info.dataText}`}>Race No.</span>
                                <span className={`font-mono text-xs font-black leading-none ${info.theme === 'ultra' ? 'text-brand' : 'text-brand'}`}>
                                  #{pData.race_count}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${info.labelColor}`}>{pData.distance || '---'}</span>
                        </div>
                        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                          <div className="flex flex-col">
                            <div className={`flex items-center gap-1.5 opacity-40 mb-1 ${info.dataText}`}>
                              <Timer size={12} strokeWidth={2} />
                              <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Time</span>
                            </div>
                            <span className={`font-mono text-3xl font-black tabular-nums leading-none drop-shadow-sm ${info.dataText}`}>
                              {pData.time || '---'}
                            </span>
                          </div>
                          {displayPace && (
                            <div className="flex flex-col">
                              <div className={`flex items-center gap-1.5 opacity-40 mb-1 ${info.dataText}`}>
                                <Gauge size={12} strokeWidth={2} />
                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Pace</span>
                              </div>
                              <span className="font-mono text-3xl font-black italic tabular-nums leading-none drop-shadow-sm text-brand">
                                {displayPace}
                              </span>
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
              if (index === 0) return <p key={index} className="font-sans text-xl text-ink leading-loose text-justify mb-8"><span className="float-left font-serif text-6xl md:text-[80px] leading-[0.8] pt-2 pr-3 pb-0 text-brand font-black">{pText.charAt(0)}</span>{pText.slice(1)}</p>;
              return <p key={index} className="font-sans text-lg md:text-xl text-ink-light leading-relaxed text-justify mb-6 whitespace-pre-wrap">{pText}</p>;
            })}
          </article>

          {post.media && post.media.length > 0 && (
            <div className="mt-12 mb-8">
              <h3 className="font-mono text-xs md:text-sm text-ink-light uppercase tracking-widest mb-6 border-b border-line pb-2">Captured Moments ({post.media.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {post.media.map((mediaItem, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden bg-paper-dark border border-line">
                    {mediaItem.type === 'video' ? <video src={mediaItem.uri} controls playsInline className="w-full h-full object-cover bg-ink" /> : <img src={mediaItem.uri} alt={`Moment ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-20 pt-12 border-t border-ink/10 flex flex-col md:flex-row justify-between gap-12">
            {nav.prev ? (
              <Link href={`/log/${nav.prev.id}`} className="group flex-1">
                <span className="font-mono text-[10px] text-ink/30 uppercase tracking-[0.3em] block mb-2 group-hover:text-brand transition-colors">Previous Log</span>
                <h4 className="font-serif text-lg font-bold text-ink leading-tight group-hover:text-brand transition-colors">{getDisplayTitle(nav.prev)}</h4>
              </Link>
            ) : (
              <div className="flex-1 opacity-20 cursor-not-allowed">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] block mb-2">Previous Log</span>
                <h4 className="font-serif text-lg font-bold">End of Archive</h4>
              </div>
            )}
            <div className="w-px h-12 bg-line hidden md:block"></div>
            {nav.next ? (
              <Link href={`/log/${nav.next.id}`} className="group flex-1 md:text-right">
                <span className="font-mono text-[10px] text-ink/30 uppercase tracking-[0.3em] block mb-2 group-hover:text-brand transition-colors">Next Log</span>
                <h4 className="font-serif text-lg font-bold text-ink leading-tight group-hover:text-brand transition-colors">{getDisplayTitle(nav.next)}</h4>
              </Link>
            ) : (
              <div className="flex-1 md:text-right opacity-20 cursor-not-allowed">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] block mb-2">Next Log</span>
                <h4 className="font-serif text-lg font-bold">Latest Record</h4>
              </div>
            )}
          </div>

        </div>
      </div>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-8 right-8 z-[1000] p-4 bg-ink text-paper rounded-full shadow-2xl transition-all duration-500 hover:bg-brand hover:-translate-y-2 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}
      >
        <div className="flex flex-col items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-widest">
          <ArrowUp size={16} />
          <span>TOP</span>
        </div>
      </button>

    </main>
  );
}
