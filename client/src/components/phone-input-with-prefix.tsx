import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@shared/schema";
import { cn } from "@/lib/utils";

interface PhoneInputWithPrefixProps {
  country: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function PhoneInputWithPrefix({
  country,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  "data-testid": testId,
}: PhoneInputWithPrefixProps) {
  const countryData = COUNTRIES.find(c => c.code === country);
  const phoneCode = countryData?.phoneCode || "";
  const phoneDigits = countryData?.phoneDigits || 10;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/\D/g, "");
    if (inputValue.length <= phoneDigits) {
      onChange(inputValue);
    }
  };

  return (
    <div className={cn("flex", className)}>
      {country && phoneCode && (
        <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium text-muted-foreground min-w-[60px]">
          {phoneCode}
        </div>
      )}
      <Input
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder || `${phoneDigits} chiffres`}
        disabled={disabled || !country}
        className={cn(
          country && phoneCode ? "rounded-l-none" : "",
          "flex-1"
        )}
        data-testid={testId}
        maxLength={phoneDigits}
      />
    </div>
  );
}
