"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Check, Image as ImageIcon, AlertCircle, XCircle, Trash2, PlusCircle, User, Activity, Type, FileText, LayoutGrid, Tags, Eye, EyeOff, Calendar, List, MapPin, AlertTriangle } from "lucide-react";

interface ParticipantStats {
  FM_count: number | null;
  HM_count: number | null;
  UM_count: number | null;
  distance_km: number | null;
}

interface Participant {
  name: string;
  distance: string | null;
  time: string | null;
  stats: ParticipantStats;
}

interface MarathonMetadata {
  race_name: string | null;
  country: string | null;
  city: string | null;
  continent: string | null;
  trip_id: string | null;
  mountains: string[];
  participants: Participant[];
}

interface Media {
  uri: string;
  type: string;
}

interface Post {
  id: string;
  title: string;
  event_date: string;
  content: string;
  category: string;
  sub_categories: string[];
  tags: string[];
  is_hidden: boolean;
  cover_image?: string;
  media: Media[];
  metadata?: MarathonMetadata | null;
}

interface FormData {
  title: string;
  event_date: string;
  content: string;
  category: string;
  sub_categories: string[];
  tags: string;
  is_hidden: boolean;
  cover_image: string;
  metadata: {
    race_name: string | null;
    continent: string | null;
    country: string | null;
    city: string | null;
    participants: Participant[];
  };
}

type FieldErrors = Partial<Record<string, string>>;

// ── Location data (continent → country → cities) ──────────────
type CityEntry = { zh: string; en: string };
type LocationData = Record<string, Record<string, CityEntry[]>>;

