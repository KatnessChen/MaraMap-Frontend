"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { GeoJsonObject, Feature, Geometry } from "geojson";
import { ArrowRight } from "lucide-react";
import MarkerClusterGroup from "react-leaflet-cluster";
import CountryModal from "./CountryModal";
import ListView from "./ListView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

interface FlattenedPoint {
  id: string;
  postId: string;
  lat: number;
  lng: number;
  title: string;
  date: string;
  cat: string;
  uri: string;
  country?: string;
  country_en?: string;
  continent?: string;
  city?: string;
}

function FitBounds({ points }: { points: FlattenedPoint[] }) {
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

const TOTAL_COUNTRIES = 195;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const selectCls = "font-mono text-xs bg-paper border border-line/60 px-2 py-1 text-ink focus:outline-none focus:border-brand/60 cursor-pointer";

interface DateFilter {
  startYear: number;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
}

function formatDateFilter(f: DateFilter): string {
  const start = f.startMonth ? `${f.startYear}年${f.startMonth}月` : `${f.startYear}年`;
  const end = f.endYear ? (f.endMonth ? `${f.endYear}年${f.endMonth}月` : `${f.endYear}年`) : null;
  return end && end !== start ? `${start} → ${end}` : start;
}

function DateRangePicker({
  availableYears,
  applied,
  onApply,
  onClear,
}: {
  availableYears: number[];
  applied: DateFilter | null;
  onApply: (f: DateFilter) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sy, setSy] = useState<number | null>(null);
  const [sm, setSm] = useState<number | null>(null);
  const [ey, setEy] = useState<number | null>(null);
  const [em, setEm] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const openPanel = () => {
    setSy(applied?.startYear ?? null);
    setSm(applied?.startMonth ?? null);
    setEy(applied?.endYear ?? null);
    setEm(applied?.endMonth ?? null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    <div className="relative shrink-0" ref={ref}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={openPanel}
          className={`font-mono text-xs px-3 py-1 border transition-colors flex items-center gap-1.5 ${
            applied
              ? 'border-brand/60 text-brand bg-brand/5 hover:bg-brand/10'
              : 'border-line/60 text-ink/70 hover:text-ink hover:border-ink/40'
          }`}
        >
          {applied ? formatDateFilter(applied) : '選擇期間'}
          <span className="opacity-70 text-[11px]">▾</span>
        </button>
        {applied && (
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            className="w-4 h-4 flex items-center justify-center text-ink/60 hover:text-ink transition-colors font-mono text-xs leading-none"
            aria-label="清除篩選"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-[700] bg-paper border border-line shadow-xl p-5 w-[300px]">
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60 mb-2">起始</p>
              <div className="flex flex-col gap-1.5">
                <select value={sy ?? ''} onChange={e => handleSyChange(e.target.value ? Number(e.target.value) : null)} className={selectCls}>
                  <option value="">年</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={sm ?? ''} onChange={e => handleSmChange(e.target.value ? Number(e.target.value) : null)} disabled={!sy} className={`${selectCls} disabled:opacity-30 disabled:cursor-not-allowed`}>
                  <option value="">月</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                </select>
              </div>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60 mb-2">結束</p>
              <div className="flex flex-col gap-1.5">
                <select value={ey ?? ''} onChange={e => handleEyChange(e.target.value ? Number(e.target.value) : null)} disabled={!sy} className={`${selectCls} disabled:opacity-30 disabled:cursor-not-allowed`}>
                  <option value="">年</option>
                  {endYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={em ?? ''} onChange={e => setEm(e.target.value ? Number(e.target.value) : null)} disabled={!ey} className={`${selectCls} disabled:opacity-30 disabled:cursor-not-allowed`}>
                  <option value="">月</option>
                  {endMonths.map(m => <option key={m} value={m}>{m}月</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-line/40">
            <button onClick={handleClear} className="font-mono text-xs text-ink/60 hover:text-ink transition-colors underline underline-offset-2">
              清空
            </button>
            <button
              onClick={handleApply}
              disabled={!sy}
              className="font-mono text-xs px-5 py-1.5 bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              套用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapView() {
  const [allPoints, setAllPoints] = useState<FlattenedPoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>("馬拉松");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [raceStats, setRaceStats] = useState<RaceStats | null>(null);
  const [totalCountryCount, setTotalCountryCount] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [humanViews, setHumanViews] = useState<number | null>(null);
  const overseasCount = useMemo(() => {
    const marathon = categories.find(c => c.name === "馬拉松");
    return marathon?.sub_categories.find(s => s.name === "海外馬")?.count ?? 0;
  }, [categories]);

  const sevenMajorsCount = useMemo(() => {
    const marathon = categories.find(c => c.name === "馬拉松");
    return marathon?.sub_categories.find(s => s.name === "七大馬")?.count ?? 0;
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

  const statItems = useMemo<Array<{ label: string; unit: string; value: number; cat: string; sub: string | null }>>(() => [
    { label: "全馬",  unit: "場", value: raceStats?.totalFM ?? 0, cat: "馬拉松", sub: null      },
    { label: "海外馬", unit: "場", value: overseasCount,           cat: "馬拉松", sub: "海外馬"  },
    { label: "七大馬", unit: "場", value: sevenMajorsCount,        cat: "馬拉松", sub: "七大馬"  },
    { label: "旅遊",  unit: "篇", value: travelCount,              cat: "旅遊",   sub: null      },
    { label: "百岳",  unit: "座", value: hikingCount,              cat: "登山",   sub: null      },
  ], [raceStats, overseasCount, sevenMajorsCount, travelCount, hikingCount]);

  const points = useMemo(() => {
    if (!dateFilter) return allPoints;
    const { startYear, startMonth, endYear, endMonth } = dateFilter;
    const startVal = startYear * 100 + (startMonth ?? 1);
    const ey = endYear ?? startYear;
    const em = endMonth ?? 12;
    const endVal = ey * 100 + em;
    return allPoints.filter(p => {
      const d = new Date(p.date);
      const val = d.getFullYear() * 100 + (d.getMonth() + 1);
      return val >= startVal && val <= endVal;
    });
  }, [allPoints, dateFilter]);

  const availableYears = useMemo(() => {
    const years = new Set(allPoints.map(p => new Date(p.date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [allPoints]);

  const { startDate, endDate } = useMemo(() => {
    if (!dateFilter) return { startDate: undefined, endDate: undefined };
    const { startYear, startMonth, endYear, endMonth } = dateFilter;
    const sm = startMonth ?? 1;
    const ey = endYear ?? startYear;
    const em = endMonth ?? 12;
    const lastDay = new Date(ey, em, 0).getDate();
    return {
      startDate: `${startYear}-${String(sm).padStart(2, '0')}-01`,
      endDate: `${ey}-${String(em).padStart(2, '0')}-${lastDay}`,
    };
  }, [dateFilter]);

  const visitedCountries = useMemo(() => {
    const set = new Set<string>();
    points.forEach(p => { if (p.country_en) set.add(p.country_en); });
    return set;
  }, [points]);

  const handleFilterClick = useCallback((cat: string, sub: string | null) => {
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

  const geoStyle = (feature?: { properties: { name: string; "ISO3166-1-Alpha-3": string } }) => {
    const name = feature?.properties?.name ?? "";
    const isoA3 = feature?.properties?.["ISO3166-1-Alpha-3"] ?? "";
    const isVisited = visitedCountries.has(name) || visitedCountries.has(isoA3);
    return {
      fillColor: isVisited ? "#e63946" : "transparent",
      weight: isVisited ? 1.5 : 0,
      opacity: isVisited ? 0.7 : 0,
      color: "#e63946",
      fillOpacity: isVisited ? 0.35 : 0,
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
        setTotalCountryCount(davis.country_count || 0);
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

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (activeCategory) params.set('category', activeCategory);
        if (activeSubCategory) params.set('sub_category', activeSubCategory);
        const res = await fetch(`${API_URL}/api/v1/locations?${params}`);
        if (res.ok) {
          const data: FlattenedPoint[] = await res.json();
          setAllPoints(data);
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, [activeCategory, activeSubCategory]);

  const pct = ((totalCountryCount / TOTAL_COUNTRIES) * 100).toFixed(1);

  return (
    <div className="relative flex flex-col md:flex-row flex-1 min-h-0 w-full overflow-hidden">

      {/* ── Desktop Aside (hidden on mobile) ── */}
      <aside className="hidden md:flex md:w-80 shrink-0 flex-col bg-paper border-r border-line z-10">

        <div className="px-7 pt-8 pb-6 border-b border-line">
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); }}
              className="text-left group cursor-pointer transition-all hover:opacity-80 hover:-translate-y-0.5"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-5xl tabular-nums leading-none text-brand">
                  {totalCountryCount}
                </span>
                <span className="font-serif text-lg text-ink/40 pb-0.5">國</span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/60">已到訪國家</p>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); }}
              className="text-left group cursor-pointer transition-all hover:opacity-80 hover:-translate-y-0.5"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-5xl tabular-nums leading-none text-brand">
                  {overseasCount}
                </span>
                <span className="font-serif text-lg text-ink/40 pb-0.5">場</span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/60">海外馬拉松</p>
            </button>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 max-h-[22rem] p-5 grid grid-cols-2 gap-5 overflow-y-auto"
          style={{ gridTemplateRows: 'repeat(3, minmax(5rem, 1fr))' }}
        >
          <button
            onClick={() => { setActiveCategory(null); setActiveSubCategory(null); }}
            className={`group [container-type:size] flex flex-col items-start justify-between px-4 py-3 h-full transition-all duration-200 text-left border-2 cursor-pointer ${
              activeCategory === null
                ? "border-brand bg-brand/8 -translate-y-0.5"
                : "border-line/60 hover:border-ink/30 hover:bg-ink/4 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-baseline gap-1 leading-none">
              <span className={`font-mono font-bold tabular-nums [font-size:clamp(1.25rem,44cqh,2.25rem)] ${activeCategory === null ? "text-brand" : "text-ink"}`}>
                {totalPostCount}
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

        {humanViews !== null && (
          <div className="shrink-0 px-5 py-3 border-t border-line/40">
            <p className="font-mono text-xs text-ink/35 tracking-widest">
              網站累計 {humanViews.toLocaleString()} 人次造訪
            </p>
          </div>
        )}

      </aside>

      {/* ── Main area: Map (always mounted) + ListView overlay ── */}
      <main className="flex-1 flex flex-col min-h-0">

        {/* ── Mobile Time Filter + View Toggle ── */}
        <div className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 bg-paper border-b border-line/40">
          <div className="flex-1 min-w-0">
            <DateRangePicker
              availableYears={availableYears}
              applied={dateFilter}
              onApply={setDateFilter}
              onClear={() => setDateFilter(null)}
            />
          </div>
          <div className="shrink-0 flex items-center border border-line/60 rounded-full">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-1.5 rounded-full font-mono text-xs transition-colors ${viewMode === 'map' ? 'bg-ink text-paper' : 'text-ink/60'}`}
            >
              地圖
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-full font-mono text-xs transition-colors ${viewMode === 'list' ? 'bg-ink text-paper' : 'text-ink/60'}`}
            >
              列表
            </button>
          </div>
        </div>


        {/* ── Time filter + View toggle bar (desktop) ── */}
        <div className="hidden md:flex shrink-0 items-center gap-3 px-4 py-2 border-b border-line/40 bg-paper z-[600]">
          <div className="flex-1">
            <DateRangePicker
              availableYears={availableYears}
              applied={dateFilter}
              onApply={setDateFilter}
              onClear={() => setDateFilter(null)}
            />
          </div>
          <div className="shrink-0 flex items-center bg-paper border border-line/60 rounded-full">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-1 rounded-full font-mono text-xs uppercase tracking-[0.2em] transition-colors ${viewMode === 'map' ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'}`}
            >
              地圖
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1 rounded-full font-mono text-xs uppercase tracking-[0.2em] transition-colors ${viewMode === 'list' ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'}`}
            >
              列表
            </button>
          </div>
        </div>

        {/* ── Map / List area ── */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {viewMode === 'list' && (
            <div className="absolute inset-0 z-20 bg-paper">
              <ListView
                category={activeCategory}
                subCategory={activeSubCategory}
                startDate={startDate}
                endDate={endDate}
              />
            </div>
          )}
          {isLoading && allPoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper z-10 animate-pulse font-mono text-xs uppercase tracking-widest text-ink/60">
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
          className="w-full h-full grayscale-[0.8] contrast-[1.1]"
          zoomControl={false}
          worldCopyJump={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {geoData && (
            <GeoJSON
              key={`geojson-${[...visitedCountries].sort().join(',')}`}
              data={geoData}
              style={geoStyle}
              onEachFeature={onEachCountry}
            />
          )}

          <FitBounds points={points} />
          <ZoomControl position="bottomright" />

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
        </MapContainer>
        </div>{/* end map/list area */}

        {/* ── Mobile Bottom Panel ── */}
        <div className="md:hidden shrink-0 bg-paper border-t border-line">
          {/* Hero stats */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-line/30">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); }}
              className="flex items-baseline gap-1 active:opacity-60 transition-opacity"
            >
              <span className="font-mono font-bold text-3xl tabular-nums leading-none text-brand">{totalCountryCount}</span>
              <span className="font-serif text-base text-ink/60">國</span>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); }}
              className="flex items-baseline gap-1 active:opacity-60 transition-opacity"
            >
              <span className="font-mono font-bold text-3xl tabular-nums leading-none text-brand">{overseasCount}</span>
              <span className="font-serif text-base text-ink/60">場海外馬</span>
            </button>
          </div>
          {/* Category chips */}
          <div className="chip-scroll flex gap-2 overflow-x-auto px-3 py-2.5 pb-safe">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); }}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border font-mono text-xs whitespace-nowrap transition-all ${
                activeCategory === null
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink/60 active:bg-ink/5"
              }`}
            >
              <span>所有文章</span>
              <span className="font-bold tabular-nums">{totalPostCount}</span>
            </button>
            {statItems.map(({ label, value, cat, sub }) => {
              const isActive = activeCategory === cat && activeSubCategory === sub;
              return (
                <button
                  key={label}
                  onClick={() => handleFilterClick(cat, sub)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border font-mono text-xs whitespace-nowrap transition-all ${
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
