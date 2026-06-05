import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { TrendingUp, RefreshCw, MessageCircle, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

type MonthlyLimitStatus = {
  applicable: boolean;
  currency?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  percentage?: number;
  isDefault?: boolean;
  resetDate?: string;
};

export default function MonthlyLimitPage() {
  const [, setLocation] = useLocation();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: limitStatus, isLoading } = useQuery<MonthlyLimitStatus>({
    queryKey: ["/api/user/monthly-limit-status"],
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: user?.accountType === "personal",
  });

  if (user && user.accountType !== "personal") {
    return null;
  }

  const pct = limitStatus?.percentage ?? 0;
  const barColor =
    pct >= 90 ? "bg-red-500" :
    pct >= 70 ? "bg-orange-500" :
    "bg-green-500";
  const textColor =
    pct >= 90 ? "text-red-600 dark:text-red-400" :
    pct >= 70 ? "text-orange-600 dark:text-orange-400" :
    "text-green-600 dark:text-green-400";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Ma limite mensuelle</h1>
        <p className="text-sm text-muted-foreground">
          Suivi de vos transactions entrantes pour ce mois
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ) : limitStatus?.applicable ? (
        <>
          <Card data-testid="card-monthly-limit-detail">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                Progression du mois en cours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{pct}% utilisé</span>
                  <span className="font-medium">
                    {(limitStatus.used ?? 0).toLocaleString("fr-FR")} / {(limitStatus.limit ?? 0).toLocaleString("fr-FR")} {limitStatus.currency}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                    data-testid="progress-monthly-limit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Montant reçu ce mois</p>
                  <p className="font-semibold text-sm" data-testid="text-limit-used">
                    {(limitStatus.used ?? 0).toLocaleString("fr-FR")} {limitStatus.currency}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Disponible</p>
                  <p className={`font-semibold text-sm ${textColor}`} data-testid="text-limit-remaining">
                    {(limitStatus.remaining ?? 0).toLocaleString("fr-FR")} {limitStatus.currency}
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Limite totale du mois</p>
                <p className="font-semibold text-sm" data-testid="text-limit-total">
                  {(limitStatus.limit ?? 0).toLocaleString("fr-FR")} {limitStatus.currency}
                  {limitStatus.isDefault && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(limite par défaut)</span>
                  )}
                </p>
              </div>

              {limitStatus.resetDate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Remise à zéro le{" "}
                    <strong>
                      {new Date(limitStatus.resetDate).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-limit-support">
            <CardContent className="pt-5 pb-4">
              <div className="flex gap-3">
                <MessageCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Vous souhaitez augmenter cette limite ?</p>
                  <p className="text-sm text-muted-foreground">
                    Votre limite mensuelle est de{" "}
                    <strong>{(limitStatus.limit ?? 0).toLocaleString("fr-FR")} {limitStatus.currency}</strong>.
                    Pour dépasser cette limite ou demander son augmentation, contactez notre équipe support — nous traiterons votre demande dans les meilleurs délais.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setLocation("/dashboard/support")}
                    data-testid="button-contact-support-limit"
                    className="mt-1"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contacter le support
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">Aucune limite mensuelle applicable à votre compte.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
