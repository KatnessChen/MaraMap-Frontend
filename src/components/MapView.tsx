"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@/i18n/navigation";
import type { GeoJsonObject, Feature, Geometry } from "geojson";
import { ArrowRight, ChevronLeft, History, List as ListIcon, Map as MapIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useLocale, useTranslations } from "next-intl";
import CountryModal from "./CountryModal";
import ListView from "./ListView";
import TimelineView from "./TimelineView";
import { getApiBase } from "@/utils/apiBase";
import { getCountryGeoStyle } from "@/utils/mapStyle";
import { translateTaxonomyLabel, translateDistanceType, type Locale } from "@/utils/taxonomyTranslations";
import type { FlattenedPoint, GeoPoint } from "./map/leafletHelpers";
import { FitBounds, createEventIcon, createClusterCustomIcon, MapResizer } from "./map/leafletHelpers";
import type { DateFilter } from "./map/DateRangePicker";
import { DateRangePicker, StatSkeleton } from "./map/DateRangePicker";

const API_URL = getApiBase();

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

type ViewMode = 'map' | 'list' | 'timeline';

const VIEW_MODES: Array<{ mode: ViewMode; key: 'map' | 'list' | 'timeline'; Icon: LucideIcon }> = [
  { mode: 'map', key: 'map', Icon: MapIcon },
  { mode: 'list', key: 'list', Icon: ListIcon },
  { mode: 'timeline', key: 'timeline', Icon: History },
];


