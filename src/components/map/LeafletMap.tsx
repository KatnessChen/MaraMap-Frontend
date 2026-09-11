"use client";

import { useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";
import { ArrowRight } from "lucide-react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { Link } from "@/i18n/navigation";
import { getCountryGeoStyle } from "@/utils/mapStyle";
import { translateTaxonomyLabel, translatePairedName, type Locale } from "@/utils/taxonomyTranslations";
import type { GeoPoint } from "./leafletHelpers";
import { FitBounds, createEventIcon, createClusterCustomIcon, MapResizer } from "./leafletHelpers";

type CountryProperties = { name: string; "ISO3166-1-Alpha-3": string };

interface LeafletMapProps {
  points: GeoPoint[];
  geoData: FeatureCollection | null;
  visitedCountries: Map<string, number>;
  locale: Locale;
  onCountryClick: (country: string, countryEn: string | null) => void;
}

// Everything in this file touches `leaflet`, which reads `window` at module
// load time — pulled out of MapView.tsx so that component can be server-
// rendered (its aside/hero shell no longer has to wait for this chunk to
// download+hydrate before showing real UI instead of a loading placeholder).
// Loaded by MapView via `dynamic(..., { ssr: false })`.
export default function LeafletMap({ points, geoData, visitedCountries, locale, onCountryClick }: LeafletMapProps) {
  const geoStyle = (feature?: { properties: CountryProperties }) =>
    getCountryGeoStyle(feature, visitedCountries);

  const onEachCountry = useCallback((feature: Feature<Geometry, CountryProperties>, layer: L.Layer) => {
    const name = feature?.properties?.name ?? "";
    const isoA3 = feature?.properties?.["ISO3166-1-Alpha-3"] ?? "";
    if (!visitedCountries.has(name) && !visitedCountries.has(isoA3)) return;
    layer.on("click", () => {
      const match = points.find((p) => p.country_en === name || p.country_en === isoA3);
      if (match?.country) {
        onCountryClick(match.country.trim(), match.country_en ?? null);
      }
    });
  }, [visitedCountries, points, onCountryClick]);

  // Marker elements are memoised on `points` alone: without this, every
  // unrelated re-render (e.g. collapsing the aside) rebuilt a few hundred
  // Marker/Popup elements and blocked the main thread long enough to swallow
  // the panel's slide animation.
  const markerLayer = useMemo(() => (
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
          <div className="font-mono text-xs text-brand uppercase mb-1">{translateTaxonomyLabel(pt.cat, locale)} / {pt.date}</div>
          <h3 className="font-serif font-bold text-sm leading-tight mb-2 line-clamp-2 group-hover:text-brand transition-colors">{translatePairedName(pt.title, pt.title_en, locale)}</h3>
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
  ), [points, locale]);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxBounds={[[-85, -180], [85, 180]]}
      maxBoundsViscosity={1.0}
      scrollWheelZoom={true}
      className="w-full h-full grayscale-[0.3] contrast-[1.1]"
      zoomControl={false}
      worldCopyJump={false}
    >
      <TileLayer
        className="grayscale-[0.8] contrast-[1.1]"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_BASEMAP_API_KEY}`}
      />

      {geoData && (
        <GeoJSON
          key={`geojson-${[...visitedCountries.entries()].sort().join(',')}`}
          data={geoData}
          style={geoStyle}
          onEachFeature={onEachCountry}
        />
      )}

      <MapResizer />
      <FitBounds points={points} />
      <ZoomControl position="bottomright" />

      {markerLayer}
    </MapContainer>
  );
}
