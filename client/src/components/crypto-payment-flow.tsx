import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Bitcoin, 
  Loader2, 
  Copy, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  AlertCircle,
  RefreshCw 
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface CryptoPaymentFlowProps {
  amount: number;
  currency?: string;
  userId?: string;
  paymentLinkId?: string;
  merchantLinkId?: string;
  apiKeyId?: string;
  storageId?: string;
  orderDescription?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerPaysFee?: boolean;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

interface PaymentDetails {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  priceAmountUsd: number;
  priceAmountXof: number;
  qrCode: string;
  transactionId: string;
  expiresIn: number;
}

function getStorageKey(storageId?: string, paymentLinkId?: string, merchantLinkId?: string, apiKeyId?: string, userId?: string) {
  return `bkapay_crypto_${storageId || paymentLinkId || merchantLinkId || apiKeyId || userId || "default"}`;
}

function loadPersistedPayment(storageKey: string, amount: number, currency: string): { paymentDetails: PaymentDetails | null; selectedCrypto: string | null; step: "select" | "confirm" | "waiting" | "completed" | "failed"; timeLeft: number } {
  const empty = { paymentDetails: null, selectedCrypto: null, step: "select" as const, timeLeft: 0 };
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return empty;
    const data = JSON.parse(saved);
    if (!data.paymentDetails || !data.createdAt) return empty;
    if (amount > 0 && (data.amount !== amount || data.currency !== currency)) {
      localStorage.removeItem(storageKey);
      return empty;
    }
    const elapsed = Math.floor((Date.now() - data.createdAt) / 1000);
    const remaining = (data.expiresIn || 1800) - elapsed;
    if (remaining <= 0) {
      localStorage.removeItem(storageKey);
      return empty;
    }
    return { paymentDetails: data.paymentDetails, selectedCrypto: data.selectedCrypto || null, step: "waiting", timeLeft: remaining };
  } catch {
    return empty;
  }
}

