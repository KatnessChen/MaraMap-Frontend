"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="shrink-0 h-14 bg-ink flex items-center justify-between px-4 md:px-6 z-10 relative">
      <Link
        href="/"
        className="flex items-baseline gap-2.5 group"
      >
        <span className="font-serif font-black italic text-xl text-brand group-hover:opacity-80 transition-opacity">Davis & Rose</span>
        <span className="font-serif font-black text-base text-white/80 group-hover:text-white transition-colors">環球跑旅</span>
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
