import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import mobileMoneyImage from "@assets/mobile_money-logo-1_1766663492110.png";
import creditCardImage from "@assets/png-clipart-visa-mastercard-carte-de-credit-paylife-carte-de-p_1766663492228.png";

type PaymentMethod = "mobile_money" | "credit_card";

interface PaymentMethodSelectorProps {
  defaultMethod?: PaymentMethod;
  onMethodChange?: (method: PaymentMethod) => void;
  mobileMoneyContent: React.ReactNode;
  className?: string;
}

export function PaymentMethodSelector({
  defaultMethod = "mobile_money",
  onMethodChange,
  mobileMoneyContent,
  className,
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(defaultMethod);

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    onMethodChange?.(method);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-3">
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

        <button
          type="button"
          onClick={() => handleMethodChange("credit_card")}
          className={cn(
            "relative rounded-lg border-2 p-2 transition-all duration-200 hover-elevate",
            selectedMethod === "credit_card"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/50"
          )}
          data-testid="button-select-credit-card"
        >
          <img
            src={creditCardImage}
            alt="Carte Bancaire"
            className="w-full h-16 object-contain rounded"
          />
          <span className="block mt-2 text-xs font-medium text-foreground">
            Carte Bancaire
          </span>
          {selectedMethod === "credit_card" && (
            <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {selectedMethod === "mobile_money" && (
        <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          {mobileMoneyContent}
        </div>
      )}

      {selectedMethod === "credit_card" && (
        <Card className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  En cours de developpement
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Le paiement par carte bancaire sera bientot disponible. 
                  Veuillez utiliser Mobile Money pour effectuer votre paiement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
