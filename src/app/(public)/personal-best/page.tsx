"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

const DISTANCE_ORDER = ["超馬", "全馬", "半馬"];

interface BestEntry {
  time: string;
  raceName: string | null;
  date: string;
  postId: string;
  country: string | null;
  distanceKm: number | null;
}

interface ParticipantData {
  bests: Record<string, BestEntry>;
}

interface PBResponse {
  participants: Record<string, ParticipantData>;
}

function BestCard({ distance, entry }: { distance: string; entry: BestEntry | undefined }) {
  const label =
    distance === "超馬" && entry?.distanceKm
      ? `超馬 · ${entry.distanceKm}km`
      : distance;

  const inner = entry ? (
    <Link href={`/log/${entry.postId}`} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full group">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/30 mb-3">{label}</span>
      <span className="font-serif font-black text-3xl md:text-4xl text-ink group-hover:text-brand transition-colors tabular-nums leading-none">
        {entry.time}
      </span>
      <div className="mt-auto pt-4 space-y-0.5">
        <p className="font-sans text-sm font-bold text-ink/70 line-clamp-1">{entry.raceName || "—"}</p>
        <p className="font-mono text-xs text-ink/30">
          {entry.date}{entry.country ? ` · ${entry.country}` : ""}
        </p>
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

  const extraDistances = useMemo(() => {
    if (!current) return [];
    return Object.keys(current.bests).filter((d) => !DISTANCE_ORDER.includes(d)).sort();
  }, [current]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-paper">
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-ink/30 mb-10">
          <Trophy size={13} className="text-brand" /> Personal Best
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 font-mono text-xs uppercase tracking-widest text-ink/30 animate-pulse">
            Loading...
          </div>
        ) : !data || participants.length === 0 ? (
          <div className="flex items-center justify-center h-48 font-mono text-xs uppercase tracking-widest text-ink/30">
            尚無 Personal Best 紀錄
          </div>
        ) : (
          <div className="space-y-10">
            {participants.length > 1 && (
              <div className="flex gap-2 border-b border-line">
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

            <section>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/30 mb-5">當前最佳成績</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DISTANCE_ORDER.map((distance) => (
                  <BestCard key={distance} distance={distance} entry={current?.bests[distance]} />
                ))}
              </div>
              {extraDistances.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {extraDistances.map((distance) => (
                    <BestCard key={distance} distance={distance} entry={current?.bests[distance]} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
