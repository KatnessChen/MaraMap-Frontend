"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-paper">
      <div className="font-mono text-sm uppercase tracking-[0.4em] text-ink">
        Initializing Spatial Data...
      </div>
    </div>
  ),
});

export default function Home() {
  return <MapView />;
}
