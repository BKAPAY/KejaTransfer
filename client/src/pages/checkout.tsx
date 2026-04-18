import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, CheckCircle2, XCircle, RefreshCw, ShieldCheck, Clock, User, Mail, Globe, Phone, Copy, Check } from "lucide-react";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OperatorSelector } from "@/components/operator-selector";
import { CountryFlag } from "@/components/country-flag";
import logoImage from "@assets/bkapay-logo.png";
import { getCurrencyDecimals } from "@/lib/currency";
import { usePaymentCountdown } from "@/hooks/use-payment-countdown";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { CryptoPaymentFlow } from "@/components/crypto-payment-flow";
import { CurrencySelector } from "@/components/currency-selector";
import { hasMultiplePawaPayCurrencies, getCurrenciesForCountry as getPawaPayCurrenciesForCountry, getOperatorCodesForCurrency, operatorSupportsCurrency } from "@shared/pawapay-countries";
import { hasMultipleCurrencies, getMbiyoPayCurrenciesForCountry } from "@shared/mbiyopay-countries";

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
  api_key_id?: string;
  customerPaysCryptoFee?: boolean;
  customerPaysFee?: boolean;
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

interface CheckoutPaymentState {
  stage: Stage;
  transactionId: string | null;
  country: string;
  operator: string;
  customerPhone: string;
  customerName: string;
  customerEmail: string;
  paymentMessage: string;
  redirectUrl: string | null;
}

function getCheckoutStateKey(sessionId: string): string {
  return `checkout_payment_state_${sessionId}`;
}

function saveCheckoutState(sessionId: string, state: CheckoutPaymentState): void {
  localStorage.setItem(getCheckoutStateKey(sessionId), JSON.stringify(state));
}

