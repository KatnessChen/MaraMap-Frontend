// Shared location data + form helpers used by the admin post editor
// (/admin/edit/[id]) and the new-post form (/admin/new). Extracted so both
// screens stay in sync — a country/city added here shows up in both.

// ── Location data (continent → country → cities) ──────────────
export type CityEntry = { zh: string; en: string };
export type LocationData = Record<string, Record<string, CityEntry[]>>;

export const LOCATION_DATA: LocationData = {
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

export const CONTINENTS = Object.keys(LOCATION_DATA);

export const COUNTRY_EN_MAP: Record<string, string> = {
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

export function countryOption(zh: string): { label: string; value: string } {
  const en = COUNTRY_EN_MAP[zh];
  return { label: en ? `${zh}（${en}）` : zh, value: zh };
}

export function getCountries(continent: string): { label: string; value: string }[] {
  return Object.keys(LOCATION_DATA[continent] || {}).map(countryOption);
}

export function getCityOptions(continent: string, country: string): { label: string; value: string }[] {
  return (LOCATION_DATA[continent]?.[country] || []).map(c => ({ label: `${c.zh}（${c.en}）`, value: c.zh }));
}

// Flat fallbacks for when continent/country not yet selected
export const ALL_COUNTRIES = [...new Set(Object.values(LOCATION_DATA).flatMap(c => Object.keys(c)))].map(countryOption);
export const ALL_CITY_OPTIONS = [...new Set(
  Object.values(LOCATION_DATA).flatMap(c => Object.values(c).flat())
)].map(c => ({ label: `${c.zh}（${c.en}）`, value: c.zh }));

// ── Combobox option helpers ────────────────────────────────────
export type ComboOption = string | { label: string; value: string };
export const getLabel = (o: ComboOption) => typeof o === "string" ? o : o.label;
export const getValue = (o: ComboOption) => typeof o === "string" ? o : o.value;

// ── Marathon distance / time helpers ───────────────────────────
export const DISTANCE_KM_MAP: Record<string, number | null> = {
  全馬: 42.195,
  半馬: 21.0975,
  超馬: null,
  "10K": 10,
  "5K": 5,
};

export const TIME_REGEX = /^\d+:\d{2}:\d{2}$/;

export function isValidDate(val: string) {
  return !!val && !isNaN(new Date(val).getTime());
}
