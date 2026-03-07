import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle2, XCircle, RefreshCw, ShieldCheck, Clock } from "lucide-react";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OperatorSelector } from "@/components/operator-selector";
import { CountryFlag } from "@/components/country-flag";
import logoImage from "@assets/bkapay-logo.png";
import { getCurrencyDecimals } from "@/lib/currency";
import { hasMultiplePawaPayCurrencies, getCurrenciesForCountry as getPawaPayCurrenciesForCountry } from "@shared/pawapay-countries";
import { hasMultipleCurrencies, getMbiyoPayCurrenciesForCountry } from "@shared/mbiyopay-countries";
import { CurrencySelector } from "@/components/currency-selector";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SessionInfo {
  success: boolean;
  session_id?: string;
  status: string;
  amount?: number;
  currency?: string;
  description?: string;
  merchant?: string;
  success_url?: string | null;
  cancel_url?: string | null;
  expires_at?: string;
  error?: string;
}

type Stage = "form" | "otp" | "polling" | "completed" | "failed" | "expired" | "redirect";

function formatAmount(amount: number, currency: string): string {
  const decimals = getCurrencyDecimals(currency);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount) + " " + currency;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function Checkout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("form");
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpInstructions, setOtpInstructions] = useState("");
  const [otpUssdCode, setOtpUssdCode] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const successUrlRef = useRef<string | null>(null);
  const cancelUrlRef = useRef<string | null>(null);

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery<SessionInfo>({
    queryKey: ["/api/v1/payment-sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/payment-sessions/${sessionId}`);
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: false,
    staleTime: Infinity,
  });

  const { data: enabledCountriesOperators, isLoading: isLoadingOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/deposits"],
  });

  const collectCountries = enabledCountriesOperators
    ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
        .sort((a, b) => {
          const aHasOps = (enabledCountriesOperators[a.code] || []).length > 0;
          const bHasOps = (enabledCountriesOperators[b.code] || []).length > 0;
          if (aHasOps && !bHasOps) return -1;
          if (!aHasOps && bHasOps) return 1;
          return 0;
        })
    : [];

  const allCountryOperators = country
    ? (OPERATORS[country as keyof typeof OPERATORS] || [])
    : [];

  const countryOperators = (enabledCountriesOperators && country
    ? allCountryOperators.filter(op => (enabledCountriesOperators[country] || []).includes(op.code))
    : allCountryOperators
  );

  useEffect(() => {
    if (session?.expires_at) {
      setSessionExpiresAt(new Date(session.expires_at));
    }
  }, [session]);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const tick = () => {
      const remaining = sessionExpiresAt.getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown(0);
        if (stage === "form") setStage("expired");
        clearInterval(countdownRef.current!);
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current!);
  }, [sessionExpiresAt, stage]);

  useEffect(() => {
    if (session?.success_url) successUrlRef.current = session.success_url;
    if (session?.cancel_url) cancelUrlRef.current = session.cancel_url;
  }, [session]);

  const startPolling = (txId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const [sessionRes, txRes] = await Promise.all([
          fetch(`/api/v1/payment-sessions/${sessionId}/status`).then(r => r.json()),
          txId ? fetch("/api/softpay/verify-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: txId }) }).then(r => r.json()) : Promise.resolve(null),
        ]);

        const sessionStatus = sessionRes?.status;
        const txStatus = txRes?.status;

        if (sessionStatus === "completed" || txStatus === "completed" || txRes?.response_code === "00") {
          clearInterval(pollRef.current!);
          setStage("completed");
          setTimeout(() => {
            if (successUrlRef.current) window.location.href = successUrlRef.current;
          }, 2500);
        } else if (sessionStatus === "failed" || txStatus === "failed") {
          clearInterval(pollRef.current!);
          setStage("failed");
        }
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const payMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/v1/payment-sessions/${sessionId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors du paiement");
      return data;
    },
    onSuccess: (data) => {
      if (data.requiresOTP) {
        setOtpInstructions(data.otpInstructions || "");
        setOtpUssdCode(data.otpUssdCode || "");
        setStage("otp");
        return;
      }
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        setStage("redirect");
        return;
      }
      if (data.transactionId) {
        setTransactionId(data.transactionId);
      }
      setPaymentMessage(data.message || "Validez le paiement sur votre téléphone.");
      setStage("polling");
      if (data.transactionId) startPolling(data.transactionId);
    },
    onError: (error: any) => {
      setStage("form");
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handlePay = () => {
    if (!country || !operator || !customerPhone) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    payMutation.mutate({ country, operator, customerPhone, customerName, currency: selectedCurrency || undefined });
  };

  const handleOtpSubmit = () => {
    if (!otpCode.trim()) {
      toast({ title: "Code requis", description: "Veuillez entrer le code OTP", variant: "destructive" });
      return;
    }
    payMutation.mutate({ country, operator, customerPhone, customerName, otpCode, currency: selectedCurrency || undefined });
  };

  const handleRetry = () => {
    setStage("form");
    setOtpCode("");
    setOtpInstructions("");
    setTransactionId(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Chargement du paiement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionError || !session?.success || session?.status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">Session expirée ou invalide</p>
            <p className="text-sm text-muted-foreground">
              {session?.error || "Ce lien de paiement n'est plus valide."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session?.status === "completed" || stage === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-xl text-foreground mb-1">Paiement réussi</p>
            <p className="text-muted-foreground text-sm">
              {session.amount && session.currency ? formatAmount(session.amount, session.currency) : ""}
              {session.description ? ` — ${session.description}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-4">Redirection en cours...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">Session expirée</p>
            <p className="text-sm text-muted-foreground">Cette session de paiement a expiré. Contactez le marchand pour générer un nouveau lien.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">Paiement échoué</p>
            <p className="text-sm text-muted-foreground mb-4">Le paiement n'a pas pu être complété.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleRetry} data-testid="button-retry">
                <RefreshCw className="w-4 h-4 mr-2" /> Réessayer
              </Button>
              {cancelUrlRef.current && (
                <Button variant="ghost" onClick={() => window.location.href = cancelUrlRef.current!}>
                  Annuler
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "redirect" && redirectUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-3">Redirection vers le paiement...</p>
            <Button onClick={() => window.location.href = redirectUrl} data-testid="button-redirect">
              Accéder au paiement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "polling") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto mb-4" data-testid="icon-polling" />
            <p className="font-semibold text-foreground mb-2">En attente de confirmation</p>
            <p className="text-sm text-muted-foreground mb-4">{paymentMessage}</p>
            {session.amount && session.currency && (
              <p className="text-2xl font-bold text-foreground">{formatAmount(session.amount, session.currency)}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-6" />
            <h2 className="font-semibold text-lg text-center mb-2">Code OTP requis</h2>
            {otpUssdCode && (
              <Alert className="mb-4">
                <AlertDescription className="text-sm">
                  Composez <strong>{otpUssdCode}</strong> pour obtenir votre code
                </AlertDescription>
              </Alert>
            )}
            {otpInstructions && <p className="text-sm text-muted-foreground mb-4">{otpInstructions}</p>}
            <input
              type="text"
              placeholder="Entrez votre code OTP"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-4 text-sm bg-background"
              data-testid="input-otp"
            />
            <Button onClick={handleOtpSubmit} disabled={payMutation.isPending} className="w-full" data-testid="button-submit-otp">
              {payMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <img src={logoImage} alt="BKApay" className="h-8 w-auto" />
            {countdown !== null && countdown > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatCountdown(countdown)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="bg-muted/50 rounded-md p-4 mb-5">
            <p className="text-xs text-muted-foreground mb-1">Paiement à</p>
            <p className="font-semibold text-foreground">{session.merchant || "BKApay"}</p>
            {session.description && <p className="text-sm text-muted-foreground mt-1">{session.description}</p>}
            {session.amount && session.currency && (
              <p className="text-2xl font-bold text-foreground mt-2" data-testid="text-amount">
                {formatAmount(session.amount, session.currency)}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Votre nom</label>
              <input
                type="text"
                placeholder="Nom complet"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="input-customer-name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Pays</label>
              <Select
                value={country}
                onValueChange={(c) => { setCountry(c); setOperator(""); setSelectedCurrency(""); }}
              >
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="Selectionnez un pays" />
                </SelectTrigger>
                <SelectContent>
                  {collectCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2"><CountryFlag code={c.code} size="xs" />{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {country && hasMultiplePawaPayCurrencies(country) && (
              <CurrencySelector
                countryCode={country}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                overrideCurrencies={getPawaPayCurrenciesForCountry(country)}
              />
            )}
            {country && !hasMultiplePawaPayCurrencies(country) && hasMultipleCurrencies(country) && (
              <CurrencySelector
                countryCode={country}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                overrideCurrencies={getMbiyoPayCurrenciesForCountry(country)}
              />
            )}

            {country && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Opérateur</label>
                {countryOperators.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {isLoadingOperators ? "Chargement..." : "Aucun opérateur disponible pour ce pays"}
                  </div>
                ) : (
                  <OperatorSelector
                    operators={countryOperators}
                    selectedOperator={operator}
                    onSelect={setOperator}
                    isLoading={isLoadingOperators}
                  />
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Numéro de téléphone</label>
              <PhoneInputWithPrefix
                country={country}
                value={customerPhone}
                onChange={setCustomerPhone}
                placeholder="Votre numéro mobile money"
                data-testid="input-phone"
              />
            </div>

            <Button
              onClick={handlePay}
              disabled={payMutation.isPending || !country || !operator || !customerPhone}
              className="w-full"
              data-testid="button-pay"
            >
              {payMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Payer {session.amount && session.currency ? formatAmount(session.amount, session.currency) : ""}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Paiement sécurisé par BKApay</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
