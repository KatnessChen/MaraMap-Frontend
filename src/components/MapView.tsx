"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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

export default function MapView() {
  const [allPoints, setAllPoints] = useState<FlattenedPoint[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>("馬拉松");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [raceStats, setRaceStats] = useState<RaceStats | null>(null);
  const [totalCountryCount, setTotalCountryCount] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
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

  const statItems = useMemo<Array<{ label: string; unit: string; value: number; cat: string; sub: string | null }>>(() => [
    { label: "全馬",  unit: "場", value: raceStats?.totalFM ?? 0, cat: "馬拉松", sub: null      },
    { label: "海外馬", unit: "場", value: overseasCount,           cat: "馬拉松", sub: "海外馬"  },
    { label: "七大馬", unit: "場", value: sevenMajorsCount,        cat: "馬拉松", sub: "七大馬"  },
    { label: "旅遊",  unit: "篇", value: travelCount,              cat: "旅遊",   sub: null      },
    { label: "百岳",  unit: "座", value: hikingCount,              cat: "登山",   sub: null      },
  ], [raceStats, overseasCount, sevenMajorsCount, travelCount, hikingCount]);

  const points = useMemo(() => {
    let filtered = allPoints;
    if (selectedYear !== null)
      filtered = filtered.filter(p => new Date(p.date).getFullYear() === selectedYear);
    if (selectedMonth !== null)
      filtered = filtered.filter(p => new Date(p.date).getMonth() + 1 === selectedMonth);
    return filtered;
  }, [allPoints, selectedYear, selectedMonth]);

  const availableYears = useMemo(() => {
    const years = new Set(allPoints.map(p => new Date(p.date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [allPoints]);

  const availableMonths = useMemo(() => {
    if (selectedYear === null) return [];
    const months = new Set(
      allPoints
        .filter(p => new Date(p.date).getFullYear() === selectedYear)
        .map(p => new Date(p.date).getMonth() + 1)
    );
    return [...months].sort((a, b) => a - b);
  }, [allPoints, selectedYear]);

  const { startDate, endDate } = useMemo(() => {
    if (selectedYear === null) return { startDate: undefined, endDate: undefined };
    const mm = selectedMonth !== null ? String(selectedMonth).padStart(2, '0') : null;
    if (!mm) return { startDate: `${selectedYear}-01-01`, endDate: `${selectedYear}-12-31` };
    const lastDay = new Date(selectedYear, selectedMonth!, 0).getDate();
    return { startDate: `${selectedYear}-${mm}-01`, endDate: `${selectedYear}-${mm}-${lastDay}` };
  }, [selectedYear, selectedMonth]);

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
    <div className="relative flex flex-col md:flex-row w-screen h-screen overflow-hidden">

      {/* ── Desktop Aside (hidden on mobile) ── */}
      <aside className="hidden md:flex md:w-80 shrink-0 flex-col bg-paper border-r border-line z-10">

        <div className="px-7 pt-8 pb-5 border-b border-line">
          <p className="font-serif font-black text-xl text-ink tracking-wide">
            <span className="italic">Davis & Rose</span>
            <span className="text-brand mx-2">·</span>
            <span className="text-ink/60 font-normal not-italic">環球跑旅</span>
          </p>
        </div>

        <div className="px-7 pt-8 pb-6 border-b border-line">
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); }}
              className="text-left group transition-all hover:opacity-80"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-7xl tabular-nums leading-none text-brand">
                  {totalCountryCount}
                </span>
                <span className="font-serif text-2xl text-ink/30 pb-1">國</span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/30">已到訪國家</p>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); }}
              className="text-left group transition-all hover:opacity-80"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-7xl tabular-nums leading-none text-brand">
                  {overseasCount}
                </span>
                <span className="font-serif text-2xl text-ink/30 pb-1">場</span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/30">海外馬拉松</p>
            </button>
          </div>
        </div>

        <div className="px-5 py-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setActiveCategory(null); setActiveSubCategory(null); }}
            className={`group flex flex-col items-start px-4 py-4 transition-all duration-200 text-left border-2 ${
              activeCategory === null
                ? "border-brand bg-brand/8"
                : "border-line/60 hover:border-ink/30 hover:bg-ink/4"
            }`}
          >
            <div className="flex items-baseline gap-1 leading-none">
              <span className={`font-mono font-bold text-4xl tabular-nums ${activeCategory === null ? "text-brand" : "text-ink"}`}>
                全
              </span>
            </div>
            <span className={`font-mono text-xs mt-2.5 tracking-widest leading-tight ${
              activeCategory === null ? "text-brand/70" : "text-ink/40 group-hover:text-ink/60"
            }`}>
              所有
            </span>
          </button>
          {statItems.map(({ label, unit, value, cat, sub }) => {
            const isActive = activeCategory === cat && activeSubCategory === sub;
            return (
              <button
                key={label}
                onClick={() => handleFilterClick(cat, sub)}
                className={`group flex flex-col items-start px-4 py-4 transition-all duration-200 text-left border-2 ${
                  isActive
                    ? "border-brand bg-brand/8"
                    : "border-line/60 hover:border-ink/30 hover:bg-ink/4"
                }`}
              >
                <div className="flex items-baseline gap-1 leading-none">
                  <span className={`font-mono font-bold text-4xl tabular-nums ${isActive ? "text-brand" : "text-ink"}`}>
                    {value}
                  </span>
                  <span className={`font-serif text-base ${isActive ? "text-brand/50" : "text-ink/30"}`}>
                    {unit}
                  </span>
                </div>
                <span className={`font-mono text-xs mt-2.5 tracking-widest leading-tight ${
                  isActive ? "text-brand/70" : "text-ink/40 group-hover:text-ink/60"
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

      </aside>

      {/* ── Main area: Map (always mounted) + ListView overlay ── */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── Mobile Header ── */}
        <header className="md:hidden shrink-0 h-14 bg-paper border-b border-line flex items-center justify-between px-4">
          <p className="font-serif font-black text-base text-ink">
            <span className="italic">Davis & Rose</span>
            <span className="text-brand mx-1.5">·</span>
            <span className="text-ink/60 font-normal not-italic text-sm">環球跑旅</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); }}
              className="flex items-baseline gap-0.5 hover:opacity-70 transition-opacity"
            >
              <span className="font-mono font-bold text-xl text-brand tabular-nums">{totalCountryCount}</span>
              <span className="font-serif text-sm text-ink/40">國</span>
            </button>
            <span className="font-mono text-xs text-ink/20">·</span>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); }}
              className="flex items-baseline gap-0.5 hover:opacity-70 transition-opacity"
            >
              <span className="font-mono font-bold text-xl text-brand tabular-nums">{overseasCount}</span>
              <span className="font-serif text-sm text-ink/40">場</span>
            </button>
            <div className="ml-2 flex items-center border border-line/60 rounded-full">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 rounded-full font-mono text-xs transition-colors ${viewMode === 'map' ? 'bg-ink text-paper' : 'text-ink/40'}`}
              >
                地圖
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-full font-mono text-xs transition-colors ${viewMode === 'list' ? 'bg-ink text-paper' : 'text-ink/40'}`}
              >
                清單
              </button>
            </div>
          </div>
        </header>

        {/* ── Mobile Time Filter ── */}
        <div className="md:hidden shrink-0 px-3 py-2 bg-paper border-b border-line/40">
          <div className="time-chip-scroll flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => { setSelectedYear(null); setSelectedMonth(null); }}
              className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                selectedYear === null ? 'bg-ink text-paper border-ink' : 'border-line/60 text-ink/40 hover:text-ink/70'
              }`}
            >
              全部
            </button>
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => { setSelectedYear(year); setSelectedMonth(null); }}
                className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                  selectedYear === year ? 'bg-ink text-paper border-ink' : 'border-line/60 text-ink/40 hover:text-ink/70'
                }`}
              >
                {year}
              </button>
            ))}
            {selectedYear !== null && availableMonths.length > 0 && (
              <>
                <span className="shrink-0 text-ink/20 text-xs px-0.5">·</span>
                <button
                  onClick={() => setSelectedMonth(null)}
                  className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                    selectedMonth === null ? 'bg-brand text-paper border-brand' : 'border-line/60 text-ink/40'
                  }`}
                >
                  全月
                </button>
                {availableMonths.map(month => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                      selectedMonth === month ? 'bg-brand text-paper border-brand' : 'border-line/60 text-ink/40'
                    }`}
                  >
                    {month}月
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Mobile Category Chips ── */}
        <div className="md:hidden shrink-0 px-3 py-2 bg-paper border-b border-line/40">
          <div className="chip-scroll flex gap-2 overflow-x-auto">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); }}
              className={`shrink-0 px-3 py-1.5 rounded-full border font-mono text-xs whitespace-nowrap transition-all ${
                activeCategory === null
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink/60 active:bg-ink/5"
              }`}
            >
              所有
            </button>
            {statItems.map(({ label, value, cat, sub }) => {
              const isActive = activeCategory === cat && activeSubCategory === sub;
              return (
                <button
                  key={label}
                  onClick={() => handleFilterClick(cat, sub)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-xs whitespace-nowrap transition-all ${
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

        {/* ── Time filter + View toggle bar (desktop) ── */}
        <div className="hidden md:flex shrink-0 items-center gap-3 px-4 py-2 border-b border-line/40 bg-paper z-[600]">

          {/* Time chips */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto time-chip-scroll">
            <button
              onClick={() => { setSelectedYear(null); setSelectedMonth(null); }}
              className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                selectedYear === null ? 'bg-ink text-paper border-ink' : 'border-line/60 text-ink/40 hover:text-ink/70'
              }`}
            >
              全部
            </button>
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => { setSelectedYear(year); setSelectedMonth(null); }}
                className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                  selectedYear === year ? 'bg-ink text-paper border-ink' : 'border-line/60 text-ink/40 hover:text-ink/70'
                }`}
              >
                {year}
              </button>
            ))}
            {selectedYear !== null && availableMonths.length > 0 && (
              <>
                <span className="shrink-0 text-ink/20 text-xs px-0.5">·</span>
                <button
                  onClick={() => setSelectedMonth(null)}
                  className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                    selectedMonth === null ? 'bg-brand text-paper border-brand' : 'border-line/60 text-ink/40 hover:text-ink/70'
                  }`}
                >
                  全月
                </button>
                {availableMonths.map(month => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={`shrink-0 px-3 py-1 rounded-full font-mono text-xs border transition-colors ${
                      selectedMonth === month ? 'bg-brand text-paper border-brand' : 'border-line/60 text-ink/40 hover:text-ink/70'
                    }`}
                  >
                    {month}月
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Map/List toggle */}
          <div className="shrink-0 flex items-center bg-paper border border-line/60 rounded-full">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-1 rounded-full font-mono text-xs uppercase tracking-[0.2em] transition-colors ${viewMode === 'map' ? 'bg-ink text-paper' : 'text-ink/40 hover:text-ink'}`}
            >
              地圖
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1 rounded-full font-mono text-xs uppercase tracking-[0.2em] transition-colors ${viewMode === 'list' ? 'bg-ink text-paper' : 'text-ink/40 hover:text-ink'}`}
            >
              清單
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
                onClose={() => setViewMode('map')}
              />
            </div>
          )}
          <div className="absolute bottom-4 right-4 z-[1000] pointer-events-none">
            <span className="font-mono text-xs text-ink/50 tracking-widest">
              Powered by Mara<span className="text-brand">Map</span>
            </span>
          </div>
          {isLoading && allPoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper z-10 animate-pulse font-mono text-xs uppercase tracking-widest text-ink/40">
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
                  <div className="p-2 max-w-[200px]">
                    <div className="font-mono text-[10px] text-brand uppercase mb-1">{pt.cat} / {pt.date}</div>
                    <h3 className="font-serif font-bold text-sm leading-tight mb-2 line-clamp-2">{pt.title}</h3>
                    {pt.uri && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={pt.uri} alt="Moment" className="w-full h-24 object-cover mb-2 border border-line" />
                    )}
                    <Link
                      href={`/log/${pt.postId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink hover:text-brand transition-colors"
                    >
                      VIEW LOG <ArrowRight size={12} />
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
        </div>{/* end map/list area */}
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
