// zh country name (same as country_translations.zh / fb_posts.metadata.country)
// -> ISO 3166-1 alpha-2 code. Add a new entry here whenever a new country is
// added to the backend's country_translations table — flags aren't derived
// automatically, an unmapped country just shows no flag (see getCountryFlag).
const COUNTRY_ISO2: Record<string, string> = {
  "台灣": "TW", "中國": "CN", "香港": "HK", "澳門": "MO", "泰國": "TH",
  "馬來西亞": "MY", "新加坡": "SG", "挪威": "NO", "葡萄牙": "PT", "格陵蘭": "GL",
  "澳洲": "AU", "柬埔寨": "KH", "日本": "JP", "加拿大": "CA", "法國": "FR",
  "奧地利": "AT", "美國": "US", "英國": "GB", "德國": "DE", "義大利": "IT",
  "西班牙": "ES", "荷蘭": "NL", "瑞典": "SE", "丹麥": "DK", "芬蘭": "FI",
  "瑞士": "CH", "比利時": "BE", "捷克": "CZ", "波蘭": "PL", "匈牙利": "HU",
  "希臘": "GR", "土耳其": "TR", "以色列": "IL", "印度": "IN", "韓國": "KR",
  "越南": "VN", "印尼": "ID", "菲律賓": "PH", "紐西蘭": "NZ", "南非": "ZA",
  "巴西": "BR", "阿根廷": "AR", "墨西哥": "MX", "俄羅斯": "RU", "蒙古": "MN",
  "智利": "CL", "秘魯": "PE", "摩洛哥": "MA", "寮國": "LA", "冰島": "IS",
  "法羅群島": "FO", "南極": "AQ", "帛琉": "PW", "緬甸": "MM", "尼泊爾": "NP",
  "斯里蘭卡": "LK", "阿拉伯聯合大公國": "AE", "卡達": "QA", "愛爾蘭": "IE",
  "克羅埃西亞": "HR", "斯洛維尼亞": "SI", "立陶宛": "LT", "拉脫維亞": "LV",
  "愛沙尼亞": "EE", "羅馬尼亞": "RO", "保加利亞": "BG", "塞爾維亞": "RS",
  "哥倫比亞": "CO", "厄瓜多": "EC", "斐濟": "FJ", "埃及": "EG", "肯亞": "KE",
  "衣索比亞": "ET", "坦尚尼亞": "TZ",
};

function flagEmojiFromIso2(code: string): string {
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map(c => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Flag emoji for a zh country name; "" if unknown (never throws — same
 *  graceful-fallback contract as the backend's raceEn()/mountainEn()). */
export function getCountryFlag(zh: string | null | undefined): string {
  if (!zh) return "";
  const code = COUNTRY_ISO2[zh.trim()];
  return code ? flagEmojiFromIso2(code) : "";
}
