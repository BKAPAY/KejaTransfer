import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BJ: { name: "Bénin", flag: "🇧🇯", currency: "XOF" },
  TG: { name: "Togo", flag: "🇹🇬", currency: "XOF" },
  CI: { name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF" },
  BF: { name: "Burkina Faso", flag: "🇧🇫", currency: "XOF" },
  CM: { name: "Cameroun", flag: "🇨🇲", currency: "XAF" },
  CD_CDF: { name: "RD Congo", flag: "🇨🇩", currency: "CDF" },
  CD_USD: { name: "RD Congo", flag: "🇨🇩", currency: "USD" },
  GA: { name: "Gabon", flag: "🇬🇦", currency: "XAF" },
  CG: { name: "Congo Brazzaville", flag: "🇨🇬", currency: "XAF" },
  SN: { name: "Sénégal", flag: "🇸🇳", currency: "XOF" },
  ZM: { name: "Zambie", flag: "🇿🇲", currency: "ZMW" },
  UG: { name: "Ouganda", flag: "🇺🇬", currency: "UGX" },
};

const WALLET_ORDER = ["BJ", "TG", "CI", "BF", "CM", "CD_CDF", "CD_USD", "GA", "CG", "SN", "ZM", "UG"];

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

export default function BusinessDashboard() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: wallets, isLoading } = useQuery<BusinessWallet[]>({
    queryKey: ["/api/business/wallets"],
  });

  const walletMap: Record<string, BusinessWallet> = {};
  if (wallets) {
    wallets.forEach(w => {
      const key = getWalletKey(w.country, w.currency);
      walletMap[key] = w;
    });
  }

  const totalXOF = WALLET_ORDER
    .filter(k => !k.startsWith("CD") && ["BJ", "TG", "CI", "BF", "SN"].includes(k))
    .reduce((sum, key) => sum + (walletMap[key]?.balance || 0), 0);

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
          : WALLET_ORDER.map(key => {
              const info = COUNTRY_INFO[key];
              if (!info) return null;
              const wallet = walletMap[key];
              const balance = wallet?.balance || 0;
              const isPositive = balance > 0;

              return (
                <Card
                  key={key}
                  data-testid={`wallet-card-${key.toLowerCase()}`}
                  className="transition-colors"
                >
                  <CardContent className="flex items-center justify-between gap-4 py-4 px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">{info.flag}</span>
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">{info.name}</p>
                        <p className="text-xs text-muted-foreground">{info.currency}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`font-bold text-lg tabular-nums ${
                          isPositive ? "text-foreground" : "text-muted-foreground"
                        }`}
                        data-testid={`wallet-balance-${key.toLowerCase()}`}
                      >
                        {formatCurrency(balance, info.currency)}
                      </p>
                      {isPositive && (
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          Actif
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
        }
      </div>
    </div>
  );
}
