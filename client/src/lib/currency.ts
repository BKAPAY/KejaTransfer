import { CURRENCY_CONVERSION_RATES, CURRENCIES } from "@shared/schema";

export function convertCurrency(
  amountXOF: number,
  targetCurrency: string = "XOF"
): number {
  const rate = CURRENCY_CONVERSION_RATES[targetCurrency] || 1;
  return Math.round(amountXOF * rate * 100) / 100;
}

// Currencies that don't use decimal places (African francs)
const NO_DECIMAL_CURRENCIES = ["XOF", "XAF", "CDF", "GNF", "GMD", "RWF"];

export function getCurrencyDecimals(currency: string): number {
  return NO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
}

export function formatCurrency(
  amountXOF: number,
  currency: string = "XOF"
): string {
  const converted = convertCurrency(amountXOF, currency);
  const decimals = getCurrencyDecimals(currency);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted);
}

// Format amount in its own currency (no conversion)
export function formatAmountInCurrency(
  amount: number,
  currency: string = "XOF"
): string {
  const decimals = getCurrencyDecimals(currency);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function getCurrencyLabel(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency ? `${currency.name} (${currency.code})` : code;
}
