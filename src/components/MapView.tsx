"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { GeoJsonObject, Feature, Geometry } from "geojson";
import { ArrowRight, ChevronLeft } from "lucide-react";
import MarkerClusterGroup from "react-leaflet-cluster";
import CountryModal from "./CountryModal";
import ListView from "./ListView";
import TimelineView from "./TimelineView";
import { getApiBase } from "@/utils/apiBase";

const API_URL = getApiBase();

interface FlattenedPoint {
  id: string;
  postId: string;
  lat: number | null;
  lng: number | null;
  title: string;
  date: string;
  cat: string;
  sub_cats: string[];
  uri: string;
  country?: string;
  country_en?: string;
  continent?: string;
  city?: string;
}

// Points guaranteed to carry real coordinates (used for map markers/bounds).
type GeoPoint = FlattenedPoint & { lat: number; lng: number };

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }, [points, map]);
  return null;
}

const createEventIcon = () => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div class="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-[0_0_10px_rgba(230,57,70,0.5)]"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const createClusterCustomIcon = (cluster: { getChildCount: () => number }) => {
  const count = cluster.getChildCount();
  const size = Math.min(Math.max(28, 20 + Math.log2(count) * 4), 52);
  const fontSize = Math.max(10, Math.round(size * 0.38));
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e63946;border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 20px rgba(230,57,70,0.4);">
             <span style="color:white;font-size:${fontSize}px;font-weight:700;font-family:monospace;line-height:1;">${count}</span>
           </div>`,
    className: "custom-cluster-icon",
    iconSize: L.point(size, size, true),
  });
};

interface SubCategory {
  name: string;
  count: number;
}

interface Category {
  name: string;
  count: number;
  sub_categories: SubCategory[];
}

interface RaceStats {
  totalFM: number;
}

type ViewMode = 'map' | 'list' | 'timeline';

const VIEW_MODES: Array<{ mode: ViewMode; label: string }> = [
  { mode: 'map', label: '地圖' },
  { mode: 'list', label: '列表' },
  { mode: 'timeline', label: '時間軸' },
];

const TOTAL_COUNTRIES = 195;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const selectCls = "font-mono text-sm bg-paper border border-line/60 px-2 py-1 text-ink focus:outline-none focus:border-brand/60 cursor-pointer";

interface DateFilter {
  startYear: number;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
}

function formatDateFilter(f: DateFilter, compact = false): string {
  if (compact) {
    const sy = String(f.startYear).slice(-2);
    const sm = f.startMonth ? `/${f.startMonth}` : '';
    const ey = f.endYear ? String(f.endYear).slice(-2) : null;
    const em = f.endMonth ? `/${f.endMonth}` : '';
    const start = `${sy}${sm}`;
    const end = ey ? `${ey}${em}` : null;
    return end && end !== start ? `${start}→${end}` : start;
  }
  const start = f.startMonth ? `${f.startYear}年${f.startMonth}月` : `${f.startYear}年`;
  const end = f.endYear ? (f.endMonth ? `${f.endYear}年${f.endMonth}月` : `${f.endYear}年`) : null;
  return end && end !== start ? `${start} → ${end}` : start;
}

function DateRangePicker({
  availableYears,
  applied,
  onApply,
  onClear,
  compact = false,
}: {
  availableYears: number[];
  applied: DateFilter | null;
  onApply: (f: DateFilter) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sy, setSy] = useState<number | null>(null);
  const [sm, setSm] = useState<number | null>(null);
  const [ey, setEy] = useState<number | null>(null);
  const [em, setEm] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    if (open) { setOpen(false); return; }
    setSy(applied?.startYear ?? null);
    setSm(applied?.startMonth ?? null);
    setEy(applied?.endYear ?? null);
    setEm(applied?.endMonth ?? null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const endYears = sy ? availableYears.filter(y => y >= sy) : availableYears;
  const endMonths = (ey && sy && ey === sy && sm) ? MONTHS.filter(m => m >= sm) : MONTHS;

  const handleSyChange = (v: number | null) => {
    setSy(v); setSm(null);
    if (v && ey && ey < v) { setEy(null); setEm(null); }
  };
  const handleSmChange = (v: number | null) => {
    setSm(v);
    if (v && ey === sy && em && em < v) setEm(null);
  };
  const handleEyChange = (v: number | null) => { setEy(v); setEm(null); };

  const handleApply = () => {
    if (sy) { onApply({ startYear: sy, startMonth: sm, endYear: ey, endMonth: em }); }
    else { onClear(); }
    setOpen(false);
  };
  const handleClear = () => { setSy(null); setSm(null); setEy(null); setEm(null); };

  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          onClick={togglePanel}
          className={`font-mono text-base md:text-[13px] px-2.5 py-1 border transition-colors flex items-center gap-1.5 min-w-0 cursor-pointer ${
            applied
              ? 'border-brand/60 text-brand bg-white hover:bg-brand/5'
              : 'border-line/60 text-ink/70 bg-white hover:text-ink hover:border-ink/40'
          }`}
        >
          {/* Mobile keeps a short label — the three-way view toggle takes most
              of the row on a 390px screen. */}
          <span className="truncate md:hidden">{applied ? formatDateFilter(applied, true) : '期間'}</span>
          <span className="hidden md:block truncate">{applied ? formatDateFilter(applied, compact) : '選擇期間'}</span>
          <span className="opacity-70 text-xs shrink-0">▾</span>
        </button>
        {applied && (
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            className="font-mono text-sm text-ink/50 hover:text-ink transition-colors whitespace-nowrap shrink-0"
          >
            清除
          </button>
        )}
      </div>

      {open && (
        <div ref={panelRef} className="absolute top-full left-0 z-[700] bg-paper border border-line shadow-xl p-5 w-[280px]">
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-ink/60 w-12 shrink-0 whitespace-nowrap">起始</span>
              <select value={sy ?? ''} onChange={e => handleSyChange(e.target.value ? Number(e.target.value) : null)} className={`${selectCls} flex-1`}>
                <option value="">年</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={sm ?? ''} onChange={e => handleSmChange(e.target.value ? Number(e.target.value) : null)} disabled={!sy} className={`${selectCls} flex-1 disabled:opacity-30 disabled:cursor-not-allowed`}>
                <option value="">月</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-ink/60 w-12 shrink-0 whitespace-nowrap">結束</span>
              <select value={ey ?? ''} onChange={e => handleEyChange(e.target.value ? Number(e.target.value) : null)} disabled={!sy} className={`${selectCls} flex-1 disabled:opacity-30 disabled:cursor-not-allowed`}>
                <option value="">年</option>
                {endYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={em ?? ''} onChange={e => setEm(e.target.value ? Number(e.target.value) : null)} disabled={!ey} className={`${selectCls} flex-1 disabled:opacity-30 disabled:cursor-not-allowed`}>
                <option value="">月</option>
                {endMonths.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-line/40">
            <button onClick={handleClear} className="font-mono text-sm text-ink/60 hover:text-ink transition-colors underline underline-offset-2">
              清空
            </button>
            <button
              onClick={handleApply}
              disabled={!sy}
              className="font-mono text-sm px-5 py-1.5 bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              套用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Watch the map container's own size instead of taking `asideOpen` as a
    // prop. Two wins: this component no longer depends on aside state (so the
    // whole map subtree can be memoised and skip re-rendering on toggle), and
    // invalidateSize is debounced to fire ONCE after the resize settles rather
    // than eagerly on click. Eager invalidateSize forces the marker cluster to
    // re-cluster synchronously (~1.5s block) right in the middle of the aside
    // slide, which swallowed the animation. Letting leaflet's tiles visually
    // stretch during the 300ms slide and correcting once afterwards keeps the
    // animation on unblocked frames.
    const el = map.getContainer();
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => map.invalidateSize(), 160);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [map]);
  return null;
}

export default function MapView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>("馬拉松");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [raceStats, setRaceStats] = useState<RaceStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [listTitleMode, setListTitleMode] = useState<'countries' | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [humanViews, setHumanViews] = useState<number | null>(null);
  const [basePoints, setBasePoints] = useState<FlattenedPoint[]>([]);
  const [asideOpen, setAsideOpen] = useState(true);

  // API-derived counts (no date filter)
  const overseasCount = useMemo(() => {
    const marathon = categories.find(c => c.name === "馬拉松");
    return marathon?.sub_categories.find(s => s.name === "海外馬")?.count ?? 0;
  }, [categories]);

  const nineMajorsCount = useMemo(() => {
    const marathon = categories.find(c => c.name === "馬拉松");
    return marathon?.sub_categories.find(s => s.name === "九大馬")?.count ?? 0;
  }, [categories]);

  const travelCount = useMemo(() => {
    return categories.find(c => c.name === "旅遊")?.count ?? 0;
  }, [categories]);

  const hikingCount = useMemo(() => {
    return categories.find(c => c.name === "登山")?.count ?? 0;
  }, [categories]);

  const totalPostCount = useMemo(() =>
    categories.reduce((sum, c) => sum + c.count, 0),
  [categories]);

  // Date-filtered base (all categories, no geo filter)
  const filteredBase = useMemo(() => {
    if (!dateFilter) return basePoints;
    const { startYear, startMonth, endYear, endMonth } = dateFilter;
    const startVal = startYear * 100 + (startMonth ?? 1);
    const ey = endYear ?? startYear;
    const em = endMonth ?? 12;
    const endVal = ey * 100 + em;
    return basePoints.filter(p => {
      const d = new Date(p.date);
      const val = d.getFullYear() * 100 + (d.getMonth() + 1);
      return val >= startVal && val <= endVal;
    });
  }, [basePoints, dateFilter]);

  // Distinct visited countries across ALL posts (every category, geo not
  // required) — not the marathon-scoped `stats?participant=Davis` count, which
  // only saw countries with a race and so undercounted travel-/hike-only ones.
  // With a date filter active this narrows to `filteredBase`; otherwise it's
  // the whole dataset. Driven off `basePoints`/`filteredBase` so it always
  // matches what the list and timeline actually show.
  const displayCountryCount = useMemo(() => {
    const src = dateFilter ? filteredBase : basePoints;
    return new Set(src.map(p => p.country_en).filter(Boolean)).size;
  }, [dateFilter, filteredBase, basePoints]);

  const displayTotalPostCount = useMemo(() => {
    if (!dateFilter) return totalPostCount;
    return filteredBase.length;
  }, [dateFilter, totalPostCount, filteredBase]);

  const displayFMCount = useMemo(() => {
    if (!dateFilter) return raceStats?.totalFM ?? 0;
    return filteredBase.filter(p => p.cat === '馬拉松').length;
  }, [dateFilter, raceStats, filteredBase]);

  const displayOverseasCount = useMemo(() => {
    if (!dateFilter) return overseasCount;
    return filteredBase.filter(p => p.cat === '馬拉松' && p.sub_cats.includes('海外馬')).length;
  }, [dateFilter, overseasCount, filteredBase]);

  const displayNineMajorsCount = useMemo(() => {
    if (!dateFilter) return nineMajorsCount;
    return filteredBase.filter(p => p.cat === '馬拉松' && p.sub_cats.includes('九大馬')).length;
  }, [dateFilter, nineMajorsCount, filteredBase]);

  const displayTravelCount = useMemo(() => {
    if (!dateFilter) return travelCount;
    return filteredBase.filter(p => p.cat === '旅遊').length;
  }, [dateFilter, travelCount, filteredBase]);

  const displayHikingCount = useMemo(() => {
    if (!dateFilter) return hikingCount;
    return filteredBase.filter(p => p.cat === '登山').length;
  }, [dateFilter, hikingCount, filteredBase]);

  const statItems = useMemo<Array<{ label: string; unit: string; value: number; cat: string; sub: string | null }>>(() => [
    { label: "全馬",  unit: "場", value: displayFMCount,          cat: "馬拉松", sub: null      },
    { label: "海外馬", unit: "場", value: displayOverseasCount,   cat: "馬拉松", sub: "海外馬"  },
    { label: "九大馬", unit: "場", value: displayNineMajorsCount,  cat: "馬拉松", sub: "九大馬"  },
    { label: "旅遊",  unit: "篇", value: displayTravelCount,      cat: "旅遊",   sub: null      },
    { label: "登山",  unit: "座", value: displayHikingCount,      cat: "登山",   sub: null      },
  ], [displayFMCount, displayOverseasCount, displayNineMajorsCount, displayTravelCount, displayHikingCount]);

  // Points for the map layer: category/sub-category filtered, geo-required.
  // Derived client-side from basePoints instead of a separate network call —
  // basePoints already holds the full unfiltered dataset (geoOnly=false).
  const categoryFilteredPoints = useMemo(() => {
    return basePoints.filter(
      (p): p is GeoPoint =>
        p.lat != null &&
        p.lng != null &&
        (!activeCategory || p.cat === activeCategory) &&
        (!activeSubCategory || p.sub_cats.includes(activeSubCategory)),
    );
  }, [basePoints, activeCategory, activeSubCategory]);

  const points = useMemo(() => {
    if (!dateFilter) return categoryFilteredPoints;
    const { startYear, startMonth, endYear, endMonth } = dateFilter;
    const startVal = startYear * 100 + (startMonth ?? 1);
    const ey = endYear ?? startYear;
    const em = endMonth ?? 12;
    const endVal = ey * 100 + em;
    return categoryFilteredPoints.filter(p => {
      const d = new Date(p.date);
      const val = d.getFullYear() * 100 + (d.getMonth() + 1);
      return val >= startVal && val <= endVal;
    });
  }, [categoryFilteredPoints, dateFilter]);

  // Points for ListView: category/sub-category + date filtered, geo not required.
  const listPoints = useMemo(() => {
    return filteredBase.filter(p =>
      (!activeCategory || p.cat === activeCategory) &&
      (!activeSubCategory || p.sub_cats.includes(activeSubCategory)),
    );
  }, [filteredBase, activeCategory, activeSubCategory]);

  const availableYears = useMemo(() => {
    const years = new Set(basePoints.map(p => new Date(p.date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [basePoints]);

  // country_en → number of posts, drives choropleth intensity on the map
  const visitedCountries = useMemo(() => {
    const map = new globalThis.Map<string, number>();
    points.forEach(p => {
      if (p.country_en) map.set(p.country_en, (map.get(p.country_en) ?? 0) + 1);
    });
    return map;
  }, [points]);

  // Marker elements are memoised on `points` alone: without this, every
  // unrelated re-render (e.g. collapsing the aside) rebuilt a few hundred
  // Marker/Popup elements and blocked the main thread long enough to swallow
  // the panel's slide animation.
  const markerLayer = useMemo(() => (
    <MarkerClusterGroup
      chunkedLoading
      iconCreateFunction={createClusterCustomIcon}
      maxClusterRadius={60}
      showCoverageOnHover={false}
      spiderfyOnMaxZoom={true}
    >
      {points.map((pt) => (
    <Marker
      key={pt.id}
      position={[pt.lat, pt.lng]}
      icon={createEventIcon()}
    >
      <Popup className="custom-popup">
        <Link
          href={`/log/${pt.postId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-2 max-w-[200px] group"
        >
          <div className="font-mono text-xs text-brand uppercase mb-1">{pt.cat} / {pt.date}</div>
          <h3 className="font-serif font-bold text-sm leading-tight mb-2 line-clamp-2 group-hover:text-brand transition-colors">{pt.title}</h3>
          {pt.uri && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={pt.uri} alt="Moment" className="w-full h-24 object-cover mb-2 border border-line" />
          )}
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink group-hover:text-brand transition-colors">
            VIEW LOG <ArrowRight size={12} />
          </span>
        </Link>
      </Popup>
    </Marker>
      ))}
    </MarkerClusterGroup>
  ), [points]);

  const handleFilterClick = useCallback((cat: string, sub: string | null) => {
    setListTitleMode(null);
    const isActive = activeCategory === cat && activeSubCategory === sub;
    if (isActive) {
      setActiveCategory("馬拉松");
      setActiveSubCategory(null);
    } else {
      setActiveCategory(cat);
      setActiveSubCategory(sub);
    }
  }, [activeCategory, activeSubCategory]);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Failed to fetch GeoJSON:", err));
  }, []);

  // Sequential scale: near-white pink (1 visit) → deep vivid red (VISIT_CAP+
  // visits). Saturation ramps up alongside darkness so the deep end reads as
  // more vivid, not muddier, than the brand red it's built around.
  const COUNTRY_HUE = 356;
  const countryFillColor = (intensity: number) => {
    const saturation = 80 + intensity * 10; // 65% (light) → 90% (deep, vivid)
    const lightness = 85 - intensity * 50; // 95% (near-white pink) → 42% (deep red)
    return `hsl(${COUNTRY_HUE}, ${saturation}%, ${lightness}%)`;
  };

  const geoStyle = (feature?: { properties: { name: string; "ISO3166-1-Alpha-3": string } }) => {
    const name = feature?.properties?.name ?? "";
    const isoA3 = feature?.properties?.["ISO3166-1-Alpha-3"] ?? "";
    const count = visitedCountries.get(name) ?? visitedCountries.get(isoA3) ?? 0;
    const isVisited = count > 0;
    // Scale against a fixed cap rather than the dataset max — the home base
    // (e.g. Taiwan) has an order of magnitude more posts than anywhere else,
    // so normalizing against it would flatten every other country into the
    // same near-minimum shade. Countries at/above the cap render at full
    // intensity; everything below spreads across the gradient on a log curve.
    // Cap is well above the typical "visited a handful of times" range so
    // the #2 country (e.g. China) still reads visibly lighter than the #1
    // outlier (e.g. Taiwan) instead of both clipping to the same max shade.
    const VISIT_CAP = 50;
    const cappedCount = Math.min(count, VISIT_CAP);
    const intensity = isVisited ? Math.log(cappedCount + 1) / Math.log(VISIT_CAP + 1) : 0;
    return {
      fillColor: isVisited ? countryFillColor(intensity) : "transparent",
      weight: isVisited ? 1.5 : 0,
      opacity: isVisited ? 0.7 : 0,
      color: "#e63946",
      // 半透明遮罩：讓底圖的國家/城市地名能透出來，同時保留造訪次數的深淺漸層。
      fillOpacity: isVisited ? 0.5 : 0,
    };
  };

  const onEachCountry = useCallback((feature: Feature<Geometry, { name: string; "ISO3166-1-Alpha-3": string }>, layer: L.Layer) => {
    const name = feature?.properties?.name ?? "";
    const isoA3 = feature?.properties?.["ISO3166-1-Alpha-3"] ?? "";
    if (!visitedCountries.has(name) && !visitedCountries.has(isoA3)) return;
    layer.on("click", () => {
      const match = points.find((p) => p.country_en === name || p.country_en === isoA3);
      if (match?.country) setSelectedCountry(match.country.trim());
    });
  }, [visitedCountries, points]);

  useEffect(() => {
    const fetchRaceStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/stats?participant=Davis`);
        if (!res.ok) return;
        const davis = await res.json();
        setRaceStats({ totalFM: davis.fm_count || 0 });
      } catch (err) {
        console.error("Failed to fetch race stats:", err);
      }
    };
    fetchRaceStats();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/stats/visits`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHumanViews(d.total_human); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchBasePoints = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_URL}/api/v1/locations?geoOnly=false`);
        if (res.ok) {
          const data: FlattenedPoint[] = await res.json();
          setBasePoints(data);
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBasePoints();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/categories`);
        if (res.ok) {
          const data: Category[] = await res.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const pct = ((displayCountryCount / TOTAL_COUNTRIES) * 100).toFixed(1);

  return (
    <div className="relative flex flex-col flex-1 min-h-0 w-full overflow-hidden">

      {/* ── Full-width Date Picker + View Toggle ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-2 border-b border-line/40 z-[600]"
        style={{
          backgroundColor: '#e8e4de',
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent, transparent 13px, rgba(0,0,0,0.05) 13px, rgba(0,0,0,0.05) 14px)',
            'repeating-linear-gradient(90deg, transparent, transparent 13px, rgba(0,0,0,0.03) 13px, rgba(0,0,0,0.03) 14px)',
          ].join(', '),
        }}
      >
        <div className="flex-1 min-w-0">
          <DateRangePicker
            availableYears={availableYears}
            applied={dateFilter}
            onApply={setDateFilter}
            onClear={() => setDateFilter(null)}
          />
        </div>
        <div className="shrink-0 flex items-center border border-line/60 rounded-full bg-white">
          {VIEW_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center justify-center px-3.5 py-2 rounded-full transition-colors cursor-pointer ${viewMode === mode ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'}`}
            >
              <span className="font-mono text-sm uppercase tracking-[0.15em] leading-none whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col md:flex-row flex-1 min-h-0">

      {/* ── Desktop Aside (hidden on mobile) ──
          Slides via a negative left margin rather than an animated width: the
          aside is a flex item, so the flex algorithm resolves its used size
          from flex-basis and ignores a transitioning `width` (the panel would
          jump). `margin-left` is applied after flex sizing, so animating it
          from 0 to -20rem slides the fixed-width panel off to the left while
          the map (flex-1) smoothly reclaims the space. */}
      <aside className={`hidden md:flex shrink-0 flex-col bg-white z-[500] overflow-hidden md:w-80 transition-[margin-left] duration-300 ease-in-out relative ${asideOpen ? 'ml-0' : '-ml-80'}`}>

        <div className="flex flex-col h-full w-80">

        <div className="relative z-10 px-7 pt-4 pb-6 border-b border-r border-line/40 bg-white shadow-[0_4px_14px_-6px_rgba(0,0,0,0.18)]">
          <div className="grid grid-cols-2 divide-x divide-line/40">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); setListTitleMode('countries'); }}
              className="text-left group cursor-pointer transition-all hover:opacity-80 hover:-translate-y-0.5 pr-5"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-5xl tabular-nums leading-none text-brand">
                  {displayCountryCount}
                </span>
                <span className="font-serif text-lg text-ink/40 pb-0.5">國</span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/60">已到訪國家</p>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); setListTitleMode(null); }}
              className="text-left group cursor-pointer transition-all hover:opacity-80 hover:-translate-y-0.5 pl-5"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-5xl tabular-nums leading-none text-brand">
                  {displayOverseasCount}
                </span>
                <span className="font-serif text-lg text-ink/40 pb-0.5">場</span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/60">海外馬拉松</p>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 max-h-[22rem] overflow-y-auto flex flex-col">
        <div
          className="p-5 grid grid-cols-2 gap-5"
          style={{ gridTemplateRows: 'repeat(3, minmax(5rem, 1fr))' }}
        >
          <button
            onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setListTitleMode(null); }}
            className={`group [container-type:size] flex flex-col items-start justify-between px-4 py-3 h-full transition-all duration-200 text-left border-2 cursor-pointer ${
              activeCategory === null
                ? "border-brand bg-brand/8 -translate-y-0.5"
                : "border-line/60 hover:border-ink/30 hover:bg-ink/4 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-baseline gap-1 leading-none">
              <span className={`font-mono font-bold tabular-nums [font-size:clamp(1.25rem,44cqh,2.25rem)] ${activeCategory === null ? "text-brand" : "text-ink"}`}>
                {displayTotalPostCount}
              </span>
              <span className={`font-serif font-bold [font-size:clamp(0.875rem,17cqh,1.25rem)] ${activeCategory === null ? "text-brand/70" : "text-ink/50"}`}>
                篇
              </span>
            </div>
            <span className={`font-mono font-bold tracking-widest leading-tight [font-size:clamp(0.75rem,13cqh,1rem)] ${
              activeCategory === null ? "text-brand" : "text-ink/70 group-hover:text-ink"
            }`}>
              所有文章
            </span>
          </button>
          {statItems.map(({ label, unit, value, cat, sub }) => {
            const isActive = activeCategory === cat && activeSubCategory === sub;
            return (
              <button
                key={label}
                onClick={() => handleFilterClick(cat, sub)}
                className={`group [container-type:size] flex flex-col items-start justify-between px-4 py-3 h-full transition-all duration-200 text-left border-2 cursor-pointer ${
                  isActive
                    ? "border-brand bg-brand/8 -translate-y-0.5"
                    : "border-line/60 hover:border-ink/30 hover:bg-ink/4 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-baseline gap-1 leading-none">
                  <span className={`font-mono font-bold tabular-nums [font-size:clamp(1.25rem,44cqh,2.25rem)] ${isActive ? "text-brand" : "text-ink"}`}>
                    {value}
                  </span>
                  <span className={`font-serif font-bold [font-size:clamp(0.875rem,17cqh,1.25rem)] ${isActive ? "text-brand/70" : "text-ink/50"}`}>
                    {unit}
                  </span>
                </div>
                <span className={`font-mono font-bold tracking-widest leading-tight [font-size:clamp(0.75rem,13cqh,1rem)] ${
                  isActive ? "text-brand" : "text-ink/70 group-hover:text-ink"
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        </div>
        </div>{/* end fixed-width content */}

        {/* Right divider — overlaid so the hero section's white bg can't hide it,
            and inside the z-[500] aside so it paints above the map tiles. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-ink/20 z-10" />

      </aside>

      {/* Collapse / Expand toggle — a sibling of the aside (not a child), so it
          stays on screen when the panel slides off. Its `left` animates in
          lock-step with the panel margin: open → sitting on the panel's right
          border; collapsed → just inside the map's left edge. */}
      <button
        onClick={() => setAsideOpen(o => !o)}
        className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-[550] w-5 h-14 bg-paper border border-line rounded-md items-center justify-center shadow-sm transition-[left] duration-300 ease-in-out cursor-pointer ${asideOpen ? 'left-[19.375rem]' : 'left-1'}`}
        aria-label={asideOpen ? '收合側欄' : '展開側欄'}
      >
        <ChevronLeft size={13} className={`text-ink/50 transition-transform duration-300 ${asideOpen ? '' : 'rotate-180'}`} />
      </button>

      {/* ── Main area: Map (always mounted) + ListView overlay ── */}
      <main className="flex-1 flex flex-col min-h-0">


        {/* ── Map / List area ── */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {viewMode === 'list' && (
            <div className="absolute inset-0 z-20 bg-paper">
              <ListView
                points={listPoints}
                isLoading={isLoading}
                category={activeCategory}
                subCategory={activeSubCategory}
                titleMode={listTitleMode}
              />
            </div>
          )}
          {viewMode === 'timeline' && (
            <div className="absolute inset-0 z-20 bg-paper">
              <TimelineView
                points={listPoints}
                isLoading={isLoading}
                category={activeCategory}
                subCategory={activeSubCategory}
                titleMode={listTitleMode}
              />
            </div>
          )}
          {isLoading && points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper z-10 font-mono text-sm uppercase tracking-widest text-ink">
              Generating Spatial Log...
            </div>
          )}
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxBounds={[[-85, -180], [85, 180]]}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          className="w-full h-full grayscale-[0.3] contrast-[1.1]"
          zoomControl={false}
          worldCopyJump={false}
        >
          <TileLayer
            className="grayscale-[0.8] contrast-[1.1]"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {geoData && (
            <GeoJSON
              key={`geojson-${[...visitedCountries.entries()].sort().join(',')}`}
              data={geoData}
              style={geoStyle}
              onEachFeature={onEachCountry}
            />
          )}

          <MapResizer />
          <FitBounds points={points} />
          <ZoomControl position="bottomright" />

          {markerLayer}
        </MapContainer>
        </div>{/* end map/list area */}

        {/* ── Mobile Bottom Panel ── */}
        <div className="md:hidden shrink-0 bg-paper border-t border-line">
          {/* Hero stats */}
          <div className="relative z-10 flex items-center gap-4 px-4 pt-3 pb-2 bg-paper shadow-[0_-4px_14px_-6px_rgba(0,0,0,0.18)]">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); setListTitleMode('countries'); }}
              className="flex items-baseline gap-1 active:opacity-60 transition-opacity"
            >
              <span className="font-mono font-bold text-3xl tabular-nums leading-none text-brand">{displayCountryCount}</span>
              <span className="font-serif text-base text-ink/60">國</span>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); setListTitleMode(null); }}
              className="flex items-baseline gap-1 active:opacity-60 transition-opacity"
            >
              <span className="font-mono font-bold text-3xl tabular-nums leading-none text-brand">{displayOverseasCount}</span>
              <span className="font-serif text-base text-ink/60">場海外馬</span>
            </button>
            {humanViews !== null && (
              <span className="self-end pb-0.5 ml-auto shrink-0 font-mono text-[12px] text-ink/40 tracking-widest whitespace-nowrap">
                累計 {humanViews.toLocaleString()} 人次造訪
              </span>
            )}
          </div>
          {/* Category chips — wrap onto multiple rows so every category is
              visible at once; horizontal scrolling was hard to use on mobile. */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-2 pb-safe">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setListTitleMode(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-full border font-mono text-sm whitespace-nowrap transition-all ${
                activeCategory === null
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink/60 active:bg-ink/5"
              }`}
            >
              <span>所有文章</span>
              <span className="font-bold tabular-nums">{displayTotalPostCount}</span>
            </button>
            {statItems.map(({ label, value, cat, sub }) => {
              const isActive = activeCategory === cat && activeSubCategory === sub;
              return (
                <button
                  key={label}
                  onClick={() => handleFilterClick(cat, sub)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-full border font-mono text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-paper text-ink/60 active:bg-ink/5"
                  }`}
                >
                  <span>{label}</span>
                  <span className="font-bold tabular-nums">{value}</span>
                </button>
              );
            })}
          </div>
        </div>

      </main>

      </div>{/* end aside+main row */}

      {/* Country Modal */}
      {selectedCountry && (
        <CountryModal
          country={selectedCountry}
          onClose={() => setSelectedCountry(null)}
        />
      )}

      <style jsx global>{`
        .leaflet-container {
          background: #f8f9fa !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0 !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .custom-cluster-icon {
          background: none !important;
          border: none !important;
        }
        /* Hide filter chip scrollbar */
        .chip-scroll::-webkit-scrollbar,
        .time-chip-scroll::-webkit-scrollbar {
          display: none;
        }
        .chip-scroll,
        .time-chip-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}</style>
    </div>
  );
}
