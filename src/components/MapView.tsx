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

export default function MapView() {
  const [points, setPoints] = useState<FlattenedPoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("馬拉松");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

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
      <aside className="w-72 shrink-0 flex flex-col bg-paper border-r border-line z-10">

        {/* Logo 區 */}
        <div className="px-6 pt-8 pb-6 border-b border-line">
          <h1 className="font-mono font-bold text-3xl text-ink tracking-tight mb-1">
            Mara<span className="text-brand">Map</span>
          </h1>
          <p className="font-serif font-black text-lg text-ink tracking-wide">
            <span className="italic">Davis & Rose</span>
            <span className="text-brand mx-1.5">·</span>
            <span className="text-ink/70 font-normal not-italic">環球跑旅</span>
          </p>
        </div>

        {/* 分類切換 */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-1">
          {categories.map((cat) => {
            const isCatActive = activeCategory === cat.name;
            return (
              <div key={cat.name} className="mb-1">
                {/* 主分類 */}
                <button
                  onClick={() => {
                    setActiveCategory(cat.name);
                    setActiveSubCategory(null);
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-3 transition-all duration-200 text-left
                    ${isCatActive
                      ? "bg-ink text-paper"
                      : "text-ink/60 hover:text-ink hover:bg-ink/5"}
                  `}
                >
                  <span className="font-serif font-bold text-lg tracking-wide">{cat.name}</span>
                  <span className={`font-mono text-sm tabular-nums ${isCatActive ? "text-paper/60" : "text-ink/30"}`}>
                    {cat.count}
                  </span>
                </button>

                {/* 子分類 — 永遠展開 */}
                {cat.sub_categories.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {cat.sub_categories.map((sub) => {
                      const isSubActive = activeSubCategory === sub.name && isCatActive;
                      return (
                        <button
                          key={sub.name}
                          onClick={() => {
                            setActiveCategory(cat.name);
                            setActiveSubCategory(isSubActive ? null : sub.name);
                          }}
                          className={`
                            w-full flex items-center justify-between pl-6 pr-3 py-2.5 transition-all duration-200 text-left border-l-2 ml-3
                            ${isSubActive
                              ? "border-brand text-brand font-bold bg-brand/5"
                              : "border-transparent text-ink/45 hover:text-ink hover:border-ink/20"}
                          `}
                        >
                          <span className="font-serif text-base">{sub.name}</span>
                          <span className={`font-mono text-sm tabular-nums ${isSubActive ? "text-brand/70" : "text-ink/25"}`}>
                            {sub.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Map ── */}
      <main className="flex-1 relative">
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