export default function MapView() {
  const t = useTranslations("MapView");
  const locale = useLocale() as Locale;
  const [categories, setCategories] = useState<Category[]>([]);
  // null = 「所有文章」. The map opens on everything; defaulting to 馬拉松 meant
  // 旅遊/登山 posts were silently absent until the visitor found the filter.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCountryEn, setSelectedCountryEn] = useState<string | null>(null);
  const [raceStats, setRaceStats] = useState<RaceStats | null>(null);
  // The hero/grid numbers come from three independent requests (locations,
  // categories, race stats). `isLoading` only covers locations, so categories-
  // and stats-derived tiles used to render a bare 0 until their own request
  // landed. Tracked separately so the skeleton covers all three.
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [raceStatsLoading, setRaceStatsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [listTitleMode, setListTitleMode] = useState<'countries' | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [humanViews, setHumanViews] = useState<number | null>(null);
  const [basePoints, setBasePoints] = useState<FlattenedPoint[]>([]);
  const [asideOpen, setAsideOpen] = useState(true);

  // API-derived counts (no date filter)
  const overseasCount = useMemo(() => {
    const marathon = categories.find(c => c.name === "馬拉松");
    return marathon?.sub_categories.find(s => s.name === "海外馬")?.count ?? 0;
  }, [categories]);

  const nineMajorsCount = useMemo(() => {
    const marathon = categories.find(c => c.name === "馬拉松");
    return marathon?.sub_categories.find(s => s.name === "九大馬")?.count ?? 0;
  }, [categories]);

  const travelCount = useMemo(() => {
    return categories.find(c => c.name === "旅遊")?.count ?? 0;
  }, [categories]);

  const hikingCount = useMemo(() => {
    return categories.find(c => c.name === "登山")?.count ?? 0;
  }, [categories]);

  const totalPostCount = useMemo(() =>
    categories.reduce((sum, c) => sum + c.count, 0),
  [categories]);

  // Date-filtered base (all categories, no geo filter)
  const filteredBase = useMemo(() => {
    if (!dateFilter) return basePoints;
    const { startYear, startMonth, endYear, endMonth } = dateFilter;
    const startVal = startYear * 100 + (startMonth ?? 1);
    const ey = endYear ?? startYear;
    const em = endMonth ?? 12;
    const endVal = ey * 100 + em;
    return basePoints.filter(p => {
      const d = new Date(p.date);
      const val = d.getFullYear() * 100 + (d.getMonth() + 1);
      return val >= startVal && val <= endVal;
    });
  }, [basePoints, dateFilter]);

  // Distinct visited countries across ALL posts (every category, geo not
  // required) — not the marathon-scoped `stats?participant=Davis` count, which
  // only saw countries with a race and so undercounted travel-/hike-only ones.
  // With a date filter active this narrows to `filteredBase`; otherwise it's
  // the whole dataset. Driven off `basePoints`/`filteredBase` so it always
  // matches what the list and timeline actually show.
  const displayCountryCount = useMemo(() => {
    const src = dateFilter ? filteredBase : basePoints;
    return new Set(src.map(p => p.country_en).filter(Boolean)).size;
  }, [dateFilter, filteredBase, basePoints]);

  const displayTotalPostCount = useMemo(() => {
    if (!dateFilter) return totalPostCount;
    return filteredBase.length;
  }, [dateFilter, totalPostCount, filteredBase]);

  const displayFMCount = useMemo(() => {
    if (!dateFilter) return raceStats?.totalFM ?? 0;
    return filteredBase.filter(p => p.cat === '馬拉松').length;
  }, [dateFilter, raceStats, filteredBase]);

  const displayOverseasCount = useMemo(() => {
    if (!dateFilter) return overseasCount;
    return filteredBase.filter(p => p.cat === '馬拉松' && p.sub_cats.includes('海外馬')).length;
  }, [dateFilter, overseasCount, filteredBase]);

  const displayNineMajorsCount = useMemo(() => {
    if (!dateFilter) return nineMajorsCount;
    return filteredBase.filter(p => p.cat === '馬拉松' && p.sub_cats.includes('九大馬')).length;
  }, [dateFilter, nineMajorsCount, filteredBase]);

  const displayTravelCount = useMemo(() => {
    if (!dateFilter) return travelCount;
    return filteredBase.filter(p => p.cat === '旅遊').length;
  }, [dateFilter, travelCount, filteredBase]);

  const displayHikingCount = useMemo(() => {
    if (!dateFilter) return hikingCount;
    return filteredBase.filter(p => p.cat === '登山').length;
  }, [dateFilter, hikingCount, filteredBase]);

  // `chipLabel` is a shorter form for the mobile pill row only (`label` is
  // used on desktop, where the sidebar tile wraps onto multiple lines).
  // In zh these are already short (全馬/海外馬/九大馬), so chipLabel only
  // needs to differ from label in en — English "Full/Overseas/World Marathon
  // Majors+" blew the pills onto a horizontally-scrolling, clipped row at
  // 390px (see docs/I18N_PLAN.md's Layer 1 width-regression notes).
  const statItems = useMemo<Array<{ label: string; chipLabel: string; unit: string; value: number; cat: string; sub: string | null }>>(() => [
    { label: translateDistanceType("全馬", locale),  chipLabel: locale === 'en' ? t('chipMarathon') : translateDistanceType("全馬", locale), unit: t("unitRace"), value: displayFMCount,          cat: "馬拉松", sub: null      },
    { label: translateTaxonomyLabel("海外馬", locale), chipLabel: locale === 'en' ? t('chipOverseas') : translateTaxonomyLabel("海外馬", locale), unit: t("unitRace"), value: displayOverseasCount,   cat: "馬拉松", sub: "海外馬"  },
    { label: translateTaxonomyLabel("九大馬", locale), chipLabel: locale === 'en' ? t('chipMajors') : translateTaxonomyLabel("九大馬", locale), unit: t("unitRace"), value: displayNineMajorsCount,  cat: "馬拉松", sub: "九大馬"  },
    { label: translateTaxonomyLabel("旅遊", locale),  chipLabel: translateTaxonomyLabel("旅遊", locale), unit: t("unitPost"), value: displayTravelCount,      cat: "旅遊",   sub: null      },
    { label: translateTaxonomyLabel("登山", locale),  chipLabel: translateTaxonomyLabel("登山", locale), unit: t("unitPeak"), value: displayHikingCount,      cat: "登山",   sub: null      },
  ], [displayFMCount, displayOverseasCount, displayNineMajorsCount, displayTravelCount, displayHikingCount, locale, t]);

  // Points for the map layer: category/sub-category filtered, geo-required.
  // Derived client-side from basePoints instead of a separate network call —
  // basePoints already holds the full unfiltered dataset (geoOnly=false).
  const categoryFilteredPoints = useMemo(() => {
    return basePoints.filter(
      (p): p is GeoPoint =>
        p.lat != null &&
        p.lng != null &&
        (!activeCategory || p.cat === activeCategory) &&
        (!activeSubCategory || p.sub_cats.includes(activeSubCategory)),
    );
  }, [basePoints, activeCategory, activeSubCategory]);

  const points = useMemo(() => {
    if (!dateFilter) return categoryFilteredPoints;
    const { startYear, startMonth, endYear, endMonth } = dateFilter;
    const startVal = startYear * 100 + (startMonth ?? 1);
    const ey = endYear ?? startYear;
    const em = endMonth ?? 12;
    const endVal = ey * 100 + em;
    return categoryFilteredPoints.filter(p => {
      const d = new Date(p.date);
      const val = d.getFullYear() * 100 + (d.getMonth() + 1);
      return val >= startVal && val <= endVal;
    });
  }, [categoryFilteredPoints, dateFilter]);

  // Points for ListView: category/sub-category + date filtered, geo not required.
  const listPoints = useMemo(() => {
    return filteredBase.filter(p =>
      (!activeCategory || p.cat === activeCategory) &&
      (!activeSubCategory || p.sub_cats.includes(activeSubCategory)),
    );
  }, [filteredBase, activeCategory, activeSubCategory]);

  const availableYears = useMemo(() => {
    const years = new Set(basePoints.map(p => new Date(p.date).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [basePoints]);

  // country_en → number of posts, drives choropleth intensity on the map
  const visitedCountries = useMemo(() => {
    const map = new globalThis.Map<string, number>();
    points.forEach(p => {
      if (p.country_en) map.set(p.country_en, (map.get(p.country_en) ?? 0) + 1);
    });
    return map;
  }, [points]);

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
          <h3 className="font-serif font-bold text-sm leading-tight mb-2 line-clamp-2 group-hover:text-brand transition-colors">{pt.title}</h3>
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

  const handleFilterClick = useCallback((cat: string, sub: string | null) => {
    setListTitleMode(null);
    const isActive = activeCategory === cat && activeSubCategory === sub;
    if (isActive) {
      // Toggling the active filter off returns to 「所有文章」, matching the
      // initial state rather than dropping the visitor into 馬拉松.
      setActiveCategory(null);
      setActiveSubCategory(null);
    } else {
      setActiveCategory(cat);
      setActiveSubCategory(sub);
    }
  }, [activeCategory, activeSubCategory]);

  useEffect(() => {
    // Self-hosted in public/ rather than fetched live from GitHub at runtime —
    // the homepage's core visual shouldn't depend on an external host staying up.
    fetch("/countries.geojson")
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Failed to fetch GeoJSON:", err));
  }, []);

  const geoStyle = (feature?: { properties: { name: string; "ISO3166-1-Alpha-3": string } }) =>
    getCountryGeoStyle(feature, visitedCountries);

  const onEachCountry = useCallback((feature: Feature<Geometry, { name: string; "ISO3166-1-Alpha-3": string }>, layer: L.Layer) => {
    const name = feature?.properties?.name ?? "";
    const isoA3 = feature?.properties?.["ISO3166-1-Alpha-3"] ?? "";
    if (!visitedCountries.has(name) && !visitedCountries.has(isoA3)) return;
    layer.on("click", () => {
      const match = points.find((p) => p.country_en === name || p.country_en === isoA3);
      if (match?.country) {
        setSelectedCountry(match.country.trim());
        setSelectedCountryEn(match.country_en ?? null);
      }
    });
  }, [visitedCountries, points]);

  useEffect(() => {
    const fetchRaceStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/stats?participant=Davis`);
        if (!res.ok) return;
        const davis = await res.json();
        setRaceStats({ totalFM: davis.fm_count || 0 });
      } catch (err) {
        console.error("Failed to fetch race stats:", err);
      } finally {
        // Also clears on the `!res.ok` early return and on error: a failed
        // request must fall through to the real (zero) value rather than
        // leave the tile shimmering forever.
        setRaceStatsLoading(false);
      }
    };
    fetchRaceStats();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/stats/visits`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHumanViews(d.total_human); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchBasePoints = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_URL}/api/v1/locations?geoOnly=false`);
        if (res.ok) {
          const data: FlattenedPoint[] = await res.json();
          setBasePoints(data);
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBasePoints();
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
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // With a date filter every tile is recomputed from `filteredBase` (i.e. from
  // basePoints alone), so the categories/race-stats requests are irrelevant and
  // only the locations fetch can still be pending.
  const statsLoading = dateFilter
    ? isLoading
    : isLoading || categoriesLoading || raceStatsLoading;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 w-full overflow-hidden">

      {/* ── Full-width Date Picker + View Toggle ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-2 border-b border-line/40 z-[600]"
        style={{
          backgroundColor: '#e8e4de',
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent, transparent 13px, rgba(0,0,0,0.05) 13px, rgba(0,0,0,0.05) 14px)',
            'repeating-linear-gradient(90deg, transparent, transparent 13px, rgba(0,0,0,0.03) 13px, rgba(0,0,0,0.03) 14px)',
          ].join(', '),
        }}
      >
        <div className="flex-1 min-w-0">
          <DateRangePicker
            availableYears={availableYears}
            applied={dateFilter}
            onApply={setDateFilter}
            onClear={() => setDateFilter(null)}
          />
        </div>
        <div className="shrink-0 flex items-center border border-line/60 rounded-full bg-white">
          {VIEW_MODES.map(({ mode, key, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              aria-label={t(key)}
              className={`flex items-center justify-center px-3.5 py-2 max-[360px]:py-3.5 rounded-full transition-colors cursor-pointer ${viewMode === mode ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'}`}
            >
              {/* Below 360px three Chinese labels plus the date picker overflow
                  the row, so the toggle falls back to icons. */}
              <Icon size={16} className="hidden max-[360px]:block shrink-0" />
              {/* Tracking stays off: these labels are Chinese, and letter-spacing
                  built for Latin caps just pushes the glyphs apart. */}
              <span className="font-mono text-xs leading-none whitespace-nowrap max-[360px]:hidden">{t(key)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col md:flex-row flex-1 min-h-0">

      {/* ── Desktop Aside (hidden on mobile) ──
          Slides via a negative left margin rather than an animated width: the
          aside is a flex item, so the flex algorithm resolves its used size
          from flex-basis and ignores a transitioning `width` (the panel would
          jump). `margin-left` is applied after flex sizing, so animating it
          from 0 to -20rem slides the fixed-width panel off to the left while
          the map (flex-1) smoothly reclaims the space. */}
      <aside className={`hidden md:flex shrink-0 flex-col bg-white z-[500] overflow-hidden md:w-80 transition-[margin-left] duration-300 ease-in-out relative ${asideOpen ? 'ml-0' : '-ml-80'}`}>

        <div className="flex flex-col h-full w-80">

        <div className="relative z-10 px-7 pt-4 pb-6 border-b border-r border-line/40 bg-white shadow-[0_4px_14px_-6px_rgba(0,0,0,0.18)]">
          <div className="grid grid-cols-2 divide-x divide-line/40">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); setListTitleMode('countries'); }}
              className="text-left group cursor-pointer transition-all hover:opacity-80 hover:-translate-y-0.5 pr-5"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-5xl tabular-nums leading-none text-brand">
                  {statsLoading ? <StatSkeleton /> : displayCountryCount}
                </span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/60">{t("countriesVisited")}</p>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); setListTitleMode(null); }}
              className="text-left group cursor-pointer transition-all hover:opacity-80 hover:-translate-y-0.5 pl-5"
            >
              <div className="flex items-end gap-1.5 mb-2">
                <span className="font-mono font-bold text-5xl tabular-nums leading-none text-brand">
                  {statsLoading ? <StatSkeleton /> : displayOverseasCount}
                </span>
              </div>
              <p className="font-mono text-xs tracking-[0.25em] text-ink/60">{t("overseasMarathons")}</p>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 max-h-[22rem] overflow-y-auto flex flex-col">
        <div
          className="p-5 grid grid-cols-2 gap-5"
          style={{ gridTemplateRows: 'repeat(3, minmax(5rem, 1fr))' }}
        >
          <button
            onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setListTitleMode(null); }}
            className={`group [container-type:size] flex flex-col items-start justify-between px-4 py-3 h-full transition-all duration-200 text-left border-2 cursor-pointer ${
              activeCategory === null
                ? "border-brand bg-brand/8 -translate-y-0.5"
                : "border-line/60 hover:border-ink/30 hover:bg-ink/4 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-baseline gap-1 leading-none">
              <span className={`font-mono font-bold tabular-nums [font-size:clamp(1.25rem,44cqh,2.25rem)] ${activeCategory === null ? "text-brand" : "text-ink"}`}>
                {statsLoading ? <StatSkeleton digits={3} /> : displayTotalPostCount}
              </span>
              <span className={`font-serif font-bold [font-size:clamp(0.875rem,17cqh,1.25rem)] ${activeCategory === null ? "text-brand/70" : "text-ink/50"}`}>
                {t("unitPost")}
              </span>
            </div>
            <span className={`font-mono font-bold tracking-widest leading-tight [font-size:clamp(0.75rem,13cqh,1rem)] ${
              activeCategory === null ? "text-brand" : "text-ink/70 group-hover:text-ink"
            }`}>
              {t("allPosts")}
            </span>
          </button>
          {statItems.map(({ label, unit, value, cat, sub }) => {
            const isActive = activeCategory === cat && activeSubCategory === sub;
            return (
              <button
                key={label}
                onClick={() => handleFilterClick(cat, sub)}
                className={`group [container-type:size] flex flex-col items-start justify-between px-4 py-3 h-full transition-all duration-200 text-left border-2 cursor-pointer ${
                  isActive
                    ? "border-brand bg-brand/8 -translate-y-0.5"
                    : "border-line/60 hover:border-ink/30 hover:bg-ink/4 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-baseline gap-1 leading-none">
                  <span className={`font-mono font-bold tabular-nums [font-size:clamp(1.25rem,44cqh,2.25rem)] ${isActive ? "text-brand" : "text-ink"}`}>
                    {statsLoading ? <StatSkeleton /> : value}
                  </span>
                  <span className={`font-serif font-bold [font-size:clamp(0.875rem,17cqh,1.25rem)] ${isActive ? "text-brand/70" : "text-ink/50"}`}>
                    {unit}
                  </span>
                </div>
                <span className={`font-mono font-bold tracking-widest leading-tight [font-size:clamp(0.75rem,13cqh,1rem)] ${
                  isActive ? "text-brand" : "text-ink/70 group-hover:text-ink"
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        </div>
        </div>{/* end fixed-width content */}

        {/* Right divider — overlaid so the hero section's white bg can't hide it,
            and inside the z-[500] aside so it paints above the map tiles. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-ink/20 z-10" />

      </aside>

      {/* Collapse / Expand toggle — a sibling of the aside (not a child), so it
          stays on screen when the panel slides off. Its `left` animates in
          lock-step with the panel margin: open → sitting on the panel's right
          border; collapsed → just inside the map's left edge. */}
      <button
        onClick={() => setAsideOpen(o => !o)}
        className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-[550] w-5 h-14 bg-paper border border-line rounded-md items-center justify-center shadow-sm transition-[left] duration-300 ease-in-out cursor-pointer ${asideOpen ? 'left-[19.375rem]' : 'left-1'}`}
        aria-label={asideOpen ? t('collapseSidebar') : t('expandSidebar')}
      >
        <ChevronLeft size={13} className={`text-ink/50 transition-transform duration-300 ${asideOpen ? '' : 'rotate-180'}`} />
      </button>

      {/* ── Main area: Map (always mounted) + ListView overlay ── */}
      <main className="flex-1 flex flex-col min-h-0">


        {/* ── Map / List area ── */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {viewMode === 'list' && (
            <div className="absolute inset-0 z-20 bg-paper">
              <ListView
                points={listPoints}
                isLoading={isLoading}
                category={activeCategory}
                subCategory={activeSubCategory}
                titleMode={listTitleMode}
              />
            </div>
          )}
          {viewMode === 'timeline' && (
            <div className="absolute inset-0 z-20 bg-paper">
              <TimelineView
                points={listPoints}
                isLoading={isLoading}
                category={activeCategory}
                subCategory={activeSubCategory}
                titleMode={listTitleMode}
              />
            </div>
          )}
          {isLoading && points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper z-10 font-mono text-sm uppercase tracking-widest text-ink">
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
        </div>{/* end map/list area */}

        {/* ── Mobile Bottom Panel ── */}
        <div className="md:hidden shrink-0 bg-paper border-t border-line">
          {/* Hero stats */}
          <div className="relative z-10 flex items-center gap-3 px-4 pt-3 pb-2 bg-paper shadow-[0_-4px_14px_-6px_rgba(0,0,0,0.18)]">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setViewMode('list'); setListTitleMode('countries'); }}
              className="flex shrink-0 items-baseline gap-1 whitespace-nowrap active:opacity-60 transition-opacity"
            >
              <span className="font-mono font-bold text-3xl tabular-nums leading-none text-brand">{statsLoading ? <StatSkeleton /> : displayCountryCount}</span>
              <span className="font-serif text-base text-ink/60">{t("unitCountry")}</span>
            </button>
            <button
              onClick={() => { setActiveCategory('馬拉松'); setActiveSubCategory('海外馬'); setViewMode('list'); setListTitleMode(null); }}
              className="flex shrink-0 items-baseline gap-1 whitespace-nowrap active:opacity-60 transition-opacity"
            >
              <span className="font-mono font-bold text-3xl tabular-nums leading-none text-brand">{statsLoading ? <StatSkeleton /> : displayOverseasCount}</span>
              <span className="font-serif text-base text-ink/60">{t("unitRaceOverseas")}</span>
            </button>
            {/* The counter yields first on narrow screens — the two stat
                buttons must never be squeezed into per-character wrapping —
                and drops out entirely below 360px. */}
            {humanViews !== null && (
              <span className="self-end pb-0.5 ml-auto min-w-0 truncate font-mono text-[12px] text-ink/40 tracking-[0.01em] whitespace-nowrap text-right max-[360px]:hidden">
                {t("totalVisits", { count: humanViews.toLocaleString() })}
              </span>
            )}
          </div>
          {/* Category chips — wrap onto multiple rows so every category is
              visible at once; horizontal scrolling was hard to use on mobile. */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-2 pb-safe">
            <button
              onClick={() => { setActiveCategory(null); setActiveSubCategory(null); setListTitleMode(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-full border font-mono font-bold text-sm whitespace-nowrap transition-all ${
                activeCategory === null
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink/60 active:bg-ink/5"
              }`}
            >
              <span>{t("allPosts")}</span>
              <span className="font-bold tabular-nums">{statsLoading ? <StatSkeleton digits={3} /> : displayTotalPostCount}</span>
            </button>
            {statItems.map(({ label, chipLabel, value, cat, sub }) => {
              const isActive = activeCategory === cat && activeSubCategory === sub;
              return (
                <button
                  key={label}
                  onClick={() => handleFilterClick(cat, sub)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-full border font-mono font-bold text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-paper text-ink/60 active:bg-ink/5"
                  }`}
                >
                  <span>{chipLabel}</span>
                  <span className="font-bold tabular-nums">{statsLoading ? <StatSkeleton /> : value}</span>
                </button>
              );
            })}
          </div>
        </div>

      </main>

      </div>{/* end aside+main row */}

      {/* Country Modal */}
      {selectedCountry && (
        <CountryModal
          country={selectedCountry}
          countryEn={selectedCountryEn}
          onClose={() => { setSelectedCountry(null); setSelectedCountryEn(null); }}
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
        /* Hide filter chip scrollbar */
        .chip-scroll::-webkit-scrollbar,
        .time-chip-scroll::-webkit-scrollbar {
          display: none;
        }
        .chip-scroll,
        .time-chip-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}</style>
    </div>
  );
}
