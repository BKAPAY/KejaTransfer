import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";
import airtelImage from "@assets/image_search_1771486869310_1771487355059.png";
import mpesaImage from "@assets/image_search_1771486907537_1771487355101.png";
import celtiisImage from "@assets/image_search_1771486943445_1771487355123.jpg";
import expressoImage from "@assets/image_search_1771487048520_1771487355151.png";
import corisImage from "@assets/image_search_1771487069905_1771487355176.png";
import afrimoneyImage from "@assets/image_search_1771487089985_1771487355198.png";
import qmoneyImage from "@assets/image_search_1771487154605_1771487355255.jpg";
import telecelImage from "@assets/image_search_1771487186999_1771487355289.jpg";

interface Operator {
  readonly code: string;
  readonly name: string;
  readonly requiresOtp?: boolean;
}

interface OperatorSelectorProps {
  operators: readonly Operator[];
  selectedOperator: string | undefined;
  onSelect: (code: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  disabledOperators?: Record<string, string>;
}

const OPERATOR_LOGOS: Record<string, { image?: string; color: string; bgColor: string; textColor: string }> = {
  orange: { image: omImage, color: "#FF6600", bgColor: "bg-orange-100 dark:bg-orange-950", textColor: "text-orange-600 dark:text-orange-400" },
  mtn: { image: mtnImage, color: "#FFCC00", bgColor: "bg-yellow-100 dark:bg-yellow-950", textColor: "text-yellow-600 dark:text-yellow-500" },
  moov: { image: moovImage, color: "#0066CC", bgColor: "bg-blue-100 dark:bg-blue-950", textColor: "text-blue-600 dark:text-blue-400" },
  wave: { image: waveImage, color: "#1E3A8A", bgColor: "bg-indigo-100 dark:bg-indigo-950", textColor: "text-indigo-600 dark:text-indigo-400" },
  free: { image: freeImage, color: "#E53935", bgColor: "bg-red-100 dark:bg-red-950", textColor: "text-red-600 dark:text-red-400" },
  airtel: { image: airtelImage, color: "#ED1C24", bgColor: "bg-red-100 dark:bg-red-950", textColor: "text-red-600 dark:text-red-400" },
  mpesa: { image: mpesaImage, color: "#4CAF50", bgColor: "bg-green-100 dark:bg-green-950", textColor: "text-green-600 dark:text-green-400" },
  celtiis: { image: celtiisImage, color: "#9C27B0", bgColor: "bg-purple-100 dark:bg-purple-950", textColor: "text-purple-600 dark:text-purple-400" },
  tmoney: { image: tmonyImage, color: "#00897B", bgColor: "bg-teal-100 dark:bg-teal-950", textColor: "text-teal-600 dark:text-teal-400" },
  togocom: { image: tmonyImage, color: "#00897B", bgColor: "bg-teal-100 dark:bg-teal-950", textColor: "text-teal-600 dark:text-teal-400" },
  expresso: { image: expressoImage, color: "#673AB7", bgColor: "bg-violet-100 dark:bg-violet-950", textColor: "text-violet-600 dark:text-violet-400" },
  coris: { image: corisImage, color: "#FF9800", bgColor: "bg-amber-100 dark:bg-amber-950", textColor: "text-amber-600 dark:text-amber-400" },
  afrimoney: { image: afrimoneyImage, color: "#2196F3", bgColor: "bg-sky-100 dark:bg-sky-950", textColor: "text-sky-600 dark:text-sky-400" },
  qmoney: { image: qmoneyImage, color: "#607D8B", bgColor: "bg-slate-100 dark:bg-slate-800", textColor: "text-slate-600 dark:text-slate-400" },
  telecel: { image: telecelImage, color: "#795548", bgColor: "bg-stone-100 dark:bg-stone-900", textColor: "text-stone-600 dark:text-stone-400" },
  wizall: { image: wizallImage, color: "#00BCD4", bgColor: "bg-cyan-100 dark:bg-cyan-950", textColor: "text-cyan-600 dark:text-cyan-400" },
  // PawaPay operators (East & Southern Africa)
  vodafone: { color: "#E60000", bgColor: "bg-red-100 dark:bg-red-950", textColor: "text-red-600 dark:text-red-400" },
  airteltigo: { image: airtelImage, color: "#ED1C24", bgColor: "bg-red-100 dark:bg-red-950", textColor: "text-red-600 dark:text-red-400" },
  vodacom: { color: "#E60000", bgColor: "bg-red-100 dark:bg-red-950", textColor: "text-red-600 dark:text-red-400" },
  tigo: { color: "#0072BC", bgColor: "bg-blue-100 dark:bg-blue-950", textColor: "text-blue-600 dark:text-blue-400" },
  halotel: { color: "#00A651", bgColor: "bg-green-100 dark:bg-green-950", textColor: "text-green-600 dark:text-green-400" },
  tnm: { color: "#002868", bgColor: "bg-blue-100 dark:bg-blue-950", textColor: "text-blue-700 dark:text-blue-400" },
  movitel: { color: "#00A651", bgColor: "bg-emerald-100 dark:bg-emerald-950", textColor: "text-emerald-600 dark:text-emerald-400" },
  zamtel: { color: "#009A44", bgColor: "bg-green-100 dark:bg-green-950", textColor: "text-green-700 dark:text-green-400" },
};

function getOperatorStyle(code: string) {
  return OPERATOR_LOGOS[code.toLowerCase()] || { 
    color: "#6B7280", 
    bgColor: "bg-gray-100 dark:bg-gray-800", 
    textColor: "text-gray-600 dark:text-gray-400" 
  };
}

function getOperatorInitials(name: string): string {
  const words = name.split(" ");
  if (words.length === 1) {
    return name.slice(0, 2).toUpperCase();
  }
  return words.map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function OperatorSelector({ 
  operators, 
  selectedOperator, 
  onSelect, 
  disabled = false,
  isLoading = false,
  disabledOperators = {},
}: OperatorSelectorProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className="h-16 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (operators.length === 0) {
    return null;
  }

  const activeDisabledMessage = selectedOperator
    ? disabledOperators[selectedOperator.toLowerCase()]
    : undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {operators.map((op) => {
          const style = getOperatorStyle(op.code);
          const isSelected = selectedOperator === op.code;
          const isOpDisabled = !!disabledOperators[op.code.toLowerCase()];
          
          return (
            <button
              key={op.code}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(op.code)}
              data-testid={`operator-${op.code}`}
              className={cn(
                "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200",
                "min-h-[70px] hover-elevate",
                isSelected && isOpDisabled
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                  : isSelected 
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md" 
                    : "border-border hover:border-primary/50 bg-card",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSelected && !isOpDisabled && (
                <div className="absolute top-1 right-1">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              {isSelected && isOpDisabled && (
                <div className="absolute top-1 right-1">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
              )}
              
              {style.image ? (
                <img 
                  src={style.image} 
                  alt={op.name} 
                  className={cn(
                    "w-10 h-10 object-contain rounded-full",
                    isOpDisabled && "opacity-60"
                  )}
                />
              ) : (
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                  style.bgColor,
                  style.textColor,
                  isOpDisabled && "opacity-60"
                )}>
                  {getOperatorInitials(op.name)}
                </div>
              )}
              
              <span className={cn(
                "mt-1.5 text-xs font-medium text-center leading-tight",
                isSelected && isOpDisabled
                  ? "text-amber-700 dark:text-amber-400"
                  : isSelected 
                    ? "text-primary" 
                    : "text-foreground"
              )}>
                {op.name}
              </span>
            </button>
          );
        })}
      </div>

      {activeDisabledMessage && (
        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            {activeDisabledMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
