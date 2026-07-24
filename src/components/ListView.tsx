"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronsDown } from "lucide-react";
import { formatCityName } from "@/utils/formatLocation";

interface ListPoint {
  id: string;
  postId: string;
  title: string;
  date: string;
  cat: string;
  country?: string | null;
  country_en?: string | null;
  continent?: string | null;
  city?: string | null;
}

interface ListViewProps {
  points: ListPoint[];
  isLoading: boolean;
  category: string | null;
  subCategory: string | null;
  titleMode?: 'countries' | null;
}

export default function ListView({ points, isLoading, category, subCategory, titleMode }: ListViewProps) {
  const [openContinents, setOpenContinents] = useState<Set<string>>(new Set());
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    // continent → country → events
    const map = new Map<string, Map<string, ListPoint[]>>();
    points.forEach(p => {
      const continent = p.continent || '其他';
      const country = p.country || p.country_en || '未知';
      if (!map.has(continent)) map.set(continent, new Map());
      const byCountry = map.get(continent)!;
      if (!byCountry.has(country)) byCountry.set(country, []);
      byCountry.get(country)!.push(p);
    });
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh')));
  }, [points]);

  useEffect(() => {
    if (grouped.size === 0) return;
    setOpenContinents(new Set(grouped.keys()));
    setOpenCountries(new Set());
  }, [grouped]);

  const toggleContinent = (c: string) =>
    setOpenContinents(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  const toggleCountry = (key: string) =>
    setOpenCountries(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Count distinct country NAMES, not (continent, country) pairs. Summing
  // `countries.size` per continent double-counted any country that appeared
  // under two continents — which is exactly how empty-country junk posts (the
  // FB reshares that fall into the '未知' bucket with inconsistent continent
  // tags) once inflated "到訪國家" to 41 instead of the true 39. Also drop the
  // '未知' bucket entirely: a post with no country is not a visited country.
  const distinctCountryCount = useMemo(() => {
    const names = new Set<string>();
    for (const countries of grouped.values())
      for (const country of countries.keys())
        if (country !== '未知') names.add(country);
    return names.size;
  }, [grouped]);

  const totalCount = (countries: Map<string, ListPoint[]>) =>
    [...countries.values()].reduce((sum, evts) => sum + evts.length, 0);

  const allCountryKeys = useMemo(() =>
    [...grouped.entries()].flatMap(([continent, countryMap]) =>
      [...countryMap.keys()].map(country => `${continent}::${country}`)
    ),
  [grouped]);

  return (
    <div className="flex flex-col w-full h-full bg-paper overflow-hidden">

      {/* Header */}
      <div className="relative z-10 shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-line bg-paper shadow-[0_4px_14px_-6px_rgba(0,0,0,0.18)]">
        <p className="font-serif text-xl font-bold text-ink/80">
          {!category ? (titleMode === 'countries' ? '到訪國家' : '所有文章') : subCategory ?? category}
          <span className="ml-2 text-brand tabular-nums">
            ({!category && titleMode === 'countries' ? distinctCountryCount : points.length})
          </span>
        </p>
        <button
          onClick={() => {
            const allOpen = openCountries.size === allCountryKeys.length;
            setOpenCountries(allOpen ? new Set() : new Set(allCountryKeys));
          }}
          className="p-1 text-ink/50 hover:text-ink transition-colors"
          aria-label="全部展開/收合"
        >
          <ChevronsDown
            size={16}
            className={`transition-transform duration-200 ${openCountries.size === allCountryKeys.length ? "rotate-180" : "rotate-0"}`}
          />
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center font-mono text-sm uppercase tracking-widest text-ink">
          Loading...
        </div>
      ) : points.length === 0 ? (
        <div className="flex-1 flex items-center justify-center font-mono text-sm uppercase tracking-widest text-ink/60">
          No Records Found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-line">
          {[...grouped.entries()].map(([continent, countries]) => {
            const continentOpen = openContinents.has(continent);
            return (
              <div key={continent}>

                {/* Continent row */}
                <button
                  onClick={() => toggleContinent(continent)}
                  className="w-full flex items-center gap-3 px-4 md:px-6 py-2.5 bg-ink/[0.06] md:bg-transparent hover:bg-ink/[0.1] md:hover:bg-ink/[0.03] transition-colors text-left"
                >
                  <ChevronDown size={14} className={`text-ink/50 shrink-0 transition-transform duration-200 ${continentOpen ? "rotate-0" : "-rotate-90"}`} />
                  <span className="font-sans text-base text-ink">{continent}</span>
                  <span className="font-mono text-sm text-ink/50 tabular-nums">
                    ({totalCount(countries)})
                  </span>
                </button>

                {continentOpen && (
                  <div className="border-t border-line/40">
                    {[...countries.entries()]
                      .sort((a, b) => {
                        if (continent === '亞洲') {
                          if (a[0] === '台灣') return -1;
                          if (b[0] === '台灣') return 1;
                        }
                        return a[0].localeCompare(b[0]);
                      })
                      .map(([country, events]) => {
                        const countryKey = `${continent}::${country}`;
                        const countryOpen = openCountries.has(countryKey);
                        return (
                          <div key={country}>

                            {/* Country row */}
                            <button
                              onClick={() => toggleCountry(countryKey)}
                              className="w-full flex items-center gap-2.5 pl-6 pr-4 md:pl-14 md:pr-6 py-2 bg-ink/[0.03] md:bg-transparent hover:bg-ink/[0.06] md:hover:bg-ink/[0.03] transition-colors text-left border-b border-line/30"
                            >
                              <ChevronDown size={13} className={`text-ink/50 shrink-0 transition-transform duration-200 ${countryOpen ? "rotate-0" : "-rotate-90"}`} />
                              <span className="font-mono text-base text-ink/80">{country}</span>
                              <span className="font-mono text-sm text-ink/50 tabular-nums">
                                ({events.length})
                              </span>
                            </button>

                            {countryOpen && (
                              <div>
                                {events.map(evt => (
                                  <Link
                                    key={evt.id}
                                    href={`/log/${evt.postId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col pl-[55px] pr-4 md:pl-[87px] md:pr-6 py-2.5 bg-white md:bg-transparent hover:bg-brand/5 group transition-colors border-b border-line/20"
                                  >
                                    {/* Date + city on the meta line, title
                                        below — same stacked layout as the
                                        timeline entries. */}
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-0.5 font-mono text-sm text-ink/60">
                                      <span className="tabular-nums">{evt.date}</span>
                                      {evt.city && <span>{formatCityName(evt.city, country)}</span>}
                                    </div>
                                    <span className="font-sans text-base text-ink leading-snug group-hover:text-brand transition-colors line-clamp-2">
                                      {evt.title}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
