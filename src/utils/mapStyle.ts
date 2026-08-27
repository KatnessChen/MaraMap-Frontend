/**
 * Pure choropleth styling logic for MapView's country layer, pulled out so it
 * can be tested without Leaflet (which doesn't render meaningfully in jsdom).
 */

type CountryFeature = { properties: { name: string; "ISO3166-1-Alpha-3": string } } | undefined;

// Countries at/above this many posts render at full color intensity;
// everything below spreads across the gradient on a log curve. Fixed rather
// than scaled against the dataset max — the home base (e.g. Taiwan) has an
// order of magnitude more posts than anywhere else, so normalizing against
// it would flatten every other visited country into the same near-minimum
// shade. Well above the typical "visited a handful of times" range so the
// #2 country still reads visibly lighter than the #1 outlier instead of both
// clipping to the same max shade.
export const VISIT_CAP = 50;

const COUNTRY_HUE = 356;

// Sequential scale: near-white pink (low intensity) → deep vivid red (high
// intensity). Saturation ramps up alongside darkness so the deep end reads
// as more vivid, not muddier, than the brand red it's built around.
export function countryFillColor(intensity: number): string {
  const saturation = 80 + intensity * 10; // 65% (light) → 90% (deep, vivid)
  const lightness = 85 - intensity * 50; // 95% (near-white pink) → 42% (deep red)
  return `hsl(${COUNTRY_HUE}, ${saturation}%, ${lightness}%)`;
}

// A GeoJSON feature's `name` and ISO-3166 alpha-3 code are matched against
// whichever key the post data happened to use, since the two datasets don't
// consistently agree on one or the other.
export function getVisitCount(feature: CountryFeature, visitedCountries: Map<string, number>): number {
  const name = feature?.properties?.name ?? "";
  const isoA3 = feature?.properties?.["ISO3166-1-Alpha-3"] ?? "";
  return visitedCountries.get(name) ?? visitedCountries.get(isoA3) ?? 0;
}

export interface CountryGeoStyle {
  fillColor: string;
  weight: number;
  opacity: number;
  color: string;
  fillOpacity: number;
}

export function getCountryGeoStyle(feature: CountryFeature, visitedCountries: Map<string, number>): CountryGeoStyle {
  const count = getVisitCount(feature, visitedCountries);
  const isVisited = count > 0;
  const cappedCount = Math.min(count, VISIT_CAP);
  const intensity = isVisited ? Math.log(cappedCount + 1) / Math.log(VISIT_CAP + 1) : 0;
  return {
    fillColor: isVisited ? countryFillColor(intensity) : "transparent",
    weight: isVisited ? 1.5 : 0,
    opacity: isVisited ? 0.7 : 0,
    color: "#e63946",
    // 半透明遮罩：讓底圖的國家/城市地名能透出來，同時保留造訪次數的深淺漸層。
    fillOpacity: isVisited ? 0.5 : 0,
  };
}
