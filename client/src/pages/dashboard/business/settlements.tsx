import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Loader2, Inbox, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES } from "@shared/schema";
import type { Settlement } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface BusinessWallet {
  id: string;
  country: string;
  currency: string;
  balance: number;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Complété</Badge>;
  if (status === "pending") return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejeté</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function BusinessSettlements() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [amount, setAmount] = useState("");

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: wallets = [] } = useQuery<BusinessWallet[]>({
    queryKey: ["/api/business/wallets"],
  });

  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ["/api/business/settlements"],
  });

  const createSettlement = useMutation({
    mutationFn: async (data: { walletCountry: string; walletCurrency: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/business/settlements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/wallets"] });
      setDialogOpen(false);
      setAmount("");
      setSelectedWallet("");
      toast({ title: "Demande envoyée", description: "Votre demande de règlement a été soumise." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const hasBankAccount = user?.bankAccountNumber && user?.bankName;

  const formatAmount = (val: number, currency: string = "XOF") => {
    return new Intl.NumberFormat("fr-FR").format(val) + " " + currency;
  };

  const walletsWithBalance = wallets.filter(w => w.balance > 0);
  const selectedWalletData = wallets.find(w => `${w.country}-${w.currency}` === selectedWallet);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settlements-title">Règlement</h1>
          <p className="text-sm text-muted-foreground">Demandez le transfert de vos fonds vers votre compte bancaire</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={!hasBankAccount || walletsWithBalance.length === 0}
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
                    className="flex items-center justify-between gap-4 p-3 border rounded-md"
                    data-testid={`settlement-row-${s.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {formatAmount(s.amount, s.walletCurrency)}
                        </span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {countryData?.flag} {countryData?.name} - {new Date(s.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                      {s.bankName && (
                        <p className="text-xs text-muted-foreground">
                          {s.bankName} - ****{s.bankAccountNumber?.slice(-4)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) { setSelectedWallet(""); setAmount(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau règlement</DialogTitle>
            <DialogDescription>
              Transférer des fonds de votre portefeuille vers votre compte bancaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Portefeuille source</label>
              <Select onValueChange={setSelectedWallet} value={selectedWallet}>
                <SelectTrigger data-testid="select-settlement-wallet">
                  <SelectValue placeholder="Choisir un portefeuille" />
                </SelectTrigger>
                <SelectContent>
                  {walletsWithBalance.map((w) => {
                    const cd = COUNTRIES.find(c => c.code === w.country);
                    return (
                      <SelectItem key={`${w.country}-${w.currency}`} value={`${w.country}-${w.currency}`}>
                        {cd?.flag} {cd?.name} - {formatAmount(w.balance, w.currency)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Montant à transférer"
                data-testid="input-settlement-amount"
              />
              {selectedWalletData && (
                <p className="text-xs text-muted-foreground">
                  Solde disponible : {formatAmount(selectedWalletData.balance, selectedWalletData.currency)}
                </p>
              )}
            </div>
            {hasBankAccount && (
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-xs font-medium">Compte bancaire de destination</p>
                <p className="text-xs text-muted-foreground">{user?.bankAccountHolder}</p>
                <p className="text-xs text-muted-foreground">{user?.bankName} - ****{user?.bankAccountNumber?.slice(-4)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-settlement">Annuler</Button>
            <Button
              onClick={() => {
                if (!selectedWalletData || !amount) return;
                createSettlement.mutate({
                  walletCountry: selectedWalletData.country,
                  walletCurrency: selectedWalletData.currency,
                  amount: parseInt(amount),
                });
              }}
              disabled={!amount || !selectedWallet || createSettlement.isPending || (selectedWalletData && parseInt(amount) > selectedWalletData.balance)}
              data-testid="button-confirm-settlement"
            >
              {createSettlement.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmer le règlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
