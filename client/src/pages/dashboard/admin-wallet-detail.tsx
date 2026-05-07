import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Banknote } from "lucide-react";
import { CountryFlag } from "@/components/country-flag";
import { Link } from "wouter";

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

const PERIOD_OPTIONS = [
  { label: "30 jours", days: 30 },
  { label: "60 jours", days: 60 },
  { label: "90 jours", days: 90 },
];

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Dépôt",
  payment_link: "Lien de paiement",
  merchant_link: "Lien marchand",
  api_payment: "Paiement API",
  withdrawal: "Retrait",
  transfer: "Transfert",
  api_payout: "Payout API",
};

const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];

function formatCurrency(amount: number, currency: string): string {
  try {
    const hasDecimals = amount % 1 !== 0;
    const decimals = hasDecimals ? 2 : currency === "USD" ? 2 : 0;
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount) + " " + currency;
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminWalletDetail() {
  const params = useParams<{ userId: string; country: string }>();
  const userId = params.userId || "";
  const countryKey = params.country || "";
  const info = COUNTRY_INFO[countryKey];
  const countryCode = countryKey.includes("_") ? "CD" : countryKey;

  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const queryParams = new URLSearchParams();
  if (useCustom && customFrom && customTo) {
    queryParams.set("from", customFrom);
    queryParams.set("to", customTo);
  } else {
    queryParams.set("days", String(selectedDays));
  }
  const currency = info?.currency;
  if (currency) queryParams.set("currency", currency);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/business/wallet-stats/${userId}/${countryKey}`, queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/business/wallet-stats/${userId}/${countryKey}?${queryParams}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!userId && !!countryKey,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/admin/business/users/${userId}/wallets`}>
          <Button variant="ghost" size="icon" data-testid="button-admin-wallet-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <CountryFlag code={countryCode} size="md" />
        <div>
          <h1 className="text-xl font-bold text-foreground">{info?.name ?? countryKey}</h1>
          <p className="text-xs text-muted-foreground">Détails du wallet — vue admin</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {PERIOD_OPTIONS.map(opt => (
          <Button
            key={opt.days}
            size="sm"
            variant={!useCustom && selectedDays === opt.days ? "default" : "outline"}
            onClick={() => { setSelectedDays(opt.days); setUseCustom(false); }}
            data-testid={`button-period-${opt.days}`}
          >
            {opt.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={useCustom ? "default" : "outline"}
          onClick={() => setUseCustom(true)}
          data-testid="button-period-custom"
        >
          Personnalisé
        </Button>
      </div>

      {useCustom && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
            data-testid="input-date-from"
          />
          <span className="text-sm text-muted-foreground">—</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
            data-testid="input-date-to"
          />
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5 text-green-500" />
              Total accumulé (Payin)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(data?.totalPayin ?? 0, info?.currency ?? "XOF")}
                </p>
                <p className="text-xs text-muted-foreground">{data?.countPayin ?? 0} transaction(s)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5 text-red-500" />
              Total payout
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(data?.totalPayout ?? 0, info?.currency ?? "XOF")}
                </p>
                <p className="text-xs text-muted-foreground">{data?.countPayout ?? 0} transaction(s)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-blue-500" />
              Total règlement (approuvés)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(data?.totalSettlements ?? 0, info?.currency ?? "XOF")}
                </p>
                <p className="text-xs text-muted-foreground">{data?.countSettlements ?? 0} règlement(s)</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Transactions</h2>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !data?.transactions?.length ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucune transaction sur cette période
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.transactions.map((tx: any) => {
              const isIncoming = INCOMING_TYPES.includes(tx.type);
              return (
                <Card key={tx.id} data-testid={`tx-row-${tx.id}`}>
                  <CardContent className="py-2.5 px-3 flex items-center gap-3">
                    <div className={`p-1.5 rounded-full flex-shrink-0 ${isIncoming ? "bg-green-100 dark:bg-green-950" : "bg-red-100 dark:bg-red-950"}`}>
                      {isIncoming
                        ? <ArrowDownCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        : <ArrowUpCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                        {tx.customerName ? ` — ${tx.customerName}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold tabular-nums ${isIncoming ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {isIncoming ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                      {tx.operator && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{tx.operator}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
