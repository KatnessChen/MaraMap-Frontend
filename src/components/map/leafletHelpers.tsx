"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export interface FlattenedPoint {
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
export type GeoPoint = FlattenedPoint & { lat: number; lng: number };

export function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }, [points, map]);
  return null;
}

export const createEventIcon = () => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div class="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-[0_0_10px_rgba(230,57,70,0.5)]"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export const createClusterCustomIcon = (cluster: { getChildCount: () => number }) => {
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

export function MapResizer() {
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
