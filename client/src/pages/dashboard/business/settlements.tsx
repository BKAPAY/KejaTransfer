import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banknote, Loader2, Inbox, AlertCircle, Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES } from "@shared/schema";
import type { Settlement } from "@shared/schema";

function minuteBucket(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

function batchStatus(items: Settlement[]): "pending" | "completed" | "rejected" | "partial" {
  const statuses = new Set(items.map(s => s.status));
  if (statuses.size === 1) return statuses.values().next().value as any;
  return "partial";
}

function BatchStatusBadge({ status }: { status: string }) {
  if (status === "completed") return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0">
      <CheckCircle2 className="w-3 h-3 mr-1" />Validé
    </Badge>
  );
  if (status === "pending") return (
    <Badge variant="secondary" className="shrink-0">
      <Clock className="w-3 h-3 mr-1" />En attente
    </Badge>
  );
  if (status === "rejected") return (
    <Badge variant="destructive" className="shrink-0">
      <XCircle className="w-3 h-3 mr-1" />Rejeté
    </Badge>
  );
  if (status === "partial") return (
    <Badge variant="outline" className="shrink-0 border-orange-400 text-orange-600 dark:text-orange-400">
      <Clock className="w-3 h-3 mr-1" />Partiel
    </Badge>
  );
  return <Badge variant="secondary" className="shrink-0">{status}</Badge>;
}

function groupSettlements(settlements: Settlement[]) {
  const buckets = new Map<string, Settlement[]>();
  for (const s of settlements) {
    const key = minuteBucket(s.createdAt);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => new Date(b[1][0].createdAt).getTime() - new Date(a[1][0].createdAt).getTime())
    .map(([key, items]) => ({ key, items }));
}

export default function BusinessSettlements() {
  const [, navigate] = useLocation();

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });

  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ["/api/business/settlements"],
  });

  const hasBankAccount = user?.bankAccountNumber && user?.bankName;
  const hasMomo = user?.momoPhone && user?.momoOperator;
  const hasPaymentMethod = hasBankAccount || hasMomo;
  const batches = groupSettlements(settlements);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settlements-title">Règlement</h1>
          <p className="text-sm text-muted-foreground">Demandez le transfert de vos fonds vers votre compte bancaire ou Mobile Money</p>
        </div>
        <Button
          onClick={() => navigate("/dashboard/business/settlements/new")}
          disabled={!hasPaymentMethod}
          data-testid="button-new-settlement"
        >
          <Banknote className="w-4 h-4 mr-2" />
          Nouveau règlement
        </Button>
      </div>

      {!hasPaymentMethod && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Aucun moyen de paiement configuré</p>
              <p className="text-xs text-muted-foreground">
                Configurez votre compte bancaire ou Mobile Money dans les Paramètres avant de demander un règlement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="w-5 h-5" />
            Historique des règlements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun règlement pour le moment</p>
            </div>
          ) : (
            <div className="divide-y">
              {batches.map(({ key, items }) => {
                const status = batchStatus(items);
                const date = new Date(items[0].createdAt);
                const dateLabel = date.toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                });
                const timeLabel = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                const ts = date.getTime();

                return (
                  <button
                    key={key}
                    className="w-full text-left py-4 flex items-center justify-between gap-4 hover-elevate"
                    onClick={() => navigate(`/dashboard/business/settlement-batch/${ts}`)}
                    data-testid={`batch-${key}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs text-muted-foreground">Règlement créé le</span>
                        <span className="text-xs font-semibold">{dateLabel} à {timeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <BatchStatusBadge status={status} />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {items.map(s => {
                            const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                            return cd ? <CountryFlag key={s.id} code={cd.code} size="xs" /> : null;
                          })}
                          <span className="text-xs text-muted-foreground">
                            {items.map(s => {
                              const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                              return cd?.name;
                            }).filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
