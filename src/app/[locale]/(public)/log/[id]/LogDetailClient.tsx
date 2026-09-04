"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUp, Timer, Gauge, Edit2, ChevronLeft, ChevronRight, X, Maximize2, Play } from "lucide-react";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getApiBase } from "@/utils/apiBase";
import { formatCityName } from "@/utils/formatLocation";
import { translateTaxonomyLabel, translateDistanceType, translatePairedName, type Locale } from "@/utils/taxonomyTranslations";
import type { Post as PostBase } from "@/utils/postHelpers";


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
  race_name_en?: string | null;
  country: string | null;
  country_en?: string | null;
  city: string | null;
  city_en?: string | null;
  mountain_name?: string | null;
  mountain_name_en?: string | null;
  participants: Participant[];
}

interface Post extends PostBase {
  cover_image?: string;
  media?: Media[];
  metadata?: MarathonMetadata | null;
  trip_id?: string | null;
  title_en?: string | null;
  content_en?: string | null;
  // 'pending' means a translation attempt is in flight for this post right
  // now (either ours or another reader's) — see the trigger effect below.
  content_status?: 'pending' | 'done' | 'failed' | null;
}

interface TripPost {
  postId: string;
  title: string;
  title_en?: string | null;
  date: string;
  category: string;
  country: string | null;
  country_en?: string | null;
  city: string | null;
  city_en?: string | null;
  coverImage: string | null;
  isPrimary: boolean;
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

const RACE_LABEL_CHAR: Record<Locale, Record<string, string>> = {
  zh: { 超馬: "超", 全馬: "全", 半馬: "半", 跑步: "跑" },
  en: { 超馬: "U", 全馬: "F", 半馬: "H", 跑步: "R" },
};

function getRaceTypeInfo(distName: string, locale: Locale) {
  const label = RACE_LABEL_CHAR[locale][distName] ?? RACE_LABEL_CHAR[locale]["跑步"];
  if (distName === "超馬")
    return { label, theme: "ultra", bg: "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950", border: "border-zinc-600", text: "text-white/10", dataText: "text-white", labelColor: "text-zinc-400", shine: "bg-white/10" };
  if (distName === "全馬")
    return { label, theme: "gold", bg: "bg-gradient-to-br from-amber-100 via-amber-50 to-amber-400", border: "border-amber-500", text: "text-amber-900/10", dataText: "text-amber-950", labelColor: "text-amber-700/60", shine: "bg-white/40" };
  if (distName === "半馬")
    return { label, theme: "silver", bg: "bg-gradient-to-br from-slate-100 via-white to-slate-400", border: "border-slate-400", text: "text-slate-900/10", dataText: "text-slate-900", labelColor: "text-slate-600/60", shine: "bg-white/50" };
  return { label, theme: "rose", bg: "bg-gradient-to-br from-rose-100 via-rose-50 to-rose-300", border: "border-rose-400", text: "text-rose-900/10", dataText: "text-rose-950", labelColor: "text-rose-700/60", shine: "bg-white/40" };
}

function getDisplayTitle(post: Post, fallback: string, locale: Locale) {
  return translatePairedName(post.title, post.title_en, locale) || fallback;
}

// Never blank per the i18n plan's fallback rule: an English reader who hits
// an untranslated post sees the Chinese original (with a notice above the
// article, added by the caller) rather than nothing.
function getDisplayContent(post: Post, locale: Locale) {
  return translatePairedName(post.content, post.content_en, locale);
}

function extractCoordinates(media: Media[] | undefined) {
  if (!media || media.length === 0) return null;
  const loc = media.find(m => m.lat !== null && m.lng !== null);
  return loc ? `${loc.lat?.toFixed(4)}° N, ${loc.lng?.toFixed(4)}° E` : null;
}

function useSliderDrag(idx: number, count: number, onPrev: () => void, onNext: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const liveOffset = useRef(0);
  const didDrag = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    didDrag.current = false;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const raw = e.touches[0].clientX - startX.current;
    if (Math.abs(raw) > 5) didDrag.current = true;
    // rubber-band at edges
    const clamped =
      (idx === 0 && raw > 0) ? raw * 0.22 :
      (idx === count - 1 && raw < 0) ? raw * 0.22 :
      raw;
    liveOffset.current = clamped;
    setOffset(clamped);
  };
  const onTouchEnd = () => {
    const o = liveOffset.current;
    setDragging(false);
    setOffset(0);
    liveOffset.current = 0;
    startX.current = null;
    if (Math.abs(o) > 48) o < 0 ? onNext() : onPrev();
  };

