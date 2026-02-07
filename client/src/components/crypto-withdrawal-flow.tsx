import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CryptoIcon } from "@/components/crypto-icon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock } from "lucide-react";

interface CryptoCurrency {
  code: string;
  name: string;
  symbol: string;
  payinEnabled: boolean;
  payoutEnabled: boolean;
  minAmountXOF: number;
  minAmount?: number;
  minCurrency?: string;
}

interface CryptoWithdrawalFlowProps {
  amount: number;
  currency: string;
  userBalance: number;
  type: "withdrawal" | "transfer";
  onSuccess?: () => void;
}

export function CryptoWithdrawalFlow({
  amount,
  currency,
  userBalance,
  type,
  onSuccess,
}: CryptoWithdrawalFlowProps) {
  const { toast } = useToast();
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [step, setStep] = useState<"select" | "confirm" | "completed">("select");
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityCode, setSecurityCode] = useState("");
  const [securityError, setSecurityError] = useState("");

  const { data: cryptoCurrencies, isLoading: loadingCurrencies } = useQuery<CryptoCurrency[]>({
    queryKey: ["/api/crypto/currencies", currency, "payout"],
    queryFn: async () => {
      const res = await fetch(`/api/crypto/currencies?currency=${currency}&direction=payout`);
      return res.json();
    },
  });

  const { data: estimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ["/api/crypto/withdrawal-estimate", amount, currency, selectedCrypto, type],
    queryFn: async () => {
      const res = await fetch(`/api/crypto/withdrawal-estimate?amount=${amount}&currency=${currency}&crypto=${selectedCrypto}&type=${type}`);
      return res.json();
    },
    enabled: !!selectedCrypto && !!amount && amount > 0,
  });

  const withdrawalMutation = useMutation({
    mutationFn: async (data: { securityCode: string }) => {
      const res = await apiRequest("POST", "/api/crypto/create-withdrawal", {
        amount,
        currency,
        crypto: selectedCrypto,
        walletAddress,
        type,
        securityCode: data.securityCode,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        setStep("completed");
        setShowSecurityModal(false);
        setSecurityCode("");
        setSecurityError("");
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        onSuccess?.();
      } else {
        if (response.error?.includes("Code de securite") || response.error?.includes("incorrect")) {
          setSecurityError(response.error);
        } else {
          setShowSecurityModal(false);
          setSecurityCode("");
          toast({
            title: "Erreur",
            description: response.error || "Erreur lors du retrait crypto",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Erreur lors du retrait crypto";
      if (errorMessage.includes("Code de securite") || errorMessage.includes("incorrect")) {
        setSecurityError(errorMessage);
      } else {
        setShowSecurityModal(false);
        setSecurityCode("");
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const handleSelectCrypto = (code: string) => {
    setSelectedCrypto(code);
    setStep("select");
  };

  const handleConfirm = () => {
    if (!selectedCrypto) {
      toast({ title: "Erreur", description: "Selectionnez une cryptomonnaie", variant: "destructive" });
      return;
    }
    if (!walletAddress || walletAddress.length < 10) {
      toast({ title: "Erreur", description: "Entrez une adresse de portefeuille valide", variant: "destructive" });
      return;
    }

    const totalNeeded = estimate?.totalDeducted || amount;
    if (totalNeeded > userBalance) {
      toast({ title: "Solde insuffisant", description: `Votre solde est insuffisant. Il faut ${totalNeeded.toLocaleString("fr-FR")} ${currency}`, variant: "destructive" });
      return;
    }
    setSecurityCode("");
    setSecurityError("");
    setShowSecurityModal(true);
  };

  const handleSecurityCodeSubmit = () => {
    if (!securityCode || securityCode.length !== 6 || !/^\d+$/.test(securityCode)) {
      setSecurityError("Le code de securite doit contenir 6 chiffres");
      return;
    }
    setSecurityError("");
    withdrawalMutation.mutate({ securityCode });
  };

  if (step === "completed") {
    return (
      <div className="text-center space-y-4 py-6">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold">
            {type === "withdrawal" ? "Retrait" : "Transfert"} crypto initie
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Votre {type === "withdrawal" ? "retrait" : "transfert"} de {amount.toLocaleString("fr-FR")} {currency} en crypto est en cours de traitement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Selectionnez une cryptomonnaie</Label>
        {loadingCurrencies ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {cryptoCurrencies?.map((crypto) => (
              <button
                key={crypto.code}
                type="button"
                onClick={() => handleSelectCrypto(crypto.code)}
                className={cn(
                  "rounded-lg border-2 p-2 text-center transition-all duration-200 hover-elevate",
                  selectedCrypto === crypto.code
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-primary/50"
                )}
                data-testid={`button-select-crypto-${crypto.code}`}
              >
                <div className="flex justify-center mb-1">
                  <CryptoIcon code={crypto.code} size="md" />
                </div>
                <span className="text-xs font-bold block">{crypto.symbol}</span>
                <span className="text-[10px] text-muted-foreground block truncate">{crypto.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCrypto && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Adresse du portefeuille</Label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Entrez l'adresse de votre portefeuille crypto"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="pl-10"
                data-testid="input-crypto-wallet"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Assurez-vous que l'adresse correspond au reseau de la crypto selectionnee
            </p>
          </div>

          {loadingEstimate ? (
            <div className="flex items-center gap-2 text-muted-foreground p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Calcul de l'estimation...</span>
            </div>
          ) : estimate && !estimate.error ? (
            <div className="bg-muted p-4 rounded-md border space-y-2">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="text-sm space-y-2 w-full">
                  {type === "transfer" ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant a envoyer:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais:</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-crypto-fee">
                          +{new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(estimate.feeAmount)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total debite du solde:</span>
                        <span className="text-foreground" data-testid="text-crypto-total-deducted">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(estimate.totalDeducted)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant saisi:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais:</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-crypto-fee">
                          -{new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(estimate.feeAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-green-600 dark:text-green-400">
                        <span>Montant recu ({currency}):</span>
                        <span data-testid="text-crypto-amount-received">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(estimate.amountAfterFee)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-muted-foreground">Debite du solde:</span>
                        <span className="font-medium text-foreground" data-testid="text-crypto-total-deducted">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: currency,
                            minimumFractionDigits: 0,
                          }).format(estimate.totalDeducted)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold text-green-600 dark:text-green-400">
                    <span>Vous recevrez environ:</span>
                    <span data-testid="text-crypto-estimate">
                      {estimate.estimatedCryptoAmount} {estimate.cryptoSymbol}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : estimate?.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{estimate.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            className="w-full"
            onClick={handleConfirm}
            disabled={!selectedCrypto || !walletAddress || walletAddress.length < 10 || withdrawalMutation.isPending || loadingEstimate}
            data-testid="button-confirm-crypto-withdrawal"
          >
            {withdrawalMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmer le {type === "withdrawal" ? "retrait" : "transfert"} crypto
              </>
            )}
          </Button>
        </>
      )}

      <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertDescription className="text-xs text-yellow-900 dark:text-yellow-100 ml-2">
          Verifiez bien votre adresse de portefeuille avant de confirmer. Les transactions crypto sont irreversibles.
        </AlertDescription>
      </Alert>

      <Dialog open={showSecurityModal} onOpenChange={setShowSecurityModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Code de securite
            </DialogTitle>
            <DialogDescription>
              Entrez votre code de securite a 6 chiffres pour confirmer le {type === "withdrawal" ? "retrait" : "transfert"} crypto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="******"
                maxLength={6}
                inputMode="numeric"
                value={securityCode}
                onChange={(e) => {
                  setSecurityCode(e.target.value.replace(/\D/g, ""));
                  setSecurityError("");
                }}
                data-testid="input-crypto-security-code"
                className="text-center text-2xl tracking-widest"
              />
              {securityError && (
                <p className="text-sm text-destructive text-center">{securityError}</p>
              )}
            </div>
            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant:</span>
                <span className="font-medium">{amount.toLocaleString("fr-FR")} {currency}</span>
              </div>
              {estimate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total debite:</span>
                  <span className="font-medium">{estimate.totalDeducted?.toLocaleString("fr-FR")} {currency}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Crypto:</span>
                <span className="font-medium">{selectedCrypto?.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adresse:</span>
                <span className="font-medium text-xs truncate max-w-[180px]">{walletAddress}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSecurityModal(false);
                setSecurityCode("");
                setSecurityError("");
              }}
              data-testid="button-cancel-crypto-security"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSecurityCodeSubmit}
              disabled={withdrawalMutation.isPending || securityCode.length !== 6}
              data-testid="button-confirm-crypto-security"
            >
              {withdrawalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verification...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
