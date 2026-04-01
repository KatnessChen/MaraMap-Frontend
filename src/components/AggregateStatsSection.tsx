'use client';

import { useEffect, useState } from 'react';
import { Activity, MapPin, Award, Zap } from 'lucide-react';

interface StatsData {
  participant_name: string;
  total_distance_km: number;
  fm_count: number;
  hm_count: number;
  um_count: number;
  last_updated: string;
}

interface AggregateStats {
  totalMarathons: number;
  totalDistance: number;
  totalRaces: number;
  countriesVisited: number;
}

export default function AggregateStatsSection() {
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAggregateStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';

        // Fetch stats for all participants
        const davisRes = await fetch(`${apiUrl}/api/v1/stats?participant=Davis`, {
          cache: 'no-store',
        });
        const roseRes = await fetch(`${apiUrl}/api/v1/stats?participant=Rose`, {
          cache: 'no-store',
        });

        if (!davisRes.ok || !roseRes.ok) {
          throw new Error('Failed to fetch statistics');
        }

        const davisData: StatsData = await davisRes.json();
        const roseData: StatsData = await roseRes.json();

        // Aggregate the statistics
        const totalMarathons = davisData.fm_count + roseData.fm_count;
        const totalDistance = Math.round(
          (davisData.total_distance_km + roseData.total_distance_km) * 10
        ) / 10; // Round to 1 decimal place
        const totalRaces =
          davisData.fm_count +
          davisData.hm_count +
          davisData.um_count +
          roseData.fm_count +
          roseData.hm_count +
          roseData.um_count;

        // Fetch all posts to count unique countries/locations
        const postsRes = await fetch(`${apiUrl}/api/v1/posts?page=1&limit=1000`, {
          cache: 'no-store',
        });

        let countriesVisited = 15; // Default fallback
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          // Extract unique locations from posts (using a simple approach)
          // If posts have location data, count unique countries
          const uniqueLocations = new Set<string>();
          if (postsData.data && Array.isArray(postsData.data)) {
            postsData.data.forEach((post: { location?: string }) => {
              if (post.location) {
                uniqueLocations.add(post.location);
              }
            });
          }
          countriesVisited = Math.max(uniqueLocations.size, 15);
        }

        setStats({
          totalMarathons,
          totalDistance,
          totalRaces,
          countriesVisited,
        });
      } catch (err) {
        console.error('Failed to fetch aggregate stats:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load statistics'
        );
        // Set default values on error
        setStats({
          totalMarathons: 253,
          totalDistance: 10724,
          totalRaces: 285,
          countriesVisited: 15,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAggregateStats();
  }, []);

  if (loading) {
    return (
      <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded border border-line bg-paper-dark px-4 py-6 md:px-6 md:py-8"
          >
            <div className="mb-2 h-8 w-16 animate-pulse rounded bg-ink-light"></div>
            <div className="h-4 w-12 animate-pulse rounded bg-ink-light"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return null; // Fail silently if stats can't be loaded
  }

  const statItems = [
    {
      icon: Activity,
      value: stats.totalMarathons.toLocaleString(),
      label: '全馬完賽',
      sublabel: 'Full Marathons',
    },
    {
      icon: MapPin,
      value: stats.totalDistance.toLocaleString(),
      label: '總距離',
      sublabel: 'Total Distance (km)',
    },
    {
      icon: Award,
      value: stats.countriesVisited.toString(),
      label: '國家數',
      sublabel: 'Countries Visited',
    },
    {
      icon: Zap,
      value: stats.totalRaces.toLocaleString(),
      label: '完賽總數',
      sublabel: 'Total Races',
    },
  ];

  return (
    <div className="mb-12">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex flex-col items-center justify-center rounded border-b-2 border-b-brand bg-ink px-4 py-8 shadow-sm transition-all duration-300 hover:shadow-md md:px-6"
            >
              <Icon className="mb-3 h-6 w-6 text-brand md:h-7 md:w-7" />
              <div className="mb-2 text-center text-2xl font-bold text-white md:text-3xl">
                {item.value}
              </div>
              <div className="text-center text-xs font-medium text-white md:text-sm">
                {item.label}
              </div>
              <div className="mt-1 text-center text-xs text-ink-light md:text-xs">
                {item.sublabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
