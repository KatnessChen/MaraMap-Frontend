"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { ArrowRight, MapPin, X } from "lucide-react";

// 修正 Leaflet 預設 Icon 在 Next.js 中遺失的問題
const customIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div class="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-[0_0_10px_rgba(230,57,70,0.5)]"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface Media {
  lat: number | null;
  lng: number | null;
  uri: string;
  type: string;
}

interface PostWithLocations {
  id: string;
  event_date: string;
  title: string;
  category: string;
  media: Media[];
}

interface FlattenedPoint {
  id: string;
  postId: string;
  lat: number;
  lng: number;
  title: string;
  event_date: string;
  category: string;
  uri: string;
}

export default function MapView() {
  const [points, setPoints] = useState<FlattenedPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/locations`); 
        if (res.ok) {
          const data: PostWithLocations[] = await res.json();
          
          const flattened: FlattenedPoint[] = [];
          data.forEach(post => {
            if (post.media && Array.isArray(post.media)) {
              post.media.forEach((m, idx) => {
                if (m.lat !== undefined && m.lat !== null && !isNaN(m.lat) &&
                    m.lng !== undefined && m.lng !== null && !isNaN(m.lng)) {
                  flattened.push({
                    id: `${post.id}-${idx}`,
                    postId: post.id,
                    lat: m.lat,
                    lng: m.lng,
                    title: post.title,
                    event_date: post.event_date,
                    category: post.category,
                    uri: m.uri
                  });
                }
              });
            }
          });
          setPoints(flattened);
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-paper animate-pulse font-mono text-xs uppercase tracking-widest">
        Generating Spatial Log...
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      <MapContainer 
        center={[20, 0]} // 全球中心點
        zoom={2} 
        minZoom={2}
        scrollWheelZoom={true}
        className="w-full h-full grayscale-[0.8] contrast-[1.1]"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        <ZoomControl position="bottomright" />

        {points.map((pt) => (
          <Marker 
            key={pt.id} 
            position={[pt.lat, pt.lng]} 
            icon={customIcon}
          >
            <Popup className="custom-popup">
              <div className="p-2 max-w-[200px]">
                <div className="font-mono text-[10px] text-brand uppercase mb-1">{pt.category} / {pt.event_date}</div>
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
      </MapContainer>

      {/* 回到列表按鈕 */}
      <Link 
        href="/" 
        className="absolute top-6 left-6 z-[1000] bg-ink text-paper px-5 py-3 rounded-full flex items-center gap-3 shadow-2xl hover:bg-brand transition-all hover:scale-105 group"
      >
        <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        <span className="font-mono text-sm font-bold uppercase tracking-widest">Exit Map</span>
      </Link>

      {/* 數據小卡 */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-white/80 backdrop-blur-md p-4 border border-line shadow-xl hidden md:block">
        <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest mb-1">DATA LAYER</div>
        <div className="font-serif font-black text-xl text-ink">Global Track Log</div>
        <div className="font-mono text-xs text-brand mt-1">{points.length} Points Indexed</div>
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
      `}</style>
    </div>
  );
}
