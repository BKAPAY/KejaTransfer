const EXCHANGERATE_API_KEY = process.env.EXCHANGERATE_API_KEY;
const EXCHANGERATE_API_URL = "https://v6.exchangerate-api.com/v6";

if (!EXCHANGERATE_API_KEY) {
  console.warn("[CurrencyConverter] EXCHANGERATE_API_KEY not configured");
}

// Currencies that don't use decimal places (African francs, etc.)
const NO_DECIMAL_CURRENCIES = ["XOF", "XAF", "CDF", "GNF", "GMD", "RWF"];

function getCurrencyDecimals(currency: string): number {
  return NO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
}

function roundToDecimals(amount: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) {
    return Math.round(amount);
  }
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

export interface ConversionResult {
  success: boolean;
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  conversionRate: number;
  error?: string;
}

const rateCache: Map<string, { rate: number; timestamp: number }> = new Map();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<ConversionResult> {
  if (!EXCHANGERATE_API_KEY) {
    return {
      success: false,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount,
      targetCurrency: toCurrency,
      conversionRate: 1,
      error: "API de conversion non configurée",
    };
  }

  const cacheKey = `${fromCurrency}_${toCurrency}`;
  const cachedRate = rateCache.get(cacheKey);
  
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION_MS) {
    const convertedAmount = roundToDecimals(amount * cachedRate.rate, toCurrency);
    console.log(`[CurrencyConverter] Using cached rate: ${fromCurrency} -> ${toCurrency} = ${cachedRate.rate}`);
    return {
      success: true,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount,
      targetCurrency: toCurrency,
      conversionRate: cachedRate.rate,
    };
  }

  try {
    const url = `${EXCHANGERATE_API_URL}/${EXCHANGERATE_API_KEY}/pair/${fromCurrency}/${toCurrency}/${amount}`;
    console.log(`[CurrencyConverter] Fetching rate: ${fromCurrency} -> ${toCurrency}`);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.result === "success") {
      rateCache.set(cacheKey, {
        rate: data.conversion_rate,
        timestamp: Date.now(),
      });

      const convertedAmount = roundToDecimals(data.conversion_result, toCurrency);
      console.log(`[CurrencyConverter] Converted ${amount} ${fromCurrency} -> ${convertedAmount} ${toCurrency} (rate: ${data.conversion_rate})`);
      
      return {
        success: true,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount,
        targetCurrency: toCurrency,
        conversionRate: data.conversion_rate,
      };
    } else {
      console.error("[CurrencyConverter] API error:", data["error-type"]);
      return {
        success: false,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount,
        targetCurrency: toCurrency,
        conversionRate: 1,
        error: `Erreur de conversion: ${data["error-type"]}`,
      };
    }
  } catch (error: any) {
    console.error("[CurrencyConverter] Error:", error);
    return {
      success: false,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount,
      targetCurrency: toCurrency,
      conversionRate: 1,
      error: "Erreur de connexion au service de conversion",
    };
  }
}

export async function convertXofToGnf(amountXof: number): Promise<ConversionResult> {
  return convertCurrency(amountXof, "XOF", "GNF");
}

export async function getConversionRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const result = await convertCurrency(1, fromCurrency, toCurrency);
  return result.success ? result.conversionRate : null;
}

export function getCurrencyForCountry(countryCode: string): string {
  const countryCurrencies: Record<string, string> = {
    bj: "XOF",
    tg: "XOF",
    ci: "XOF",
    sn: "XOF",
    bf: "XOF",
    ml: "XOF",
    ne: "XOF",
    gn: "GNF",
    cm: "XAF",
    td: "XAF",
    cg: "XAF",
    cf: "XAF",
    ga: "XAF",
    cd: "CDF",
    rw: "RWF",
  };
  return countryCurrencies[countryCode.toLowerCase()] || "XOF";
}

export function needsCurrencyConversion(countryCode: string): boolean {
  const currency = getCurrencyForCountry(countryCode);
  return currency !== "XOF";
}

export async function convertXofToTargetCurrency(amountXof: number, countryCode: string): Promise<ConversionResult> {
  const targetCurrency = getCurrencyForCountry(countryCode);
  if (targetCurrency === "XOF") {
    return {
      success: true,
      originalAmount: amountXof,
      originalCurrency: "XOF",
      convertedAmount: amountXof,
      targetCurrency: "XOF",
      conversionRate: 1,
    };
  }
  return convertCurrency(amountXof, "XOF", targetCurrency);
}
