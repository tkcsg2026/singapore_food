/**
 * Country-name translation helpers for supplier products.
 *
 * Many supplier products only have `country_of_origin` (Japanese) filled in
 * and leave `country_of_origin_en` empty. Without these helpers, the product
 * card would show "日本" even when the UI is switched to English.
 *
 * The maps below cover the country names most commonly seen for Japan-side
 * imports. Anything not in the map falls back to the raw value so we never
 * silently lose data.
 */

const JA_TO_EN: Record<string, string> = {
  "日本": "Japan",
  "国産": "Japan",
  "日本産": "Japan",
  "中国": "China",
  "中国産": "China",
  "台湾": "Taiwan",
  "台湾産": "Taiwan",
  "韓国": "Korea",
  "韓国産": "Korea",
  "タイ": "Thailand",
  "タイ産": "Thailand",
  "ベトナム": "Vietnam",
  "ベトナム産": "Vietnam",
  "マレーシア": "Malaysia",
  "マレーシア産": "Malaysia",
  "インドネシア": "Indonesia",
  "インドネシア産": "Indonesia",
  "フィリピン": "Philippines",
  "シンガポール": "Singapore",
  "シンガポール産": "Singapore",
  "インド": "India",
  "アメリカ": "USA",
  "アメリカ合衆国": "USA",
  "米国": "USA",
  "米国産": "USA",
  "カナダ": "Canada",
  "メキシコ": "Mexico",
  "ブラジル": "Brazil",
  "アルゼンチン": "Argentina",
  "オーストラリア": "Australia",
  "豪州": "Australia",
  "ニュージーランド": "New Zealand",
  "イギリス": "UK",
  "英国": "UK",
  "フランス": "France",
  "イタリア": "Italy",
  "スペイン": "Spain",
  "ドイツ": "Germany",
  "オランダ": "Netherlands",
  "ベルギー": "Belgium",
  "スイス": "Switzerland",
  "ロシア": "Russia",
  "ノルウェー": "Norway",
  "デンマーク": "Denmark",
  "アイスランド": "Iceland",
  "チリ": "Chile",
  "ペルー": "Peru",
  "南アフリカ": "South Africa",
};

const EN_TO_JA: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [ja, en] of Object.entries(JA_TO_EN)) {
    if (!m[en]) m[en] = ja;
  }
  return m;
})();

/** True when the string contains any CJK / Japanese character. */
function hasJapanese(s: string): boolean {
  return /[぀-ゟ゠-ヿ一-龯々ー]/.test(s);
}

/**
 * Pick the best label for a product's country of origin in the active language.
 *
 * @param ja  the saved Japanese-side value (`country_of_origin`)
 * @param en  the saved English-side value (`country_of_origin_en`) — may be empty
 * @param lang current UI language
 * @returns translated label, or empty string when nothing was provided
 */
export function displayCountryOfOrigin(
  ja: string | null | undefined,
  en: string | null | undefined,
  lang: "en" | "ja",
): string {
  const rawJa = (ja ?? "").trim();
  const rawEn = (en ?? "").trim();

  if (lang === "ja") {
    if (rawJa) return rawJa;
    if (rawEn) return EN_TO_JA[rawEn] ?? rawEn;
    return "";
  }

  // EN view
  if (rawEn) return rawEn;
  if (!rawJa) return "";
  // Strip a few common wrappers ("〇〇産") before lookup
  const stripped = rawJa.replace(/[（(].*?[)）]\s*$/u, "").trim();
  if (JA_TO_EN[stripped]) return JA_TO_EN[stripped];
  if (JA_TO_EN[rawJa]) return JA_TO_EN[rawJa];
  // Fall back to the raw value only when it doesn't contain Japanese characters,
  // otherwise we'd render Japanese text in an English-language view.
  return hasJapanese(rawJa) ? rawJa : rawJa;
}
