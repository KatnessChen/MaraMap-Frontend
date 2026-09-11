"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/utils/apiBase";

// Module-scoped so every component mounted on the same page load shares one
// request: SiteHeader and MapView both display this number, and without this
// cache each fetched `/stats/visits` independently, doubling the network call
// and the DB hit behind it on every homepage load.
let cachedPromise: Promise<number | null> | null = null;

function fetchHumanViews(): Promise<number | null> {
  if (!cachedPromise) {
    cachedPromise = fetch(`${getApiBase()}/api/v1/stats/visits`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.total_human ?? null)
      .catch(() => null);
  }
  return cachedPromise;
}

export function useHumanViews(): number | null {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchHumanViews().then((v) => {
      if (!cancelled) setValue(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return value;
}
