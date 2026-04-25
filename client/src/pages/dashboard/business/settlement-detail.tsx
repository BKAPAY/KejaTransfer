import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES } from "@shared/schema";
import {
  ArrowLeft, Banknote, CheckCircle2, Clock, XCircle,
  Building2, FileText, MessageSquare,
} from "lucide-react";

interface SettlementDetail {
  id: string;
  userId: string;
  walletCountry: string;
  walletCurrency: string;
  amount: number;
  status: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankName: string;
  bankSwiftBic: string | null;
  bankBranchAddress: string | null;
  bankBranchName: string | null;
  bankBranchSortCode: string | null;
  bankCountry: string | null;
  bankCurrency: string | null;
  createdAt: string;
  adminNotes: string | null;
  rejectionReason: string | null;
}

function formatAmount(amount: number, currency: string) {
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount) + " " + currency;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />Validé
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 mr-1" />En attente
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />Rejeté
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default function SettlementDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: settlement, isLoading } = useQuery<SettlementDetail>({
    queryKey: ["/api/business/settlements", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/business/settlements/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Règlement introuvable");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="max-w-xl space-y-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/business/settlements")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Retour
        </Button>
        <p className="text-muted-foreground">Règlement introuvable.</p>
      </div>
    );
  }

  const countryData = COUNTRIES.find((c) => c.code === settlement.walletCountry);
  const formattedDate = new Date(settlement.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/business/settlements")}
          data-testid="button-back-settlement"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Détail du règlement</h1>
          <p className="text-xs text-muted-foreground font-mono">#{settlement.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={settlement.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="w-4 h-4" />
            Informations du règlement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Montant demandé</p>
              <p className="font-bold text-lg">{formatAmount(settlement.amount, settlement.walletCurrency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Statut</p>
              <StatusBadge status={settlement.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Portefeuille source</p>
              <div className="flex items-center gap-2">
                {countryData && <CountryFlag code={countryData.code} size="sm" />}
                <span className="text-sm">{countryData?.name ?? settlement.walletCountry}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date de demande</p>
              <p className="text-sm">{formattedDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4" />
            Compte bancaire de destination
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settlement.bankAccountHolder && (
            <div>
              <p className="text-xs text-muted-foreground">Titulaire</p>
              <p className="text-sm font-medium">{settlement.bankAccountHolder}</p>
            </div>
          )}
          {settlement.bankName && (
            <div>
              <p className="text-xs text-muted-foreground">Banque</p>
              <p className="text-sm">{settlement.bankName}</p>
            </div>
          )}
          {settlement.bankAccountNumber && (
            <div>
              <p className="text-xs text-muted-foreground">Numéro de compte</p>
              <p className="text-sm font-mono">****{settlement.bankAccountNumber.slice(-4)}</p>
            </div>
          )}
          {settlement.bankSwiftBic && (
            <div>
              <p className="text-xs text-muted-foreground">SWIFT / BIC</p>
              <p className="text-sm font-mono">{settlement.bankSwiftBic}</p>
            </div>
          )}
          {settlement.bankCountry && (
            <div>
              <p className="text-xs text-muted-foreground">Pays de la banque</p>
              <p className="text-sm">{settlement.bankCountry}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {settlement.status === "completed" && settlement.adminNotes && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-green-700 dark:text-green-400">
              <MessageSquare className="w-4 h-4" />
              Message de l'administrateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-md p-3">
              <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">{settlement.adminNotes}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ce message confirme que votre règlement a été traité.
            </p>
          </CardContent>
        </Card>
      )}

      {settlement.status === "rejected" && settlement.rejectionReason && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <FileText className="w-4 h-4" />
              Motif de rejet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">{settlement.rejectionReason}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Votre solde a été automatiquement recrédité sur votre portefeuille. Vous pouvez soumettre une nouvelle demande.
            </p>
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={() => navigate("/dashboard/business/settlements/new")}
            >
              <Banknote className="w-4 h-4 mr-2" />
              Nouvelle demande de règlement
            </Button>
          </CardContent>
        </Card>
      )}

      {settlement.status === "pending" && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">En cours de traitement</p>
                <p className="text-xs text-muted-foreground">
                  Votre demande est en attente de validation par notre équipe. Vous serez notifié dès qu'elle sera traitée.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
