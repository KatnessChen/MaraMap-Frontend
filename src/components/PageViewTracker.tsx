"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getApiBase } from "@/utils/apiBase";
import { isBotUserAgent } from "@/utils/isBotUserAgent";

const API_URL = getApiBase();

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // The backend already refuses to count a crawler's visit either way —
    // this just stops a JS-executing one (e.g. Google's "GoogleOther") from
    // sending the request at all.
    if (isBotUserAgent(navigator.userAgent)) return;
    fetch(`${API_URL}/api/v1/stats/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
