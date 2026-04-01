import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, TrendingUp } from "lucide-react";
import type { User } from "@shared/schema";

interface BusinessWallet {
  id: string;
  userId: string;
  country: string;
  currency: string;
  balance: number;
}

const COUNTRY_INFO: Record<string, { name: string; flag: string; currency: string }> = {
  // Afrique de l'Ouest — XOF
  BJ: { name: "Bénin", flag: "🇧🇯", currency: "XOF" },
  TG: { name: "Togo", flag: "🇹🇬", currency: "XOF" },
  CI: { name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF" },
  BF: { name: "Burkina Faso", flag: "🇧🇫", currency: "XOF" },
  SN: { name: "Sénégal", flag: "🇸🇳", currency: "XOF" },
  ML: { name: "Mali", flag: "🇲🇱", currency: "XOF" },
  NE: { name: "Niger", flag: "🇳🇪", currency: "XOF" },
  // Afrique de l'Ouest — autres devises
  GN: { name: "Guinée", flag: "🇬🇳", currency: "GNF" },
  GM: { name: "Gambie", flag: "🇬🇲", currency: "GMD" },
  // Afrique Centrale — XAF
  CM: { name: "Cameroun", flag: "🇨🇲", currency: "XAF" },
  TD: { name: "Tchad", flag: "🇹🇩", currency: "XAF" },
  CG: { name: "Congo-Brazzaville", flag: "🇨🇬", currency: "XAF" },
  CF: { name: "Centrafrique", flag: "🇨🇫", currency: "XAF" },
  GA: { name: "Gabon", flag: "🇬🇦", currency: "XAF" },
  // Afrique Centrale — autres devises
  CD_CDF: { name: "RD Congo (CDF)", flag: "🇨🇩", currency: "CDF" },
  CD_USD: { name: "RD Congo (USD)", flag: "🇨🇩", currency: "USD" },
  // Afrique de l'Est & Australe
  RW: { name: "Rwanda", flag: "🇷🇼", currency: "RWF" },
  KE: { name: "Kenya", flag: "🇰🇪", currency: "KES" },
  TZ: { name: "Tanzanie", flag: "🇹🇿", currency: "TZS" },
  UG: { name: "Ouganda", flag: "🇺🇬", currency: "UGX" },
  ZM: { name: "Zambie", flag: "🇿🇲", currency: "ZMW" },
  MW: { name: "Malawi", flag: "🇲🇼", currency: "MWK" },
  MZ: { name: "Mozambique", flag: "🇲🇿", currency: "MZN" },
  LS: { name: "Lesotho", flag: "🇱🇸", currency: "LSL" },
  // Afrique de l'Ouest — Anglophone
  GH: { name: "Ghana", flag: "🇬🇭", currency: "GHS" },
  NG: { name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
  SL: { name: "Sierra Leone", flag: "🇸🇱", currency: "SLE" },
};

const WALLET_ORDER = [
  // XOF
  "BJ", "TG", "CI", "BF", "SN", "ML", "NE",
  // Autres Afrique Ouest
  "GN", "GM",
  // XAF
  "CM", "TD", "CG", "CF", "GA",
  // RD Congo
  "CD_CDF", "CD_USD",
  // Afrique Est & Australe
  "RW", "KE", "TZ", "UG", "ZM", "MW", "MZ", "LS",
  // Anglophone
  "GH", "NG", "SL",
];

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

function getWalletKey(country: string, currency: string): string {
  if (country === "CD") {
    return `CD_${currency}`;
  }
  return country;
}

// Get the base country code from a WALLET_ORDER key
function getCountryCodeFromKey(key: string): string {
  if (key === "CD_CDF" || key === "CD_USD") return "CD";
  return key;
}

export default function BusinessDashboard() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: wallets, isLoading } = useQuery<BusinessWallet[]>({
    queryKey: ["/api/business/wallets"],
  });

  const { data: walletSettings } = useQuery<{ disabled: string[] }>({
    queryKey: ["/api/business/wallet-country-settings"],
  });
  const disabledCountries: string[] = walletSettings?.disabled ?? [];

  const walletMap: Record<string, BusinessWallet> = {};
  if (wallets) {
    wallets.forEach(w => {
      const key = getWalletKey(w.country, w.currency);
      walletMap[key] = w;
    });
  }

  const XOF_KEYS = ["BJ", "TG", "CI", "BF", "SN", "ML", "NE"];
  const totalXOF = XOF_KEYS.reduce((sum, key) => sum + (walletMap[key]?.balance || 0), 0);

  // Sort: enabled wallets first, disabled last (keep original order within each group)
  const sortedKeys = [
    ...WALLET_ORDER.filter(k => !disabledCountries.includes(getCountryCodeFromKey(k))),
    ...WALLET_ORDER.filter(k => disabledCountries.includes(getCountryCodeFromKey(k))),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user?.businessName || "Tableau de bord Entreprise"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.firstName} {user?.lastName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Wallets par pays — les paiements collectés dans chaque pays alimentent le wallet correspondant
        </span>
      </div>

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))
          : sortedKeys.map(key => {
              const info = COUNTRY_INFO[key];
              if (!info) return null;
              const wallet = walletMap[key];
              const balance = wallet?.balance || 0;
              const isPositive = balance > 0;
              const countryCode = getCountryCodeFromKey(key);
              const isDisabled = disabledCountries.includes(countryCode);

              return (
                <Card
                  key={key}
                  data-testid={`wallet-card-${key.toLowerCase()}`}
                  className={`transition-all duration-200 ${isDisabled ? "opacity-60 pointer-events-none select-none" : ""}`}
                >
                  <CardContent className="py-4 px-5 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl flex-shrink-0">{info.flag}</span>
                      <p className="font-medium leading-tight">{info.name}</p>
                      {isDisabled ? (
                        <Badge variant="secondary" className="text-xs ml-auto">
                          Indisponible
                        </Badge>
                      ) : isPositive ? (
                        <Badge variant="secondary" className="text-xs ml-auto">
                          Actif
                        </Badge>
                      ) : null}
                    </div>
                    <p
                      className={`font-bold text-xl tabular-nums ${
                        isPositive && !isDisabled ? "text-foreground" : "text-muted-foreground"
                      }`}
                      data-testid={`wallet-balance-${key.toLowerCase()}`}
                    >
                      {formatCurrency(balance, info.currency)}
                    </p>
                  </CardContent>
                </Card>
              );
            })
        }
      </div>
    </div>
  );
}