const LOCATION_DATA: LocationData = {
  亞洲: {
    台灣: [
      { zh: "台北", en: "Taipei" }, { zh: "新北", en: "New Taipei" }, { zh: "桃園", en: "Taoyuan" },
      { zh: "台中", en: "Taichung" }, { zh: "台南", en: "Tainan" }, { zh: "高雄", en: "Kaohsiung" },
      { zh: "基隆", en: "Keelung" }, { zh: "新竹", en: "Hsinchu" }, { zh: "嘉義", en: "Chiayi" },
      { zh: "花蓮", en: "Hualien" }, { zh: "台東", en: "Taitung" }, { zh: "宜蘭", en: "Yilan" },
    ],
    日本: [
      { zh: "東京", en: "Tokyo" }, { zh: "大阪", en: "Osaka" }, { zh: "京都", en: "Kyoto" },
      { zh: "名古屋", en: "Nagoya" }, { zh: "神戶", en: "Kobe" }, { zh: "福岡", en: "Fukuoka" },
      { zh: "札幌", en: "Sapporo" }, { zh: "仙台", en: "Sendai" }, { zh: "廣島", en: "Hiroshima" },
      { zh: "那霸", en: "Naha" }, { zh: "橫濱", en: "Yokohama" }, { zh: "奈良", en: "Nara" },
    ],
    韓國: [
      { zh: "首爾", en: "Seoul" }, { zh: "釜山", en: "Busan" }, { zh: "仁川", en: "Incheon" },
      { zh: "濟州", en: "Jeju" }, { zh: "大邱", en: "Daegu" },
    ],
    中國: [
      { zh: "上海", en: "Shanghai" }, { zh: "北京", en: "Beijing" }, { zh: "廣州", en: "Guangzhou" },
      { zh: "深圳", en: "Shenzhen" }, { zh: "成都", en: "Chengdu" }, { zh: "廈門", en: "Xiamen" },
    ],
    香港: [{ zh: "香港", en: "Hong Kong" }],
    澳門: [{ zh: "澳門", en: "Macau" }],
    新加坡: [{ zh: "新加坡", en: "Singapore" }],
    馬來西亞: [
      { zh: "吉隆坡", en: "Kuala Lumpur" }, { zh: "檳城", en: "Penang" },
      { zh: "古晉", en: "Kuching" }, { zh: "亞庇", en: "Kota Kinabalu" },
    ],
    泰國: [
      { zh: "曼谷", en: "Bangkok" }, { zh: "清邁", en: "Chiang Mai" },
      { zh: "普吉", en: "Phuket" }, { zh: "芭達雅", en: "Pattaya" },
    ],
    越南: [
      { zh: "胡志明市", en: "Ho Chi Minh City" }, { zh: "河內", en: "Hanoi" },
      { zh: "峴港", en: "Da Nang" },
    ],
    印尼: [
      { zh: "雅加達", en: "Jakarta" }, { zh: "峇里島", en: "Bali" }, { zh: "日惹", en: "Yogyakarta" },
    ],
    菲律賓: [{ zh: "馬尼拉", en: "Manila" }, { zh: "宿霧", en: "Cebu" }],
    柬埔寨: [{ zh: "金邊", en: "Phnom Penh" }, { zh: "暹粒", en: "Siem Reap" }],
    緬甸: [{ zh: "仰光", en: "Yangon" }, { zh: "蒲甘", en: "Bagan" }],
    印度: [
      { zh: "孟買", en: "Mumbai" }, { zh: "新德里", en: "New Delhi" },
      { zh: "班加羅爾", en: "Bangalore" }, { zh: "清奈", en: "Chennai" },
    ],
    尼泊爾: [{ zh: "加德滿都", en: "Kathmandu" }, { zh: "波卡拉", en: "Pokhara" }],
    斯里蘭卡: [{ zh: "可倫坡", en: "Colombo" }],
    以色列: [{ zh: "特拉維夫", en: "Tel Aviv" }, { zh: "耶路撒冷", en: "Jerusalem" }],
    土耳其: [{ zh: "伊斯坦堡", en: "Istanbul" }, { zh: "安卡拉", en: "Ankara" }],
    阿拉伯聯合大公國: [{ zh: "杜拜", en: "Dubai" }, { zh: "阿布達比", en: "Abu Dhabi" }],
    卡達: [{ zh: "多哈", en: "Doha" }],
  },
  歐洲: {
    英國: [
      { zh: "倫敦", en: "London" }, { zh: "愛丁堡", en: "Edinburgh" },
      { zh: "曼徹斯特", en: "Manchester" }, { zh: "利物浦", en: "Liverpool" },
    ],
    法國: [
      { zh: "巴黎", en: "Paris" }, { zh: "里昂", en: "Lyon" }, { zh: "馬賽", en: "Marseille" },
      { zh: "尼斯", en: "Nice" }, { zh: "波爾多", en: "Bordeaux" },
    ],
    德國: [
      { zh: "柏林", en: "Berlin" }, { zh: "慕尼黑", en: "Munich" }, { zh: "漢堡", en: "Hamburg" },
      { zh: "科隆", en: "Cologne" }, { zh: "法蘭克福", en: "Frankfurt" },
    ],
    義大利: [
      { zh: "羅馬", en: "Rome" }, { zh: "米蘭", en: "Milan" }, { zh: "佛羅倫斯", en: "Florence" },
      { zh: "威尼斯", en: "Venice" }, { zh: "那不勒斯", en: "Naples" },
    ],
    西班牙: [
      { zh: "馬德里", en: "Madrid" }, { zh: "巴塞隆納", en: "Barcelona" },
      { zh: "塞維亞", en: "Seville" }, { zh: "瓦倫西亞", en: "Valencia" },
    ],
    葡萄牙: [{ zh: "里斯本", en: "Lisbon" }, { zh: "波多", en: "Porto" }],
    荷蘭: [{ zh: "阿姆斯特丹", en: "Amsterdam" }, { zh: "鹿特丹", en: "Rotterdam" }],
    比利時: [{ zh: "布魯塞爾", en: "Brussels" }, { zh: "安特衛普", en: "Antwerp" }],
    瑞士: [{ zh: "蘇黎世", en: "Zurich" }, { zh: "日內瓦", en: "Geneva" }, { zh: "伯恩", en: "Bern" }],
    奧地利: [{ zh: "維也納", en: "Vienna" }, { zh: "薩爾斯堡", en: "Salzburg" }, { zh: "因斯布魯克", en: "Innsbruck" }],
    瑞典: [{ zh: "斯德哥爾摩", en: "Stockholm" }, { zh: "哥德堡", en: "Gothenburg" }],
    丹麥: [{ zh: "哥本哈根", en: "Copenhagen" }],
    芬蘭: [{ zh: "赫爾辛基", en: "Helsinki" }],
    挪威: [{ zh: "奧斯陸", en: "Oslo" }, { zh: "卑爾根", en: "Bergen" }],
    波蘭: [{ zh: "華沙", en: "Warsaw" }, { zh: "克拉科夫", en: "Krakow" }],
    捷克: [{ zh: "布拉格", en: "Prague" }, { zh: "布爾諾", en: "Brno" }],
    匈牙利: [{ zh: "布達佩斯", en: "Budapest" }],
    希臘: [{ zh: "雅典", en: "Athens" }, { zh: "塞薩洛尼基", en: "Thessaloniki" }],
    愛爾蘭: [{ zh: "都柏林", en: "Dublin" }],
    克羅埃西亞: [{ zh: "薩格勒布", en: "Zagreb" }, { zh: "杜布羅夫尼克", en: "Dubrovnik" }],
    斯洛維尼亞: [{ zh: "盧布林雅那", en: "Ljubljana" }],
    立陶宛: [{ zh: "維爾紐斯", en: "Vilnius" }],
    拉脫維亞: [{ zh: "里加", en: "Riga" }],
    愛沙尼亞: [{ zh: "塔林", en: "Tallinn" }],
    羅馬尼亞: [{ zh: "布加勒斯特", en: "Bucharest" }],
    保加利亞: [{ zh: "索菲亞", en: "Sofia" }],
    塞爾維亞: [{ zh: "貝爾格萊德", en: "Belgrade" }],
  },
  北美洲: {
    美國: [
      { zh: "紐約", en: "New York" }, { zh: "波士頓", en: "Boston" }, { zh: "芝加哥", en: "Chicago" },
      { zh: "洛杉磯", en: "Los Angeles" }, { zh: "舊金山", en: "San Francisco" },
      { zh: "西雅圖", en: "Seattle" }, { zh: "邁阿密", en: "Miami" },
      { zh: "華盛頓特區", en: "Washington D.C." }, { zh: "拉斯維加斯", en: "Las Vegas" },
      { zh: "丹佛", en: "Denver" }, { zh: "亞特蘭大", en: "Atlanta" },
      { zh: "費城", en: "Philadelphia" }, { zh: "休士頓", en: "Houston" },
    ],
    加拿大: [
      { zh: "多倫多", en: "Toronto" }, { zh: "溫哥華", en: "Vancouver" },
      { zh: "蒙特婁", en: "Montreal" }, { zh: "渥太華", en: "Ottawa" }, { zh: "卡加利", en: "Calgary" },
    ],
    墨西哥: [{ zh: "墨西哥城", en: "Mexico City" }, { zh: "坎昆", en: "Cancun" }],
    格陵蘭: [{ zh: "努克", en: "Nuuk" }],
  },
  南美洲: {
    巴西: [{ zh: "聖保羅", en: "São Paulo" }, { zh: "里約熱內盧", en: "Rio de Janeiro" }],
    阿根廷: [{ zh: "布宜諾斯艾利斯", en: "Buenos Aires" }],
    智利: [{ zh: "聖地牙哥", en: "Santiago" }],
    哥倫比亞: [{ zh: "波哥大", en: "Bogotá" }, { zh: "麥德林", en: "Medellín" }],
    秘魯: [{ zh: "利馬", en: "Lima" }, { zh: "庫斯科", en: "Cusco" }],
    厄瓜多: [{ zh: "基多", en: "Quito" }],
  },
  大洋洲: {
    澳洲: [
      { zh: "雪梨", en: "Sydney" }, { zh: "墨爾本", en: "Melbourne" },
      { zh: "布里斯本", en: "Brisbane" }, { zh: "伯斯", en: "Perth" },
      { zh: "阿德雷德", en: "Adelaide" }, { zh: "黃金海岸", en: "Gold Coast" },
    ],
    紐西蘭: [{ zh: "奧克蘭", en: "Auckland" }, { zh: "威靈頓", en: "Wellington" }, { zh: "基督城", en: "Christchurch" }],
    斐濟: [{ zh: "蘇瓦", en: "Suva" }],
  },
  非洲: {
    南非: [{ zh: "開普敦", en: "Cape Town" }, { zh: "約翰尼斯堡", en: "Johannesburg" }],
    摩洛哥: [{ zh: "卡薩布蘭卡", en: "Casablanca" }, { zh: "馬拉喀什", en: "Marrakech" }],
    埃及: [{ zh: "開羅", en: "Cairo" }, { zh: "亞歷山大", en: "Alexandria" }],
    肯亞: [{ zh: "奈洛比", en: "Nairobi" }],
    衣索比亞: [{ zh: "亞的斯亞貝巴", en: "Addis Ababa" }],
    坦尚尼亞: [{ zh: "三蘭港", en: "Dar es Salaam" }, { zh: "吉利馬扎羅", en: "Kilimanjaro" }],
  },
};

