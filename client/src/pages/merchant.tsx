import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { MerchantLink } from "@shared/schema";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, AlertCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePaymentCountdown } from "@/hooks/use-payment-countdown";

const merchantPaymentSchema = z.object({
  amount: z.number().min(100, "Le montant minimum est de 100 XOF"),
  customerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  customerEmail: z.string().email("Email invalide"),
  country: z.string().min(1, "Sélectionnez un pays"),
  customerPhone: z.string().min(8, "Numéro de téléphone invalide"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
});

type MerchantPaymentFormData = z.infer<typeof merchantPaymentSchema>;

// Instructions USSD Orange par pays
const ORANGE_INSTRUCTIONS: Record<string, string> = {
  SN: "Composez #144#391*VOTRE CODE PIN ORANGE MONEY# pour obtenir votre code de paiement",
  CI: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
  BF: "Composez *555*6# sur votre téléphone pour compléter le paiement",
};

// Clé pour stocker l'état du paiement
function getMerchantPaymentStateKey(token: string): string {
  return `merchant_payment_state_${token}`;
}

interface MerchantPaymentState {
  stage: "form" | "ussd" | "otp" | "polling" | "completed" | "failed";
  invoiceToken: string | null;
  transactionId: string | null;
  ussdInstruction: string | null;
  wizallTransactionId: string | null;
  paidAmount: number;
  country: string;
  operator: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

function saveMerchantPaymentState(token: string, state: MerchantPaymentState): void {
  localStorage.setItem(getMerchantPaymentStateKey(token), JSON.stringify(state));
}

function loadMerchantPaymentState(token: string): MerchantPaymentState | null {
  const stored = localStorage.getItem(getMerchantPaymentStateKey(token));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function clearMerchantPaymentState(token: string): void {
  localStorage.removeItem(getMerchantPaymentStateKey(token));
}

export default function Merchant() {
  const [, params] = useRoute("/merchant/:token");
  const token = params?.token;
  const [paymentStage, setPaymentStage] = useState<"form" | "ussd" | "otp" | "polling" | "completed" | "failed">("form");
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [ussdInstruction, setUssdInstruction] = useState<string | null>(null);
  const [wizallTransactionId, setWizallTransactionId] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [savedCountry, setSavedCountry] = useState<string>("");
  const [savedOperator, setSavedOperator] = useState<string>("");
  const { toast } = useToast();

  const { data: merchantLink, isLoading: linkLoading } = useQuery<MerchantLink>({
    queryKey: ["/api/merchant-links/public", token],
    enabled: !!token,
  });

  const form = useForm<MerchantPaymentFormData>({
    resolver: zodResolver(merchantPaymentSchema),
    defaultValues: {
      amount: undefined as any,
      customerName: "",
      customerEmail: "",
      country: "",
      customerPhone: "",
      operator: "",
    },
  });

  // Restaurer l'état du paiement au chargement
  useEffect(() => {
    if (!token) return;
    
    const savedState = loadMerchantPaymentState(token);
    if (savedState && savedState.stage !== "form" && savedState.stage !== "completed" && savedState.stage !== "failed") {
      setPaymentStage(savedState.stage);
      setInvoiceToken(savedState.invoiceToken);
      setTransactionId(savedState.transactionId);
      setUssdInstruction(savedState.ussdInstruction);
      setWizallTransactionId(savedState.wizallTransactionId);
      setPaidAmount(savedState.paidAmount);
      setSavedCountry(savedState.country);
      setSavedOperator(savedState.operator);
      
      // Restaurer les valeurs du formulaire pour confirmation
      form.reset({
        amount: savedState.paidAmount,
        customerName: savedState.customerName,
        customerEmail: savedState.customerEmail,
        customerPhone: savedState.customerPhone,
        country: savedState.country,
        operator: savedState.operator,
      });
    }
  }, [token, form]);

  const selectedCountry = form.watch("country");
  const countryOperators = selectedCountry ? OPERATORS[(selectedCountry as keyof typeof OPERATORS) || ("BJ" as const)] || [] : [];

  // Payment countdown hook with persistent timer
  const countdown = usePaymentCountdown({
    invoiceToken,
    transactionId,
    enabled: paymentStage === "polling",
    onCompleted: () => {
      setPaymentStage("completed");
      if (token) clearMerchantPaymentState(token);
      toast({
        title: "Paiement réussi",
        description: "Votre transaction a été confirmée",
      });
    },
    onFailed: () => {
      setPaymentStage("failed");
      if (token) clearMerchantPaymentState(token);
      toast({
        title: "Paiement échoué",
        description: "La transaction n'a pas pu être complétée",
        variant: "destructive",
      });
    },
    onExpired: () => {
      setPaymentStage("failed");
      if (token) clearMerchantPaymentState(token);
      toast({
        title: "Délai expiré",
        description: "Le temps de validation a expiré",
        variant: "destructive",
      });
    },
  });

  // SOFTPAY INIT mutation
  const initMutation = useMutation({
    mutationFn: async (data: MerchantPaymentFormData) => {
      const res = await apiRequest("POST", `/api/merchant-links/softpay-init/${token}`, {
        amount: data.amount,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        country: data.country,
        operator: data.operator,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.transactionId && data.token) {
        const formData = form.getValues();
        setTransactionId(data.transactionId);
        setInvoiceToken(data.token);
        setUssdInstruction(data.ussdInstruction || data.message || null);
        setPaidAmount(formData.amount);
        setSavedCountry(formData.country);
        setSavedOperator(formData.operator);
        
        let newStage: "ussd" | "otp" | "polling" = "polling";
        
        if (data.requiresTwoStep) {
          newStage = "ussd";
        } else if (data.requiresOTP) {
          newStage = "otp";
        } else {
          countdown.startCountdown();
          toast({
            title: "Paiement initié",
            description: "Veuillez valider le paiement sur votre téléphone",
          });
        }
        
        setPaymentStage(newStage);
        
        // Sauvegarder l'état pour persistance
        if (token) {
          saveMerchantPaymentState(token, {
            stage: newStage,
            invoiceToken: data.token,
            transactionId: data.transactionId,
            ussdInstruction: data.ussdInstruction || data.message || null,
            wizallTransactionId: null,
            paidAmount: formData.amount,
            country: formData.country,
            operator: formData.operator,
            customerName: formData.customerName,
            customerEmail: formData.customerEmail,
            customerPhone: formData.customerPhone,
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'initialisation du paiement",
        variant: "destructive",
      });
    },
  });

  // SOFTPAY CONFIRM mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ authorizationCode }: { authorizationCode?: string }) => {
      const formData = form.getValues();
      const country = formData.country || savedCountry;
      const operator = formData.operator || savedOperator;
      const payload: any = {
        token: invoiceToken,
        transactionId,
        authorizationCode,
        country,
        operator,
        customerPhone: formData.customerPhone,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
      };
      
      if (wizallTransactionId && authorizationCode) {
        payload.wizallTransactionId = wizallTransactionId;
      }
      
      const res = await apiRequest("POST", "/api/merchant-links/softpay-confirm", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        if (data.requiresOTP && data.wizallTransactionId) {
          setWizallTransactionId(data.wizallTransactionId);
          setPaymentStage("otp");
          
          if (token) {
            const currentState = loadMerchantPaymentState(token);
            if (currentState) {
              saveMerchantPaymentState(token, {
                ...currentState,
                stage: "otp",
                wizallTransactionId: data.wizallTransactionId,
              });
            }
          }
          
          toast({
            title: "Code OTP envoyé",
            description: "Veuillez entrer le code reçu par SMS",
          });
        } else if (data.redirectUrl) {
          if (token) clearMerchantPaymentState(token);
          window.location.href = data.redirectUrl;
        } else {
          countdown.startCountdown();
          setPaymentStage("polling");
          
          if (token) {
            const currentState = loadMerchantPaymentState(token);
            if (currentState) {
              saveMerchantPaymentState(token, {
                ...currentState,
                stage: "polling",
              });
            }
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
      setPaymentStage("form");
      if (token) clearMerchantPaymentState(token);
    },
  });

  const onSubmit = async (data: MerchantPaymentFormData) => {
    initMutation.mutate(data);
  };

  const handleConfirm = async () => {
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

  const handleOTPSubmit = async () => {
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (linkLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Chargement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!merchantLink || !merchantLink.isActive) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <img src={logoImage} alt="BKApay" className="h-16 w-auto mx-auto mb-4" />
              <p className="text-muted-foreground">Lien marchand introuvable ou inactif</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: Completed - Show success logo only
  if (paymentStage === "completed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            
            <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400" data-testid="icon-success" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Paiement Réussi</h2>
              <p className="text-sm text-muted-foreground">Votre transaction a été confirmée avec succès</p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(paidAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: Failed - Show error logo only
  if (paymentStage === "failed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            
            <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" data-testid="icon-failed" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Paiement Échoué</h2>
              <p className="text-sm text-muted-foreground">
                {countdown.isExpired ? "Le délai de validation a expiré" : "La transaction n'a pas pu être complétée"}
              </p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(paidAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: Polling with countdown
  if (paymentStage === "polling") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" data-testid="icon-polling" />
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Paiement en cours</h2>
                <p className="text-sm text-muted-foreground">
                  Veuillez valider le paiement sur votre téléphone
                </p>
              </div>

              {/* Countdown Timer */}
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: USSD instructions
  if (paymentStage === "ussd") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Instructions de paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ussdInstruction && (
              <Alert className="bg-primary/5 border-primary/20">
                <AlertDescription className="text-sm whitespace-pre-line">
                  {ussdInstruction}
                </AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Suivez les instructions sur votre téléphone pour compléter le paiement
            </p>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || confirmMutation.isPending}
              className="w-full"
              data-testid="button-confirm-ussd"
            >
              {isSubmitting || confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                "J'ai complété le paiement"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: OTP input
  if (paymentStage === "otp") {
    const currentCountry = form.getValues("country") || savedCountry;
    const currentOperator = form.getValues("operator") || savedOperator;
    const isOrangeOperator = currentOperator.toLowerCase().includes("orange");
    const orangeInstruction = isOrangeOperator && currentCountry ? ORANGE_INSTRUCTIONS[currentCountry] : null;
    
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Code de confirmation</CardTitle>
            <CardDescription>
              {isOrangeOperator 
                ? "Générez votre code de paiement Orange Money" 
                : "Entrez le code OTP reçu par SMS"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Instructions Orange Money */}
            {orangeInstruction && (
              <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>Instructions :</strong><br/>
                  {orangeInstruction}
                </AlertDescription>
              </Alert>
            )}
            
            <div>
              <label htmlFor="auth-code" className="block text-sm font-medium mb-2">
                Code de paiement
              </label>
              <Input
                id="auth-code"
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Entrez le code obtenu"
                data-testid="input-otp"
              />
            </div>
            <Button
              onClick={handleOTPSubmit}
              disabled={isSubmitting || confirmMutation.isPending}
              className="w-full"
              data-testid="button-submit-otp"
            >
              {isSubmitting || confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Valider le code"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
      <Card className="w-full max-w-xs sm:max-w-sm md:max-w-lg">
        <CardHeader className="text-center space-y-2 sm:space-y-3 lg:space-y-4 p-3 sm:p-4 lg:p-6">
          <div className="flex justify-center mb-1 sm:mb-2">
            <img src={logoImage} alt="BKApay" className="h-8 sm:h-10 lg:h-12 w-auto" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Envoyer de l'argent à</p>
            <CardTitle className="text-sm sm:text-lg lg:text-2xl mb-1 sm:mb-2">{merchantLink.merchantName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Montant (XOF)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10000"
                        data-testid="input-amount"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Nom complet</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jean Dupont"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jean@exemple.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Pays</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Sélectionnez un pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={selectedCountry === "SN" ? "771234567" : "97123456"}
                        data-testid="input-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="operator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Opérateur</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-operator">
                          <SelectValue placeholder="Sélectionnez votre opérateur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countryOperators.map((op) => (
                          <SelectItem key={op.code} value={op.code}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={initMutation.isPending}
                data-testid="button-pay"
              >
                {initMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initialisation...
                  </>
                ) : (
                  "Payer maintenant"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        {/* Footer sécurisé */}
        <div className="border-t px-4 py-3 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Paiement sécurisé avec{" "}
            <a 
              href="/" 
              className="text-primary font-semibold hover:underline"
              data-testid="link-bkapay-home"
            >
              BKApay
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
