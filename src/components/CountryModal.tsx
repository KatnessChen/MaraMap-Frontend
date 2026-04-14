"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";

interface Participant {
  name: string;
  distance: string | null;
  distanceKm: number | null;
  time: string | null;
}

interface CountryRace {
  postId: string;
  title: string;
  date: string;
  category: string;
  raceName: string | null;
  city: string | null;
  participants: Participant[];
}

function getRaceType(distance: string | null, distanceKm: number | null): string {
  if (distanceKm !== null && distanceKm !== undefined) {
    if (distanceKm > 45) return "超馬";
    if (distanceKm >= 42) return "全馬";
    if (distanceKm >= 21) return "半馬";
  }
  return distance || "跑步";
}

interface CountryModalProps {
  country: string;
  onClose: () => void;
}

export default function CountryModal({ country, onClose }: CountryModalProps) {
  const [races, setRaces] = useState<CountryRace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRaces = async () => {
      try {
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
        const res = await fetch(
          `${apiUrl}/api/v1/locations/by-country?country=${encodeURIComponent(country)}`
        );
        if (res.ok) setRaces(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRaces();
  }, [country]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop — 固定不動，點擊關閉 */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 捲動容器 — pointer-events-none 讓點擊穿透到 backdrop */}
      <div className="absolute inset-0 overflow-y-auto pointer-events-none">
        <div className="min-h-full flex items-start justify-center py-16 px-4">

      {/* Panel */}
      <div className="pointer-events-auto bg-paper w-full max-w-lg shadow-2xl border-t-4 border-brand">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-6 border-b-2 border-line shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          <div>
            <p className="font-mono text-xs text-brand uppercase tracking-[0.3em] mb-2">
              MaraMap 足跡
            </p>
            <h2 className="font-serif font-black text-3xl text-ink drop-shadow-sm">{country}</h2>
            {!isLoading && (
              <p className="font-mono text-sm text-ink/40 mt-1">
                共 {races.length} 筆紀錄
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink/40 hover:text-brand transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Race list */}
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 font-mono text-sm text-ink/40 animate-pulse">
              載入中...
            </div>
          ) : races.length === 0 ? (
            <div className="flex items-center justify-center py-16 font-mono text-sm text-ink/40">
              查無賽事資料
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {races.map((race) => (
                <li
                  key={race.postId}
                  className="px-6 py-5 hover:bg-ink/[0.02] transition-colors"
                >
                  {/* Date + City */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm text-brand uppercase">
                      {race.date}
                    </span>
                    {race.city && (
                      <>
                        <span className="text-ink/20">·</span>
                        <span className="font-mono text-sm text-ink/50">
                          {race.city}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title — clickable */}
                  <Link
                    href={`/log/${race.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-serif font-bold text-xl text-ink mb-3 leading-snug hover:text-brand transition-colors cursor-pointer"
                  >
                    {race.raceName || race.title}
                  </Link>

                  {/* Participants */}
                  {race.participants.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {race.participants.map((p, idx) => {
                        const raceType = getRaceType(p.distance, p.distanceKm);
                        const hasTime =
                          p.time && p.time !== "---" && p.time !== "N/A";
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="font-serif font-black text-base text-ink w-14 shrink-0">
                              {p.name}
                            </span>
                            <span className="font-mono text-sm bg-ink/5 px-2 py-0.5 text-ink/60">
                              {raceType}
                            </span>
                            {hasTime && (
                              <span className="font-mono text-base font-bold text-ink tabular-nums">
                                {p.time}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Log link */}
                  <Link
                    href={`/log/${race.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-mono text-ink/40 hover:text-brand transition-colors cursor-pointer"
                  >
                    閱讀完整紀錄 <ArrowRight size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

        </div>
      </div>
    </div>
  );
}
