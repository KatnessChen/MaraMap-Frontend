"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiBase } from "@/utils/apiBase";

export default function SiteHeader() {
  const pathname = usePathname();
  const [humanViews, setHumanViews] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${getApiBase()}/api/v1/stats/visits`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHumanViews(d.total_human); })
      .catch(() => {});
  }, []);

  return (
    <header
      className="shrink-0 h-14 flex items-center justify-between px-4 md:px-6 z-10 relative"
      style={{
        backgroundColor: '#1c1c1c',
        backgroundImage: [
          'repeating-linear-gradient(0deg, transparent, transparent 13px, rgba(255,255,255,0.035) 13px, rgba(255,255,255,0.035) 14px)',
          'repeating-linear-gradient(90deg, transparent, transparent 13px, rgba(255,255,255,0.025) 13px, rgba(255,255,255,0.025) 14px)',
        ].join(', '),
      }}
    >
      <Link href="/" className="site-header-logo flex items-center gap-2.5 whitespace-nowrap">
        <span className="site-header-english font-serif font-black italic text-[clamp(0.95rem,3.9vw,1.25rem)] text-brand">Davis &amp; Rose</span>
        {/* Separator is desktop-only — on mobile the bar is tight enough that
            the two wordmarks read better with just the gap between them. */}
        <span className="hidden md:inline-block text-white/25 text-[clamp(0.85rem,3.4vw,1.25rem)] font-thin" style={{ transform: 'rotate(12deg)' }}>/</span>
        <span className="site-header-chinese font-serif font-black text-[clamp(0.9rem,3.7vw,1.25rem)] text-white tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.15em]">環球跑旅</span>
      </Link>
      <nav className="flex shrink-0 items-center gap-5 pl-3">
        {humanViews !== null && (
          <span className="hidden md:block font-mono text-xs text-white/40 tracking-widest whitespace-nowrap text-right">
            累計 {humanViews.toLocaleString()} 次造訪
          </span>
        )}
        <Link
          href="/personal-best"
          aria-label="最佳成績"
          className={`font-mono text-xs uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 transition-colors max-[360px]:-m-3 max-[360px]:p-3 ${
            pathname === "/personal-best" ? "text-brand" : "text-white/50 hover:text-white"
          }`}
        >
          {/* Below 360px the wordmark alone fills the bar — drop to the icon
              rather than let the label wrap or push the logo. The icon grows
              and the link takes padding so the tap target stays usable. */}
          <Trophy size={12} className="shrink-0 max-[360px]:size-[18px]" />
          <span className="max-[360px]:hidden">最佳成績</span>
        </Link>
      </nav>
    </header>
  );
}
