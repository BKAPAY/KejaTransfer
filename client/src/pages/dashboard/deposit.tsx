import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import type { User } from "@shared/schema";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { CountryFlag } from "@/components/country-flag";
import { ArrowDownToLine, CheckCircle2, Clock, ExternalLink, Info, Loader2, Smartphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateIncomingFee, fetchFeeConfig, formatFeePercentage } from "@/lib/fees";
import { useState, useEffect, useCallback } from "react";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { CryptoPaymentFlow } from "@/components/crypto-payment-flow";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { OperatorSelector } from "@/components/operator-selector";
import { hasMultipleCurrencies, getMbiyoPayCurrencyForCountry, getMbiyoPayCurrenciesForCountry, operatorRequiresOtp as mbiyoOperatorRequiresOtp, getOtpInstructionsForCountry } from "@shared/mbiyopay-countries";
import { paydunyaRequiresOtp, getPaydunyaOtpConfig } from "@shared/paydunya-otp";
import { useConvertedMinimums } from "@/hooks/use-converted-minimums";
import { getCurrencyDecimals } from "@/lib/currency";
import { usePaymentCountdown, DEFAULT_COUNTDOWN_DURATION } from "@/hooks/use-payment-countdown";

interface ConversionData {
  convertedAmount: number;
  targetCurrency: string;
  conversionRate: number;
  isLoading: boolean;
}

const depositSchema = z.object({
  country: z.string().min(1, "Selectionnez un pays"),
  operator: z.string().min(1, "Selectionnez un operateur"),
  phone: z.string().min(8, "Le numero de telephone est requis"),
});

type DepositFormData = z.infer<typeof depositSchema>;

