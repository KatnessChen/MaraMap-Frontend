"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getApiBase } from "@/utils/apiBase";

const API_URL = getApiBase();

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch(`${API_URL}/api/v1/stats/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
