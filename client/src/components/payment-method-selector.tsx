import { useState } from "react";
import { cn } from "@/lib/utils";
import mobileMoneyImage from "@assets/mobile_money-logo-1_1766663492110.png";
import cryptoImage from "@assets/cryptomonnaies-1-1100x733_1767970452802.jpg";

type PaymentMethod = "mobile_money" | "crypto";

interface PaymentMethodSelectorProps {
  defaultMethod?: PaymentMethod;
  onMethodChange?: (method: PaymentMethod) => void;
  mobileMoneyContent: React.ReactNode;
  cryptoContent?: React.ReactNode;
  showCrypto?: boolean;
  className?: string;
}

export function PaymentMethodSelector({
  defaultMethod = "mobile_money",
  onMethodChange,
  mobileMoneyContent,
  cryptoContent,
  showCrypto = true,
  className,
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(defaultMethod);

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    onMethodChange?.(method);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("grid gap-3", showCrypto ? "grid-cols-2" : "grid-cols-1")}>
        <button
          type="button"
          onClick={() => handleMethodChange("mobile_money")}
          className={cn(
            "relative rounded-lg border-2 p-2 transition-all duration-200 hover-elevate",
            selectedMethod === "mobile_money"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/50"
          )}
          data-testid="button-select-mobile-money"
        >
          <img
            src={mobileMoneyImage}
            alt="Mobile Money"
            className="w-full h-16 object-contain rounded"
          />
          <span className="block mt-2 text-xs font-medium text-foreground">
            Mobile Money
          </span>
          {selectedMethod === "mobile_money" && (
            <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary" />
          )}
        </button>

        {showCrypto && (
          <button
            type="button"
            onClick={() => handleMethodChange("crypto")}
            className={cn(
              "relative rounded-lg border-2 p-2 transition-all duration-200 hover-elevate",
              selectedMethod === "crypto"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:border-primary/50"
            )}
            data-testid="button-select-crypto"
          >
            <img
              src={cryptoImage}
              alt="Cryptomonnaie"
              className="w-full h-16 object-contain rounded"
            />
            <span className="block mt-2 text-xs font-medium text-foreground">
              Cryptomonnaie
            </span>
            {selectedMethod === "crypto" && (
              <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary" />
            )}
          </button>
        )}
      </div>

      {selectedMethod === "mobile_money" && (
        <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          {mobileMoneyContent}
        </div>
      )}

      {selectedMethod === "crypto" && showCrypto && cryptoContent && (
        <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          {cryptoContent}
        </div>
      )}
    </div>
  );
}
