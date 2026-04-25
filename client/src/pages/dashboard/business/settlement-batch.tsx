import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES } from "@shared/schema";
import type { Settlement as BaseSettlement } from "@shared/schema";
import {
  ArrowLeft, Clock, CheckCircle2, Loader2, Banknote, Calendar, XCircle, AlertCircle,
} from "lucide-react";

type Settlement = BaseSettlement & { adminNotes?: string | null; rejectionReason?: string | null };

function minuteBucket(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

function formatAmount(val: number, currency: string) {
  return new Intl.NumberFormat("fr-FR").format(val) + " " + currency;
}

function StatusLine({ status }: { status: string }) {
  if (status === "completed") return (
    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">Votre règlement a été validé</span>
    </div>
  );
  if (status === "rejected") return (
    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
      <XCircle className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">Votre règlement a été rejeté</span>
    </div>
  );
  if (status === "partial") return (
    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">Règlement partiellement traité</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">Votre règlement est en cours de traitement</span>
    </div>
  );
}

function batchStatus(items: Settlement[]): "pending" | "completed" | "rejected" | "partial" {
  const statuses = new Set(items.map(s => s.status));
  if (statuses.size === 1) return statuses.values().next().value as any;
  return "partial";
}

function ItemStatusBadge({ status }: { status: string }) {
  if (status === "completed") return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0 text-xs">
      <CheckCircle2 className="w-3 h-3 mr-1" />Validé
    </Badge>
  );
  if (status === "rejected") return (
    <Badge variant="destructive" className="shrink-0 text-xs">
      <XCircle className="w-3 h-3 mr-1" />Rejeté
    </Badge>
  );
  return (
    <Badge variant="secondary" className="shrink-0 text-xs">
      <Clock className="w-3 h-3 mr-1" />En attente
    </Badge>
  );
}

export default function BusinessSettlementBatch() {
  const params = useParams<{ ts: string }>();
  const [, navigate] = useLocation();

  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ["/api/business/settlements"],
  });

  const targetBucket = params.ts
    ? minuteBucket(new Date(Number(params.ts)).toISOString())
    : "";

  const batch = settlements.filter(s => minuteBucket(s.createdAt) === targetBucket);
  const first = batch[0];
  const status = first ? batchStatus(batch) : "pending";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!first) {
    return (
      <div className="space-y-4 max-w-xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard/business/settlements")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Retour
        </Button>
        <p className="text-muted-foreground text-sm">Règlement introuvable.</p>
      </div>
    );
  }

  const batchDate = new Date(first.createdAt);
  const dateLabel = batchDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const timeLabel = batchDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const rejectedItems = batch.filter(s => s.status === "rejected");
  const hasRejection = rejectedItems.length > 0;

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/business/settlements")}
          data-testid="button-back-batch"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Détail du règlement</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" />
            Soumis le {dateLabel} à {timeLabel}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="py-5">
          <StatusLine status={status} />
          {status === "pending" && (
            <p className="text-xs text-muted-foreground mt-2">
              Notre équipe traite votre demande. Vous serez notifié dès validation.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Banknote className="w-4 h-4" />
            Pays soumis au règlement
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {batch.map(s => {
              const cd = COUNTRIES.find(c => c.code === s.walletCountry);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 py-3"
                  data-testid={`batch-item-${s.id}`}
                >
                  <div className="flex items-center gap-3">
                    {cd && <CountryFlag code={cd.code} size="sm" />}
                    <p className="text-sm font-medium">{cd?.name ?? s.walletCountry}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatAmount(s.amount, s.walletCurrency)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {hasRejection && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Règlement(s) rejeté(s)</p>
                {rejectedItems[0].rejectionReason && (
                  <p className="text-xs text-muted-foreground mt-1">Motif : {rejectedItems[0].rejectionReason}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Les soldes concernés ont été automatiquement recrédités sur vos wallets.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate("/dashboard/business/settlements/new")}
            >
              <Banknote className="w-3.5 h-3.5 mr-2" />
              Soumettre une nouvelle demande
            </Button>
          </CardContent>
        </Card>
      )}

      {batch.every(s => s.status === "completed") && (
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="py-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Virement effectué</p>
                {first.adminNotes && (
                  <p className="text-xs text-muted-foreground mt-1">{first.adminNotes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
