"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="shrink-0 h-12 bg-paper border-b border-line flex items-center justify-between px-4 md:px-6 z-10 relative">
      <Link
        href="/"
        className="font-serif font-black text-sm text-ink hover:text-brand transition-colors"
      >
        <span className="italic">Davis & Rose</span>
        <span className="text-brand mx-1.5">·</span>
        <span className="text-ink/60 font-normal not-italic">環球跑旅</span>
      </Link>
      <nav className="flex items-center gap-5">
        <Link
          href="/"
          className={`font-mono text-xs uppercase tracking-[0.2em] transition-colors ${
            pathname === "/" ? "text-brand" : "text-ink/40 hover:text-ink"
          }`}
        >
          地圖
        </Link>
        <Link
          href="/personal-best"
          className={`font-mono text-xs uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors ${
            pathname === "/personal-best" ? "text-brand" : "text-ink/40 hover:text-ink"
          }`}
        >
          <Trophy size={12} />
          PB
        </Link>
      </nav>
    </header>
  );
}
