"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { GeoJsonObject } from "geojson";
import { ArrowRight, X } from "lucide-react";
import MarkerClusterGroup from "react-leaflet-cluster";

// 修正 Leaflet 預設 Icon 在 Next.js 中遺失的問題
// 統一 Marker 大小，不再顯示數量資訊
const createEventIcon = () => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div class="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-[0_0_10px_rgba(230,57,70,0.5)]"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// 自定義聚合點 Icon - 僅作為視覺標識，不顯示數字
const createClusterCustomIcon = (cluster: { getChildCount: () => number }) => {
  const count = cluster.getChildCount();
  // 根據聚合點的活動數量做微幅的視覺層級，但縮小範圍且不放數字
  const size = Math.min(Math.max(20, 16 + Math.log2(count) * 4), 48);
  
  return L.divIcon({
    html: `<div class="flex items-center justify-center rounded-full bg-brand shadow-[0_0_20px_rgba(230,57,70,0.4)] border-2 border-white/50 backdrop-blur-[2px]" 
                style="width: ${size}px; height: ${size}px;">
           </div>`,
    className: "custom-cluster-icon",
    iconSize: L.point(size, size, true),
  });
};

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
}

interface Category {
  name: string;
  count: number;
}

export default function MapView() {
  const [points, setPoints] = useState<FlattenedPoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("馬拉松");
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);

  // 映射表：將後端中文國家名稱映射至 GeoJSON 的名稱 (ADMIN)
  const countryNameMap: Record<string, string> = {
    "台灣": "Taiwan",
    "台 灣": "Taiwan",
    "中國": "China",
    "泰國": "Thailand",
    "馬來西亞": "Malaysia",
    "新加坡": "Singapore",
    "挪威": "Norway",
    "葡萄牙": "Portugal",
    "格陵蘭": "Greenland",
    "澳洲": "Australia",
    "柬埔寨": "Cambodia",
    "日本": "Japan",
    "加拿大": "Canada",
    "法國": "France",
    "奧地利": "Austria",
  };

  // 取得已造訪國家清單
  const visitedCountries = useMemo(() => {
    const set = new Set<string>();
    points.forEach(p => {
      if (p.country) {
        const trimmed = p.country.trim();
        const mapped = countryNameMap[trimmed] || trimmed;
        set.add(mapped);
      }
    });
    console.log("Visited Countries (Mapped):", Array.from(set));
    return set;
  }, [points]);

  // 取得 GeoJSON 數據
  useEffect(() => {
    // 輕量級全球國家 GeoJSON
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then(res => res.json())
      .then(data => {
        console.log("GeoJSON Data Loaded, first feature name:", data.features[0]?.properties?.name);
        setGeoData(data);
      })
      .catch(err => console.error("Failed to fetch GeoJSON:", err));
  }, []);

  // GeoJSON 樣式
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

  // 取得分類統計
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/categories`);
        if (res.ok) {
          const data: Category[] = await res.json();
          // 將「海外馬」排在前面，如果有的話
          const sorted = data.sort((a, b) => {
            if (a.name === "海外馬") return -1;
            if (b.name === "海外馬") return 1;
            return b.count - a.count;
          });
          setCategories(sorted);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // 取得該分類的文章點位
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/locations?category=${encodeURIComponent(activeCategory)}`); 
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
  }, [activeCategory]);

  if (isLoading && points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-paper animate-pulse font-mono text-xs uppercase tracking-widest">
        Generating Spatial Log...
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        minZoom={2}
        maxBounds={[[-85, -180], [85, 180]]} // 限制邊界，防止無限捲動
        maxBoundsViscosity={1.0} // 讓邊界有彈性或完全固定
        scrollWheelZoom={true}
        className="w-full h-full grayscale-[0.8] contrast-[1.1]"
        zoomControl={false}
        worldCopyJump={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          noWrap={true} // 防止圖磚重複
        />

        {geoData && (
          <GeoJSON 
            key={`geojson-${geoData ? 'loaded' : 'pending'}-${visitedCountries.size}`} 
            data={geoData} 
            style={geoStyle} 
          />
        )}
        
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

      {/* 回到列表按鈕 */}
      <Link 
        href="/" 
        className="absolute top-6 left-6 z-[1000] bg-ink text-paper px-5 py-3 rounded-full flex items-center gap-3 shadow-2xl hover:bg-brand transition-all hover:scale-105 group"
      >
        <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        <span className="font-mono text-sm font-bold uppercase tracking-widest">Exit Map</span>
      </Link>

      {/* 地圖標題 - 正上方居中 */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-8 py-3 border border-line shadow-2xl rounded-full flex items-center flex-nowrap gap-4">
          <div className="font-mono text-[10px] text-brand uppercase tracking-[0.3em] hidden sm:block whitespace-nowrap">TRAVEL LOG</div>
          <h1 className="font-serif font-black text-lg md:text-xl text-ink whitespace-nowrap flex items-baseline gap-1">
            Davis & Rose <span className="font-normal text-base opacity-70">馬拉松足跡</span>
          </h1>
          <div className="flex items-center gap-2 pl-4 border-l border-line ml-1 whitespace-nowrap">
            <span className="font-mono text-[10px] text-ink/40 uppercase tracking-widest">Races</span>
            <span className="font-serif font-black text-brand text-lg">{points.length}</span>
          </div>
        </div>
      </div>

      {/* 分類切換器 - 底部中央 */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] max-w-[90vw] overflow-x-auto no-scrollbar">
        <div className="bg-white/80 backdrop-blur-lg p-1.5 border border-line shadow-xl flex gap-1 whitespace-nowrap rounded-lg">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`
                px-4 py-2 flex items-center gap-2 transition-all duration-300 rounded-md
                ${activeCategory === cat.name 
                  ? "bg-brand text-white shadow-lg" 
                  : "hover:bg-ink/5 text-ink/60 hover:text-ink"}
              `}
            >
              <span className="font-serif font-black text-sm uppercase tracking-wider">{cat.name}</span>
              <span className={`
                font-mono text-[10px] px-1.5 py-0.5 border
                ${activeCategory === cat.name ? "border-white/40 text-white/80" : "border-ink/10 text-ink/40"}
              `}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

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
        /* 聚合點容器樣式調整，確保 Icon 居中 */
        .custom-cluster-icon {
          background: none !important;
          border: none !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
