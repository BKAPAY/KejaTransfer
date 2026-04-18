// Supported countries on the platform
const SUPPORTED_COUNTRIES = [
  "BJ", "CI", "SN", "BF", "TG", "ML", "GN", "NE",
  "CM", "CD", "TD", "CG", "CF", "GA", "RW", "GM",
  "GH", "KE", "TZ", "UG", "ZM", "MW", "MZ", "NG", "SL", "LS"
];

// Timezone → country code mapping for African countries
const TIMEZONE_COUNTRY: Record<string, string> = {
  "Africa/Porto-Novo": "BJ",
  "Africa/Cotonou": "BJ",
  "Africa/Abidjan": "CI",
  "Africa/Dakar": "SN",
  "Africa/Ouagadougou": "BF",
  "Africa/Lome": "TG",
  "Africa/Bamako": "ML",
  "Africa/Conakry": "GN",
  "Africa/Niamey": "NE",
  "Africa/Douala": "CM",
  "Africa/Kinshasa": "CD",
  "Africa/Lubumbashi": "CD",
  "Africa/Ndjamena": "TD",
  "Africa/Brazzaville": "CG",
  "Africa/Bangui": "CF",
  "Africa/Libreville": "GA",
  "Africa/Kigali": "RW",
  "Africa/Banjul": "GM",
  "Africa/Accra": "GH",
  "Africa/Nairobi": "KE",
  "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kampala": "UG",
  "Africa/Lusaka": "ZM",
  "Africa/Blantyre": "MW",
  "Africa/Maputo": "MZ",
  "Africa/Lagos": "NG",
  "Africa/Freetown": "SL",
  "Africa/Maseru": "LS",
};

export interface DetectResult {
  country: string | null;
  detected: boolean;
}

/**
 * Detect country from user's browser (real IP via api.country.is,
 * fallback to timezone mapping).
 */
export async function detectCountryClient(): Promise<DetectResult> {
  // --- 1. Try api.country.is (HTTPS, CORS enabled, no API key) ---
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://api.country.is", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const code: string = data?.country ?? "";
      if (code && SUPPORTED_COUNTRIES.includes(code)) {
        console.log(`[GeoIP] api.country.is → ${code}`);
        return { country: code, detected: true };
      }
    }
  } catch {
    // network error or timeout → fall through
  }

  // --- 2. Try ipapi.co (HTTPS, CORS enabled) ---
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const code: string = data?.country_code ?? data?.country ?? "";
      if (code && SUPPORTED_COUNTRIES.includes(code)) {
        console.log(`[GeoIP] ipapi.co → ${code}`);
        return { country: code, detected: true };
      }
    }
  } catch {
    // fall through
  }

  // --- 3. Timezone fallback ---
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const code = TIMEZONE_COUNTRY[tz] ?? null;
    if (code && SUPPORTED_COUNTRIES.includes(code)) {
      console.log(`[GeoIP] timezone (${tz}) → ${code}`);
      return { country: code, detected: true };
    }
  } catch {
    // no Intl support
  }

  return { country: null, detected: false };
}
