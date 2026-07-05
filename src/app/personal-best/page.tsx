"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, TrendingDown, TrendingUp, Minus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

const DISTANCE_ORDER = ["超馬", "全馬", "半馬", "10K", "5K"];

interface BestEntry {
  time: string;
  raceName: string | null;
  date: string;
  postId: string;
  country: string | null;
}

interface TimelineEntry {
  date: string;
  raceName: string | null;
  country: string | null;
  distance: string;
  time: string;
  postId: string;
  delta: string | null;
}

interface ParticipantData {
  bests: Record<string, BestEntry>;
  timeline: TimelineEntry[];
}

interface PBResponse {
  participants: Record<string, ParticipantData>;
}

function DeltaBadge({ delta }: { delta: string | null }) {
  if (!delta) return <span className="font-mono text-xs text-ink/30 tabular-nums">首次</span>;
  const isFaster = delta.startsWith("-");
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums font-bold ${isFaster ? "text-emerald-600" : "text-brand"}`}>
      {isFaster ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
      {delta}
    </span>
  );
}

function BestCard({ distance, entry }: { distance: string; entry: BestEntry | undefined }) {
  const inner = entry ? (
    <Link href={`/log/${entry.postId}`} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full group">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/30 mb-3">{distance}</span>
      <span className="font-serif font-black text-3xl md:text-4xl text-ink group-hover:text-brand transition-colors tabular-nums leading-none">
        {entry.time}
      </span>
      <div className="mt-auto pt-4 space-y-0.5">
        <p className="font-sans text-sm font-bold text-ink/70 line-clamp-1">{entry.raceName || "—"}</p>
        <p className="font-mono text-xs text-ink/30">{entry.date} {entry.country ? `· ${entry.country}` : ""}</p>
      </div>
    </Link>
  ) : (
    <div className="flex flex-col h-full">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/30 mb-3">{distance}</span>
      <span className="font-serif font-black text-3xl md:text-4xl text-ink/15 leading-none">—</span>
      <p className="mt-auto pt-4 font-sans text-xs text-ink/20">尚無紀錄</p>
    </div>
  );

  return (
    <div className={`p-6 border ${entry ? "border-line bg-white hover:border-brand/30" : "border-line/40 bg-white/40"} transition-colors h-40`}>
      {inner}
    </div>
  );
}

export default function PersonalBestPage() {
  const [data, setData] = useState<PBResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeParticipant, setActiveParticipant] = useState<string>("Davis");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/personal-best`);
        if (res.ok) {
          const json: PBResponse = await res.json();
          setData(json);
          // Default to Davis if available, else first participant
          const names = Object.keys(json.participants);
          if (names.includes("Davis")) setActiveParticipant("Davis");
          else if (names.length > 0) setActiveParticipant(names[0]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const participants = useMemo(() => Object.keys(data?.participants || {}), [data]);
  const current = useMemo(() => data?.participants[activeParticipant], [data, activeParticipant]);

  const sortedDistances = useMemo(() => {
    if (!current) return [];
    const known = DISTANCE_ORDER.filter((d) => current.bests[d]);
    const other = Object.keys(current.bests).filter((d) => !DISTANCE_ORDER.includes(d)).sort();
    return [...known, ...other];
  }, [current]);

  const displayDistances = useMemo(() => {
    const all = DISTANCE_ORDER.filter((d) => current?.bests[d]);
    // Always show at least the known distances in order, fill unknowns too
    return DISTANCE_ORDER;
  }, [current]);

  // Group timeline by year for visual separation
  const timelineByYear = useMemo(() => {
    if (!current) return [];
    const reversed = [...current.timeline].reverse();
    const map = new Map<string, TimelineEntry[]>();
    for (const entry of reversed) {
      const year = entry.date.slice(0, 4);
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(entry);
    }
    return [...map.entries()];
  }, [current]);

  return (
    <div className="min-h-screen bg-paper">
      {/* Top nav */}
      <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur-sm border-b border-line">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/40 hover:text-brand transition-colors">
            <ArrowLeft size={14} /> Map
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-ink/30">Personal Best</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-16">

        {isLoading ? (
          <div className="flex items-center justify-center h-64 font-mono text-xs uppercase tracking-widest text-ink/30 animate-pulse">
            Loading...
          </div>
        ) : !data || participants.length === 0 ? (
          <div className="flex items-center justify-center h-64 font-mono text-xs uppercase tracking-widest text-ink/30">
            尚無 Personal Best 紀錄
          </div>
        ) : (
          <>
            {/* Participant tabs */}
            {participants.length > 1 && (
              <div className="flex gap-2 border-b border-line pb-0">
                {participants.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveParticipant(name)}
                    className={`px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] border-b-2 -mb-px transition-colors ${
                      activeParticipant === name
                        ? "border-brand text-brand"
                        : "border-transparent text-ink/40 hover:text-ink"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Current Bests */}
            <section>
              <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-ink/40 mb-6">
                <Trophy size={13} className="text-brand" /> 當前最佳成績
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {displayDistances.map((distance) => (
                  <BestCard key={distance} distance={distance} entry={current?.bests[distance]} />
                ))}
              </div>
              {/* Extra distances not in standard list */}
              {sortedDistances.filter((d) => !DISTANCE_ORDER.includes(d)).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {sortedDistances.filter((d) => !DISTANCE_ORDER.includes(d)).map((distance) => (
                    <BestCard key={distance} distance={distance} entry={current?.bests[distance]} />
                  ))}
                </div>
              )}
            </section>

            {/* PB Timeline */}
            {current && current.timeline.length > 0 && (
              <section>
                <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-ink/40 mb-6">
                  <Minus size={13} className="text-brand" /> PB 時間線
                </h2>

                <div className="space-y-8">
                  {timelineByYear.map(([year, entries]) => (
                    <div key={year} className="flex gap-6">
                      {/* Year label */}
                      <div className="w-12 shrink-0 pt-3">
                        <span className="font-mono text-xs text-ink/30 tabular-nums">{year}</span>
                      </div>

                      {/* Entries */}
                      <div className="flex-1 space-y-0 border-l border-line/50 pl-6">
                        {entries.map((entry, idx) => (
                          <Link
                            key={idx}
                            href={`/log/${entry.postId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between py-3 border-b border-line/30 last:border-0 hover:bg-brand/[0.03] -mx-6 px-6 group transition-colors"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              {/* Distance badge */}
                              <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink/40 bg-paper border border-line/60 px-2 py-0.5">
                                {entry.distance}
                              </span>
                              {/* Race name */}
                              <div className="min-w-0">
                                <p className="font-serif text-sm font-bold text-ink group-hover:text-brand transition-colors line-clamp-1">
                                  {entry.raceName || "—"}
                                </p>
                                <p className="font-mono text-[10px] text-ink/30">
                                  {entry.date}{entry.country ? ` · ${entry.country}` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 ml-4">
                              <DeltaBadge delta={entry.delta} />
                              <span className="font-mono text-sm font-bold text-ink tabular-nums">
                                {entry.time}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {current && current.timeline.length === 0 && (
              <section>
                <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-ink/40 mb-6">
                  <Minus size={13} className="text-brand" /> PB 時間線
                </h2>
                <p className="font-sans text-sm text-ink/30 py-8 text-center border border-line/30">
                  尚無標記為 PB 的賽事紀錄
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