export default function Deposit() {
  const { toast } = useToast();
  const [paymentStep, setPaymentStep] = useState<"form" | "polling" | "completed" | "otp" | "redirect">("form");
  const [depositAmount, setDepositAmount] = useState<number | undefined>(undefined);
  const [paymentData, setPaymentData] = useState<{
    transactionId?: string;
    fedapayTransactionId?: number;
    message?: string;
    redirectUrl?: string;
    ussdInstruction?: string;
    paydunyaToken?: string;
    requiresOTP?: boolean;
    instructions?: string;
    otpInstructions?: string;
    otpUssdCode?: string;
    otpHint?: string;
    provider?: string;
  }>({});
  const [otpCode, setOtpCode] = useState("");
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [conversionData, setConversionData] = useState<ConversionData | null>(null);

  const countdown = usePaymentCountdown({
    invoiceToken: paymentData.paydunyaToken || null,
    transactionId: paymentData.transactionId || null,
    enabled: paymentStep === "polling" || paymentStep === "redirect",
    durationSeconds: DEFAULT_COUNTDOWN_DURATION,
    onCompleted: () => {
      setPollingStatus("completed");
      setPaymentStep("completed");
      toast({
        title: "Paiement reussi",
        description: "Votre depot a ete complete",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setTimeout(() => {
        form.reset();
        setPaymentData({});
        setPollingStatus(null);
        setPaymentStep("form");
      }, 3000);
    },
    onFailed: () => {
      setPaymentStep("form");
      toast({
        title: "Paiement echoue",
        description: "Le paiement n'a pas abouti",
        variant: "destructive",
      });
    },
    onExpired: () => {
      setPaymentStep("form");
      toast({
        title: "Delai expire",
        description: "Le paiement n'a pas ete confirme dans le delai imparti",
        variant: "destructive",
      });
    },
  });
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");
  const [feePercentage, setFeePercentage] = useState<number>(60);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });
  
  const userBalanceCurrency = user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const { depositMin, cryptoMin } = useConvertedMinimums(userBalanceCurrency);

  const { data: enabledCountriesOperators, isLoading: isLoadingOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/deposits"],
  });

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      country: "",
      operator: "",
      phone: "",
    },
  });

  const selectedCountry = form.watch("country");
  const selectedOperator = form.watch("operator");
  const amount = depositAmount;

  const currentOperatorNeedsOtp = selectedCountry && selectedOperator
    ? (mbiyoOperatorRequiresOtp(selectedCountry, selectedOperator) || paydunyaRequiresOtp(selectedCountry, selectedOperator))
    : false;

  const currentOtpInstructions = selectedCountry && selectedOperator && currentOperatorNeedsOtp
    ? (mbiyoOperatorRequiresOtp(selectedCountry, selectedOperator)
        ? getOtpInstructionsForCountry(selectedCountry)
        : (() => {
            const config = getPaydunyaOtpConfig(selectedCountry, selectedOperator);
            return config && config.instructions ? { ussdCode: config.ussdCode || "", instructions: config.instructions, hint: config.hint || "" } : { ussdCode: "#144#", instructions: "Composez le code USSD pour obtenir votre code OTP", hint: "" };
          })())
    : null;

  // Auto-detect country from IP address
  useEffect(() => {
    const detectCountry = async () => {
      // Only auto-detect if no country is selected yet
      if (selectedCountry) return;
      
      try {
        const response = await fetch("/api/detect-country");
        if (response.ok) {
          const data = await response.json();
          if (data.detected && data.country && enabledCountriesOperators) {
            // Only set if the detected country is enabled
            if (Object.keys(enabledCountriesOperators).includes(data.country)) {
              form.setValue("country", data.country);
              console.log(`[GeoIP] Auto-selected country: ${data.country}`);
            }
          }
        }
      } catch (error) {
        console.error("[GeoIP] Failed to detect country:", error);
      }
    };
    
    if (enabledCountriesOperators && !selectedCountry) {
      detectCountry();
    }
  }, [enabledCountriesOperators, selectedCountry, form]);

  // Filter countries to only show those enabled by admin (country-level payin enabled)
  // Note: countries may have empty operator lists, UI will show "no operators" message
  const collectCountries = enabledCountriesOperators 
    ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
    : [];
  
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && selectedCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  // Fetch dynamic fee from database when country/operator changes
  useEffect(() => {
    if (selectedCountry && selectedOperator) {
      fetchFeeConfig(selectedCountry, selectedOperator).then(fees => {
        setFeePercentage(fees.incoming);
      });
    }
  }, [selectedCountry, selectedOperator]);

  const netAmount = amount ? calculateIncomingFee(Math.floor(amount), feePercentage).netAmount : 0;

  // Handle currency selection when country changes
  useEffect(() => {
    if (selectedCountry && hasMultipleCurrencies(selectedCountry)) {
      const currencies = getMbiyoPayCurrenciesForCountry(selectedCountry);
      setSelectedCurrency(currencies[0]);
    } else if (selectedCountry) {
      const countryCurrency = COUNTRIES.find(c => c.code === selectedCountry)?.currency || "XOF";
      setSelectedCurrency(countryCurrency);
    }
  }, [selectedCountry]);

  // Currency conversion: user's balance currency -> payment currency (country selected)
  // User enters amount in THEIR currency, we show converted amount in the SELECTED country's currency
  // IMPORTANT: Only calculate payment currency if a country is actually selected
  const paymentCurrency = selectedCountry 
    ? (hasMultipleCurrencies(selectedCountry) 
        ? selectedCurrency 
        : (COUNTRIES.find(c => c.code === selectedCountry)?.currency || userBalanceCurrency))
    : userBalanceCurrency; // Default to user's currency when no country selected
  // Only need conversion if a country is selected AND its currency differs from user's currency
  const needsConversion = selectedCountry && paymentCurrency !== userBalanceCurrency;

  const fetchConversion = useCallback(async (amountToConvert: number, fromCurrency: string, toCurrency: string) => {
    if (!amountToConvert || amountToConvert <= 0 || fromCurrency === toCurrency) {
      setConversionData(null);
      return;
    }

    setConversionData(prev => prev ? { ...prev, isLoading: true } : { convertedAmount: 0, targetCurrency: toCurrency, conversionRate: 0, isLoading: true });

    try {
      const res = await fetch("/api/convert-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountToConvert, fromCurrency, toCurrency }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setConversionData({
          convertedAmount: data.convertedAmount,
          targetCurrency: data.targetCurrency,
          conversionRate: data.conversionRate,
          isLoading: false,
        });
      } else {
        setConversionData(null);
      }
    } catch (error) {
      console.error("Currency conversion error:", error);
      setConversionData(null);
    }
  }, []);

  useEffect(() => {
    if (needsConversion && amount && amount > 0) {
      const debounceTimer = setTimeout(() => {
        // Convert FROM user's balance currency TO the payment currency of selected country
        fetchConversion(amount, userBalanceCurrency, paymentCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, amount, paymentCurrency, userBalanceCurrency, fetchConversion, selectedCurrency]);

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const providerAmount = needsConversion && conversionData?.convertedAmount 
        ? conversionData.convertedAmount 
        : depositAmount;
      const providerCurrency = needsConversion && conversionData?.targetCurrency
        ? conversionData.targetCurrency
        : selectedCurrency;
      
      const res = await apiRequest("POST", "/api/fedapay/deposit", {
        ...data,
        amount: providerAmount,
        currency: providerCurrency,
        originalAmount: depositAmount,
        originalCurrency: userBalanceCurrency,
        ...(currentOperatorNeedsOtp && otpCode.trim() ? { otpCode: otpCode.trim() } : {}),
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        setPaymentData({
          transactionId: response.transactionId,
          fedapayTransactionId: response.fedapayTransactionId,
          message: response.message,
          redirectUrl: response.redirectUrl,
          ussdInstruction: response.ussdInstruction,
          paydunyaToken: response.token,
          requiresOTP: response.requiresOTP,
          instructions: response.instructions,
          provider: response.provider,
        });
        
        if (response.requiresOTP && !currentOperatorNeedsOtp) {
          countdown.resetCountdown();
          setPaymentStep("otp");
          toast({
            title: "Code OTP requis",
            description: response.ussdInstruction || "Generez votre code de paiement",
          });
        } else if (response.redirectUrl) {
          countdown.startCountdown();
          setPaymentStep("redirect");
          setOtpCode("");
          toast({
            title: "Redirection requise",
            description: "Cliquez sur le bouton pour finaliser le paiement",
          });
        } else {
          countdown.startCountdown();
          setPaymentStep("polling");
          setOtpCode("");
        }
      } else if (response.requiresOTP && !currentOperatorNeedsOtp) {
        countdown.resetCountdown();
        setPaymentData({
          otpInstructions: response.otpInstructions,
          otpUssdCode: response.otpUssdCode,
          otpHint: response.otpHint,
          provider: response.provider,
          requiresOTP: true,
        });
        setPaymentStep("otp");
        toast({
          title: "Code OTP requis",
          description: response.otpInstructions || "Generez votre code de paiement Orange Money",
        });
      } else {
        countdown.resetCountdown();
        setPaymentStep("form");
        toast({
          title: "Erreur",
          description: response.error || "Erreur lors du depot",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      countdown.resetCountdown();
      setPaymentStep("form");
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du depot",
        variant: "destructive",
      });
    },
  });

  const otpMutation = useMutation({
    mutationFn: async ({ authorizationCode }: { authorizationCode: string }) => {
      const formData = form.getValues();
      
      if (paymentData.provider === "mbiyopay") {
        const providerAmount = conversionData ? Math.floor(conversionData.convertedAmount) : depositAmount;
        const providerCurrency = conversionData ? conversionData.targetCurrency : userBalanceCurrency;
        const res = await apiRequest("POST", "/api/fedapay/deposit", {
          ...formData,
          amount: providerAmount,
          currency: providerCurrency,
          originalAmount: depositAmount,
          originalCurrency: userBalanceCurrency,
          otpCode: authorizationCode,
        });
        return res.json();
      }
      
      const res = await apiRequest("POST", "/api/payment-links/softpay-confirm", {
        token: paymentData.paydunyaToken,
        transactionId: paymentData.transactionId,
        authorizationCode,
        country: formData.country,
        operator: formData.operator,
        customerPhone: formData.phone,
        customerName: user ? `${user.firstName} ${user.lastName}`.trim() : "Client",
        customerEmail: user?.email || "noreply@bkapay.com",
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        if (paymentData.provider === "mbiyopay") {
          setPaymentData(prev => ({
            ...prev,
            transactionId: response.transactionId,
            redirectUrl: response.redirectUrl,
            instructions: response.instructions,
          }));
        }
        if (response.redirectUrl) {
          countdown.startCountdown();
          setPaymentStep("redirect");
          setOtpCode("");
          toast({
            title: "Redirection requise",
            description: "Cliquez sur le bouton pour finaliser le paiement",
          });
        } else {
          countdown.startCountdown();
          setPaymentStep("polling");
          setOtpCode("");
          toast({
            title: "Code valide",
            description: "Veuillez valider le paiement sur votre telephone",
          });
        }
      } else {
        toast({
          title: "Erreur",
          description: response.error || "Code OTP invalide",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la validation du code",
        variant: "destructive",
      });
    },
  });

  const handleOtpSubmit = () => {
    if (!otpCode.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer le code OTP",
        variant: "destructive",
      });
      return;
    }
    
    if (paymentData.provider !== "mbiyopay" && (!paymentData.paydunyaToken || !paymentData.transactionId)) {
      toast({
        title: "Erreur",
        description: "Donnees de paiement manquantes. Veuillez recommencer.",
        variant: "destructive",
      });
      setPaymentStep("form");
      return;
    }
    
    otpMutation.mutate({ authorizationCode: otpCode });
  };


  const onSubmit = (data: DepositFormData) => {
    if (!depositAmount || depositAmount < depositMin) {
      toast({
        title: "Montant insuffisant",
        description: `Le montant minimum est de ${depositMin.toLocaleString("fr-FR")} ${userBalanceCurrency}`,
        variant: "destructive",
      });
      return;
    }
    if (currentOperatorNeedsOtp && !otpCode.trim()) {
      toast({
        title: "Code OTP requis",
        description: "Veuillez entrer le code OTP avant de continuer",
        variant: "destructive",
      });
      return;
    }
    if (!currentOperatorNeedsOtp) {
      countdown.startCountdown();
      setPaymentStep("polling");
    }
    depositMutation.mutate(data);
  };

  const handleBackToForm = () => {
    countdown.resetCountdown();
    setPaymentStep("form");
    setPaymentData({});
    form.reset();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5" />
          Depot
        </h1>
        <p className="text-sm text-muted-foreground">
          Ajoutez des fonds via mobile money
        </p>
      </div>

      {user && (
        <Alert className="py-2 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <AlertDescription className="text-xs text-blue-900 dark:text-blue-100">
            <strong>Solde disponible:</strong> {new Intl.NumberFormat("fr-FR").format(user.balance || 0)} {userBalanceCurrency}
          </AlertDescription>
        </Alert>
      )}

      {paymentStep === "polling" && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Smartphone className="h-16 w-16 text-primary" />
                <div className="absolute -top-1 -right-1">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-lg">Validation en attente</p>
              <p className="text-sm text-muted-foreground mt-2">
                {form.getValues("operator")?.toLowerCase() === "wave"
                  ? "Une demande de paiement Wave a ete envoyee. Ouvrez l'application Wave sur votre telephone et acceptez la demande de paiement."
                  : form.getValues("operator")?.toLowerCase() === "orange"
                    ? "Une demande de paiement Orange Money a ete envoyee sur votre telephone."
                    : "Une demande de paiement a ete envoyee sur votre telephone."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {form.getValues("operator")?.toLowerCase() === "wave"
                  ? "Verifiez vos notifications Wave pour valider le paiement."
                  : "Veuillez valider le paiement sur votre application mobile money."}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
              <p className="text-3xl font-mono font-bold text-primary" data-testid="text-countdown">
                {countdown.formattedTime}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Montant</p>
              <p className="text-2xl font-bold text-primary">
                {amount?.toLocaleString()} FCFA
              </p>
            </div>
            {paymentData.ussdInstruction && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 text-left">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900 dark:text-blue-100 ml-2 whitespace-pre-line">
                  {paymentData.ussdInstruction}
                </AlertDescription>
              </Alert>
            )}
            {paymentData.instructions && (
              <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800 text-left">
                <Info className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm text-purple-900 dark:text-purple-100 ml-2">
                  <p className="font-semibold mb-1">Instructions de l'operateur</p>
                  <p className="whitespace-pre-line">{paymentData.instructions}</p>
                </AlertDescription>
              </Alert>
            )}
            {paymentData.redirectUrl && (
              <Button
                onClick={() => window.open(paymentData.redirectUrl, "_blank")}
                className="w-full"
                data-testid="button-redirect-payment"
              >
                {form.getValues("operator")?.toLowerCase() === "wave" 
                  ? "Ouvrir Wave pour scanner le QR code" 
                  : form.getValues("operator")?.toLowerCase() === "orange" 
                    ? "Ouvrir la page de paiement Orange Money"
                    : "Ouvrir la page de paiement"}
              </Button>
            )}
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100 ml-2">
                Ne fermez pas cette page. La verification est automatique.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleBackToForm}
              variant="outline"
              size="sm"
              data-testid="button-cancel-polling"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      )}

      {paymentStep === "redirect" && paymentData.redirectUrl && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <ExternalLink className="h-12 w-12 mx-auto text-blue-600" />
            <div>
              <p className="font-semibold text-lg">
                {form.getValues("operator")?.toLowerCase() === "wave" ? "Paiement Wave" : "Finaliser le paiement"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {form.getValues("operator")?.toLowerCase() === "wave"
                  ? "Cliquez sur le bouton ci-dessous pour completer votre paiement via Wave"
                  : "Cliquez sur le bouton ci-dessous pour finaliser votre paiement"}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
              <p className="text-3xl font-mono font-bold text-primary" data-testid="text-redirect-countdown">
                {countdown.formattedTime}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Montant</p>
              <p className="text-2xl font-bold text-primary">
                {amount?.toLocaleString()} FCFA
              </p>
            </div>
            <Button
              onClick={() => {
                if (paymentData.redirectUrl) {
                  window.open(paymentData.redirectUrl, "_blank");
                }
              }}
              className="w-full"
              variant="default"
              size="lg"
              data-testid="button-redirect-payment"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              {form.getValues("operator")?.toLowerCase() === "wave"
                ? "Aller a Wave pour payer"
                : "Finaliser le paiement"}
            </Button>
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100 ml-2">
                Apres avoir paye, revenez ici. La verification est automatique.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleBackToForm}
              variant="outline"
              size="sm"
              data-testid="button-cancel-redirect"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      )}

      {paymentStep === "completed" && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            <div>
              <p className="font-semibold text-green-700">Paiement reussi!</p>
              <p className="text-sm text-muted-foreground">
                Votre depot a ete complete avec succes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentStep === "otp" && (
        <Card>
          <CardContent className="py-8 space-y-4">
            <div className="text-center space-y-2">
              <Smartphone className="h-12 w-12 mx-auto text-primary" />
              <p className="font-semibold text-lg">Code de confirmation requis</p>
              <p className="text-sm text-muted-foreground">
                {paymentData.otpInstructions || paymentData.ussdInstruction || "Generez votre code de paiement et entrez-le ci-dessous"}
              </p>
            </div>
            {paymentData.otpUssdCode && (
              <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <Info className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  <p className="font-semibold mb-1">Composez ce code USSD sur votre telephone :</p>
                  <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2 my-2 text-center">
                    <code className="text-lg font-bold text-orange-700 dark:text-orange-400">
                      {paymentData.otpUssdCode}
                    </code>
                  </div>
                  {paymentData.otpHint && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">{paymentData.otpHint}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Montant</p>
              <p className="text-2xl font-bold text-primary">
                {amount?.toLocaleString()} FCFA
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="otp-code" className="block text-sm font-medium">
                Code de paiement
              </label>
              <Input
                id="otp-code"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Entrez le code obtenu"
                data-testid="input-otp-code"
              />
            </div>
            <Button
              onClick={handleOtpSubmit}
              disabled={otpMutation.isPending || !otpCode.trim()}
              className="w-full"
              data-testid="button-submit-otp"
            >
              {otpMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validation...
                </>
              ) : (
                "Valider le code"
              )}
            </Button>
            <Button
              onClick={handleBackToForm}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-cancel-otp"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      )}

      {paymentStep === "form" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Details du depot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant ({userBalanceCurrency})</label>
              <Input
                type="number"
                placeholder="10000"
                data-testid="input-deposit-amount"
                min="100"
                value={depositAmount || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setDepositAmount(val === "" ? undefined : Number(val));
                }}
              />
              {depositAmount !== undefined && depositAmount < depositMin && (
                <p className="text-sm text-destructive">Le montant minimum est de {depositMin.toLocaleString("fr-FR")} {userBalanceCurrency}</p>
              )}
            </div>

            <PaymentMethodSelector
              cryptoContent={
                amount && amount >= cryptoMin ? (
                  <CryptoPaymentFlow
                    amount={amount}
                    currency={userBalanceCurrency}
                    userId={user?.id}
                    orderDescription="Depot BKApay"
                    customerName={user ? `${user.firstName} ${user.lastName}` : undefined}
                    customerEmail={user?.email}
                    onSuccess={() => {
                      setPaymentStep("completed");
                      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
                    }}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    Entrez un montant d'au moins {cryptoMin.toLocaleString("fr-FR")} {userBalanceCurrency} pour payer en crypto
                  </div>
                )
              }
              mobileMoneyContent={
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pays</FormLabel>
                          <Select 
                            value={field.value} 
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("operator", "");
                            }}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-country">
                                <SelectValue placeholder="Selectionnez un pays" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {collectCountries.map((country) => (
                                <SelectItem key={country.code} value={country.code}>
                                  <span className="flex items-center gap-2"><CountryFlag code={country.code} size="xs" />{country.name}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedCountry && hasMultipleCurrencies(selectedCountry) && (
                      <CurrencySelector
                        countryCode={selectedCountry}
                        selectedCurrency={selectedCurrency}
                        onCurrencyChange={setSelectedCurrency}
                      />
                    )}

                    {selectedCountry && (
                      <FormField
                        control={form.control}
                        name="operator"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operateur</FormLabel>
                            {countryOperators.length === 0 ? (
                              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                                Aucun operateur disponible pour ce pays
                              </div>
                            ) : (
                              <OperatorSelector
                                operators={countryOperators}
                                selectedOperator={field.value}
                                onSelect={(val) => { field.onChange(val); setOtpCode(""); }}
                                isLoading={isLoadingOperators}
                              />
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numero de telephone</FormLabel>
                          <FormControl>
                            <PhoneInputWithPrefix
                              country={selectedCountry}
                              value={field.value}
                              onChange={field.onChange}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {conversionData && (
                      <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                          Montant a payer ({paymentCurrency})
                        </p>
                        {conversionData.isLoading ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                            <span className="text-sm text-green-600">Conversion en cours...</span>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-green-800 dark:text-green-200" data-testid="text-converted-amount">
                            {new Intl.NumberFormat("fr-FR", {
                              minimumFractionDigits: getCurrencyDecimals(paymentCurrency),
                              maximumFractionDigits: getCurrencyDecimals(paymentCurrency),
                            }).format(conversionData.convertedAmount)} {paymentCurrency}
                          </p>
                        )}
                      </div>
                    )}

                    {amount && selectedCountry && selectedOperator && netAmount > 0 && (
                      <div className="bg-muted p-3 rounded-md border">
                        <p className="text-sm text-muted-foreground">
                          Vous recevrez
                        </p>
                        <p className="text-lg font-semibold text-foreground" data-testid="text-net-amount">
                          {new Intl.NumberFormat("fr-FR", {
                            minimumFractionDigits: getCurrencyDecimals(userBalanceCurrency),
                            maximumFractionDigits: getCurrencyDecimals(userBalanceCurrency),
                          }).format(netAmount)} {userBalanceCurrency}
                        </p>
                      </div>
                    )}

                    {currentOperatorNeedsOtp && currentOtpInstructions && (
                      <div className="space-y-3">
                        <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                          <Info className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                            <p className="font-semibold mb-1">Instructions pour obtenir votre code OTP :</p>
                            <p className="whitespace-pre-line">{currentOtpInstructions.instructions}</p>
                            {currentOtpInstructions.ussdCode && (
                              <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2 my-2 text-center">
                                <code className="text-lg font-bold text-orange-700 dark:text-orange-400">
                                  {currentOtpInstructions.ussdCode}
                                </code>
                              </div>
                            )}
                            {currentOtpInstructions.hint && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{currentOtpInstructions.hint}</p>
                            )}
                          </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                          <label htmlFor="otp-code-inline" className="block text-sm font-medium">
                            Code de paiement OTP
                          </label>
                          <Input
                            id="otp-code-inline"
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder="Entrez le code OTP obtenu"
                            data-testid="input-otp-code-inline"
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={depositMutation.isPending || countryOperators.length === 0 || (currentOperatorNeedsOtp && !otpCode.trim())}
                      data-testid="button-submit-deposit"
                    >
                      {depositMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          En cours...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {currentOperatorNeedsOtp ? "Valider le paiement" : "Continuer"}
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