const CONTINENTS = Object.keys(LOCATION_DATA);

const COUNTRY_EN_MAP: Record<string, string> = {
  台灣: "Taiwan", 日本: "Japan", 韓國: "South Korea", 中國: "China",
  香港: "Hong Kong", 澳門: "Macau", 新加坡: "Singapore", 馬來西亞: "Malaysia",
  泰國: "Thailand", 越南: "Vietnam", 印尼: "Indonesia", 菲律賓: "Philippines",
  柬埔寨: "Cambodia", 緬甸: "Myanmar", 印度: "India", 尼泊爾: "Nepal",
  斯里蘭卡: "Sri Lanka", 以色列: "Israel", 土耳其: "Turkey",
  阿拉伯聯合大公國: "UAE", 卡達: "Qatar",
  英國: "United Kingdom", 法國: "France", 德國: "Germany", 義大利: "Italy",
  西班牙: "Spain", 葡萄牙: "Portugal", 荷蘭: "Netherlands", 比利時: "Belgium",
  瑞士: "Switzerland", 奧地利: "Austria", 瑞典: "Sweden", 丹麥: "Denmark",
  芬蘭: "Finland", 挪威: "Norway", 波蘭: "Poland", 捷克: "Czech Republic",
  匈牙利: "Hungary", 希臘: "Greece", 愛爾蘭: "Ireland", 克羅埃西亞: "Croatia",
  斯洛維尼亞: "Slovenia", 立陶宛: "Lithuania", 拉脫維亞: "Latvia",
  愛沙尼亞: "Estonia", 羅馬尼亞: "Romania", 保加利亞: "Bulgaria", 塞爾維亞: "Serbia",
  美國: "United States", 加拿大: "Canada", 墨西哥: "Mexico", 格陵蘭: "Greenland",
  巴西: "Brazil", 阿根廷: "Argentina", 智利: "Chile", 哥倫比亞: "Colombia",
  秘魯: "Peru", 厄瓜多: "Ecuador",
  澳洲: "Australia", 紐西蘭: "New Zealand", 斐濟: "Fiji",
  南非: "South Africa", 摩洛哥: "Morocco", 埃及: "Egypt",
  肯亞: "Kenya", 衣索比亞: "Ethiopia", 坦尚尼亞: "Tanzania",
};

