"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronsDown } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

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
  category: string | null;
  subCategory: string | null;
  startDate?: string;
  endDate?: string;
}

export default function ListView({ category, subCategory, startDate, endDate }: ListViewProps) {
  const [points, setPoints] = useState<ListPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openContinents, setOpenContinents] = useState<Set<string>>(new Set());
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (subCategory) params.set('sub_category', subCategory);
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        params.set('geoOnly', 'false');
        const res = await fetch(`${API_URL}/api/v1/locations?${params}`);
        if (res.ok) setPoints(await res.json());
      } catch (err) {
        console.error("Failed to fetch list data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [category, subCategory, startDate, endDate]);

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

  const distinctCountryCount = useMemo(() =>
    [...grouped.values()].reduce((sum, countries) => sum + countries.size, 0),
  [grouped]);

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
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-line">
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-ink/70">
          {!category ? '所有文章' : subCategory ?? category}
          <span className="ml-3 text-brand tabular-nums">
            {points.length}
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
        <div className="flex-1 flex items-center justify-center font-mono text-sm uppercase tracking-widest text-ink/60 animate-pulse">
          Loading...
        </div>
      ) : points.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <p className="font-serif font-bold text-2xl text-ink/20">—</p>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/40">此期間無紀錄</p>
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
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-ink/[0.03] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown size={14} className={`text-ink/50 shrink-0 transition-transform duration-200 ${continentOpen ? "rotate-0" : "-rotate-90"}`} />
                    <span className="font-serif font-bold text-base text-ink">{continent}</span>
                  </div>
                  <span className="font-mono text-sm text-ink/60 tabular-nums">
                    {totalCount(countries)}
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
                              className="w-full flex items-center justify-between pl-14 pr-6 py-3 hover:bg-ink/[0.03] transition-colors text-left border-b border-line/30"
                            >
                              <div className="flex items-center gap-2.5">
                                <ChevronDown size={13} className={`text-ink/50 shrink-0 transition-transform duration-200 ${countryOpen ? "rotate-0" : "-rotate-90"}`} />
                                <span className="font-mono text-base text-ink/80">{country}</span>
                              </div>
                              <span className="font-mono text-sm text-ink/60 tabular-nums">
                                {events.length}
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
                                    className="flex items-center justify-between pl-24 pr-6 py-2.5 hover:bg-brand/5 group transition-colors border-b border-line/20"
                                  >
                                    <div className="flex items-baseline gap-1.5 min-w-0 mr-4">
                                      {evt.city && (
                                        <span className="font-mono text-xs text-ink/60 shrink-0">{evt.city}</span>
                                      )}
                                      <span className="font-serif text-base text-ink group-hover:text-brand transition-colors line-clamp-1">
                                        {evt.title}
                                      </span>
                                    </div>
                                    <span className="font-mono text-sm text-ink/60 tabular-nums shrink-0">
                                      {evt.date}
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
