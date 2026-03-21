"use client";

import { useEffect, useState } from "react";

interface StatsData {
  participant_name: string;
  total_distance_km: number;
  fm_count: number;
  hm_count: number;
  um_count: number;
  last_updated: string;
}

interface StatisticsBlockProps {
  participant: string;
}

export default function StatisticsBlock({ participant }: StatisticsBlockProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(
          `${apiUrl}/api/v1/stats?participant=${encodeURIComponent(participant)}`,
          { cache: 'no-store' }
        );
        
        if (!res.ok) {
          throw new Error(`Failed to fetch stats: ${res.status}`);
        }
        
        const data: StatsData = await res.json();
        setStats(data);
      } catch (err) {
        console.error(`Failed to fetch stats for ${participant}:`, err);
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [participant]);

  if (loading) {
    return (
      <div className="flex flex-col">
        <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
          {participant}&apos;s Records
        </span>
        <div className="font-mono text-6xl md:text-7xl font-bold leading-none text-white tracking-tighter">
          <div className="animate-pulse bg-white/20 h-20 w-32 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col">
        <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
          {participant}&apos;s Records
        </span>
        <div className="font-mono text-sm text-brand">
          Unable to load statistics
        </div>
      </div>
    );
  }

  const isRose = stats.participant_name.toLowerCase() === "rose";
  const displayCount = isRose ? stats.hm_count : stats.fm_count;
  const firstWord = isRose ? "Half" : "Full";

  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
        {stats.participant_name}&apos;s Records
      </span>
      <div className="flex items-end gap-2">
        <div className="font-mono text-6xl md:text-8xl font-bold leading-none text-white tracking-tighter">
          {displayCount}
        </div>
        <div className="flex flex-col font-mono text-[10px] md:text-xs uppercase tracking-widest text-brand leading-tight mb-1">
          <span className="font-black">{firstWord}</span>
          <span className="opacity-70">Marathons</span>
        </div>
      </div>
    </div>
  );
}
