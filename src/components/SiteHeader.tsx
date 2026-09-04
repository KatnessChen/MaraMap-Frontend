"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Trophy, QrCode, Languages, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getApiBase } from "@/utils/apiBase";

const NAV_LINKS = [
  { href: "/personal-best", key: "personalBest", Icon: Trophy } as const,
  { href: "/qrcode", key: "qrCode", Icon: QrCode } as const,
];

// Language names are shown in their own script regardless of the current
// locale (an "EN" toggle wouldn't help a reader who can't read "英文") —
// intentionally not run through t().
const LOCALE_LABEL = { zh: "中文", en: "EN" } as const;

export default function SiteHeader() {
  const t = useTranslations("SiteHeader");
  const locale = useLocale() as keyof typeof LOCALE_LABEL;
  const otherLocale = locale === "en" ? "zh" : "en";
  const pathname = usePathname();
  const [humanViews, setHumanViews] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${getApiBase()}/api/v1/stats/visits`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHumanViews(d.total_human); })
      .catch(() => {});
  }, []);

  // Closes on route change so the panel doesn't stay open after picking a link.
  useEffect(() => {
    const closeOnNavigate = () => setMenuOpen(false);
    closeOnNavigate();
  }, [pathname]);

  const navLinkCls = (href: string) =>
    `font-mono text-xs uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 transition-colors ${
      pathname === href ? "text-brand" : "text-white hover:text-white/70"
    }`;

  return (
    <header
      // z-[1000], not the old z-10: `relative` + any explicit z-index turns
      // this header into its own stacking context, which caps every
      // descendant's z-index (including the drawer's z-[1500] below) at
      // whatever rank the header itself has among ITS OWN siblings — the
      // drawer's local z-index never mattered against elements outside the
      // header, only the header's own did. MapView's period-picker panel
      // sits at z-[700] (src/components/MapView.tsx:220) with no
      // stacking-context-creating ancestor of its own, so it was rendering
      // above the entire header, drawer included, at the old z-10.
      className="shrink-0 min-h-14 flex items-center justify-between px-4 md:px-6 z-[1000] relative"
      style={{
        backgroundColor: '#1c1c1c',
        backgroundImage: [
          'repeating-linear-gradient(0deg, transparent, transparent 13px, rgba(255,255,255,0.035) 13px, rgba(255,255,255,0.035) 14px)',
          'repeating-linear-gradient(90deg, transparent, transparent 13px, rgba(255,255,255,0.025) 13px, rgba(255,255,255,0.025) 14px)',
        ].join(', '),
      }}
    >
      <Link href="/" className="site-header-logo flex flex-wrap items-baseline gap-x-2.5 gap-y-0 leading-tight py-1">
        <span className="site-header-english font-serif font-black italic text-[clamp(0.95rem,3.9vw,1.25rem)] text-brand whitespace-nowrap">Davis &amp; Rose</span>
        {/* Separator is desktop-only — on mobile the bar is tight enough that
            the two wordmarks read better with just the gap between them. */}
        <span className="hidden md:inline-block text-white/25 text-[clamp(0.85rem,3.4vw,1.25rem)] font-thin" style={{ transform: 'rotate(12deg)' }}>/</span>
        {/* whitespace-nowrap keeps each wordmark on one line as a unit; the
            parent's flex-wrap lets the pair drop to a second line instead of
            overflowing when a long translation (e.g. "World Running Log")
            doesn't fit next to "Davis & Rose" on a narrow phone. */}
        <span className="site-header-chinese font-serif font-black text-[clamp(0.9rem,3.7vw,1.25rem)] text-white tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.15em] whitespace-nowrap">{t("wordmark")}</span>
      </Link>
      <nav className="flex shrink-0 items-center gap-5 pl-3">
        {humanViews !== null && (
          <span className="hidden md:block font-mono text-xs text-white/40 tracking-widest whitespace-nowrap text-right">
            {t("totalVisits", { count: humanViews.toLocaleString() })}
          </span>
        )}

        {/* Desktop: both links shown directly. */}
        {NAV_LINKS.map(({ href, key, Icon }) => (
          <Link key={href} href={href} aria-label={t(key)} className={`hidden md:flex ${navLinkCls(href)}`}>
            <Icon size={12} className="shrink-0" />
            <span>{t(key)}</span>
          </Link>
        ))}

        {/* Language switcher — always visible (not folded into the mobile
            drawer): a reader stuck on the wrong language needs this in one
            tap, not three. `locale` on Link forces that locale's href
            regardless of the current one; `pathname` (from next-intl) is
            already locale-stripped with real params filled in, so this
            round-trips correctly from any page, including /log/[id]. */}
        <Link
          href={pathname}
          locale={otherLocale}
          aria-label={t("switchLocale", { locale: LOCALE_LABEL[otherLocale] })}
          className="font-mono text-xs uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
        >
          <Languages size={12} className="shrink-0" />
          <span>{LOCALE_LABEL[otherLocale]}</span>
        </Link>

        {/* Mobile: both links collapse behind a hamburger toggle instead. */}
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-label={t("menu")}
          aria-expanded={menuOpen}
          className="md:hidden flex items-center justify-center -m-3 p-3 text-white/60 hover:text-white transition-colors"
        >
          <Menu size={18} />
        </button>
      </nav>

      {/* Backdrop — covers the whole viewport so any tap outside the drawer
          closes it; sits one z-step below the drawer itself. Both stay
          mounted (rather than conditionally rendered) so the transform/
          opacity transitions actually animate instead of snapping. */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-[1499] bg-black/50 transition-opacity duration-300 ${
          menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer — full-height, slides in from the right. z-[1500] is
          deliberately above MapView's period-picker panel (z-[700],
          src/components/MapView.tsx:220), the highest z-index this header
          could otherwise sit under. */}
      <div
        className="md:hidden fixed inset-y-0 right-0 z-[1500] w-72 max-w-[80vw] bg-[#1c1c1c] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-in-out"
        style={{ transform: menuOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-end h-14 px-4 border-b border-white/10">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label={t("closeMenu")}
            className="flex items-center justify-center -m-3 p-3 text-white/60 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="py-2">
          {NAV_LINKS.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-5 py-4 text-sm ${navLinkCls(href)}`}
            >
              <Icon size={16} className="shrink-0" />
              <span>{t(key)}</span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