function loadCheckoutState(sessionId: string): CheckoutPaymentState | null {
  const stored = localStorage.getItem(getCheckoutStateKey(sessionId));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function clearCheckoutState(sessionId: string): void {
  localStorage.removeItem(getCheckoutStateKey(sessionId));
}

export default function Checkout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("form");
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpInstructions, setOtpInstructions] = useState("");
  const [otpUssdCode, setOtpUssdCode] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copiedUssd, setCopiedUssd] = useState(false);
  const [paymentActive, setPaymentActive] = useState(false);
  const [cryptoStep, setCryptoStep] = useState<"info" | "payment">("info");
  const [cryptoCustomerInfo, setCryptoCustomerInfo] = useState<{
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  } | null>(null);
  const [conversionData, setConversionData] = useState<{
    convertedAmount: number;
    targetCurrency: string;
    conversionRate: number;
    isLoading: boolean;
  } | null>(null);
  const [dynamicFee, setDynamicFee] = useState<{ feePercentage: number; feeAmount: number } | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");
  const [retryRequested, setRetryRequested] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const successUrlRef = useRef<string | null>(null);
  const cancelUrlRef = useRef<string | null>(null);
  const [shouldStartCountdown, setShouldStartCountdown] = useState(false);

  const paymentCountdown = usePaymentCountdown({
    invoiceToken: null,
    transactionId,
    enabled: paymentActive && stage === "polling",
    onCompleted: () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setStage("completed");
      setPaymentActive(false);
      if (sessionId) clearCheckoutState(sessionId);
    },
    onFailed: () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setStage("failed");
      setPaymentActive(false);
      if (sessionId) clearCheckoutState(sessionId);
    },
    onExpired: () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setStage("expired");
      setPaymentActive(false);
      if (sessionId) clearCheckoutState(sessionId);
    },
  });

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

  interface OtpDetailInfo {
    provider: string;
    requiresOtp: boolean;
    otpInstructions?: string;
    otpUssdCode?: string;
    otpHint?: string;
  }
  const { data: depositsDetails } = useQuery<Record<string, Record<string, OtpDetailInfo>>>({
    queryKey: ["/api/countries-operators/deposits/details"],
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

  const enabledFilteredOperators = (enabledCountriesOperators && country
    ? allCountryOperators.filter(op => (enabledCountriesOperators[country] || []).includes(op.code))
    : allCountryOperators
  );

  const countryOperators = (country && hasMultiplePawaPayCurrencies(country))
    ? enabledFilteredOperators.filter(op => operatorSupportsCurrency(country, op.code, selectedCurrency))
    : enabledFilteredOperators;

  const noOperatorsAvailable = country && countryOperators.length === 0 && !isLoadingOperators;

  const operatorOtpDetail = country && operator && depositsDetails
    ? depositsDetails[country]?.[operator]
    : null;

  const showOtpOnForm = operatorOtpDetail?.requiresOtp;

  const sessionCurrency = session?.currency || "XOF";
  const targetCurrency = country
    ? ((hasMultiplePawaPayCurrencies(country) || hasMultipleCurrencies(country))
        ? selectedCurrency
        : (COUNTRIES.find(c => c.code === country)?.currency || sessionCurrency))
    : sessionCurrency;
  const needsConversion = !!country && targetCurrency !== sessionCurrency;

  const hasOperatorSelected = !!country && !!operator;
  const baseAmount = session?.amount || 0;
  const totalWithFees = (hasOperatorSelected && dynamicFee && session?.customerPaysFee) ? baseAmount + dynamicFee.feeAmount : baseAmount;
  const amountForDisplay = session?.customerPaysFee ? totalWithFees : baseAmount;

  useEffect(() => {
    const fetchDynamicFee = async () => {
      if (!country || !operator || !session?.amount || session.amount <= 0 || !session?.customerPaysFee) {
        setDynamicFee(null);
        return;
      }
      try {
        const res = await fetch(`/api/fees/${country}/${operator}`);
        if (res.ok) {
          const data = await res.json();
          const feePercentage = data.incomingFeePercentage || 60;
          const feeAmount = Math.floor((session.amount * feePercentage) / 1000);
          setDynamicFee({ feePercentage, feeAmount });
        } else {
          const feeAmount = Math.floor((session.amount * 60) / 1000);
          setDynamicFee({ feePercentage: 60, feeAmount });
        }
      } catch {
        const feeAmount = Math.floor((session.amount * 60) / 1000);
        setDynamicFee({ feePercentage: 60, feeAmount });
      }
    };
    const debounceTimer = setTimeout(fetchDynamicFee, 300);
    return () => clearTimeout(debounceTimer);
  }, [country, operator, session?.amount, session?.customerPaysFee]);

  useEffect(() => {
    if (!needsConversion || !amountForDisplay) {
      setConversionData(null);
      return;
    }
    setConversionData(prev => prev ? { ...prev, isLoading: true } : { convertedAmount: 0, targetCurrency, conversionRate: 0, isLoading: true });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/convert-currency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amountForDisplay, fromCurrency: sessionCurrency, toCurrency: targetCurrency }),
        });
        if (res.ok) {
          const data = await res.json();
          setConversionData({ convertedAmount: data.convertedAmount, targetCurrency: data.targetCurrency, conversionRate: data.conversionRate, isLoading: false });
        } else {
          setConversionData(null);
        }
      } catch {
        setConversionData(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [needsConversion, amountForDisplay, sessionCurrency, targetCurrency]);

  useEffect(() => {
    if (country && hasMultiplePawaPayCurrencies(country)) {
      const currencies = getPawaPayCurrenciesForCountry(country);
      setSelectedCurrency(currencies[0]);
    } else if (country && hasMultipleCurrencies(country)) {
      const currencies = getMbiyoPayCurrenciesForCountry(country);
      setSelectedCurrency(currencies[0]);
    } else if (country) {
      const countryCurrency = COUNTRIES.find(c => c.code === country)?.currency || "XOF";
      setSelectedCurrency(countryCurrency);
    }
  }, [country]);

  useEffect(() => {
    const detectCountry = async () => {
      if (country) return;
      try {
        const response = await fetch("/api/detect-country");
        if (response.ok) {
          const data = await response.json();
          if (data.detected && data.country && enabledCountriesOperators) {
            if (Object.keys(enabledCountriesOperators).includes(data.country)) {
              setCountry(data.country);
            }
          }
        }
      } catch {}
    };
    if (enabledCountriesOperators && !country) {
      detectCountry();
    }
  }, [enabledCountriesOperators, country]);

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
        if (stage === "form" || stage === "polling") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentActive(false);
          paymentCountdown.resetCountdown();
          setStage("expired");
        }
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

  useEffect(() => {
    if (!sessionId) return;
    const savedState = loadCheckoutState(sessionId);
    if (savedState && savedState.stage === "polling" && savedState.transactionId) {
      setStage("polling");
      setTransactionId(savedState.transactionId);
      setCountry(savedState.country);
      setOperator(savedState.operator);
      setCustomerPhone(savedState.customerPhone);
      setCustomerName(savedState.customerName);
      setCustomerEmail(savedState.customerEmail);
      setPaymentMessage(savedState.paymentMessage);
      setPaymentActive(true);
      setShouldStartCountdown(true);
    } else if (savedState && savedState.stage === "redirect" && savedState.redirectUrl) {
      setStage("redirect");
      setRedirectUrl(savedState.redirectUrl);
    }
  }, [sessionId]);

  useEffect(() => {
    if (shouldStartCountdown && transactionId) {
      paymentCountdown.startCountdown();
      startSessionPolling();
      setShouldStartCountdown(false);
    }
  }, [shouldStartCountdown, transactionId]);

  const startSessionPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const sessionRes = await fetch(`/api/v1/payment-sessions/${sessionId}/status`).then(r => r.json());
        const sessionStatus = sessionRes?.status;
        if (sessionStatus === "completed") {
          clearInterval(pollRef.current!);
          setPaymentActive(false);
          paymentCountdown.resetCountdown();
          setStage("completed");
          if (sessionId) clearCheckoutState(sessionId);
        } else if (sessionStatus === "failed") {
          clearInterval(pollRef.current!);
          setPaymentActive(false);
          paymentCountdown.resetCountdown();
          setStage("failed");
          if (sessionId) clearCheckoutState(sessionId);
        }
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
  };

  useEffect(() => {
    if (stage !== "polling" && stage !== "form") {
      setPaymentActive(false);
    }
  }, [stage]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    if (session?.status === "processing" && stage === "form" && !retryRequested && !pollRef.current) {
      startSessionPolling();
    }
  }, [session?.status, stage, retryRequested]);

  useEffect(() => {
    if ((session?.status === "completed" || stage === "completed") && successUrlRef.current) {
      const timer = setTimeout(() => {
        window.location.href = successUrlRef.current!;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [session?.status, stage]);

  useEffect(() => {
    if (stage === "failed" && cancelUrlRef.current) {
      const timer = setTimeout(() => {
        window.location.href = cancelUrlRef.current!;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "expired" && cancelUrlRef.current) {
      const timer = setTimeout(() => {
        window.location.href = cancelUrlRef.current!;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

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
      setRetryRequested(false);
      if (data.requiresOTP) {
        setOtpInstructions(data.otpInstructions || "");
        setOtpUssdCode(data.otpUssdCode || "");
        setStage("otp");
        return;
      }
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        setStage("redirect");
        if (sessionId) {
          saveCheckoutState(sessionId, {
            stage: "redirect", transactionId: data.transactionId || null,
            country, operator, customerPhone, customerName, customerEmail,
            paymentMessage: "", redirectUrl: data.redirectUrl,
          });
        }
        return;
      }
      if (data.transactionId) {
        setTransactionId(data.transactionId);
      }
      const msg = data.message || "Validez le paiement sur votre téléphone.";
      setPaymentMessage(msg);
      setStage("polling");
      setPaymentActive(true);
      paymentCountdown.startCountdown();
      startSessionPolling();
      if (sessionId) {
        saveCheckoutState(sessionId, {
          stage: "polling", transactionId: data.transactionId || null,
          country, operator, customerPhone, customerName, customerEmail,
          paymentMessage: msg, redirectUrl: null,
        });
      }
    },
    onError: (error: any) => {
      setStage("form");
      setPaymentActive(false);
      paymentCountdown.resetCountdown();
      toast({ title: "Paiement non effectue", description: error.message || "Le paiement n'a pas pu etre initie. Veuillez reessayer.", variant: "destructive" });
    },
  });

  const handlePay = () => {
    if (!country || !operator || !customerPhone) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    const body: any = { country, operator, customerPhone, customerName, currency: selectedCurrency };
    if (customerEmail) body.customerEmail = customerEmail;
    if (showOtpOnForm && otpCode.trim()) body.otpCode = otpCode;
    payMutation.mutate(body);
  };

  const handleOtpSubmit = () => {
    if (!otpCode.trim()) {
      toast({ title: "Code requis", description: "Veuillez entrer le code OTP", variant: "destructive" });
      return;
    }
    payMutation.mutate({ country, operator, customerPhone, customerName, otpCode });
  };

  const handleRetry = () => {
    if (sessionId) clearCheckoutState(sessionId);
    setStage("form");
    setOtpCode("");
    setOtpInstructions("");
    setTransactionId(null);
    setPaymentActive(false);
    setRetryRequested(true);
    paymentCountdown.resetCountdown();
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const copyUssdCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedUssd(true);
    setTimeout(() => setCopiedUssd(false), 2000);
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

  if (session?.status === "processing" && stage === "form" && !retryRequested) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-2" />
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="font-semibold text-xl text-foreground" data-testid="text-processing-title">Paiement en cours</p>
            <p className="text-muted-foreground text-sm" data-testid="text-processing-amount">
              {session?.amount && session?.currency ? formatAmount(session.amount, session.currency) : ""}
              {session?.description ? ` — ${session.description}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">Veuillez patienter, votre paiement est en cours de traitement...</p>
            <Button variant="outline" onClick={handleRetry} data-testid="button-cancel-processing">
              <RefreshCw className="w-4 h-4 mr-2" /> Annuler et réessayer
            </Button>
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
              {session?.amount && session?.currency ? formatAmount(session.amount, session.currency) : ""}
              {session?.description ? ` — ${session.description}` : ""}
            </p>
            {successUrlRef.current ? (
              <p className="text-xs text-muted-foreground mt-4">Redirection automatique dans quelques secondes...</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-4">Paiement traité avec succès</p>
            )}
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
            {cancelUrlRef.current && (
              <p className="text-xs text-muted-foreground mt-4">Redirection automatique dans quelques secondes...</p>
            )}
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
            <p className="text-sm text-muted-foreground mb-4">
              {paymentCountdown.isExpired ? "Le delai de validation a expire" : "Le paiement n'a pas pu être complété."}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleRetry} data-testid="button-retry">
                <RefreshCw className="w-4 h-4 mr-2" /> Réessayer
              </Button>
              {cancelUrlRef.current && (
                <Button variant="ghost" onClick={() => window.location.href = cancelUrlRef.current!} data-testid="button-cancel-redirect">
                  Retour au site
                </Button>
              )}
            </div>
            {cancelUrlRef.current && (
              <p className="text-xs text-muted-foreground mt-4">Redirection automatique dans quelques secondes...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "redirect" && redirectUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-2" />
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <p className="font-semibold text-foreground">Redirection vers le paiement...</p>
            <Button onClick={() => window.location.href = redirectUrl} data-testid="button-redirect">
              Accéder au paiement
            </Button>
            <div>
              <Button variant="ghost" onClick={handleRetry} data-testid="button-cancel-redirect">
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "polling") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto mb-2" />
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" data-testid="icon-polling" />

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Paiement en cours</h2>
              <p className="text-sm text-muted-foreground">
                Veuillez valider le paiement sur votre telephone
              </p>
            </div>

            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
              <p className="text-3xl font-mono font-bold text-primary" data-testid="text-payment-countdown">
                {paymentCountdown.formattedTime}
              </p>
            </div>

            {paymentMessage && (
              <div className="text-left bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Instructions:</p>
                <p className="text-sm text-foreground whitespace-pre-line">{paymentMessage}</p>
              </div>
            )}

            {session?.amount && session?.currency && (
              <p className="text-2xl font-bold text-foreground">{formatAmount(session.amount, session.currency)}</p>
            )}

            <p className="text-xs text-muted-foreground">
              Ne fermez pas cette page
            </p>

            <Button variant="outline" onClick={handleRetry} data-testid="button-cancel-polling">
              Annuler
            </Button>
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
              <Alert className="mb-4 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                      <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                        {otpUssdCode}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyUssdCode(otpUssdCode)}
                      className="bg-green-600 border-green-600 text-white shrink-0"
                      data-testid="button-copy-ussd"
                    >
                      {copiedUssd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {otpInstructions && <p className="text-sm text-muted-foreground mb-4">{otpInstructions}</p>}
            <div className="space-y-2 mb-4">
              <Label>Code OTP</Label>
              <Input
                placeholder="Entrez le code obtenu"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                data-testid="input-otp"
              />
            </div>
            <Button onClick={handleOtpSubmit} disabled={payMutation.isPending} className="w-full" data-testid="button-submit-otp">
              {payMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mobileMoneyForm = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="checkout-name" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          Nom complet
        </Label>
        <Input
          id="checkout-name"
          placeholder="Votre nom complet"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          data-testid="input-customer-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="checkout-email" className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Email
        </Label>
        <Input
          id="checkout-email"
          type="email"
          placeholder="votre@email.com"
          value={customerEmail}
          onChange={e => setCustomerEmail(e.target.value)}
          data-testid="input-customer-email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="checkout-country" className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Pays
        </Label>
        <Select value={country} onValueChange={(v) => { setCountry(v); setOperator(""); setOtpCode(""); }}>
          <SelectTrigger id="checkout-country" data-testid="select-country">
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
          onCurrencyChange={(c) => { setSelectedCurrency(c); setOperator(""); }}
          overrideCurrencies={getPawaPayCurrenciesForCountry(country)}
        />
      )}

      {country && !hasMultiplePawaPayCurrencies(country) && hasMultipleCurrencies(country) && (
        <CurrencySelector
          countryCode={country}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="checkout-phone" className="flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Numero de telephone
        </Label>
        <PhoneInputWithPrefix
          country={country}
          value={customerPhone}
          onChange={setCustomerPhone}
          data-testid="input-customer-phone"
        />
      </div>

      <div className="space-y-2">
        <Label>Operateur Mobile Money</Label>
        {noOperatorsAvailable ? (
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
              Aucun opérateur disponible pour ce pays
            </AlertDescription>
          </Alert>
        ) : (
          <OperatorSelector
            operators={countryOperators}
            selectedOperator={operator}
            onSelect={(val) => { setOperator(val); setOtpCode(""); }}
            disabled={!country || isLoadingOperators}
            isLoading={isLoadingOperators}
          />
        )}
      </div>

      {showOtpOnForm && (
        <div className="space-y-3">
          <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Instructions pour obtenir votre code OTP :</strong>
              <p className="mt-1 whitespace-pre-line">{(operatorOtpDetail?.otpInstructions || "Composez le code USSD pour obtenir votre code de paiement").replace(/MONTANT/g, amountForDisplay > 0 ? String(Math.round(amountForDisplay)) : "MONTANT")}</p>
              {operatorOtpDetail?.otpUssdCode && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                    <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                      {operatorOtpDetail.otpUssdCode.replace(/MONTANT/g, amountForDisplay > 0 ? String(Math.round(amountForDisplay)) : "MONTANT")}
                    </code>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyUssdCode(operatorOtpDetail!.otpUssdCode!.replace(/MONTANT/g, amountForDisplay > 0 ? String(Math.round(amountForDisplay)) : "MONTANT"))}
                    className="bg-green-600 border-green-600 text-white shrink-0"
                    data-testid="button-copy-ussd-form"
                  >
                    {copiedUssd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              {operatorOtpDetail?.otpHint && (
                <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">{operatorOtpDetail.otpHint}</p>
              )}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>Code OTP</Label>
            <Input
              placeholder="Entrez le code obtenu"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              data-testid="input-otp-form"
            />
            <p className="text-xs text-muted-foreground">
              Composez le code USSD ci-dessus, puis entrez le code de paiement obtenu
            </p>
          </div>
        </div>
      )}

      {conversionData && (
        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            Montant à payer
          </p>
          {conversionData.isLoading ? (
            <div className="flex items-center gap-2 mt-1">
              <Loader2 className="h-4 w-4 animate-spin text-green-600" />
              <span className="text-sm text-green-600">Conversion en cours...</span>
            </div>
          ) : (
            <p className="text-lg font-bold text-green-800 dark:text-green-200" data-testid="text-converted-amount">
              {new Intl.NumberFormat("fr-FR", {
                minimumFractionDigits: getCurrencyDecimals(conversionData.targetCurrency),
                maximumFractionDigits: getCurrencyDecimals(conversionData.targetCurrency),
              }).format(conversionData.convertedAmount)} {conversionData.targetCurrency}
            </p>
          )}
        </div>
      )}

      <Button
        onClick={handlePay}
        disabled={payMutation.isPending || !country || !operator || !customerPhone || noOperatorsAvailable || (Boolean(showOtpOnForm) && !otpCode.trim())}
        className="w-full"
        size="lg"
        data-testid="button-pay"
      >
        {payMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Traitement...
          </>
        ) : (
          `Payer ${amountForDisplay ? formatAmount(amountForDisplay, sessionCurrency) : ""}`
        )}
      </Button>
    </div>
  );

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Link href="/">
                <img src={logoImage} alt="BKApay" className="w-10 h-10 rounded-lg cursor-pointer" />
              </Link>
              <Link href="/" className="font-bold text-lg text-primary hover:underline">
                BKApay
              </Link>
            </div>
            {countdown !== null && countdown > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatCountdown(countdown)}
              </span>
            )}
          </div>
          <CardTitle>Payer a {session.merchant || "BKApay"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3 pb-4 border-b">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Montant a payer</p>
              <p className="text-3xl font-bold text-primary" data-testid="text-amount">
                {amountForDisplay ? Math.floor(amountForDisplay).toLocaleString() : ""} <span className="text-lg">{sessionCurrency}</span>
              </p>
              {needsConversion && conversionData && !conversionData.isLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.floor(amountForDisplay).toLocaleString()} {sessionCurrency} = {Math.floor(conversionData.convertedAmount).toLocaleString()} {conversionData.targetCurrency}
                </p>
              )}
              {needsConversion && conversionData?.isLoading && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Conversion en cours...
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completez votre paiement en remplissant les informations</p>
              {session.description && (
                <p className="text-sm text-foreground mt-1">{session.description}</p>
              )}
            </div>
          </div>

          <PaymentMethodSelector
            defaultMethod="mobile_money"
            mobileMoneyContent={mobileMoneyForm}
            cryptoContent={
              session.amount && session.amount >= 500 ? (
                cryptoStep === "payment" && cryptoCustomerInfo ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm text-muted-foreground">Montant a payer</p>
                      <p className="text-xl font-bold">{session.amount?.toLocaleString()} {sessionCurrency}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {cryptoCustomerInfo.customerName} - {cryptoCustomerInfo.customerEmail}
                      </p>
                    </div>
                    <CryptoPaymentFlow
                      amount={session.amount}
                      currency={session.currency || "XOF"}
                      apiKeyId={session.api_key_id}
                      storageId={`checkout_${sessionId}`}
                      customerPaysFee={session.customerPaysCryptoFee || false}
                      orderDescription={session.description || `Paiement a ${session.merchant}`}
                      customerName={cryptoCustomerInfo.customerName}
                      customerEmail={cryptoCustomerInfo.customerEmail}
                      customerPhone={cryptoCustomerInfo.customerPhone}
                      onSuccess={() => {
                        setStage("completed");
                      }}
                      onError={() => {
                        setStage("failed");
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCryptoStep("info");
                        setCryptoCustomerInfo(null);
                      }}
                      className="w-full"
                      data-testid="button-back-crypto-info"
                    >
                      Modifier les informations
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Renseignez vos informations pour payer en cryptomonnaie
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Nom complet
                        </Label>
                        <Input
                          placeholder="Jean Dupont"
                          data-testid="input-crypto-name"
                          value={cryptoCustomerInfo?.customerName || ""}
                          onChange={(e) => setCryptoCustomerInfo(prev => ({
                            customerName: e.target.value,
                            customerEmail: prev?.customerEmail || "",
                            customerPhone: prev?.customerPhone || "",
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </Label>
                        <Input
                          type="email"
                          placeholder="jean@exemple.com"
                          data-testid="input-crypto-email"
                          value={cryptoCustomerInfo?.customerEmail || ""}
                          onChange={(e) => setCryptoCustomerInfo(prev => ({
                            customerName: prev?.customerName || "",
                            customerEmail: e.target.value,
                            customerPhone: prev?.customerPhone || "",
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Telephone
                        </Label>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="00 00 00 00"
                          data-testid="input-crypto-phone"
                          value={cryptoCustomerInfo?.customerPhone || ""}
                          onChange={(e) => setCryptoCustomerInfo(prev => ({
                            customerName: prev?.customerName || "",
                            customerEmail: prev?.customerEmail || "",
                            customerPhone: e.target.value.replace(/\D/g, ""),
                          }))}
                        />
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        !cryptoCustomerInfo?.customerName?.trim() ||
                        !cryptoCustomerInfo?.customerEmail?.trim() ||
                        !cryptoCustomerInfo?.customerPhone?.trim()
                      }
                      onClick={() => setCryptoStep("payment")}
                      data-testid="button-continue-crypto"
                    >
                      Continuer vers le paiement crypto
                    </Button>
                  </div>
                )
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Le montant minimum pour payer en crypto est de 500 {session.currency || "XOF"}
                </div>
              )
            }
          />

          <div className="text-center pt-4 border-t">
            <Link href="/" className="text-xs text-primary hover:underline cursor-pointer">
              Paiement securise par BKApay
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
