import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle2, Phone, Mail, User, Globe, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { OPERATORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePaymentCountdown } from "@/hooks/use-payment-countdown";
import logoImage from "@assets/bkapay-logo.png";

interface ApiKeyInfo {
  siteName: string;
  isActive: boolean;
}

type PaymentStage = "form" | "ussd" | "otp" | "polling" | "completed" | "failed" | "redirect";

interface PaymentState {
  stage: PaymentStage;
  invoiceToken: string | null;
  transactionId: string | null;
  ussdInstruction: string | null;
  wizallTransactionId: string | null;
  redirectUrl: string | null;
  country: string;
  operator: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

const ORANGE_INSTRUCTIONS: Record<string, string> = {
  SN: "Composez #144#391*VOTRE CODE PIN ORANGE MONEY# pour obtenir votre code de paiement",
  CI: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
  BF: "Composez *555*6# sur votre telephone pour obtenir votre code OTP",
};

function getPaymentStateKey(key: string): string {
  return `api_payment_state_${key}`;
}

function savePaymentState(key: string, state: PaymentState): void {
  localStorage.setItem(getPaymentStateKey(key), JSON.stringify(state));
}

function loadPaymentState(key: string): PaymentState | null {
  const stored = localStorage.getItem(getPaymentStateKey(key));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function clearPaymentState(key: string): void {
  localStorage.removeItem(getPaymentStateKey(key));
}

export default function ApiPay() {
  const [, setLocation] = useLocation();
  const { key } = useParams<{ key: string }>();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const amount = parseInt(urlParams.get("amount") || "0");
  const description = urlParams.get("description") || "";
  const callbackUrl = urlParams.get("callback") || "";
  
  const [paymentStage, setPaymentStage] = useState<PaymentStage>("form");
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [ussdInstruction, setUssdInstruction] = useState<string | null>(null);
  const [wizallTransactionId, setWizallTransactionId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");

  const { data: apiKeyInfo, isLoading: isLoadingKey, error: keyError } = useQuery<ApiKeyInfo>({
    queryKey: [`/api/api-key-info/${key}`],
    enabled: !!key,
  });

  const { data: enabledCountriesOperators, isLoading: isLoadingOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/deposits"],
  });

  const allCountryOperators = country
    ? (OPERATORS[country as keyof typeof OPERATORS] || [])
    : [];
  
  const hasAdminConfig = Boolean(enabledCountriesOperators && country && enabledCountriesOperators[country] !== undefined);
  
  const countryOperators = isLoadingOperators 
    ? allCountryOperators
    : hasAdminConfig
      ? allCountryOperators.filter(op => (enabledCountriesOperators[country] || []).includes(op.code))
      : allCountryOperators;
  
  const noOperatorsAvailable = !isLoadingOperators && hasAdminConfig && countryOperators.length === 0;

  const [shouldStartCountdown, setShouldStartCountdown] = useState(false);

  useEffect(() => {
    if (!key) return;
    
    const savedState = loadPaymentState(key);
    if (savedState && savedState.stage !== "form" && savedState.stage !== "completed" && savedState.stage !== "failed") {
      setPaymentStage(savedState.stage);
      setInvoiceToken(savedState.invoiceToken);
      setTransactionId(savedState.transactionId);
      setUssdInstruction(savedState.ussdInstruction);
      setWizallTransactionId(savedState.wizallTransactionId);
      setRedirectUrl(savedState.redirectUrl);
      setCountry(savedState.country);
      setOperator(savedState.operator);
      setCustomerName(savedState.customerName);
      setCustomerEmail(savedState.customerEmail);
      setCustomerPhone(savedState.customerPhone);
      
      if (savedState.stage === "polling" && savedState.transactionId) {
        setShouldStartCountdown(true);
      }
    }
  }, [key]);

  const countdown = usePaymentCountdown({
    invoiceToken,
    transactionId,
    enabled: paymentStage === "polling",
    onCompleted: () => {
      setPaymentStage("completed");
      if (key) clearPaymentState(key);
      toast({
        title: "Paiement reussi",
        description: "Votre transaction a ete confirmee",
      });
      if (callbackUrl) {
        setTimeout(() => {
          window.location.href = `${callbackUrl}?status=success&transactionId=${transactionId}&amount=${amount}`;
        }, 2000);
      }
    },
    onFailed: () => {
      setPaymentStage("failed");
      if (key) clearPaymentState(key);
      toast({
        title: "Paiement echoue",
        description: "La transaction n'a pas pu etre completee",
        variant: "destructive",
      });
      if (callbackUrl) {
        setTimeout(() => {
          window.location.href = `${callbackUrl}?status=failed&transactionId=${transactionId}`;
        }, 2000);
      }
    },
    onExpired: () => {
      setPaymentStage("failed");
      if (key) clearPaymentState(key);
      toast({
        title: "Delai expire",
        description: "Le temps de validation a expire",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (shouldStartCountdown && transactionId) {
      countdown.startCountdown();
      setShouldStartCountdown(false);
    }
  }, [shouldStartCountdown, transactionId]);

  const handleNewPayment = () => {
    if (key) clearPaymentState(key);
    countdown.resetCountdown();
    setPaymentStage("form");
    setInvoiceToken(null);
    setTransactionId(null);
    setUssdInstruction(null);
    setWizallTransactionId(null);
    setRedirectUrl(null);
    setAuthCode("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCountry("");
    setOperator("");
  };

  const initMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/api-pay/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: key,
          amount,
          description,
          customerName,
          customerEmail,
          customerPhone,
          country,
          operator,
          callbackUrl: callbackUrl || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'initialisation");
      return data;
    },
    onSuccess: (data) => {
      setTransactionId(data.transactionId);
      setInvoiceToken(data.token);
      setUssdInstruction(data.ussdInstruction || data.message || null);
      
      let newStage: PaymentStage = "polling";
      
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        newStage = "redirect";
        toast({
          title: "Redirection Wave",
          description: "Cliquez sur le bouton pour completer le paiement via Wave",
        });
      } else if (data.requiresTwoStep) {
        newStage = "ussd";
      } else if (data.requiresOTP) {
        newStage = "otp";
      } else {
        countdown.startCountdown();
        toast({
          title: "Paiement initie",
          description: "Veuillez valider le paiement sur votre telephone",
        });
      }
      
      setPaymentStage(newStage);
      
      if (key) {
        savePaymentState(key, {
          stage: newStage,
          invoiceToken: data.token,
          transactionId: data.transactionId,
          ussdInstruction: data.ussdInstruction || data.message || null,
          wizallTransactionId: null,
          redirectUrl: data.redirectUrl || null,
          country,
          operator,
          customerName,
          customerEmail,
          customerPhone,
        });
      }
    },
    onError: (error: any) => {
      setPaymentStage("failed");
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'initialisation du paiement",
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ authorizationCode }: { authorizationCode?: string }) => {
      const response = await fetch("/api/api-pay/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: invoiceToken,
          transactionId,
          authorizationCode,
          country,
          operator,
          customerPhone,
          customerName,
          customerEmail,
          wizallTransactionId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la confirmation");
      return data;
    },
    onSuccess: (data) => {
      if (data.requiresOTP && data.wizallTransactionId) {
        setWizallTransactionId(data.wizallTransactionId);
        setPaymentStage("otp");
        
        if (key) {
          const currentState = loadPaymentState(key);
          if (currentState) {
            savePaymentState(key, {
              ...currentState,
              stage: "otp",
              wizallTransactionId: data.wizallTransactionId,
            });
          }
        }
        
        toast({
          title: "Code OTP envoye",
          description: "Veuillez entrer le code recu par SMS",
        });
      } else if (data.redirectUrl) {
        if (key) clearPaymentState(key);
        window.location.href = data.redirectUrl;
      } else {
        countdown.startCountdown();
        setPaymentStage("polling");
        
        if (key) {
          const currentState = loadPaymentState(key);
          if (currentState) {
            savePaymentState(key, {
              ...currentState,
              stage: "polling",
            });
          }
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la confirmation du paiement",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!customerName || !customerEmail || !customerPhone || !country || !operator) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }
    initMutation.mutate();
  };

  const handleConfirm = () => {
    if (!transactionId || !invoiceToken) {
      toast({
        title: "Erreur",
        description: "Informations de paiement manquantes",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    confirmMutation.mutate({});
    setIsSubmitting(false);
  };

  const handleOTPSubmit = () => {
    if (!authCode.trim()) {
      toast({
        title: "Code requis",
        description: "Veuillez entrer le code OTP",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    confirmMutation.mutate({ authorizationCode: authCode });
    setIsSubmitting(false);
  };

  const formatAmount = (amt: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amt);
  };

  if (isLoadingKey) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (keyError || !apiKeyInfo || !apiKeyInfo.isActive) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <img src={logoImage} alt="BKApay" className="h-12 w-auto mx-auto mb-4" />
              <div className="flex gap-3 items-start justify-center">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Lien invalide</p>
                  <p className="text-sm text-muted-foreground">
                    Ce lien de paiement n'est pas valide ou a expire
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!amount || amount < 100) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <img src={logoImage} alt="BKApay" className="h-12 w-auto mx-auto mb-4" />
              <div className="flex gap-3 items-start justify-center">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Montant invalide</p>
                  <p className="text-sm text-muted-foreground">
                    Le montant doit etre superieur a 100 XOF
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "completed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto cursor-pointer" />
            </Link>
            
            <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400" data-testid="icon-success" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Paiement Reussi</h2>
              <p className="text-sm text-muted-foreground">Votre transaction a ete confirmee avec succes</p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(amount)}</span>
              </div>
            </div>
            
            {callbackUrl && (
              <p className="text-xs text-muted-foreground">Redirection en cours...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "failed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto cursor-pointer" />
            </Link>
            
            <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" data-testid="icon-failed" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Paiement Echoue</h2>
              <p className="text-sm text-muted-foreground">
                {countdown.isExpired ? "Le delai de validation a expire" : "La transaction n'a pas pu etre completee"}
              </p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(amount)}</span>
              </div>
            </div>

            <Button
              onClick={handleNewPayment}
              variant="outline"
              className="w-full"
              data-testid="button-retry"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reessayer le paiement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "polling") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto cursor-pointer" />
            </Link>
            
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" data-testid="icon-polling" />
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Paiement en cours</h2>
                <p className="text-sm text-muted-foreground">
                  Veuillez valider le paiement sur votre telephone
                </p>
              </div>

              <div className="bg-primary/10 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
                <p className="text-3xl font-mono font-bold text-primary" data-testid="text-countdown">
                  {countdown.formattedTime}
                </p>
              </div>

              {ussdInstruction && (
                <div className="text-left bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Instructions:</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ussdInstruction}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Ne fermez pas cette page
              </p>

              <Button
                onClick={handleNewPayment}
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                data-testid="button-new-payment-polling"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Recommencer un nouveau paiement
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "redirect" && redirectUrl) {
    const handleWaveRedirect = () => {
      countdown.startCountdown();
      setPaymentStage("polling");
      
      if (key) {
        const currentState = loadPaymentState(key);
        if (currentState) {
          savePaymentState(key, {
            ...currentState,
            stage: "polling",
          });
        }
      }
      
      window.open(redirectUrl, "_blank");
    };
    
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto cursor-pointer" />
            </Link>
            <CardTitle>Paiement Wave</CardTitle>
            <CardDescription>
              Cliquez sur le bouton ci-dessous pour completer votre paiement via Wave
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                Vous serez redirige vers Wave pour finaliser le paiement de maniere securisee.
              </AlertDescription>
            </Alert>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Montant a payer</p>
              <p className="text-2xl font-bold text-primary">
                {amount.toLocaleString()} FCFA
              </p>
            </div>
            
            <Button
              onClick={handleWaveRedirect}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
              data-testid="button-wave-redirect"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Aller a Wave pour payer
            </Button>
            
            <Button
              onClick={handleNewPayment}
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              data-testid="button-new-payment-redirect"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Recommencer un nouveau paiement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "ussd") {
    const showOrangeInstructions = operator.toLowerCase() === "orange" && ORANGE_INSTRUCTIONS[country];
    
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto cursor-pointer" />
            </Link>
            <CardTitle>Confirmation du paiement</CardTitle>
            <CardDescription>
              Suivez les instructions ci-dessous pour obtenir votre code OTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showOrangeInstructions && (
              <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  {ORANGE_INSTRUCTIONS[country]}
                </AlertDescription>
              </Alert>
            )}
            
            {ussdInstruction && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">Composez ce code USSD:</p>
                <p className="text-xl font-bold text-primary font-mono">{ussdInstruction}</p>
              </div>
            )}
            
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-confirm-ussd"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                "J'ai compose le code USSD"
              )}
            </Button>
            
            <Button
              onClick={handleNewPayment}
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              data-testid="button-new-payment-ussd"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Recommencer un nouveau paiement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "otp") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto cursor-pointer" />
            </Link>
            <CardTitle>Entrez le code OTP</CardTitle>
            <CardDescription>
              Saisissez le code recu par SMS pour confirmer votre paiement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Code OTP</Label>
              <Input
                id="otp"
                placeholder="Entrez le code recu par SMS"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="text-center text-lg font-mono"
                data-testid="input-otp"
              />
            </div>
            
            <Button
              onClick={handleOTPSubmit}
              disabled={confirmMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-confirm-otp"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirmation...
                </>
              ) : (
                "Confirmer le paiement"
              )}
            </Button>
            
            <Button
              onClick={handleNewPayment}
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              data-testid="button-new-payment-otp"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Recommencer un nouveau paiement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="w-10 h-10 rounded-lg cursor-pointer" />
            </Link>
            <Link href="/" className="font-bold text-lg text-primary hover:underline">
              BKApay
            </Link>
          </div>
          <CardTitle>Payer a {apiKeyInfo.siteName}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3 pb-4 border-b">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Montant a payer</p>
              <p className="text-3xl font-bold text-primary">
                {amount.toLocaleString()} <span className="text-lg">XOF</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completez votre paiement en remplissant les informations</p>
              {description && (
                <p className="text-sm text-foreground mt-1">{description}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nom complet
              </Label>
              <Input
                id="customerName"
                placeholder="Votre nom complet"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-testid="input-customer-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerEmail" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="votre@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                data-testid="input-customer-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Pays
              </Label>
              <Select value={country} onValueChange={(v) => { setCountry(v); setOperator(""); }}>
                <SelectTrigger id="country" data-testid="select-country">
                  <SelectValue placeholder="Selectionnez un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SN">Senegal</SelectItem>
                  <SelectItem value="CI">Cote d'Ivoire</SelectItem>
                  <SelectItem value="BF">Burkina Faso</SelectItem>
                  <SelectItem value="BJ">Benin</SelectItem>
                  <SelectItem value="TG">Togo</SelectItem>
                  <SelectItem value="ML">Mali</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Numero de telephone
              </Label>
              <Input
                id="customerPhone"
                placeholder="Ex: 77 123 45 67"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                data-testid="input-customer-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator">Operateur Mobile Money</Label>
              {noOperatorsAvailable ? (
                <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                    Aucun operateur n'est disponible pour ce pays actuellement. Veuillez choisir un autre pays.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={operator} onValueChange={setOperator} disabled={!country || isLoadingOperators}>
                  <SelectTrigger id="operator" data-testid="select-operator">
                    <SelectValue placeholder={isLoadingOperators ? "Chargement..." : (country ? "Selectionnez un operateur" : "Choisissez un pays d'abord")} />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOperators.map((op) => (
                      <SelectItem key={op.code} value={op.code}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={initMutation.isPending || noOperatorsAvailable}
              className="w-full"
              size="lg"
              data-testid="button-submit-payment"
            >
              {initMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                `Payer ${amount.toLocaleString()} XOF`
              )}
            </Button>
          </div>

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
