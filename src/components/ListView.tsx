"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

const CONTINENT_EN: Record<string, string> = {
  亞洲: 'Asia',
  歐洲: 'Europe',
  北美洲: 'North America',
  南美洲: 'South America',
  非洲: 'Africa',
  大洋洲: 'Oceania',
  南極洲: 'Antarctica',
};

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
  filter: 'all' | 'overseas';
  onClose: () => void;
}

export default function ListView({ filter, onClose }: ListViewProps) {
  const [points, setPoints] = useState<ListPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openContinents, setOpenContinents] = useState<Set<string>>(new Set());
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter === 'overseas') {
          params.set('category', '馬拉松');
          params.set('sub_category', '海外馬');
        }
        const res = await fetch(`${API_URL}/api/v1/locations?${params}`);
        if (res.ok) setPoints(await res.json());
      } catch (err) {
        console.error("Failed to fetch list data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [filter]);

  const grouped = useMemo(() => {
    // continent → country → city → events
    const map = new Map<string, Map<string, Map<string, ListPoint[]>>>();
    points.forEach(p => {
      const continent = CONTINENT_EN[p.continent ?? ''] || p.continent || 'Unknown';
      const country = p.country_en || p.country || 'Unknown';
      const city = p.city || '—';
      if (!map.has(continent)) map.set(continent, new Map());
      const byCountry = map.get(continent)!;
      if (!byCountry.has(country)) byCountry.set(country, new Map());
      const byCity = byCountry.get(country)!;
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push(p);
    });
    // Sort continents A→Z
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [points]);

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

  const totalCount = (countries: Map<string, Map<string, ListPoint[]>>) =>
    [...countries.values()].reduce(
      (sum, cities) => sum + [...cities.values()].reduce((s, evts) => s + evts.length, 0),
      0
    );

  return (
    <div className="flex flex-col w-full h-full bg-paper overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-line">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink/50">
          {filter === 'all' ? '已到訪國家' : '海外馬拉松'}
          <span className="ml-3 text-brand tabular-nums">
            {filter === 'all' ? distinctCountryCount : points.length}
          </span>
        </p>
        <button
          onClick={onClose}
          className="p-1 text-ink/30 hover:text-ink transition-colors"
          aria-label="Close list view"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-ink/30 animate-pulse">
          Loading...
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
                    {continentOpen
                      ? <ChevronDown size={13} className="text-ink/30 shrink-0" />
                      : <ChevronRight size={13} className="text-ink/30 shrink-0" />
                    }
                    <span className="font-serif font-bold text-sm text-ink">{continent}</span>
                  </div>
                  <span className="font-mono text-xs text-ink/30 tabular-nums">
                    {totalCount(countries)}
                  </span>
                </button>

                {continentOpen && (
                  <div className="border-t border-line/40">
                    {[...countries.entries()]
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([country, cities]) => {
                        const countryKey = `${continent}::${country}`;
                        const countryOpen = openCountries.has(countryKey);
                        const countryTotal = [...cities.values()].reduce((s, evts) => s + evts.length, 0);
                        return (
                          <div key={country}>

                            {/* Country row */}
                            <button
                              onClick={() => toggleCountry(countryKey)}
                              className="w-full flex items-center justify-between pl-14 pr-6 py-3 hover:bg-ink/[0.03] transition-colors text-left border-b border-line/30"
                            >
                              <div className="flex items-center gap-2.5">
                                {countryOpen
                                  ? <ChevronDown size={11} className="text-ink/20 shrink-0" />
                                  : <ChevronRight size={11} className="text-ink/20 shrink-0" />
                                }
                                <span className="font-mono text-sm text-ink/70">{country}</span>
                              </div>
                              <span className="font-mono text-xs text-ink/25 tabular-nums">
                                {countryTotal}
                              </span>
                            </button>

                            {countryOpen && (
                              <div>
                                {[...cities.entries()]
                                  .sort((a, b) => a[0].localeCompare(b[0]))
                                  .map(([city, events]) => (
                                    <div key={city} className="border-b border-line/20">

                                      {/* City label */}
                                      <p className="pl-24 pr-6 pt-3 pb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-ink/30">
                                        {city}
                                      </p>

                                      {/* Events */}
                                      {events.map(evt => (
                                        <Link
                                          key={evt.id}
                                          href={`/log/${evt.postId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-between pl-24 pr-6 py-2 hover:bg-brand/5 group transition-colors"
                                        >
                                          <span className="font-serif text-sm text-ink group-hover:text-brand transition-colors line-clamp-1 mr-4">
                                            {evt.title}
                                          </span>
                                          <span className="font-mono text-xs text-ink/30 tabular-nums shrink-0">
                                            {evt.date}
                                          </span>
                                        </Link>
                                      ))}
                                    </div>
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
