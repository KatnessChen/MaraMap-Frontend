import MapView from "@/components/MapView";

// No `dynamic(..., {ssr:false})` here anymore: MapView itself only defers
// the Leaflet-touching subtree (see components/map/LeafletMap.tsx) via its
// own internal dynamic import, so the aside/hero/date-picker shell around it
// can now be server-rendered instead of the whole page waiting on a loading
// placeholder.
export default function Home() {
  return <MapView />;
}
