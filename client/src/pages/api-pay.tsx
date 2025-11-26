import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle2, Phone, Mail, User, Globe } from "lucide-react";
import { OPERATORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/bkapay-logo.png";

interface ApiKeyInfo {
  siteName: string;
  isActive: boolean;
}

type PaymentStage = "form" | "init" | "ussd" | "otp" | "polling" | "completed" | "failed";

interface PaymentState {
  stage: PaymentStage;
  transactionId?: string;
  ussdCode?: string;
  message?: string;
  requiresOtp?: boolean;
  error?: string;
}

export default function ApiPay() {
  const [, setLocation] = useLocation();
  const { key } = useParams<{ key: string }>();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const amount = parseInt(urlParams.get("amount") || "0");
  const description = urlParams.get("description") || "";
  const callbackUrl = urlParams.get("callback") || "";
  
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [otpCode, setOtpCode] = useState("");
  
  const [paymentState, setPaymentState] = useState<PaymentState>({ stage: "form" });

  const { data: apiKeyInfo, isLoading: isLoadingKey, error: keyError } = useQuery<ApiKeyInfo>({
    queryKey: [`/api/api-key-info/${key}`],
    enabled: !!key,
  });

  const countryOperators = OPERATORS[(country as keyof typeof OPERATORS) || ("BJ" as const)] || [];

  const initPaymentMutation = useMutation({
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
      setPaymentState({
        stage: data.requiresOtp ? "ussd" : "polling",
        transactionId: data.transactionId,
        ussdCode: data.ussdCode,
        message: data.message,
        requiresOtp: data.requiresOtp,
      });
      
      if (!data.requiresOtp) {
        startPolling(data.transactionId);
      }
    },
    onError: (error: any) => {
      setPaymentState({
        stage: "failed",
        error: error.message || "Erreur lors du paiement",
      });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/api-pay/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: paymentState.transactionId,
          otpCode,
          country,
          operator,
          customerPhone,
          customerName,
          customerEmail,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la confirmation");
      return data;
    },
    onSuccess: (data) => {
      setPaymentState({
        stage: "polling",
        transactionId: paymentState.transactionId,
        message: data.message || "Paiement en cours de traitement...",
      });
      startPolling(paymentState.transactionId!);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la confirmation",
        variant: "destructive",
      });
    },
  });

  const startPolling = (transactionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/transactions/${transactionId}/status`);
        const data = await response.json();
        
        if (data.status === "completed") {
          clearInterval(pollInterval);
          setPaymentState({ stage: "completed" });
          
          if (callbackUrl) {
            setTimeout(() => {
              window.location.href = `${callbackUrl}?status=success&transactionId=${transactionId}&amount=${amount}`;
            }, 2000);
          }
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setPaymentState({ 
            stage: "failed", 
            error: "Le paiement a echoue" 
          });
          
          if (callbackUrl) {
            setTimeout(() => {
              window.location.href = `${callbackUrl}?status=failed&transactionId=${transactionId}`;
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(pollInterval);
      if (paymentState.stage === "polling") {
        setPaymentState({
          stage: "failed",
          error: "Delai d'attente depasse. Veuillez reessayer.",
        });
      }
    }, 300000);
  };

  const handleSubmit = () => {
    if (!customerName || !customerEmail || !customerPhone || !country || !operator) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }
    initPaymentMutation.mutate();
  };

  const handleConfirmOtp = () => {
    if (!otpCode) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer le code OTP",
        variant: "destructive",
      });
      return;
    }
    confirmPaymentMutation.mutate();
  };

  if (isLoadingKey) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (keyError || !apiKeyInfo || !apiKeyInfo.isActive) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Lien invalide</p>
                <p className="text-sm text-muted-foreground">
                  Ce lien de paiement n'est pas valide ou a expire
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!amount || amount < 100) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Montant invalide</p>
                <p className="text-sm text-muted-foreground">
                  Le montant doit etre superieur a 100 XOF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <img src={logoImage} alt="BKApay" className="w-10 h-10 rounded-lg" />
            <p className="font-bold text-lg text-foreground">BKApay</p>
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
            {description && (
              <div>
                <p className="text-sm text-muted-foreground">Detail</p>
                <p className="text-sm text-foreground">{description}</p>
              </div>
            )}
          </div>

          {paymentState.stage === "form" && (
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
                <Select value={operator} onValueChange={setOperator} disabled={!country}>
                  <SelectTrigger id="operator" data-testid="select-operator">
                    <SelectValue placeholder={country ? "Selectionnez un operateur" : "Choisissez un pays d'abord"} />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOperators.map((op) => (
                      <SelectItem key={op.code} value={op.code}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={initPaymentMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-submit-payment"
              >
                {initPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  `Payer ${amount.toLocaleString()} XOF`
                )}
              </Button>
            </div>
          )}

          {paymentState.stage === "ussd" && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Composez ce code USSD:</p>
                <p className="text-2xl font-bold text-primary font-mono">
                  {paymentState.ussdCode || "*144#"}
                </p>
              </div>
              
              {paymentState.message && (
                <p className="text-sm text-muted-foreground text-center">
                  {paymentState.message}
                </p>
              )}

              {paymentState.requiresOtp && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Code OTP recu par SMS</Label>
                    <Input
                      id="otp"
                      placeholder="Entrez le code OTP"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      data-testid="input-otp"
                    />
                  </div>
                  
                  <Button
                    onClick={handleConfirmOtp}
                    disabled={confirmPaymentMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-otp"
                  >
                    {confirmPaymentMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirmation...
                      </>
                    ) : (
                      "Confirmer le paiement"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {paymentState.stage === "otp" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Code OTP recu par SMS</Label>
                <Input
                  id="otp"
                  placeholder="Entrez le code OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  data-testid="input-otp"
                />
              </div>
              
              <Button
                onClick={handleConfirmOtp}
                disabled={confirmPaymentMutation.isPending}
                className="w-full"
                data-testid="button-confirm-otp"
              >
                {confirmPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmation...
                  </>
                ) : (
                  "Confirmer le paiement"
                )}
              </Button>
            </div>
          )}

          {paymentState.stage === "polling" && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-semibold text-foreground">Paiement en cours</p>
              <p className="text-sm text-muted-foreground">
                {paymentState.message || "Veuillez patienter..."}
              </p>
            </div>
          )}

          {paymentState.stage === "completed" && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <p className="font-semibold text-foreground">Paiement reussi</p>
              <p className="text-sm text-muted-foreground">
                Merci pour votre paiement
              </p>
              {callbackUrl && (
                <p className="text-xs text-muted-foreground mt-2">
                  Redirection en cours...
                </p>
              )}
            </div>
          )}

          {paymentState.stage === "failed" && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="font-semibold text-foreground">Echec du paiement</p>
              <p className="text-sm text-muted-foreground">
                {paymentState.error || "Une erreur est survenue"}
              </p>
              <Button
                onClick={() => setPaymentState({ stage: "form" })}
                variant="outline"
                className="mt-4"
                data-testid="button-retry"
              >
                Reessayer
              </Button>
            </div>
          )}

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Paiement securise par BKApay
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
