import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Building2, TrendingUp } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { CountryFlag } from "@/components/country-flag";
import type { User } from "@shared/schema";

interface BusinessWallet {
  id: string;
  userId: string;
  country: string;
  currency: string;
  balance: number;
}

const COUNTRY_INFO: Record<string, { name: string; currency: string }> = {
  BJ: { name: "Bénin", currency: "XOF" },
  TG: { name: "Togo", currency: "XOF" },
  CI: { name: "Côte d'Ivoire", currency: "XOF" },
  BF: { name: "Burkina Faso", currency: "XOF" },
  SN: { name: "Sénégal", currency: "XOF" },
  ML: { name: "Mali", currency: "XOF" },
  NE: { name: "Niger", currency: "XOF" },
  GN: { name: "Guinée", currency: "GNF" },
  GM: { name: "Gambie", currency: "GMD" },
  CM: { name: "Cameroun", currency: "XAF" },
  TD: { name: "Tchad", currency: "XAF" },
  CG: { name: "Congo-Brazzaville", currency: "XAF" },
  CF: { name: "Centrafrique", currency: "XAF" },
  GA: { name: "Gabon", currency: "XAF" },
  CD_CDF: { name: "RD Congo (CDF)", currency: "CDF" },
  CD_USD: { name: "RD Congo (USD)", currency: "USD" },
  RW: { name: "Rwanda", currency: "RWF" },
  KE: { name: "Kenya", currency: "KES" },
  TZ: { name: "Tanzanie", currency: "TZS" },
  UG: { name: "Ouganda", currency: "UGX" },
  ZM: { name: "Zambie", currency: "ZMW" },
  MW: { name: "Malawi", currency: "MWK" },
  MZ: { name: "Mozambique", currency: "MZN" },
  LS: { name: "Lesotho", currency: "LSL" },
  GH: { name: "Ghana", currency: "GHS" },
  NG: { name: "Nigeria", currency: "NGN" },
  SL: { name: "Sierra Leone", currency: "SLE" },
};

const WALLET_ORDER = [
  "BJ", "TG", "CI", "BF", "SN", "ML", "NE",
  "GN", "GM",
  "CM", "TD", "CG", "CF", "GA",
  "CD_CDF", "CD_USD",
  "RW", "KE", "TZ", "UG", "ZM", "MW", "MZ", "LS",
  "GH", "NG", "SL",
];

function formatCurrency(amount: number, currency: string): string {
  try {
    const hasDecimals = amount % 1 !== 0;
    const decimals = hasDecimals ? 2 : (currency === "USD" ? 2 : 0);
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount) + " " + currency;
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

function getWalletKey(country: string, currency: string): string {
  if (country === "CD") return `CD_${currency}`;
  return country;
}

function getCountryCodeFromKey(key: string): string {
  if (key === "CD_CDF" || key === "CD_USD") return "CD";
  return key;
}

export default function AdminBusinessWallets() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [, setLocation] = useLocation();

  const { data: userProfile, isLoading: profileLoading } = useQuery<User>({
    queryKey: ["/api/admin/business/users", userId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/user/${userId}/profile`);
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: wallets, isLoading: walletsLoading } = useQuery<BusinessWallet[]>({
    queryKey: ["/api/admin/business/users", userId, "wallets"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/business/users/${userId}/wallets`);
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: walletSettings } = useQuery<{ disabled: string[] }>({
    queryKey: ["/api/admin/business/disabled-wallet-countries"],
  });
  const disabledCountries: string[] = walletSettings?.disabled ?? [];

  const walletMap: Record<string, BusinessWallet> = {};
  if (wallets) {
    wallets.forEach(w => {
      const key = getWalletKey(w.country, w.currency);
      walletMap[key] = w;
    });
  }

  const sortedKeys = [
    ...WALLET_ORDER.filter(k => !disabledCountries.includes(getCountryCodeFromKey(k))),
    ...WALLET_ORDER.filter(k => disabledCountries.includes(getCountryCodeFromKey(k))),
  ];

  const isLoading = profileLoading || walletsLoading;
  const displayName = userProfile?.businessName || `${userProfile?.firstName ?? ""} ${userProfile?.lastName ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/dashboard/admin/business/management")}
          data-testid="button-back-wallets"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            {profileLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-business-name">
                {displayName || "Compte entreprise"}
              </h1>
            )}
            {profileLoading ? (
              <Skeleton className="h-4 w-32 mt-1" />
            ) : (
              <p className="text-sm text-muted-foreground">{userProfile?.email}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Wallets par pays — soldes en temps réel
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
                      <CountryFlag code={key.slice(0, 2)} size="md" className="flex-shrink-0" />
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
