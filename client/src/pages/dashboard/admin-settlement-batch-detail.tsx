import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Clock, CheckCircle2, X, Loader2, Building2, Banknote,
  User as UserIcon, Calendar, XCircle,
} from "lucide-react";
import { useState } from "react";

interface SettlementAdmin {
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
  bankCountry: string | null;
  bankCurrency: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  adminNotes: string | null;
  rejectionReason: string | null;
}

function formatAmount(val: number, currency: string) {
  return new Intl.NumberFormat("fr-FR").format(val) + " " + currency;
}

function minuteBucket(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      <CheckCircle2 className="w-3 h-3 mr-1" />Validé
    </Badge>
  );
  if (status === "pending") return (
    <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En attente</Badge>
  );
  if (status === "rejected") return (
    <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejeté</Badge>
  );
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminSettlementBatchDetail() {
  const params = useParams<{ userId: string; ts: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [validateDialog, setValidateDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: allSettlements = [], isLoading } = useQuery<SettlementAdmin[]>({
    queryKey: ["/api/admin/settlements"],
  });

  const targetBucket = params.ts
    ? minuteBucket(new Date(Number(params.ts)).toISOString())
    : "";

  const batch = allSettlements.filter(
    s => s.userId === params.userId && minuteBucket(s.createdAt) === targetBucket
  );
  const first = batch[0];
  const pendingItems = batch.filter(s => s.status === "pending");
  const anyPending = pendingItems.length > 0;
  const allCompleted = batch.length > 0 && batch.every(s => s.status === "completed");
  const allRejected = batch.length > 0 && batch.every(s => s.status === "rejected");

  const validateBatchMutation = useMutation({
    mutationFn: async ({ adminNotes }: { adminNotes: string }) => {
      for (const s of pendingItems) {
        const res = await apiRequest("POST", `/api/admin/settlements/${s.id}/validate`, { adminNotes });
        if (!res.ok) throw new Error(`Erreur sur ${s.walletCountry}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/pending-count"] });
      setValidateDialog(false);
      setNotes("");
      toast({ title: "Lot validé", description: "Tous les règlements ont été validés." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const rejectBatchMutation = useMutation({
    mutationFn: async ({ rejectionReason }: { rejectionReason: string }) => {
      for (const s of pendingItems) {
        const res = await apiRequest("POST", `/api/admin/settlements/${s.id}/reject`, { rejectionReason });
        if (!res.ok) throw new Error(`Erreur sur ${s.walletCountry}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/pending-count"] });
      setRejectDialog(false);
      setNotes("");
      toast({ title: "Lot rejeté", description: "Les soldes ont été recrédités automatiquement." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!first) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard/admin/business/management?tab=settlements")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Retour
        </Button>
        <p className="text-muted-foreground">Lot de règlements introuvable.</p>
      </div>
    );
  }

  const batchDate = new Date(first.createdAt);
  const dateLabel = batchDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const timeLabel = batchDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });



  const overallStatus = allCompleted ? "completed" : allRejected ? "rejected" : anyPending ? "pending" : "partial";

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/admin/business/management?tab=settlements")}
          data-testid="button-back-batch"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Détail du règlement</h1>
          <p className="text-xs text-muted-foreground">Soumis le {dateLabel} à {timeLabel}</p>
        </div>
        <StatusBadge status={overallStatus} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="w-4 h-4" />
            Entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Nom de l'entreprise</p>
            <p className="font-semibold text-sm">{first.userName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Email</p>
            <p className="text-sm">{first.userEmail}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-0.5">Date de soumission</p>
            <div className="flex items-center gap-1.5 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {dateLabel} à {timeLabel}
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
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Titulaire</p>
              <p className="font-medium">{first.bankAccountHolder}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Banque</p>
              <p>{first.bankName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Numéro de compte</p>
              <p className="font-mono">{first.bankAccountNumber}</p>
            </div>
            {first.bankSwiftBic && (
              <div>
                <p className="text-xs text-muted-foreground">SWIFT / BIC</p>
                <p className="font-mono">{first.bankSwiftBic}</p>
              </div>
            )}
            {first.bankCountry && (
              <div>
                <p className="text-xs text-muted-foreground">Pays de la banque</p>
                <p>{first.bankCountry}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="w-4 h-4" />
            Montants par pays
            {batch.length > 1 && (
              <Badge variant="outline" className="ml-auto text-xs">{batch.length} pays</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {batch.map(s => {
              const cd = COUNTRIES.find(c => c.code === s.walletCountry);
              return (
                <div key={s.id} className="flex items-center justify-between gap-4 py-3" data-testid={`batch-detail-item-${s.id}`}>
                  <div className="flex items-center gap-3">
                    {cd && <CountryFlag code={cd.code} size="sm" />}
                    <div>
                      <p className="text-sm font-medium">{cd?.name ?? s.walletCountry}</p>
                      <p className="text-xs text-muted-foreground">{s.walletCurrency}</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm">{formatAmount(s.amount, s.walletCurrency)}</span>
                </div>
              );
            })}
          </div>

        </CardContent>
      </Card>

      {anyPending && (
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => { setRejectDialog(true); setNotes(""); }}
            data-testid="button-reject-batch-detail"
          >
            <X className="w-4 h-4 mr-2" />
            Rejeter
          </Button>
          <Button
            className="flex-1"
            onClick={() => { setValidateDialog(true); setNotes(""); }}
            data-testid="button-validate-batch-detail"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Valider
          </Button>
        </div>
      )}

      <Dialog open={validateDialog} onOpenChange={(o) => { if (!o) { setValidateDialog(false); setNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider le règlement</DialogTitle>
            <DialogDescription>{first.userName} — {pendingItems.length} pays</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 bg-muted rounded-md p-3 my-1">
            {pendingItems.map(s => {
              const cd = COUNTRIES.find(c => c.code === s.walletCountry);
              return (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">{cd && <CountryFlag code={cd.code} size="xs" />}{cd?.name}</span>
                  <span className="font-bold">{formatAmount(s.amount, s.walletCurrency)}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes de validation <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex : Virement effectué le 25/04/2026, référence TXN-XXXX..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="textarea-validate-notes"
            />
            <p className="text-xs text-muted-foreground">Ces notes seront visibles par l'entreprise dans son historique.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidateDialog(false); setNotes(""); }}>Annuler</Button>
            <Button
              onClick={() => { if (notes.trim()) validateBatchMutation.mutate({ adminNotes: notes.trim() }); }}
              disabled={!notes.trim() || validateBatchMutation.isPending}
              data-testid="button-confirm-validate"
            >
              {validateBatchMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialog} onOpenChange={(o) => { if (!o) { setRejectDialog(false); setNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le règlement</DialogTitle>
            <DialogDescription>{first.userName} — {pendingItems.length} pays</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 bg-muted rounded-md p-3 my-1">
            {pendingItems.map(s => {
              const cd = COUNTRIES.find(c => c.code === s.walletCountry);
              return (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">{cd && <CountryFlag code={cd.code} size="xs" />}{cd?.name}</span>
                  <span className="font-bold">{formatAmount(s.amount, s.walletCurrency)}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motif de rejet <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex : Documents manquants, informations bancaires incorrectes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="textarea-reject-reason"
            />
            <p className="text-xs text-muted-foreground">Les soldes seront recrédités automatiquement. Le motif sera visible par l'entreprise.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(false); setNotes(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => { if (notes.trim()) rejectBatchMutation.mutate({ rejectionReason: notes.trim() }); }}
              disabled={!notes.trim() || rejectBatchMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectBatchMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <X className="w-4 h-4 mr-2" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
