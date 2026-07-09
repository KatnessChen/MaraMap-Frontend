"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

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
