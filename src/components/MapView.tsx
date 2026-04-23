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
  const size = Math.min(Math.max(20, 16 + Math.log2(count) * 4), 48);
  return L.divIcon({
    html: `<div class="flex items-center justify-center rounded-full bg-brand shadow-[0_0_20px_rgba(230,57,70,0.4)] border-2 border-white/50 backdrop-blur-[2px]"
                style="width: ${size}px; height: ${size}px;">
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
  const [points, setPoints] = useState<FlattenedPoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("馬拉松");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [raceStats, setRaceStats] = useState<RaceStats | null>(null);
  const [totalCountryCount, setTotalCountryCount] = useState(0);

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

  const visitedCountries = useMemo(() => {
    const set = new Set<string>();
    points.forEach(p => {
      if (p.country_en) set.add(p.country_en);
    });
    return set;
  }, [points]);

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
        setRaceStats({
          totalFM: davis.fm_count || 0,
        });
      } catch (err) {
        console.error("Failed to fetch race stats:", err);
      }
    };
    const fetchAllCountries = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/locations`);
        if (!res.ok) return;
        const data: FlattenedPoint[] = await res.json();
        const countries = new Set(data.map(p => p.country_en).filter(Boolean));
        setTotalCountryCount(countries.size);
      } catch (err) {
        console.error("Failed to fetch all locations:", err);
      }
    };
    fetchRaceStats();
    fetchAllCountries();
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
        const params = new URLSearchParams({ category: activeCategory });
        if (activeSubCategory) params.set('sub_category', activeSubCategory);
        const res = await fetch(`${API_URL}/api/v1/locations?${params}`);
        if (res.ok) {
          const data: FlattenedPoint[] = await res.json();
          setPoints(data);
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, [activeCategory, activeSubCategory]);

  return (
    <div className="flex w-screen h-screen overflow-hidden">

      {/* ── Aside ── */}
      <aside className="w-80 shrink-0 flex flex-col bg-paper border-r border-line z-10">

        {/* 標題 */}
        <div className="px-7 pt-8 pb-5 border-b border-line">
          <p className="font-serif font-black text-xl text-ink tracking-wide">
            <span className="italic">Davis & Rose</span>
            <span className="text-brand mx-2">·</span>
            <span className="text-ink/60 font-normal not-italic">環球跑旅</span>
          </p>
        </div>

        {/* Hero 數字 — 已到訪國家 */}
        <div className="px-7 pt-8 pb-6 border-b border-line">
          <div className="flex items-end gap-3 mb-2">
            <span className="font-mono font-bold text-8xl text-brand tabular-nums leading-none">
              {totalCountryCount}
            </span>
            <div className="pb-2.5">
              <span className="font-serif text-3xl text-ink/30">國</span>
            </div>
            <span className="font-mono text-sm text-ink/30 pb-3 ml-auto">
              {((totalCountryCount / TOTAL_COUNTRIES) * 100).toFixed(1)}%
            </span>
          </div>
          <p className="font-mono text-xs text-ink/30 tracking-[0.25em]">已到訪國家</p>
        </div>

        {/* 可點擊統計方塊 */}
        <div className="px-5 py-5 grid grid-cols-2 gap-2">
          {[
            { label: "全馬", unit: "場", value: raceStats?.totalFM ?? 0, cat: "馬拉松", sub: null },
            { label: "海外馬", unit: "場", value: overseasCount, cat: "馬拉松", sub: "海外馬" },
            { label: "七大馬", unit: "場", value: sevenMajorsCount, cat: "馬拉松", sub: "七大馬" },
            { label: "旅遊", unit: "篇", value: travelCount, cat: "旅遊", sub: null },
            { label: "百岳", unit: "座", value: hikingCount, cat: "登山", sub: null },
          ].map(({ label, unit, value, cat, sub }) => {
            const isActive = activeCategory === cat && activeSubCategory === sub;
            return (
              <button
                key={label}
                onClick={() => {
                  if (isActive) {
                    setActiveCategory("馬拉松");
                    setActiveSubCategory(null);
                  } else {
                    setActiveCategory(cat);
                    setActiveSubCategory(sub);
                  }
                }}
                className={`group flex flex-col items-start px-4 py-4 transition-all duration-200 text-left border-2 ${
                  isActive
                    ? "border-brand bg-brand/8"
                    : "border-line/60 hover:border-ink/30 hover:bg-ink/4"
                }`}
              >
                <div className="flex items-baseline gap-1 leading-none">
                  <span className={`font-mono font-bold text-4xl tabular-nums ${
                    isActive ? "text-brand" : "text-ink"
                  }`}>
                    {value}
                  </span>
                  <span className={`font-serif text-base ${
                    isActive ? "text-brand/50" : "text-ink/30"
                  }`}>
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

      {/* ── Map ── */}
      <main className="flex-1 relative">
        <div className="absolute bottom-4 right-4 z-[1000] pointer-events-none">
          <span className="font-mono text-xs text-ink/50 tracking-widest">
            Powered by Mara<span className="text-brand">Map</span>
          </span>
        </div>
        {isLoading && points.length === 0 && (
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
            noWrap={true}
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
      `}</style>
    </div>
  );
}
