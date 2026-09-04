"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/utils/taxonomyTranslations";

export interface DateFilter {
  startYear: number;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
}

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const selectCls = "font-mono text-sm bg-paper border border-line/60 px-2 py-1 text-ink focus:outline-none focus:border-brand/60 cursor-pointer";

// Placeholder shown in place of a stat while its source request is still in
// flight. Sized in `ch`/`em` so it inherits the metrics of whatever number it
// stands in for — including the container-query `clamp()` sizes in the
// category grid — which keeps the box identical to the digits that replace it
// and stops the panel from reflowing when the data lands.
export function StatSkeleton({ digits = 2 }: { digits?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block align-baseline rounded-sm bg-ink/10 animate-pulse"
      style={{ width: `${digits}ch`, height: "0.72em" }}
    />
  );
}

export function formatDateFilter(f: DateFilter, compact = false, locale: Locale = 'zh'): string {
  if (compact) {
    const sy = String(f.startYear).slice(-2);
    const sm = f.startMonth ? `/${f.startMonth}` : '';
    const ey = f.endYear ? String(f.endYear).slice(-2) : null;
    const em = f.endMonth ? `/${f.endMonth}` : '';
    const start = `${sy}${sm}`;
    const end = ey ? `${ey}${em}` : null;
    return end && end !== start ? `${start}→${end}` : start;
  }
  const fmt = (year: number, month: number | null) => {
    if (locale === 'en') {
      return month ? `${MONTH_ABBR_EN[month - 1]} ${year}` : String(year);
    }
    return month ? `${year}年${month}月` : `${year}年`;
  };
  const start = fmt(f.startYear, f.startMonth);
  const end = f.endYear ? fmt(f.endYear, f.endMonth) : null;
  return end && end !== start ? `${start} → ${end}` : start;
}

const MONTH_ABBR_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthOptionLabel(m: number, locale: Locale): string {
  return locale === 'en' ? MONTH_ABBR_EN[m - 1] : `${m}月`;
}

export function DateRangePicker({
  availableYears,
  applied,
  onApply,
  onClear,
  compact = false,
}: {
  availableYears: number[];
  applied: DateFilter | null;
  onApply: (f: DateFilter) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("DateRangePicker");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [sy, setSy] = useState<number | null>(null);
  const [sm, setSm] = useState<number | null>(null);
  const [ey, setEy] = useState<number | null>(null);
  const [em, setEm] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    if (open) { setOpen(false); return; }
    setSy(applied?.startYear ?? null);
    setSm(applied?.startMonth ?? null);
    setEy(applied?.endYear ?? null);
    setEm(applied?.endMonth ?? null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const endYears = sy ? availableYears.filter(y => y >= sy) : availableYears;
  const endMonths = (ey && sy && ey === sy && sm) ? MONTHS.filter(m => m >= sm) : MONTHS;

  const handleSyChange = (v: number | null) => {
    setSy(v); setSm(null);
    if (v && ey && ey < v) { setEy(null); setEm(null); }
  };
  const handleSmChange = (v: number | null) => {
    setSm(v);
    if (v && ey === sy && em && em < v) setEm(null);
  };
  const handleEyChange = (v: number | null) => { setEy(v); setEm(null); };

  const handleApply = () => {
    if (sy) { onApply({ startYear: sy, startMonth: sm, endYear: ey, endMonth: em }); }
    else { onClear(); }
    setOpen(false);
  };
  const handleClear = () => { setSy(null); setSm(null); setEy(null); setEm(null); };

  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          onClick={togglePanel}
          className={`font-mono text-base md:text-[13px] px-2.5 py-1 border transition-colors flex items-center gap-1.5 min-w-0 cursor-pointer ${
            applied
              ? 'border-brand/60 text-brand bg-white hover:bg-brand/5'
              : 'border-line/60 text-ink/70 bg-white hover:text-ink hover:border-ink/40'
          }`}
        >
          {/* Mobile keeps a short label — the three-way view toggle takes most
              of the row on a 390px screen. */}
          <span className="truncate md:hidden">{applied ? formatDateFilter(applied, true, locale) : t('periodShort')}</span>
          <span className="hidden md:block truncate">{applied ? formatDateFilter(applied, compact, locale) : t('selectPeriod')}</span>
          <span className="opacity-70 text-xs shrink-0">▾</span>
        </button>
        {applied && (
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            className="font-mono text-sm text-ink/50 hover:text-ink transition-colors whitespace-nowrap shrink-0"
          >
            {t('clear')}
          </button>
        )}
      </div>

      {open && (
        <div ref={panelRef} className="absolute top-full left-0 z-[700] bg-paper border border-line shadow-xl p-5 w-[280px]">
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-ink/60 w-12 shrink-0 whitespace-nowrap">{t('from')}</span>
              <select value={sy ?? ''} onChange={e => handleSyChange(e.target.value ? Number(e.target.value) : null)} className={`${selectCls} flex-1`}>
                <option value="">{t('year')}</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={sm ?? ''} onChange={e => handleSmChange(e.target.value ? Number(e.target.value) : null)} disabled={!sy} className={`${selectCls} flex-1 disabled:opacity-30 disabled:cursor-not-allowed`}>
                <option value="">{t('month')}</option>
                {MONTHS.map(m => <option key={m} value={m}>{monthOptionLabel(m, locale)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-ink/60 w-12 shrink-0 whitespace-nowrap">{t('to')}</span>
              <select value={ey ?? ''} onChange={e => handleEyChange(e.target.value ? Number(e.target.value) : null)} disabled={!sy} className={`${selectCls} flex-1 disabled:opacity-30 disabled:cursor-not-allowed`}>
                <option value="">{t('year')}</option>
                {endYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={em ?? ''} onChange={e => setEm(e.target.value ? Number(e.target.value) : null)} disabled={!ey} className={`${selectCls} flex-1 disabled:opacity-30 disabled:cursor-not-allowed`}>
                <option value="">{t('month')}</option>
                {endMonths.map(m => <option key={m} value={m}>{monthOptionLabel(m, locale)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-line/40">
            <button onClick={handleClear} className="font-mono text-sm text-ink/60 hover:text-ink transition-colors underline underline-offset-2">
              {t('reset')}
            </button>
            <button
              onClick={handleApply}
              disabled={!sy}
              className="font-mono text-sm px-5 py-1.5 bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
