import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MBIYOPAY_CURRENCY_INFO, getMbiyoPayCurrenciesForCountry, hasMultipleCurrencies } from "@shared/mbiyopay-countries";

interface CurrencySelectorProps {
  countryCode: string;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  className?: string;
}

export function CurrencySelector({
  countryCode,
  selectedCurrency,
  onCurrencyChange,
  className = "",
}: CurrencySelectorProps) {
  if (!hasMultipleCurrencies(countryCode)) {
    return null;
  }

  const currencies = getMbiyoPayCurrenciesForCountry(countryCode);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium">Devise</Label>
      <div className="flex flex-wrap gap-4">
        {currencies.map((currency) => {
          const currencyInfo = MBIYOPAY_CURRENCY_INFO[currency];
          const isSelected = selectedCurrency === currency;

          return (
            <div
              key={currency}
              className="flex items-center space-x-2"
            >
              <Checkbox
                id={`currency-${currency}`}
                checked={isSelected}
                onCheckedChange={() => onCurrencyChange(currency)}
                data-testid={`checkbox-currency-${currency.toLowerCase()}`}
              />
              <Label
                htmlFor={`currency-${currency}`}
                className={`cursor-pointer text-sm ${isSelected ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {currencyInfo?.symbol || currency} ({currencyInfo?.name || currency})
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getCurrencyLabel(currency: string): string {
  const currencyInfo = MBIYOPAY_CURRENCY_INFO[currency];
  return currencyInfo?.symbol || currency;
}

export function getCurrencyFullName(currency: string): string {
  const currencyInfo = MBIYOPAY_CURRENCY_INFO[currency];
  return currencyInfo?.name || currency;
}
