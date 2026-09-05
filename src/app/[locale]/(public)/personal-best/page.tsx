"use client";

import { useEffect, useState, useMemo, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { Trophy, ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getApiBase } from "@/utils/apiBase";
import { translateDistanceType, translatePairedName, type Locale } from "@/utils/taxonomyTranslations";
import { getCountryFlag } from "@/utils/countryFlag";

const API_URL = getApiBase();

// Fixed display order; timed buckets get a descriptive suffix.
const BUCKET_ORDER = ["半馬", "全馬", "50K", "100K", "6H", "12H"];
const BUCKET_LABEL_SUFFIX: Record<Locale, Record<string, string>> = {
  zh: { "6H": "6H 計時賽", "12H": "12H 計時賽" },
  en: { "6H": "6H Time Trial", "12H": "12H Time Trial" },
};

interface Milestone {
  date: string;
  raceName: string | null;
  raceNameEn: string | null;
  postId: string;
  country: string | null;
  countryEn: string | null;
  display: string;
  delta: string | null;
}

interface RecordBucket {
  mode: "time" | "distance";
  best: Omit<Milestone, "delta">;
  progression: Milestone[];
}

interface ParticipantData {
  records?: Record<string, RecordBucket>;
}

interface PBResponse {
  participants: Record<string, ParticipantData>;
}

// Rose's races are recorded inconsistently in the source data (mislabelled
// distances, missing times) and there is no admin flow to fix them, so her PB
// is hardcoded here and overrides whatever the API derives for her. Other
// participants (Davis) still come from the API. Her half-marathon PB — and her
// debut half — is 黃金海岸 2018, 3:21:23.
const ROSE_OVERRIDE: ParticipantData = {
  records: {
    半馬: {
      mode: "time",
      best: {
        display: "3:21:23",
        date: "2018-07-01",
        raceName: "2018 黃金海岸馬拉松",
        raceNameEn: "2018 Gold Coast Marathon",
        country: "澳洲",
        countryEn: "Australia",
        postId: "f020d666-f94a-4ece-89c7-099e6df46ffb",
      },
      progression: [
        {
          display: "3:21:23",
          date: "2018-07-01",
          raceName: "2018 黃金海岸馬拉松",
          raceNameEn: "2018 Gold Coast Marathon",
          country: "澳洲",
          countryEn: "Australia",
          postId: "f020d666-f94a-4ece-89c7-099e6df46ffb",
          delta: null,
        },
      ],
    },
  },
};

function bucketLabel(bucket: string, locale: Locale) {
  return BUCKET_LABEL_SUFFIX[locale][bucket] ?? translateDistanceType(bucket, locale);
}

// Per-bucket medal face. Each is a light→deep→light metallic/enamel body with a
// diagonal sheen, a bevelled edge and a soft drop shadow. Bodies are kept light
// enough that the engraved dark text clears WCAG AA — the audience skews older,
// so contrast matters. 50K is rose-gold (unspecified by the brief; easy to swap).
const MEDAL_PALETTES: Record<
  string,
  { body: string; border: string; text: string }
> = {
  全馬: {
    body: "#faf0c8 0%, #ecd792 26%, #d7bd63 52%, #ead68b 78%, #f6e7ab 100%",
    border: "#bd9327",
    text: "#3d2c00",
  }, // 金
  半馬: {
    body: "#f5f7f8 0%, #dce1e5 26%, #c3ccd2 52%, #e0e5e9 78%, #eff2f4 100%",
    border: "#98a4ab",
    text: "#28313a",
  }, // 銀
  "50K": {
    body: "#f8e5da 0%, #eac5b1 26%, #d9a88f 52%, #eccbba 78%, #f7e2d6 100%",
    border: "#bf8a70",
    text: "#4a2b1c",
  }, // 玫瑰金
  "100K": {
    body: "#f0d9b6 0%, #ddb078 26%, #c79256 52%, #dfb682 78%, #efd6ae 100%",
    border: "#a66f3b",
    text: "#3d2410",
  }, // 古銅
  "6H": {
    body: "#dbeee0 0%, #abd7ba 26%, #83c19c 52%, #b0dabf 78%, #d8eddc 100%",
    border: "#5c9a75",
    text: "#153726",
  }, // 祖母綠
  "12H": {
    body: "#ece1f3 0%, #d4bee8 26%, #ba9cd8 52%, #d7c4ea 78%, #eae1f3 100%",
    border: "#8868af",
    text: "#361f50",
  }, // 紫
};

function medalStyle(bucket: string): CSSProperties {
  const p = MEDAL_PALETTES[bucket] ?? MEDAL_PALETTES["全馬"];
  return {
    backgroundImage: [
      "linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 36%)",
      `linear-gradient(158deg, ${p.body})`,
    ].join(", "),
    border: `1px solid ${p.border}`,
    boxShadow:
      "inset 0 1px 1px rgba(255,255,255,0.85), inset 0 -3px 7px rgba(60,40,0,0.22), 0 3px 8px rgba(50,35,0,0.16)",
    color: p.text,
  };
}
const ENGRAVE: CSSProperties = { textShadow: "0 1px 0 rgba(255,255,255,0.55)" };

// Compact tile for the "medal wall" — every distance's best at a glance.
function MedalTile({ bucket, rec }: { bucket: string; rec: RecordBucket }) {
  const t = useTranslations("PersonalBest");
  const locale = useLocale() as Locale;
  const isTimed = rec.mode === "distance";
  const modeHint = isTimed ? t("longestDistance") : t("fastestTime");
  return (
    <Link
      href={`/log/${rec.best.postId}`}
      target="_blank"
      rel="noopener noreferrer"
      style={medalStyle(bucket)}
      className="group relative flex flex-col items-center text-center rounded-xl px-3 py-4 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span
        className="font-mono text-xs font-bold uppercase tracking-[0.2em]"
        style={ENGRAVE}
      >
        {translateDistanceType(bucket, locale)}
        {isTimed && <span className="ml-1 opacity-70">{t("timed")}</span>}
      </span>
      <span
        className="mt-2 font-serif font-black text-2xl md:text-[1.75rem] tabular-nums leading-none"
        style={ENGRAVE}
      >
        {rec.best.display}
      </span>
      <span
        className="mt-2 font-mono text-[0.7rem] uppercase tracking-widest opacity-75"
        style={ENGRAVE}
      >
        {modeHint}
      </span>
    </Link>
  );
}

function RecordSection({ bucket, rec }: { bucket: string; rec: RecordBucket }) {
  const t = useTranslations("PersonalBest");
  const locale = useLocale() as Locale;
  // Every milestone is an improvement over the previous record; the newest is
  // last. Show newest → oldest so the current best reads first.
  const rows = [...rec.progression].reverse();
  const modeHint = rec.mode === "time" ? t("fastestTime") : t("longestDistance");

  return (
    <section className="border border-line bg-white">
      {/* Header: bucket + current best */}
      <div className="flex items-baseline justify-between gap-3 px-5 py-4 border-b border-line/60">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif font-black text-xl text-ink">
            {bucketLabel(bucket, locale)}
          </h2>
          <span className="font-mono text-sm text-ink/50">{modeHint}</span>
        </div>
        <span className="font-serif font-black text-2xl text-brand tabular-nums leading-none">
          {rec.best.display}
        </span>
      </div>

      {/* Progression: each row is one record-breaking race */}
      <ol className="divide-y divide-line/50">
        {rows.map((m, i) => {
          const isCurrent = i === 0;
          const isFirst = m.delta === null;
          const countryFlag = m.country ? getCountryFlag(m.country) : "";
          return (
            <li key={m.postId + m.date}>
              <Link
                href={`/log/${m.postId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-5 py-3.5 group hover:bg-paper/60 transition-colors"
              >
                {/* value + delta */}
                <div className="flex flex-col items-start w-28 shrink-0 gap-1">
                  <span
                    className={`font-serif font-black text-lg tabular-nums leading-none ${
                      isCurrent ? "text-brand" : "text-ink"
                    }`}
                  >
                    {m.display}
                  </span>
                  <span className="mt-1 font-mono text-sm text-ink/60">
                    {isFirst ? t("firstTime") : t("brokeRecordBy", { delta: m.delta! })}
                  </span>
                </div>
                {/* race + date */}
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-base font-bold text-ink/85 group-hover:text-brand transition-colors line-clamp-1 mb-1">
                    {translatePairedName(m.raceName || "", m.raceNameEn, locale) || "—"}
                  </p>
                  <p className="font-mono text-sm text-ink/55">
                    {m.date}
                    {m.country && (
                      <>
                        {" · "}
                        {countryFlag && <span className="mr-[10px]">{countryFlag}</span>}
                        {translatePairedName(m.country, m.countryEn, locale)}
                      </>
                    )}
                  </p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 font-sans text-base font-bold text-brand border border-brand/40 rounded-full px-3 py-1">
                    {t("currentBest")}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function PersonalBestPage() {
  const t = useTranslations("PersonalBest");
  const [data, setData] = useState<PBResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeParticipant, setActiveParticipant] = useState<string>("Davis");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/personal-best`);
        if (res.ok) {
          const json: PBResponse = await res.json();
          // Override Rose with hardcoded data regardless of what the API returns.
          json.participants = { ...json.participants, Rose: ROSE_OVERRIDE };
          setData(json);
          const names = Object.keys(json.participants);
          if (names.includes("Davis")) setActiveParticipant("Davis");
          else if (names.length > 0) setActiveParticipant(names[0]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const participants = useMemo(
    () => Object.keys(data?.participants || {}),
    [data],
  );
  const current = useMemo(
    () => data?.participants[activeParticipant],
    [data, activeParticipant],
  );

  // `records` is optional on purpose: an older backend serves a different
  // participant shape, and reaching straight into it white-screens the page.
  // Without it we fall through to the "no records" state instead.
  const orderedBuckets = useMemo(() => {
    if (!current?.records) return [];
    return BUCKET_ORDER.filter((b) => current.records![b]);
  }, [current]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-paper">
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-ink/60 hover:text-brand font-sans text-base font-black mb-10 transition-colors"
        >
          <ArrowLeft size={18} /> {t("backHome")}
        </Link>
        {/* Wide mono tracking is a Latin device — on Chinese it just pushes the
            glyphs apart and reads as broken. Headings use the serif face at a
            legible size instead; the audience skews older. */}
        <h1 className="flex items-center gap-3 font-serif font-black text-3xl text-ink mb-3">
          <Trophy size={24} className="text-brand shrink-0" /> {t("pageTitle")}
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 font-mono text-base uppercase tracking-widest text-ink">
            Loading...
          </div>
        ) : !data || participants.length === 0 ? (
          <div className="flex items-center justify-center h-48 font-sans text-base text-ink/60">
            {t("noRecordsYet")}
          </div>
        ) : (
          <div className="space-y-8">
            {participants.length > 1 && (
              <div className="flex gap-2 border-b border-line">
                {participants.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveParticipant(name)}
                    className={`px-5 py-2.5 font-mono text-sm uppercase tracking-[0.2em] border-b-2 -mb-px transition-colors ${
                      activeParticipant === name
                        ? "border-brand text-brand"
                        : "border-transparent text-ink/60 hover:text-ink"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {orderedBuckets.length === 0 ? (
              <div className="flex items-center justify-center h-32 font-mono text-base text-ink/50">
                {t("noDerivableRecords")}
              </div>
            ) : (
              <>
                {/* Medal wall — every distance's best at a glance, no scrolling */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {orderedBuckets.map((bucket) => (
                    <MedalTile
                      key={bucket}
                      bucket={bucket}
                      rec={current!.records![bucket]}
                    />
                  ))}
                </div>

                {/* Full record-breaking history per distance */}
                <div className="space-y-6 pt-4">
                  <h2 className="font-serif font-black text-2xl text-ink">
                    {t("recordHistory")}
                  </h2>
                  {orderedBuckets.map((bucket) => (
                    <RecordSection
                      key={bucket}
                      bucket={bucket}
                      rec={current!.records![bucket]}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
