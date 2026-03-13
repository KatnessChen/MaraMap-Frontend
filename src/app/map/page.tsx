"use client";

import dynamic from "next/dynamic";

// 動態載入地圖組件，並停用 SSR
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-paper">
      <div className="font-mono text-sm uppercase tracking-[0.4em] animate-pulse text-ink/40">
        Initializing Spatial Data...
      </div>
    </div>
  )
});

export default function MapPage() {
  return (
    <main className="w-screen h-screen overflow-hidden">
      <MapView />
    </main>
  );
}
