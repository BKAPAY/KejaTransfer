import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banknote, Loader2, Inbox, AlertCircle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES } from "@shared/schema";
import type { Settlement } from "@shared/schema";
import { useState } from "react";

function formatAmount(val: number, currency: string = "XOF") {
  return new Intl.NumberFormat("fr-FR").format(val) + " " + currency;
}

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
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ["/api/business/settlements"],
  });

  const hasBankAccount = user?.bankAccountNumber && user?.bankName;
  const batches = groupSettlements(settlements);

  function toggleBatch(key: string) {
    setOpenBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settlements-title">Règlement</h1>
          <p className="text-sm text-muted-foreground">Demandez le transfert de vos fonds vers votre compte bancaire</p>
        </div>
        <Button
          onClick={() => navigate("/dashboard/business/settlements/new")}
          disabled={!hasBankAccount}
          data-testid="button-new-settlement"
        >
          <Banknote className="w-4 h-4 mr-2" />
          Nouveau règlement
        </Button>
      </div>

      {!hasBankAccount && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Compte bancaire non configuré</p>
              <p className="text-xs text-muted-foreground">
                Configurez votre compte bancaire dans les Paramètres avant de demander un règlement.
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
            <div className="space-y-3">
              {batches.map(({ key, items }) => {
                const status = batchStatus(items);
                const isOpen = openBatches.has(key);
                const date = new Date(items[0].createdAt);
                const dateLabel = date.toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                });
                const timeLabel = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                const totalCurrencies = [...new Set(items.map(s => s.walletCurrency))];
                const isSingleCurrency = totalCurrencies.length === 1;
                const total = isSingleCurrency
                  ? items.reduce((sum, s) => sum + s.amount, 0)
                  : null;

                return (
                  <div key={key} className="border rounded-md overflow-hidden" data-testid={`batch-${key}`}>
                    <button
                      className="w-full text-left p-4 flex items-start justify-between gap-3 hover-elevate"
                      onClick={() => {
                        if (items.length === 1) {
                          navigate(`/dashboard/business/settlements/${items[0].id}`);
                        } else {
                          toggleBatch(key);
                        }
                      }}
                      data-testid={`button-batch-${key}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs text-muted-foreground">Règlement créé le</span>
                          <span className="text-xs font-medium">{dateLabel} à {timeLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {total !== null ? (
                            <span className="font-bold text-sm">{formatAmount(total, totalCurrencies[0])}</span>
                          ) : (
                            <span className="font-bold text-sm">{items.length} pays</span>
                          )}
                          <BatchStatusBadge status={status} />
                        </div>
                        {items.length > 1 && (
                          <div className="flex items-center gap-1 flex-wrap mt-2">
                            {items.map(s => {
                              const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                              return cd ? (
                                <span key={s.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CountryFlag code={cd.code} size="xs" /> {cd.name}
                                </span>
                              ) : null;
                            }).reduce((acc: any[], el, i) => {
                              if (i > 0) acc.push(<span key={`sep-${i}`} className="text-muted-foreground text-xs">·</span>);
                              acc.push(el);
                              return acc;
                            }, [])}
                          </div>
                        )}
                        {items.length === 1 && (
                          <div className="flex items-center gap-1 mt-1">
                            {(() => {
                              const cd = COUNTRIES.find(c => c.code === items[0].walletCountry);
                              return cd ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><CountryFlag code={cd.code} size="xs" /> {cd.name}</span> : null;
                            })()}
                          </div>
                        )}
                      </div>
                      {items.length > 1 ? (
                        isOpen
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      )}
                    </button>

                    {items.length > 1 && isOpen && (
                      <div className="border-t divide-y">
                        {items.map(s => {
                          const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                          return (
                            <button
                              key={s.id}
                              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover-elevate bg-muted/30"
                              onClick={() => navigate(`/dashboard/business/settlements/${s.id}`)}
                              data-testid={`settlement-row-${s.id}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {cd && <CountryFlag code={cd.code} size="sm" />}
                                <div>
                                  <p className="text-sm font-medium">{cd?.name ?? s.walletCountry}</p>
                                  <p className="text-xs text-muted-foreground">{formatAmount(s.amount, s.walletCurrency)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <BatchStatusBadge status={s.status} />
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
