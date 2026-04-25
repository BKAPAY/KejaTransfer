import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banknote, Loader2, Inbox, AlertCircle, Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES } from "@shared/schema";
import type { Settlement } from "@shared/schema";

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Validé</Badge>;
  if (status === "pending") return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejeté</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function BusinessSettlements() {
  const [, navigate] = useLocation();

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ["/api/business/settlements"],
  });

  const hasBankAccount = user?.bankAccountNumber && user?.bankName;

  const formatAmount = (val: number, currency: string = "XOF") => {
    return new Intl.NumberFormat("fr-FR").format(val) + " " + currency;
  };

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
                Veuillez d'abord configurer votre compte bancaire dans les Paramètres avant de demander un règlement.
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
          ) : settlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun règlement pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s) => {
                const countryData = COUNTRIES.find(c => c.code === s.walletCountry);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 p-3 border rounded-md cursor-pointer hover-elevate"
                    onClick={() => navigate(`/dashboard/business/settlements/${s.id}`)}
                    data-testid={`settlement-row-${s.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {formatAmount(s.amount, s.walletCurrency)}
                        </span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                        {countryData && <CountryFlag code={countryData.code} size="xs" />} {countryData?.name} - {new Date(s.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                      {s.bankName && (
                        <p className="text-xs text-muted-foreground">
                          {s.bankName} - ****{s.bankAccountNumber?.slice(-4)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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