export function CryptoPaymentFlow({
  amount,
  currency = "XOF",
  userId,
  paymentLinkId,
  merchantLinkId,
  apiKeyId,
  storageId,
  orderDescription,
  customerName,
  customerEmail,
  customerPhone,
  customerPaysFee = false,
  onSuccess,
  onError,
}: CryptoPaymentFlowProps) {
  const { toast } = useToast();
  const storageKey = getStorageKey(storageId, paymentLinkId, merchantLinkId, apiKeyId, userId);
  const persisted = loadPersistedPayment(storageKey, amount, currency);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(persisted.selectedCrypto);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(persisted.paymentDetails);
  const [paymentStep, setPaymentStep] = useState<"select" | "confirm" | "waiting" | "completed" | "failed">(persisted.step);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(persisted.timeLeft);
  const [pollFailures, setPollFailures] = useState(0);

  const { data: cryptoStatus } = useQuery<{ available: boolean; message: string }>({
    queryKey: ["/api/crypto/status"],
  });

  const { data: currencies, isLoading: currenciesLoading } = useQuery<CryptoCurrency[]>({
    queryKey: ["/api/crypto/currencies", currency, "payin"],
    queryFn: async () => {
      const res = await fetch(`/api/crypto/currencies?currency=${currency}&direction=payin`);
      return res.json();
    },
    enabled: cryptoStatus?.available === true,
  });

  const { data: estimate, isLoading: estimateLoading } = useQuery<{
    estimatedAmount: number;
    payCurrency: string;
    priceAmount: number;
    priceCurrency: string;
    customerAmount?: number;
    feeAmount?: number;
    feePercentage?: number;
    netAmount?: number;
    customerPaysFee?: boolean;
    markupPercent?: number;
  }>({
    queryKey: [`/api/crypto/estimate`, amount, currency, selectedCrypto, customerPaysFee, paymentLinkId, apiKeyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        amount: String(amount),
        currency,
        crypto: selectedCrypto!,
      });
      if (customerPaysFee) params.set("customerPaysFee", "true");
      if (paymentLinkId) params.set("paymentLinkId", paymentLinkId);
      if (apiKeyId) params.set("apiKeyId", apiKeyId);
      const res = await fetch(`/api/crypto/estimate?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur estimation");
      return res.json();
    },
    enabled: !!selectedCrypto && amount > 0 && paymentStep === "confirm",
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/create-payment", {
        amount,
        currency,
        crypto: selectedCrypto,
        userId,
        paymentLinkId,
        merchantLinkId,
        apiKeyId,
        orderDescription: orderDescription || `Paiement BKApay ${amount} ${currency}`,
        customerName,
        customerEmail,
        customerPhone,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPaymentDetails(data);
        setPaymentStep("waiting");
        const expires = data.expiresIn || 1800;
        setTimeLeft(expires);
        localStorage.setItem(storageKey, JSON.stringify({
          paymentDetails: data,
          selectedCrypto,
          createdAt: Date.now(),
          expiresIn: expires,
          amount,
          currency,
          cryptoCustomerInfo: {
            customerName: customerName || "",
            customerEmail: customerEmail || "",
            customerPhone: customerPhone || "",
          },
        }));
        toast({
          title: "Paiement cree",
          description: "Envoyez le montant exact a l'adresse indiquee",
        });
      } else {
        toast({
          title: "Erreur",
          description: data.error || "Impossible de creer le paiement",
          variant: "destructive",
        });
        onError?.(data.error);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la creation du paiement",
        variant: "destructive",
      });
      onError?.(error.message);
    },
  });

  const { data: paymentStatus, refetch: refetchStatus } = useQuery<{
    status: string;
    actuallyPaid: number;
    payAmount: number;
  }>({
    queryKey: ["/api/crypto/payment-status", paymentDetails?.paymentId],
    queryFn: async () => {
      if (!paymentDetails?.paymentId) return null;
      try {
        const res = await fetch(`/api/crypto/payment-status/${paymentDetails.paymentId}`);
        if (!res.ok) {
          setPollFailures((prev) => prev + 1);
          return null;
        }
        setPollFailures(0);
        return res.json();
      } catch {
        setPollFailures((prev) => prev + 1);
        return null;
      }
    },
    enabled: paymentStep === "waiting" && !!paymentDetails?.paymentId,
    refetchInterval: 15000,
    retry: 2,
  });

  useEffect(() => {
    if (paymentStatus) {
      if (paymentStatus.status === "finished" || paymentStatus.status === "confirmed" || paymentStatus.status === "partially_paid") {
        setPaymentStep("completed");
        localStorage.removeItem(storageKey);
        onSuccess?.(paymentDetails?.transactionId || "");
        toast({
          title: "Paiement confirme",
          description: "Votre paiement a ete recu avec succes",
        });
      } else if (paymentStatus.status === "failed" || paymentStatus.status === "expired" || paymentStatus.status === "refunded") {
        setPaymentStep("failed");
        localStorage.removeItem(storageKey);
        onError?.("Paiement echoue ou expire");
      }
    }
  }, [paymentStatus, paymentDetails, onSuccess, onError, toast, storageKey]);

  useEffect(() => {
    if (paymentStep === "waiting" && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setPaymentStep("failed");
            localStorage.removeItem(storageKey);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paymentStep, timeLeft, storageKey]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copie", description: "Adresse copiee dans le presse-papiers" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erreur", description: "Impossible de copier", variant: "destructive" });
    }
  };

  const enabledCurrencies = currencies || [];

  if (!cryptoStatus?.available) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Les paiements en cryptomonnaie ne sont pas disponibles actuellement.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (currenciesLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentStep === "completed") {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
          <div>
            <p className="text-xl font-semibold text-green-600">Paiement confirme</p>
            <p className="text-muted-foreground">
              Votre paiement de {amount.toLocaleString()} {currency} a ete recu.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentStep === "failed") {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
          <div>
            <p className="text-xl font-semibold text-destructive">Paiement echoue</p>
            <p className="text-muted-foreground">
              Le delai de paiement a expire ou une erreur s'est produite.
            </p>
          </div>
          <Button onClick={() => { localStorage.removeItem(storageKey); setPaymentStep("select"); setPaymentDetails(null); setSelectedCrypto(null); }} variant="outline">
            Reessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (paymentStep === "waiting" && paymentDetails) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Envoyez votre paiement</span>
            <Badge variant="outline" className="text-orange-600">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(timeLeft)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <img
              src={paymentDetails.qrCode}
              alt="QR Code"
              className="w-48 h-48 border rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Montant exact a envoyer</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${paymentDetails.payAmount} ${paymentDetails.payCurrency.toUpperCase()}`}
                className="font-mono text-lg"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(paymentDetails.payAmount.toString())}
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adresse de paiement</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={paymentDetails.payAddress}
                className="font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(paymentDetails.payAddress)}
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              Envoyez exactement <strong>{paymentDetails.payAmount} {paymentDetails.payCurrency.toUpperCase()}</strong> a l'adresse ci-dessus.
              Le paiement sera automatiquement detecte.
            </AlertDescription>
          </Alert>

          {pollFailures >= 3 ? (
            <div className="flex items-center justify-center gap-2 text-orange-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Verification automatique interrompue. Utilisez le bouton ci-dessous.</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Verification automatique en cours...</span>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setPollFailures(0); refetchStatus(); }}
          >
            Verifier manuellement
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (paymentStep === "confirm" && selectedCrypto) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirmer le paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-semibold">{amount.toLocaleString()} {currency}</span>
            </div>
            {estimate?.feeAmount && estimate.feeAmount > 0 && customerPaysFee ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frais ({((estimate.feePercentage || 0) / 10).toFixed(1)}%)</span>
                  <span className="font-semibold">+{estimate.feeAmount.toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-medium">Total a payer</span>
                  <span className="font-bold">{(estimate.customerAmount || amount).toLocaleString()} {currency}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Crypto</span>
              <span className="font-semibold">{selectedCrypto.toUpperCase()}</span>
            </div>
            {estimateLoading ? (
              <Skeleton className="h-6 w-24 ml-auto" />
            ) : estimate && estimate.estimatedAmount ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimation</span>
                <span className="font-semibold">
                  ~{Number(estimate.estimatedAmount).toFixed(8)} {selectedCrypto.toUpperCase()}
                </span>
              </div>
            ) : null}
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              Le montant exact sera calcule au moment du paiement selon le taux de change actuel.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCrypto(null);
                setPaymentStep("select");
              }}
              className="flex-1"
            >
              Retour
            </Button>
            <Button
              onClick={() => createPaymentMutation.mutate()}
              disabled={createPaymentMutation.isPending}
              className="flex-1"
            >
              {createPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creation...
                </>
              ) : (
                "Payer maintenant"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5" />
          Choisissez une cryptomonnaie
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Montant a payer</p>
            <p className="text-xl font-bold">{amount.toLocaleString()} {currency}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {enabledCurrencies.map((crypto) => {
              const minAmount = crypto.minAmount ?? crypto.minAmountXOF ?? 0;
              const minCurrency = crypto.minCurrency ?? "XOF";
              const isAvailable = amount >= minAmount;
              return (
                <button
                  key={crypto.code}
                  type="button"
                  onClick={() => {
                    if (isAvailable) {
                      setSelectedCrypto(crypto.code);
                      setPaymentStep("confirm");
                    }
                  }}
                  disabled={!isAvailable}
                  className={cn(
                    "p-3 rounded-lg border-2 text-center transition-all",
                    isAvailable && "hover-elevate",
                    selectedCrypto === crypto.code
                      ? "border-primary bg-primary/5"
                      : isAvailable 
                        ? "border-border hover:border-primary/50"
                        : "border-border opacity-50 cursor-not-allowed"
                  )}
                  data-testid={`button-crypto-${crypto.code}`}
                >
                  <div className="font-semibold">{crypto.symbol}</div>
                  <div className="text-xs text-muted-foreground">{crypto.name}</div>
                  <div className={cn(
                    "text-xs mt-1",
                    isAvailable ? "text-muted-foreground" : "text-destructive"
                  )}>
                    Min: {minAmount.toLocaleString("fr-FR")} {minCurrency}
                  </div>
                </button>
              );
            })}
          </div>

          {enabledCurrencies.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Aucune cryptomonnaie disponible
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