function countryOption(zh: string): { label: string; value: string } {
  const en = COUNTRY_EN_MAP[zh];
  return { label: en ? `${zh}（${en}）` : zh, value: zh };
}

function getCountries(continent: string): { label: string; value: string }[] {
  return Object.keys(LOCATION_DATA[continent] || {}).map(countryOption);
}

function getCityOptions(continent: string, country: string): { label: string; value: string }[] {
  return (LOCATION_DATA[continent]?.[country] || []).map(c => ({ label: `${c.zh}（${c.en}）`, value: c.zh }));
}

// Flat fallbacks for when continent/country not yet selected
const ALL_COUNTRIES = [...new Set(Object.values(LOCATION_DATA).flatMap(c => Object.keys(c)))].map(countryOption);
const ALL_CITY_OPTIONS = [...new Set(
  Object.values(LOCATION_DATA).flatMap(c => Object.values(c).flat())
)].map(c => ({ label: `${c.zh}（${c.en}）`, value: c.zh }));

// ── Combobox ───────────────────────────────────────────────────
type ComboOption = string | { label: string; value: string };
const getLabel = (o: ComboOption) => typeof o === "string" ? o : o.label;
const getValue = (o: ComboOption) => typeof o === "string" ? o : o.value;

function Combobox({ options, value, onChange, placeholder, hasError }: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim() === ""
    ? options
    : options.filter(o => getLabel(o).includes(value) || getValue(o).includes(value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full bg-white border-2 p-3 font-sans text-base focus:outline-none focus:border-brand shadow-sm ${hasError ? "border-brand" : "border-line"}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-line shadow-xl max-h-52 overflow-y-auto mt-0.5">
          {filtered.map((opt, i) => (
            <li
              key={i}
              onMouseDown={() => { onChange(getValue(opt)); setOpen(false); }}
              className={`px-4 py-2.5 font-sans text-sm cursor-pointer hover:bg-ink/5 ${getValue(opt) === value ? "bg-brand/5 text-brand font-bold" : "text-ink"}`}
            >
              {getLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DISTANCE_KM_MAP: Record<string, number | null> = {
  全馬: 42.195,
  半馬: 21.0975,
  超馬: null,
  "10K": 10,
  "5K": 5,
};

const TIME_REGEX = /^\d+:\d{2}:\d{2}$/;

function isValidDate(val: string) {
  return !!val && !isNaN(new Date(val).getTime());
}

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    event_date: "",
    content: "",
    category: "",
    sub_categories: [],
    tags: "",
    is_hidden: false,
    cover_image: "",
    metadata: { race_name: "", continent: "", country: "", city: "", participants: [] },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | null; msg: string }>({ type: null, msg: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [warnDismissed, setWarnDismissed] = useState(false);

  const checkAuth = () => {
    const token = localStorage.getItem("maramap_admin_token");
    const loginTime = localStorage.getItem("maramap_admin_login_time");
    if (!token || !loginTime) return null;
    if (Date.now() - parseInt(loginTime) > 60 * 60 * 1000) {
      localStorage.removeItem("maramap_admin_token");
      localStorage.removeItem("maramap_admin_login_time");
      return null;
    }
    return token;
  };

  useEffect(() => {
    const token = checkAuth();
    if (!token) { router.push("/admin/login"); return; }

    const fetchPost = async () => {
      try {
        const { id } = await (params as Promise<{ id: string }>);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3000";
        const res = await fetch(`${apiUrl}/api/v1/posts/${id}`, { cache: "no-store" });
        if (res.ok) {
          const data: Post = await res.json();
          setPost(data);
          setFormData({
            title: data.title || "",
            event_date: data.event_date || "",
            content: data.content || "",
            category: data.category || "",
            sub_categories: data.sub_categories || [],
            tags: (data.tags || []).join(", "),
            is_hidden: data.is_hidden || false,
            cover_image: data.cover_image || "",
            metadata: {
              race_name: data.metadata?.race_name || "",
              continent: data.metadata?.continent || "",
              country: data.metadata?.country || "",
              city: data.metadata?.city || "",
              participants: data.metadata?.participants || [],
            },
          });
        }
      } catch (error) {
        console.error("Failed to fetch post:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [params, router]);

  // ── Validation ──────────────────────────────────────────────
  const validate = (): { errors: FieldErrors; warnings: string[] } => {
    const errs: FieldErrors = {};
    const warns: string[] = [];

    if (!formData.title.trim()) errs["title"] = "標題為必填";
    if (!formData.event_date) errs["event_date"] = "活動日期為必填";
    else if (!isValidDate(formData.event_date)) errs["event_date"] = "日期格式不正確";
    if (!formData.category) errs["category"] = "類別為必填";
    if (!formData.metadata.continent?.trim()) errs["continent"] = "洲別為必填";
    if (!formData.metadata.country?.trim()) errs["country"] = "國家為必填";
    if (!formData.metadata.city?.trim()) errs["city"] = "城市為必填";

    formData.metadata.participants.forEach((p, idx) => {
      if (p.time && p.time !== "0:00:00" && !TIME_REGEX.test(p.time)) {
        errs[`participant_time_${idx}`] = `第 ${idx + 1} 位參賽者時間格式須為 HH:MM:SS`;
      }
    });

    if (!formData.content.trim()) warns.push("文章內容為空，確定要儲存嗎？");
    if (!formData.cover_image) warns.push("尚未設定封面圖片。");

    return { errors: errs, warnings: warns };
  };

  const scrollToFirstError = (errs: FieldErrors) => {
    const order = ["title", "event_date", "category", "continent", "country", "city"];
    for (const key of order) {
      if (errs[key]) {
        document.getElementById(`field-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    const participantKey = Object.keys(errs).find(k => k.startsWith("participant_time_"));
    if (participantKey) {
      document.getElementById(`field-${participantKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const { errors: errs, warnings: warns } = validate();
    setErrors(errs);
    setWarnings(warns);
    setWarnDismissed(false);

    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
      return;
    }

    if (warns.length > 0 && !warnDismissed) {
      // Show warning banner and wait for user to dismiss + retry
      return;
    }

    const token = checkAuth();
    if (!token) { router.push("/admin/login"); return; }
    if (!post) return;

    setIsSaving(true);
    setFeedback({ type: null, msg: "" });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3000";
      const res = await fetch(`${apiUrl}/api/v1/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        setFeedback({ type: "success", msg: "文章已成功儲存！" });
        setWarnings([]);
        setTimeout(() => setFeedback({ type: null, msg: "" }), 5000);
      } else if (res.status === 401) {
        setFeedback({ type: "error", msg: "登入已過期，請重新登入。" });
        router.push("/admin/login");
      } else {
        const errorData = await res.json();
        setFeedback({ type: "error", msg: `儲存失敗：${errorData.message || "發生錯誤"}` });
      }
    } catch {
      setFeedback({ type: "error", msg: "連線失敗，請檢查網路狀態。" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Participant helpers ───────────────────────────────────────
  const updateParticipant = (index: number, field: string, value: string | number | null) => {
    const newParticipants = [...formData.metadata.participants] as (Participant & Record<string, unknown>)[];
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      newParticipants[index][parent] = { ...(newParticipants[index][parent] as Record<string, unknown>), [child]: value === "" ? null : value };
    } else {
      newParticipants[index][field] = value;
      // Auto-fill distance_km when distance changes
      if (field === "distance" && typeof value === "string") {
        const km = DISTANCE_KM_MAP[value];
        if (km !== undefined) {
          newParticipants[index].stats = { ...(newParticipants[index].stats as ParticipantStats), distance_km: km };
        }
      }
    }
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: newParticipants as Participant[] } });
  };

  const addParticipant = () => {
    const newP: Participant = { name: "Davis", distance: "全馬", time: "0:00:00", stats: { FM_count: null, HM_count: null, UM_count: null, distance_km: 42.195 } };
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: [...formData.metadata.participants, newP] } });
  };

  const removeParticipant = (index: number) => {
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: formData.metadata.participants.filter((_, i) => i !== index) } });
  };

  if (isLoading) return <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-lg animate-pulse text-ink/40">正在載入紀錄...</div>;
  if (!post) return <div className="p-12 text-center font-sans text-xl font-bold text-ink">找不到該文章。</div>;

  const categories = ["馬拉松", "旅遊", "登山"];
  const distances = ["全馬", "半馬", "超馬", "10K", "5K"];
  const SUB_CATEGORY_MAP: Record<string, string[]> = {
    馬拉松: ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "七大馬"],
    旅遊: [],
    登山: ["大百岳", "小百岳", "海外登山"],
  };
  const availableSubs = SUB_CATEGORY_MAP[formData.category] || [];

  const toggleSubCategory = (sub: string) => {
    const next = formData.sub_categories.includes(sub)
      ? formData.sub_categories.filter(s => s !== sub)
      : [...formData.sub_categories, sub];
    setFormData({ ...formData, sub_categories: next });
  };

  const errBorder = (key: string) => errors[key] ? "border-brand" : "border-line";
  const hasWarnings = warnings.length > 0 && !warnDismissed;

  return (
    <div className="min-h-screen bg-paper pb-24 text-ink">
      {/* Toast feedback */}
      {feedback.type && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[2000] px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border-2 animate-in fade-in slide-in-from-top-4 duration-300 ${feedback.type === "success" ? "bg-green-50 border-green-500 text-green-800" : "bg-red-50 border-brand text-brand"}`}>
          {feedback.type === "success" ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-sans text-lg font-bold">{feedback.msg}</span>
          <button onClick={() => setFeedback({ type: null, msg: "" })} className="ml-4 opacity-40 hover:opacity-100"><XCircle size={18} /></button>
        </div>
      )}

      {/* Warning banner — shown when there are soft warnings and save was attempted */}
      {hasWarnings && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-xl px-8 py-5 bg-amber-50 border-2 border-amber-400 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-sans font-black text-base text-amber-900 mb-1">儲存前請確認</p>
              <ul className="space-y-1">
                {warnings.map((w, i) => <li key={i} className="font-sans text-sm text-amber-800">· {w}</li>)}
              </ul>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setWarnings([])} className="font-sans text-sm font-bold text-amber-700 hover:text-amber-900 px-4 py-2 border border-amber-300 hover:border-amber-500 transition-colors">
              取消
            </button>
            <button onClick={() => { setWarnDismissed(true); setTimeout(handleSave, 0); }} className="font-sans text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 px-6 py-2 transition-colors">
              確認儲存
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 md:p-12">
        <header className="flex items-center justify-between mb-12 border-b-2 border-ink pb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-base font-black transition-colors">
            <ArrowLeft size={20} /> 回文章列表
          </Link>
          <button onClick={handleSave} disabled={isSaving} className="bg-ink text-paper px-12 py-4 rounded-full font-sans text-xl font-black tracking-widest hover:bg-brand transition-all flex items-center gap-3 disabled:opacity-50 shadow-2xl">
            {isSaving ? <Loader2 className="animate-spin" size={24} /> : feedback.type === "success" ? <Check size={24} /> : <Save size={24} />}
            {isSaving ? "儲存中..." : "儲存變更"}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* ── Left column ── */}
          <div className="lg:col-span-8 space-y-16">

            {/* Title */}
            <div id="field-title" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <Type size={28} className="text-brand" /> 文章標題
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => { setFormData({ ...formData, title: e.target.value }); setErrors(v => ({ ...v, title: undefined })); }}
                className={`w-full bg-white border-2 ${errBorder("title")} p-6 font-serif font-black text-4xl focus:outline-none focus:border-brand shadow-sm rounded-sm`}
              />
              {errors.title && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.title}</p>}
            </div>

            {/* Event date */}
            <div id="field-event_date" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <Calendar size={28} className="text-brand" /> 活動日期
              </label>
              <input
                type="date"
                value={formData.event_date}
                onChange={e => { setFormData({ ...formData, event_date: e.target.value }); setErrors(v => ({ ...v, event_date: undefined })); }}
                className={`w-full bg-white border-2 ${errBorder("event_date")} p-6 font-mono text-2xl font-bold focus:outline-none focus:border-brand shadow-sm rounded-sm`}
              />
              {errors.event_date && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.event_date}</p>}
            </div>

            {/* Cover image */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <ImageIcon size={28} className="text-brand" /> 設定封面圖片
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 bg-white p-6 border border-line shadow-sm">
                {post.media && post.media.filter(m => m.type !== "video").map((m, idx) => (
                  <button key={idx} onClick={() => setFormData({ ...formData, cover_image: m.uri })} className={`relative aspect-square border-2 transition-all overflow-hidden rounded-md ${formData.cover_image === m.uri ? "border-brand ring-4 ring-brand/10 shadow-lg scale-[1.05] z-10" : "border-line opacity-40 hover:opacity-100"}`}>
                    <img src={m.uri} alt="預覽" className="w-full h-full object-cover" />
                    {formData.cover_image === m.uri && <div className="absolute top-2 right-2 bg-brand text-white p-1 rounded-full shadow-md"><Check size={12} /></div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <FileText size={28} className="text-brand" /> 文章內容
              </label>
              <textarea
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                rows={20}
                className="w-full bg-white border border-line p-10 font-sans text-2xl leading-relaxed focus:outline-none focus:border-brand whitespace-pre-wrap shadow-sm rounded-sm"
              />
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-4 space-y-16">

            {/* Category */}
            <div id="field-category" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <LayoutGrid size={24} className="text-brand" /> 文章類別
              </label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={e => { setFormData({ ...formData, category: e.target.value, sub_categories: [] }); setErrors(v => ({ ...v, category: undefined })); }}
                  className={`w-full bg-white border-2 ${errBorder("category")} p-5 font-sans text-lg font-black appearance-none cursor-pointer focus:border-brand outline-none shadow-sm`}
                >
                  <option value="">請選擇類別</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-xl">▼</div>
              </div>
              {errors.category && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.category}</p>}
            </div>

            {/* Sub-categories */}
            {availableSubs.length > 0 && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                  <List size={24} className="text-brand" /> 子分類
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableSubs.map(sub => {
                    const active = formData.sub_categories.includes(sub);
                    return (
                      <button key={sub} type="button" onClick={() => toggleSubCategory(sub)} className={`px-4 py-2 font-sans text-sm font-bold border-2 transition-all ${active ? "bg-brand text-white border-brand" : "bg-white text-ink/60 border-line hover:border-ink/40"}`}>
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <MapPin size={24} className="text-brand" /> 地點資訊
              </label>
              <div className="space-y-4">
                <div id="field-continent">
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">洲別</label>
                  <Combobox
                    options={CONTINENTS}
                    value={formData.metadata.continent || ""}
                    onChange={v => {
                      setFormData({ ...formData, metadata: { ...formData.metadata, continent: v, country: "", city: "" } });
                      setErrors(e => ({ ...e, continent: undefined }));
                    }}
                    placeholder="亞洲、歐洲…"
                    hasError={!!errors.continent}
                  />
                  {errors.continent && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors.continent}</p>}
                </div>
                <div id="field-country">
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">國家</label>
                  <Combobox
                    options={formData.metadata.continent ? getCountries(formData.metadata.continent) : ALL_COUNTRIES}
                    value={formData.metadata.country || ""}
                    onChange={v => {
                      setFormData({ ...formData, metadata: { ...formData.metadata, country: v, city: "" } });
                      setErrors(e => ({ ...e, country: undefined }));
                    }}
                    placeholder="台灣、日本…"
                    hasError={!!errors.country}
                  />
                  {errors.country && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors.country}</p>}
                </div>
                <div id="field-city">
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">城市</label>
                  <Combobox
                    options={
                      formData.metadata.continent && formData.metadata.country
                        ? getCityOptions(formData.metadata.continent, formData.metadata.country)
                        : ALL_CITY_OPTIONS
                    }
                    value={formData.metadata.city || ""}
                    onChange={v => {
                      setFormData({ ...formData, metadata: { ...formData.metadata, city: v } });
                      setErrors(e => ({ ...e, city: undefined }));
                    }}
                    placeholder="台北、東京…"
                    hasError={!!errors.city}
                  />
                  {errors.city && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors.city}</p>}
                </div>
                <div>
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">賽事名稱（選填）</label>
                  <input
                    type="text"
                    value={formData.metadata.race_name || ""}
                    onChange={e => setFormData({ ...formData, metadata: { ...formData.metadata, race_name: e.target.value } })}
                    className="w-full bg-white border border-line p-3 font-sans text-base focus:outline-none focus:border-brand shadow-sm"
                    placeholder="例如：東京馬拉松"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <Tags size={24} className="text-brand" /> 標籤編輯
              </label>
              <input type="text" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-white border border-line p-5 font-sans text-lg focus:outline-none focus:border-brand shadow-sm" placeholder="例如：東京, 2024, 全馬" />
            </div>

            {/* Visibility */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                {formData.is_hidden ? <EyeOff size={24} className="text-brand" /> : <Eye size={24} className="text-brand" />} 顯示設定
              </label>
              <div className="flex items-center gap-5 p-6 border-2 border-line bg-white rounded-lg shadow-sm">
                <input type="checkbox" id="is_hidden" checked={formData.is_hidden} onChange={e => setFormData({ ...formData, is_hidden: e.target.checked })} className="w-7 h-7 accent-brand cursor-pointer" />
                <label htmlFor="is_hidden" className="font-sans text-lg font-black cursor-pointer select-none">隱藏此文章</label>
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h3 className="font-serif font-black text-2xl flex items-center gap-3"><Activity size={24} className="text-brand" /> 成績小卡</h3>
                <button onClick={addParticipant} className="text-brand hover:opacity-70 transition-opacity"><PlusCircle size={28} /></button>
              </div>
              <div className="space-y-8">
                {formData.metadata.participants.map((p, idx) => (
                  <div key={idx} className="bg-white border-2 border-line p-6 shadow-sm relative space-y-6 rounded-sm">
                    <button onClick={() => removeParticipant(idx)} className="absolute top-4 right-4 text-ink/20 hover:text-brand transition-colors"><Trash2 size={18} /></button>
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 font-sans text-xs font-black text-ink/40 uppercase tracking-widest"><User size={12} /> 參賽者</label>
                      <select value={p.name} onChange={e => updateParticipant(idx, "name", e.target.value)} className="w-full bg-paper p-2 font-sans text-base font-bold border border-line">
                        <option value="Davis">Davis</option>
                        <option value="Rose">Rose</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block font-sans text-[10px] font-black text-ink/40 uppercase tracking-widest">賽事距離</label>
                        <select value={p.distance ?? ""} onChange={e => updateParticipant(idx, "distance", e.target.value)} className="w-full bg-paper p-2 font-sans text-sm font-bold border border-line">
                          {distances.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div id={`field-participant_time_${idx}`} className="space-y-2">
                        <label className="block font-sans text-[10px] font-black text-ink/40 uppercase tracking-widest">完賽時間</label>
                        <input
                          type="text"
                          value={p.time || ""}
                          onChange={e => { updateParticipant(idx, "time", e.target.value); setErrors(v => ({ ...v, [`participant_time_${idx}`]: undefined })); }}
                          className={`w-full bg-paper p-2 font-mono text-sm font-bold border-2 ${errBorder(`participant_time_${idx}`)}`}
                          placeholder="00:00:00"
                        />
                        {errors[`participant_time_${idx}`] && <p className="text-brand text-[10px] font-sans font-bold">{errors[`participant_time_${idx}`]}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line/50">
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">里程 (km)</label>
                        <input type="number" step="0.001" value={p.stats?.distance_km ?? ""} onChange={e => updateParticipant(idx, "stats.distance_km", parseFloat(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">全馬累計</label>
                        <input type="number" value={p.stats?.FM_count ?? ""} onChange={e => updateParticipant(idx, "stats.FM_count", parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">半馬累計</label>
                        <input type="number" value={p.stats?.HM_count ?? ""} onChange={e => updateParticipant(idx, "stats.HM_count", parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">超馬累計</label>
                        <input type="number" value={p.stats?.UM_count ?? ""} onChange={e => updateParticipant(idx, "stats.UM_count", parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
