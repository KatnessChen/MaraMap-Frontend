// 台灣地名顯示用格式化：去掉行政單位後綴（台北市 → 台北、新竹縣 → 新竹）。
// 只處理台灣，避免誤動到其他國家的地名（例如「胡志明市」不應被截斷）。

const TW_COUNTRY_NAMES = ["台灣", "臺灣", "Taiwan"];

const isTaiwan = (country?: string | null) =>
  !!country && TW_COUNTRY_NAMES.includes(country.trim());

/**
 * 顯示城市名時去掉台灣的「市」/「縣」單位。
 * 非台灣、空值、或無單位者原樣回傳。
 */
export function formatCityName(city?: string | null, country?: string | null): string {
  const name = (city ?? "").trim();
  if (!name || !isTaiwan(country)) return name;
  // 只去掉結尾的「市」或「縣」；若整串就是單位字元則保留原樣。
  return name.replace(/[市縣]$/u, "") || name;
}
