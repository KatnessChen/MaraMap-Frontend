"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp } from "lucide-react";
import { formatCityName } from "@/utils/formatLocation";

interface TimelinePoint {
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

interface TimelineViewProps {
  points: TimelinePoint[];
  isLoading: boolean;
  category: string | null;
  subCategory: string | null;
  titleMode?: 'countries' | null;
}

function monthLabel(date: string): string {
  const m = new Date(date).getMonth() + 1;
  return Number.isNaN(m) ? '' : `${m}月`;
}

function dayLabel(date: string): string {
  const d = new Date(date).getDate();
  return Number.isNaN(d) ? '' : String(d).padStart(2, '0');
}

export default function TimelineView({ points, isLoading, category, subCategory, titleMode }: TimelineViewProps) {
  const [sortDesc, setSortDesc] = useState(true);

  // Grouped by year, newest first by default. Points arrive already filtered
  // by category / sub-category / date range from MapView.
  const groupedByYear = useMemo(() => {
    const sorted = [...points].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDesc ? -diff : diff;
    });
    const map = new Map<string, TimelinePoint[]>();
    sorted.forEach(p => {
      const year = String(new Date(p.date).getFullYear());
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(p);
    });
    return [...map.entries()];
  }, [points, sortDesc]);

  return (
    <div className="flex flex-col w-full h-full bg-paper overflow-hidden">

      {/* Header */}
      <div className="relative z-10 shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-line bg-paper shadow-[0_4px_14px_-6px_rgba(0,0,0,0.18)]">
        <p className="font-serif text-xl font-bold text-ink/80">
          {!category ? (titleMode === 'countries' ? '到訪國家' : '所有文章') : subCategory ?? category}
          <span className="ml-2 text-ink tabular-nums">({points.length})</span>
        </p>
        <button
          onClick={() => setSortDesc(d => !d)}
          className="flex items-center gap-1.5 font-mono text-sm text-ink/60 hover:text-ink tracking-widest px-2 py-1 -mr-2 transition-colors cursor-pointer"
          aria-label="切換排序方向"
        >
          <ArrowDownUp size={14} />
          {sortDesc ? '由新到舊' : '由舊到新'}
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
        <div className="flex-1 overflow-y-auto">
          {groupedByYear.map(([year, entries]) => (
            <section key={year}>

              {/* Year marker — sticky so the year stays visible while scrolling */}
              <div className="sticky top-0 z-10 flex items-baseline gap-3 px-4 md:px-6 py-2 bg-paper/95 backdrop-blur-sm border-b border-line/60">
                <span className="font-mono font-bold text-xl tabular-nums text-ink leading-none">{year}</span>
                <span className="font-mono text-sm text-ink/60 tabular-nums">({entries.length})</span>
              </div>

              <ol className="relative">
                {/* Vertical rail — sits in the gap between the date column and
                    the entry text, clear of both. */}
                <span className="absolute left-[5rem] md:left-[5.5rem] top-0 bottom-0 w-px bg-line" aria-hidden />

                {entries.map(evt => {
                  const country = evt.country || evt.country_en || '';
                  return (
                    <li key={evt.id} className="relative">
                      <Link
                        href={`/log/${evt.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex py-3 pl-4 pr-4 md:pl-6 md:pr-6 hover:bg-brand/5 transition-colors border-b border-line/30"
                      >
                        {/* Date column */}
                        <div className="w-14 shrink-0 flex flex-col items-end pr-4">
                          <span className="font-mono text-sm text-ink/60 tabular-nums leading-none">{monthLabel(evt.date)}</span>
                          <span className="font-mono font-bold text-lg text-ink tabular-nums leading-none mt-1">{dayLabel(evt.date)}</span>
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1 pl-8">
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 mb-1">
                            <span className="font-mono text-sm text-ink">{evt.cat}</span>
                            {country && (
                              <span className="font-mono text-sm text-ink/60">
                                {country}{evt.city ? `·${formatCityName(evt.city, country)}` : ''}
                              </span>
                            )}
                          </div>
                          <p className="font-sans text-base text-ink leading-snug group-hover:text-brand transition-colors line-clamp-2">
                            {evt.title}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
