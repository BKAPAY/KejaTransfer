import { CURRENCY_CONVERSION_RATES, CURRENCIES } from "@shared/schema";

export function convertCurrency(
  amountXOF: number,
  targetCurrency: string = "XOF"
): number {
  const rate = CURRENCY_CONVERSION_RATES[targetCurrency] || 1;
  return Math.round(amountXOF * rate * 100) / 100;
}

export function formatCurrency(
  amountXOF: number,
  currency: string = "XOF"
): string {
  const converted = convertCurrency(amountXOF, currency);
  const currencyInfo = CURRENCIES.find((c) => c.code === currency);
  const symbol = currencyInfo?.symbol || currency;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(converted);
}

export function getCurrencyLabel(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency ? `${currency.name} (${currency.code})` : code;
}