  // CSS for the sliding strip: percentage is relative to strip width
  const stripStyle: React.CSSProperties = {
    width: `${count * 100}%`,
    transform: `translateX(calc(-${(idx / count) * 100}% + ${offset}px))`,
    transition: dragging ? 'none' : 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    willChange: 'transform',
  };

  return { stripStyle, onTouchStart, onTouchMove, onTouchEnd, didDrag };
}

function MediaCarousel({ items, onOpen }: { items: Media[]; onOpen: (i: number) => void }) {
  const [idx, setIdx] = useState(0);
  const prev = useCallback(() => setIdx(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % items.length), [items.length]);
  const drag = useSliderDrag(idx, items.length, prev, next);

  return (
    <div className="border border-line/40">
      <div
        className="relative aspect-[4/3] overflow-hidden bg-ink/8 group cursor-zoom-in select-none"
        onClick={() => { if (!drag.didDrag.current) onOpen(idx); }}
        onTouchStart={drag.onTouchStart}
        onTouchMove={drag.onTouchMove}
        onTouchEnd={drag.onTouchEnd}
      >
        {/* Sliding strip */}
        <div className="flex h-full" style={drag.stripStyle}>
          {items.map((item, i) => (
            <div key={i} style={{ width: `${100 / items.length}%` }} className="h-full shrink-0 relative">
              {item.type === 'video'
                ? <video src={item.uri} playsInline muted preload="metadata" className="w-full h-full object-cover pointer-events-none" />
                : <Image src={item.uri} alt={`Media ${i + 1}`} fill className="object-cover pointer-events-none" />}
            </div>
          ))}
        </div>

        {/* Play icon overlay for videos */}
        {items[idx]?.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={22} className="text-white ml-1" fill="white" />
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/30 pointer-events-none" />

        <div className="absolute top-3 right-3 bg-ink/50 backdrop-blur-sm p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Maximize2 size={14} className="text-white" />
        </div>

        {items.length > 1 && (
          <div className="absolute bottom-3 left-3 font-mono text-[11px] text-white/80 bg-ink/50 backdrop-blur-sm px-2 py-0.5 pointer-events-none">
            {idx + 1} / {items.length}
          </div>
        )}

        {items.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-paper/80 hover:bg-paper backdrop-blur-sm hidden md:flex items-center justify-center transition-all md:opacity-0 md:group-hover:opacity-100">
              <ChevronLeft size={18} className="text-ink" />
            </button>
            <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-paper/80 hover:bg-paper backdrop-blur-sm hidden md:flex items-center justify-center transition-all md:opacity-0 md:group-hover:opacity-100">
              <ChevronRight size={18} className="text-ink" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-0.5">
          {items.map((m, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`shrink-0 w-14 h-14 relative overflow-hidden border-2 transition-all ${i === idx ? 'border-brand' : 'border-transparent opacity-50 hover:opacity-80'}`}>
              {m.type === 'video'
                ? (
                  // No <video> here on purpose: at 56px the first frame is
                  // unreadable, so the icon alone carries the meaning — and
                  // every thumbnail that renders one costs a metadata fetch
                  // on page load, on top of the one the main strip already does.
                  <div className="w-full h-full flex items-center justify-center bg-ink/70">
                    <Play size={18} className="text-white" fill="white" />
                  </div>
                )
                : <Image src={m.uri} alt="" fill className="object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

interface Transform { scale: number; x: number; y: number }
const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

/**
 * Facebook-style zoom + pan for the lightbox: wheel / pinch to zoom around the
 * cursor (or pinch midpoint), drag to pan once zoomed, double click/tap to
 * toggle. Callers reset it themselves when switching slides.
 */
function useZoomPan(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  // Mirror of `transform` so gesture handlers can read the latest value
  // without re-subscribing native listeners on every frame.
  const ref = useRef(IDENTITY);
  const commit = useCallback((next: Transform) => {
    ref.current = next;
    setTransform(next);
  }, []);

  const clamp = useCallback((next: Transform): Transform => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    if (scale === MIN_SCALE) return IDENTITY;
    const el = containerRef.current;
    const maxX = ((el?.clientWidth ?? 0) * (scale - 1)) / 2;
    const maxY = ((el?.clientHeight ?? 0) * (scale - 1)) / 2;
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, [containerRef]);

  // Zoom by `factor`, keeping the point under (clientX, clientY) anchored.
  // Without a focal point the zoom is centred on the container.
  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const cur = ref.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur.scale * factor));
    const ratio = scale / cur.scale;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && clientX != null && clientY != null) {
      const px = clientX - rect.left - rect.width / 2;
      const py = clientY - rect.top - rect.height / 2;
      commit(clamp({ scale, x: px - (px - cur.x) * ratio, y: py - (py - cur.y) * ratio }));
    } else {
      commit(clamp({ scale, x: cur.x * ratio, y: cur.y * ratio }));
    }
  }, [clamp, commit, containerRef]);

  const panBy = useCallback((dx: number, dy: number) => {
    const cur = ref.current;
    commit(clamp({ ...cur, x: cur.x + dx, y: cur.y + dy }));
  }, [clamp, commit]);

  const reset = useCallback(() => commit(IDENTITY), [commit]);

  const toggle = useCallback((clientX?: number, clientY?: number) => {
    if (ref.current.scale > MIN_SCALE) reset();
    else zoomBy(DOUBLE_TAP_SCALE, clientX, clientY);
  }, [reset, zoomBy]);

  // Wheel must be a non-passive native listener so preventDefault works and the
  // page behind the portal doesn't scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, zoomBy]);

  return { transform, zoomBy, panBy, reset, toggle, zoomed: transform.scale > MIN_SCALE };
}

function Lightbox({ items, initialIdx, onClose }: { items: Media[]; initialIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIdx);
  const stripRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { transform: zoomT, zoomBy, panBy, reset: resetZoom, toggle: toggleZoom, zoomed } = useZoomPan(viewportRef);
  // Zoom is per-slide: always land on a new photo at 1x.
  const goTo = useCallback((updater: (i: number) => number) => {
    resetZoom();
    setIdx(updater);
  }, [resetZoom]);
  const prev = useCallback(() => goTo(i => (i - 1 + items.length) % items.length), [goTo, items.length]);
  const next = useCallback(() => goTo(i => (i + 1) % items.length), [goTo, items.length]);
  const drag = useSliderDrag(idx, items.length, prev, next);

  // Touch gestures are multiplexed: 2 fingers pinch, 1 finger pans while
  // zoomed, 1 finger swipes between slides at 1x.
  const touchMode = useRef<'swipe' | 'pan' | 'pinch' | null>(null);
  const pinchDist = useRef(0);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const lastTapAt = useRef(0);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  const touchDistance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      touchMode.current = 'pinch';
      pinchDist.current = touchDistance(e.touches);
      return;
    }
    if (zoomed) {
      touchMode.current = 'pan';
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return;
    }
    touchMode.current = 'swipe';
    drag.onTouchStart(e);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchMode.current === 'pinch' && e.touches.length >= 2) {
      const dist = touchDistance(e.touches);
      if (pinchDist.current > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomBy(dist / pinchDist.current, midX, midY);
      }
      pinchDist.current = dist;
      return;
    }
    if (touchMode.current === 'pan' && lastTouch.current) {
      const { clientX, clientY } = e.touches[0];
      panBy(clientX - lastTouch.current.x, clientY - lastTouch.current.y);
      lastTouch.current = { x: clientX, y: clientY };
      return;
    }
    if (touchMode.current === 'swipe') drag.onTouchMove(e);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchMode.current === 'swipe') {
      drag.onTouchEnd();
      // Double tap toggles zoom (only when the finger didn't travel).
      if (!drag.didDrag.current) {
        const now = Date.now();
        const touch = e.changedTouches[0];
        if (now - lastTapAt.current < 300) {
          toggleZoom(touch?.clientX, touch?.clientY);
          lastTapAt.current = 0;
        } else {
          lastTapAt.current = now;
        }
      }
    }
    if (e.touches.length === 0) {
      touchMode.current = null;
      lastTouch.current = null;
      pinchDist.current = 0;
    }
  };

  // Mouse drag-to-pan while zoomed.
  const onMouseDown = (e: React.MouseEvent) => {
    if (!zoomed) return;
    e.preventDefault();
    panStart.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panStart.current) return;
      panBy(e.clientX - panStart.current.x, e.clientY - panStart.current.y);
      panStart.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { panStart.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panBy]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === '+' || e.key === '=') zoomBy(1.3);
      if (e.key === '-' || e.key === '_') zoomBy(1 / 1.3);
      if (e.key === '0') resetZoom();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, prev, next, zoomBy, resetZoom]);

  // Pause all videos when switching slides
  useEffect(() => {
    stripRef.current?.querySelectorAll('video').forEach(v => v.pause());
  }, [idx]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" onClick={onClose}>
      {/* Main viewing area */}
      <div
        ref={viewportRef}
        className={`relative flex-1 overflow-hidden touch-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={e => e.stopPropagation()}
        onDoubleClick={e => toggleZoom(e.clientX, e.clientY)}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={stripRef} className="flex h-full items-center" style={drag.stripStyle}>
          {items.map((item, i) => {
            const zoomStyle: React.CSSProperties | undefined =
              i === idx && item.type !== 'video'
                ? {
                    transform: `translate(${zoomT.x}px, ${zoomT.y}px) scale(${zoomT.scale})`,
                    transition: 'transform 0.12s ease-out',
                    willChange: 'transform',
                  }
                : undefined;
            return (
              <div key={i} style={{ width: `${100 / items.length}%` }} className="h-full shrink-0 flex items-center justify-center overflow-hidden">
                {item.type === 'video'
                  // Every slide in the strip is rendered, so without preload="none"
                  // opening the lightbox fetches metadata for all N videos at once.
                  // There is no autoplay — the viewer presses play either way.
                  ? <video src={item.uri} controls preload="none" className="w-full h-full outline-none" />
                  : /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.uri} alt={`Media ${i + 1}`} className="w-full h-full object-contain select-none" style={zoomStyle} draggable={false} />}
              </div>
            );
          })}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white rounded-full z-10">
          <X size={18} />
        </button>

        {/* No on-screen zoom controls: the photo is the control surface. Touch
            pinches and double-taps, desktop uses the wheel, double-click and
            +/-/0 — all wired up above. */}

        {/* Arrows are desktop-only; on touch the photo is swiped directly. */}
        {items.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/20 hidden md:flex items-center justify-center transition-colors text-white rounded-full z-10">
              <ChevronLeft size={22} />
            </button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/20 hidden md:flex items-center justify-center transition-colors text-white rounded-full z-10">
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function LogDetailClient({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const t = useTranslations("LogDetail");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const previewMode = searchParams.get('preview') === 'true';
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tripPosts, setTripPosts] = useState<TripPost[]>([]);
  const [lightbox, setLightbox] = useState<{ items: Media[]; idx: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const checkAdmin = () => {
      // 檢查是否具備管理員權限
      const token = localStorage.getItem("maramap_admin_token");
      if (token) setIsAdmin(true);
    };
    checkAdmin();

    const fetchPostAndNav = async () => {
      try {
        const { id } = await params;
        const apiUrl = getApiBase();
        const url = new URL(`${apiUrl}/api/v1/posts/${id}`);
        if (previewMode) {
          url.searchParams.set('preview', 'true');
        }
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) { setIsLoading(false); return; }
        const data: Post = await res.json();
        setPost(data);
        // English readers only: kick off the lazy first-view translation as a
        // SEPARATE request the browser awaits itself (never blocking the
        // page's own load, and safe on Cloud Run precisely because it's the
        // browser — not a detached server-side task — holding this open).
        // First-ever view of a post pays a few seconds' latency here; every
        // later view (this reader's refresh, anyone else's, a crawler) reads
        // the cache this call fills in and returns instantly.
        if (locale === "en" && data.content_status !== "done") {
          fetch(`${apiUrl}/api/v1/posts/${data.id}/translate`, { method: "POST" })
            .then((r) => (r.ok ? r.json() : null))
            .then((result: { status: string; content?: string; title?: string } | null) => {
              if (result?.status === "done" && result.content) {
                setPost((prev) =>
                  prev
                    ? { ...prev, content_en: result.content, title_en: result.title ?? prev.title_en, content_status: "done" }
                    : prev,
                );
              } else if (result?.status === "pending") {
                setPost((prev) => (prev ? { ...prev, content_status: "pending" } : prev));
              }
            })
            .catch(() => {});
        }
        if (data.trip_id) {
          const tripRes = await fetch(`${apiUrl}/api/v1/posts/trip/${data.trip_id}`);
          if (tripRes.ok) {
            const all: TripPost[] = await tripRes.json();
            setTripPosts(all.filter(p => p.postId !== data.id));
          }
        }
      } catch (error) {
        console.error("Failed to fetch post detail or navigation:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPostAndNav();
  }, [params, previewMode, locale]);

  useEffect(() => {
    if (isLoading) return;
    const el = mainRef.current;
    if (!el) return;
    const toggleVisibility = () => setIsVisible(el.scrollTop > 500);
    el.addEventListener("scroll", toggleVisibility);
    return () => el.removeEventListener("scroll", toggleVisibility);
  }, [isLoading]);

  if (isLoading) return <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-lg text-ink">{t("loadingRecord")}</div>;
  if (!post) notFound();

  const title = getDisplayTitle(post, t("untitledFallback"), locale);
  const content = getDisplayContent(post, locale);
  const isUntranslated = locale === "en" && post.content_status !== "done";
  const coords = extractCoordinates(post.media);
  const locationLabel = post.metadata
    ? (post.metadata.country && post.metadata.city
        ? `${translatePairedName(post.metadata.country, post.metadata.country_en, locale)}·${translatePairedName(formatCityName(post.metadata.city, post.metadata.country), post.metadata.city_en, locale)}`
        : (translatePairedName(post.metadata.race_name || "", post.metadata.race_name_en, locale) || t("exploringTrail")))
    : null;

  return (
    <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative pb-24 bg-paper text-ink">
      <div 
        className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none mix-blend-multiply opacity-[0.03]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 150 200 400 50' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 200 Q 200 300 400 150' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 300 Q 250 400 400 250' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3C/svg%3E")` }}
      />
      
      <div className="w-full h-[45vh] md:h-[60vh] bg-paper-dark border-b-[6px] border-brand relative overflow-hidden flex items-center justify-center">
        {post.cover_image ? (
          <Image src={post.cover_image} alt="Cover" fill className="object-cover animate-in fade-in duration-1000" />
        ) : (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%231a1a1a' stroke-width='0.5' stroke-opacity='0.2'%3E%3Cpath d='M0 100h400M0 200h400M0 300h400M100 0v400M200 0v400M300 0v400'/%3E%3C/g%3E%3Cpath d='M80 320 Q 150 200 200 150 T 320 80' stroke='%23E63946' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='80' cy='320' r='6' fill='%231a1a1a'/%3E%3Ccircle cx='320' cy='80' r='6' fill='%23E63946'/%3E%3C/svg%3E")`, backgroundSize: 'cover' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-paper/40 to-transparent" />
        {coords && <div className="absolute bottom-6 right-6 bg-ink text-white font-mono text-sm px-4 py-1.5 tracking-widest shadow-2xl">{coords}</div>}
        
        {/* 管理員快速編輯按鈕 — plain next/link, not the locale-aware one: /admin
            is intentionally outside the [locale] segment (single-language,
            see src/i18n/routing.ts), so this must always go to /admin/edit/...
            with no /en prefix even when viewing the English article. */}
        {isAdmin && (
          <NextLink
            href={`/admin/edit/${post.id}`}
            className="absolute top-6 right-6 z-[1000] bg-brand text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group"
          >
            <Edit2 size={20} />
            <span className="font-sans text-sm font-bold max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap">{t("editThisPost")}</span>
          </NextLink>
        )}
      </div>

      <div className="max-w-4xl mx-auto -mt-16 relative z-10">
        <div className="bg-paper p-8 md:p-16 shadow-[0_-20px_60px_rgba(0,0,0,0.08)] border-t border-line">
          <Link href="/" scroll={false} className="inline-flex items-center gap-2 text-ink/60 hover:text-brand font-sans text-base font-black mb-10 transition-colors">
            <ArrowLeft size={18} /> {t("backHome")}
          </Link>

          <header className="mb-16">
            <div className="font-sans text-sm md:text-base text-brand font-black uppercase tracking-[0.2em] mb-6 flex flex-wrap gap-3 items-center">
              <span>{post.category ? translateTaxonomyLabel(post.category, locale) : t("journalFallback")}</span>
              <span className="text-line">/</span>
              <span>{post.event_date}</span>
              {locationLabel && ( <> <span className="text-line">/</span> <span className="text-ink/60">{locationLabel}</span> </> )}
            </div>
            <h1 className="font-sans text-2xl md:text-4xl font-bold leading-[1.2] text-ink tracking-tight">{title}</h1>
            
            {post.metadata && post.metadata.participants && Array.isArray(post.metadata.participants) && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                {post.metadata.participants.filter(p => p.name === "Davis").map((p, idx) => {
                  const hasTime = !!(p.time && p.time !== '---' && p.time !== 'N/A' && p.time !== '0:00:00');
                  const normalizedDist = getNormalizedDistance(p.distance, p.stats?.distance_km);
                  const displayPace = hasTime ? calculatePace(p.time, p.distance, p.stats?.distance_km) : null;
                  const info = getRaceTypeInfo(normalizedDist, locale);

                  return (
                    <div key={idx} className={`group relative overflow-hidden p-8 border-2 shadow-xl transition-all duration-500 hover:-translate-y-1 ${info.bg} ${info.border}`}>
                      {/* 浮水印 */}
                      <div className={`absolute -right-4 -bottom-4 font-serif font-black text-[110px] leading-none select-none pointer-events-none transition-all duration-1000 group-hover:scale-110 group-hover:-rotate-6 ${info.text}`}>
                        {info.label}
                      </div>

                      <div className="relative z-10">
                        {/* Header: name + distance badge */}
                        <div className="flex justify-between items-start mb-6 border-b border-black/5 pb-5">
                          <span className={`font-serif text-3xl font-black italic tracking-tighter leading-none ${info.dataText}`}>{p.name}</span>
                          <span className={`font-sans text-base font-black uppercase tracking-widest ${info.labelColor} pt-1`}>{translateDistanceType(normalizedDist, locale)}</span>
                        </div>

                        {/* Cumulative counts */}
                        {(p.stats?.FM_count || p.stats?.HM_count || p.stats?.UM_count) && (
                          <div className="flex flex-wrap gap-5 mb-7">
                            {p.stats?.FM_count && (
                              <div className="flex flex-col">
                                <span className={`font-sans text-xs uppercase font-black opacity-40 leading-none mb-3 ${info.dataText}`}>{t("cumulativeFM")}</span>
                                <span className="font-mono text-base font-black leading-none text-brand">{t("raceOrdinal", { count: p.stats.FM_count })}</span>
                              </div>
                            )}
                            {p.stats?.HM_count && (
                              <div className="flex flex-col border-l border-black/10 pl-5">
                                <span className={`font-sans text-xs uppercase font-black opacity-40 leading-none mb-3 ${info.dataText}`}>{t("cumulativeHM")}</span>
                                <span className="font-mono text-base font-black leading-none text-brand">{t("raceOrdinal", { count: p.stats.HM_count })}</span>
                              </div>
                            )}
                            {p.stats?.UM_count && (
                              <div className="flex flex-col border-l border-black/10 pl-5">
                                <span className={`font-sans text-xs uppercase font-black opacity-40 leading-none mb-3 ${info.dataText}`}>{t("cumulativeUM")}</span>
                                <span className="font-mono text-base font-black leading-none text-brand">{t("raceOrdinal", { count: p.stats.UM_count })}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Time + Pace */}
                        <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
                          <div className="flex flex-col">
                            <div className={`flex items-center gap-2 opacity-40 mb-2 ${info.dataText}`}>
                              <Timer size={14} />
                              <span className="font-sans text-xs uppercase font-black tracking-widest">{t("finishTime")}</span>
                            </div>
                            {hasTime ? (
                              <span className={`font-mono text-3xl font-black tabular-nums leading-none ${info.dataText}`}>{p.time}</span>
                            ) : (
                              <span className={`font-mono text-3xl font-black leading-none opacity-20 ${info.dataText}`}>—</span>
                            )}
                          </div>
                          {displayPace && (
                            <div className="flex flex-col">
                              <div className={`flex items-center gap-2 opacity-40 mb-2 ${info.dataText}`}>
                                <Gauge size={14} />
                                <span className="font-sans text-xs uppercase font-black tracking-widest">{t("averagePace")}</span>
                              </div>
                              <span className="font-mono text-3xl font-black italic tabular-nums leading-none text-brand">{displayPace}</span>
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

          {isUntranslated && (
            <div className="mb-10 border border-brand/30 bg-brand/5 px-5 py-3 font-sans text-sm text-ink/70">
              {post.content_status === "pending" ? t("translationPending") : t("notTranslatedYet")}
            </div>
          )}

          <article className="prose max-w-none">
            {content.split('\n\n').map((paragraph, index) => {
              const pText = paragraph.trim();
              if (!pText) return null;
              return <p key={index} className="font-sans text-lg md:text-xl text-ink leading-[1.8] mb-8 whitespace-pre-wrap">{pText}</p>;
            })}
          </article>

          {post.media && post.media.length > 0 && (() => {
            const images = post.media!.filter(m => m.type !== 'video');
            const videos = post.media!.filter(m => m.type === 'video');
            return (
              <>
                {images.length > 0 && (
                  <div className="mt-20 mb-12">
                    <h3 className="font-sans text-base text-ink/60 font-black uppercase tracking-widest mb-8 border-b border-line pb-4 flex items-center gap-3">
                      {t("photos")} <span className="font-mono text-sm font-normal">({images.length})</span>
                    </h3>
                    <MediaCarousel items={images} onOpen={i => setLightbox({ items: images, idx: i })} />
                  </div>
                )}
                {videos.length > 0 && (
                  <div className="mt-12 mb-12">
                    <h3 className="font-sans text-base text-ink/60 font-black uppercase tracking-widest mb-8 border-b border-line pb-4 flex items-center gap-3">
                      {t("videos")} <span className="font-mono text-sm font-normal">({videos.length})</span>
                    </h3>
                    <MediaCarousel items={videos} onOpen={i => setLightbox({ items: videos, idx: i })} />
                  </div>
                )}
              </>
            );
          })()}

          {tripPosts.length > 0 && (
            <div className="mt-20 mb-12">
              <h3 className="font-sans text-base text-ink/60 font-black uppercase tracking-widest mb-8 border-b border-line pb-4 flex items-center gap-3">
                {t("companionTrail")} <span className="font-mono text-sm font-normal">({tripPosts.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tripPosts.map((tp) => (
                  <Link
                    key={tp.postId}
                    href={`/log/${tp.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-4 border border-line hover:border-brand transition-colors"
                  >
                    {/* No h-20 — the fixed height left a gap below the thumbnail
                        whenever the text column (2-line title + category/date +
                        city) grew taller than 80px. min-h-20 + the container's
                        default align-items:stretch lets the image fill exactly
                        as much height as the text needs, so it always bleeds
                        flush to the card's top/left/bottom with no gap. */}
                    <div className="w-20 min-h-20 shrink-0 overflow-hidden bg-paper-dark">
                      {tp.coverImage
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={tp.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-ink/50 font-mono text-xs">{translateTaxonomyLabel(tp.category, locale)}</div>
                      }
                    </div>
                    <div className="flex flex-col justify-center min-w-0 py-3 pr-3">
                      <span className="font-mono text-xs text-brand uppercase tracking-widest mb-1">{translateTaxonomyLabel(tp.category, locale)} · {tp.date}</span>
                      <span className="font-sans font-normal text-base text-ink group-hover:text-brand transition-colors leading-snug line-clamp-2">{translatePairedName(tp.title, tp.title_en, locale) || tp.title}</span>
                      {tp.city && <span className="font-mono text-xs text-ink/60 mt-1">{translatePairedName(formatCityName(tp.city, tp.country), tp.city_en, locale)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {lightbox && (
            <Lightbox items={lightbox.items} initialIdx={lightbox.idx} onClose={() => setLightbox(null)} />
          )}

        </div>
      </div>

      <button onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className={`fixed bottom-10 right-10 z-[1000] p-5 bg-ink text-paper rounded-full shadow-2xl transition-all duration-500 hover:bg-brand hover:-translate-y-2 cursor-pointer ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        <div className="flex flex-col items-center gap-1 font-sans text-xs font-black uppercase tracking-widest"><ArrowUp size={20} /><span>TOP</span></div>
      </button>
    </main>
  );
}
