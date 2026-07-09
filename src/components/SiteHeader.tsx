"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";

export default function SiteHeader() {
  const pathname = usePathname();
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
      <Link href="/" className="site-header-logo flex items-center gap-2.5">
        <span className="site-header-english font-serif font-black italic text-xl text-brand">Davis &amp; Rose</span>
        <span className="text-white/25 text-xl font-thin" style={{ transform: 'rotate(12deg)', display: 'inline-block' }}>/</span>
        <span className="site-header-chinese font-serif font-black text-xl text-white/65 tracking-[0.15em]">環球跑旅</span>
      </Link>
      <nav className="flex items-center gap-5">
        <Link
          href="/personal-best"
          className={`font-mono text-xs uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors ${
            pathname === "/personal-best" ? "text-brand" : "text-white/50 hover:text-white"
          }`}
        >
          <Trophy size={12} />
          最佳成績
        </Link>
      </nav>
    </header>
  );
}
