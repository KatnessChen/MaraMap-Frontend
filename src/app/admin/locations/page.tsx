"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Search } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";
import { useAdminAuth, clearStoredToken } from "@/hooks/useAdminAuth";
import { authFetch } from "@/utils/authFetch";

interface CountryRow {
  zh: string;
  en: string;
}

interface CityRow {
  country_zh: string;
  zh: string;
  en: string;
}

type Feedback = { type: "success" | "error"; msg: string } | null;

function CountryCombobox({
  countries,
  value,
  onChange,
}: {
  countries: CountryRow[];
  value: string;
  onChange: (countryZh: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  // Keeps the input's display text in sync when the parent resets the
  // selection (e.g. after a successful "新增") — adjusted during render
  // rather than in an effect (React's recommended pattern for "reset local
  // state when a prop changes": https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // since setState-in-an-effect causes an extra render pass for no benefit here.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.zh.includes(q) || c.en.toLowerCase().includes(q),
    );
  }, [countries, query]);

  return (
    <div className="relative w-32">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Typing invalidates the previous selection — addCity stays
          // disabled until a real option is picked from the list below.
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on an option (onMouseDown, below) fires first.
          setTimeout(() => {
            setOpen(false);
            setQuery(value);
          }, 100);
        }}
        placeholder="所屬國家"
        className="w-full font-mono text-sm px-2 py-2 border border-line bg-white focus:outline-none focus:border-brand/60"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-40 overflow-y-auto border border-line bg-white shadow-lg">
          {filtered.map((c) => (
            <li key={c.zh}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c.zh);
                  setQuery(c.zh);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 font-mono text-sm hover:bg-brand/10 ${
                  c.zh === value ? "bg-brand/10 text-brand" : "text-ink/80"
                }`}
              >
                {c.zh}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CityEditRow({
  row,
  onSave,
  onDelete,
  busy,
}: {
  row: CityRow;
  onSave: (countryZh: string, zh: string, en: string) => Promise<void>;
  onDelete: (countryZh: string, zh: string) => void;
  busy: boolean;
}) {
  const [en, setEn] = useState(row.en);
  const dirty = en.trim() !== row.en && en.trim() !== "";

  return (
    <tr className="border-b border-line/40">
      <td className="py-2 pr-4 font-mono text-xs text-ink/50 whitespace-nowrap">{row.country_zh}</td>
      <td className="py-2 pr-4 font-mono text-sm text-ink/80 whitespace-nowrap">{row.zh}</td>
      <td className="py-2 pr-4">
        <input
          value={en}
          onChange={(e) => setEn(e.target.value)}
          className="w-full font-mono text-sm px-2 py-1 border border-line/60 bg-paper focus:outline-none focus:border-brand/60"
        />
      </td>
      <td className="py-2 pr-2 text-right whitespace-nowrap">
        <button
          onClick={() => onSave(row.country_zh, row.zh, en.trim())}
          disabled={!dirty || busy}
          className="p-1.5 text-ink/50 hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="儲存"
        >
          <Save size={15} />
        </button>
        <button
          onClick={() => onDelete(row.country_zh, row.zh)}
          disabled={busy}
          className="p-1.5 text-ink/50 hover:text-red-600 disabled:opacity-30 transition-colors"
          title="刪除"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

export default function AdminLocationsPage() {
  const router = useRouter();
  const { token } = useAdminAuth();
  // Countries are fetched only to populate the city form's "所屬國家"
  // dropdown below — there's no country management UI on this page.
  // Country names are locked (create-only, GeoJSON-constrained) at the API
  // level; see docs/I18N_PLAN.md's "國家名稱鎖定編輯".
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [citySearch, setCitySearch] = useState("");

  const [newCityCountry, setNewCityCountry] = useState("");
  const [newCityZh, setNewCityZh] = useState("");
  const [newCityEn, setNewCityEn] = useState("");

  const api = getApiBase();

  const handleUnauthorized = useCallback(() => {
    clearStoredToken();
    router.push("/admin/login");
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const loadAll = async () => {
      setIsLoading(true);
      try {
        const [cRes, tRes] = await Promise.all([
          authFetch(`${api}/api/v1/admin/location-translations/countries`, token),
          authFetch(`${api}/api/v1/admin/location-translations/cities`, token),
        ]);
        if (cRes.status === 401 || tRes.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!cRes.ok || !tRes.ok) throw new Error("load failed");
        setCountries(await cRes.json());
        setCities(await tRes.json());
      } catch {
        setFeedback({ type: "error", msg: "載入失敗，請重新整理頁面再試一次" });
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, [token, api, handleUnauthorized]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    const base = !q
      ? cities
      : cities.filter(
          (c) => c.zh.includes(q) || c.en.toLowerCase().includes(q) || c.country_zh.includes(q),
        );
    // Taiwan cities surface first (most-edited group day to day); everything
    // else keeps its original relative order — .filter() preserves order,
    // so this is a stable partition, not a re-sort.
    const taiwan = base.filter((c) => c.country_zh === "台灣");
    const rest = base.filter((c) => c.country_zh !== "台灣");
    return [...taiwan, ...rest];
  }, [cities, citySearch]);

  const saveCity = async (countryZh: string, zh: string, en: string) => {
    if (!token || !en) return;
    setBusy(true);
    try {
      const res = await authFetch(`${api}/api/v1/admin/location-translations/cities`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryZh, zh, en }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error();
      setCities((prev) =>
        prev.map((c) => (c.country_zh === countryZh && c.zh === zh ? { ...c, en } : c)),
      );
      setFeedback({ type: "success", msg: `已更新「${zh}」` });
    } catch {
      setFeedback({ type: "error", msg: "儲存失敗" });
    } finally {
      setBusy(false);
    }
  };

  const deleteCity = async (countryZh: string, zh: string) => {
    if (!token) return;
    if (!window.confirm(`確定要刪除「${zh}」嗎？`)) return;
    setBusy(true);
    try {
      const res = await authFetch(
        `${api}/api/v1/admin/location-translations/cities?country=${encodeURIComponent(countryZh)}&zh=${encodeURIComponent(zh)}`,
        token,
        { method: "DELETE" },
      );
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error();
      setCities((prev) => prev.filter((c) => !(c.country_zh === countryZh && c.zh === zh)));
      setFeedback({ type: "success", msg: `已刪除「${zh}」` });
    } catch {
      setFeedback({ type: "error", msg: "刪除失敗" });
    } finally {
      setBusy(false);
    }
  };

  const addCity = async () => {
    const countryZh = newCityCountry.trim();
    const zh = newCityZh.trim();
    const en = newCityEn.trim();
    if (!token || !countryZh || !zh || !en) return;
    setBusy(true);
    try {
      const res = await authFetch(`${api}/api/v1/admin/location-translations/cities`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryZh, zh, en }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error();
      setCities((prev) =>
        prev.some((c) => c.country_zh === countryZh && c.zh === zh)
          ? prev.map((c) => (c.country_zh === countryZh && c.zh === zh ? { country_zh: countryZh, zh, en } : c))
          : [...prev, { country_zh: countryZh, zh, en }].sort((a, b) =>
              a.country_zh === b.country_zh ? a.zh.localeCompare(b.zh) : a.country_zh.localeCompare(b.country_zh),
            ),
      );
      setNewCityZh("");
      setNewCityEn("");
      setFeedback({ type: "success", msg: `已新增「${zh}」` });
    } catch {
      setFeedback({ type: "error", msg: "新增失敗" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b-2 border-ink pb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm font-bold transition-colors mb-4"
          >
            <ArrowLeft size={16} /> 回文章管理
          </Link>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-ink tracking-tight mb-2">
            城市<span className="text-brand">翻譯</span>
          </h1>
          <p className="font-sans text-sm text-ink/60">
            編輯城市的英文名稱。這裡的資料會用在英文版網站（/en）的地圖、列表、文章頁上。
          </p>
        </header>

        {feedback && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full font-sans text-sm font-bold shadow-lg ${
              feedback.type === "success" ? "bg-ink text-white" : "bg-red-600 text-white"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-ink/40">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <section>
            <h2 className="font-serif font-black text-xl text-ink mb-4">
              城市 <span className="font-mono text-sm text-ink/40">({cities.length})</span>
            </h2>

            <div className="flex flex-wrap gap-2 mb-4">
              <CountryCombobox countries={countries} value={newCityCountry} onChange={setNewCityCountry} />
              <input
                value={newCityZh}
                onChange={(e) => setNewCityZh(e.target.value)}
                placeholder="中文城市名"
                className="w-28 font-mono text-sm px-3 py-2 border border-line bg-white focus:outline-none focus:border-brand/60"
              />
              <input
                value={newCityEn}
                onChange={(e) => setNewCityEn(e.target.value)}
                placeholder="English name"
                className="flex-1 min-w-[8rem] font-mono text-sm px-3 py-2 border border-line bg-white focus:outline-none focus:border-brand/60"
              />
              <button
                onClick={addCity}
                disabled={busy || !newCityCountry || !newCityZh.trim() || !newCityEn.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white hover:bg-ink/80 disabled:opacity-30 disabled:cursor-not-allowed font-sans text-sm font-bold transition-colors"
              >
                <Plus size={16} /> 新增
              </button>
            </div>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="搜尋城市或國家…"
                className="w-full font-mono text-sm pl-9 pr-3 py-2 border border-line/60 bg-white focus:outline-none focus:border-brand/60"
              />
            </div>

            <div className="bg-white border border-line max-h-[32rem] overflow-y-auto">
              <table className="w-full">
                <tbody className="[&>tr>td]:px-4">
                  {filteredCities.map((c) => (
                    <CityEditRow
                      key={`${c.country_zh}::${c.zh}`}
                      row={c}
                      onSave={saveCity}
                      onDelete={deleteCity}
                      busy={busy}
                    />
                  ))}
                  {filteredCities.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center font-mono text-sm text-ink/40" colSpan={4}>
                        查無符合的城市
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
