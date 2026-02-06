import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { MerchantLink } from "@shared/schema";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Clock, Loader2, AlertCircle, XCircle, RefreshCw, ExternalLink, Copy, Check } from "lucide-react";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { CryptoPaymentFlow } from "@/components/crypto-payment-flow";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { OperatorSelector } from "@/components/operator-selector";
import { hasMultipleCurrencies, getMbiyoPayCurrenciesForCountry } from "@shared/mbiyopay-countries";
import { getCurrencyDecimals } from "@/lib/currency";

interface ConversionData {
  convertedAmount: number;
  targetCurrency: string;
  conversionRate: number;
  isLoading: boolean;
}
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePaymentCountdown } from "@/hooks/use-payment-countdown";

const merchantPaymentSchema = z.object({
  amount: z.number().min(100, "Le montant minimum est de 100"),
  customerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  customerEmail: z.string().email("Email invalide"),
  country: z.string().min(1, "Sélectionnez un pays"),
  customerPhone: z.string().min(8, "Numéro de téléphone invalide"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
});

type MerchantPaymentFormData = z.infer<typeof merchantPaymentSchema>;

// Instructions USSD Orange par pays (tous les pays où Orange est disponible)
const ORANGE_INSTRUCTIONS: Record<string, string> = {
  SN: "Composez #144#391*VOTRE CODE PIN ORANGE MONEY# pour obtenir votre code de paiement",
  CI: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
  BF: "Composez *144*4*6# pour obtenir votre code de paiement",
  ML: "Composez #144*8# pour obtenir votre code de paiement",
  GN: "Composez #144*6# pour obtenir votre code de paiement",
  CM: "Composez #150*50# pour obtenir votre code de paiement",
  CD: "Composez *144*1*1# pour obtenir votre code de paiement",
  NE: "Composez #144*4# pour obtenir votre code de paiement",
  BJ: "Composez #144*6# pour obtenir votre code de paiement",
  TG: "Composez #144*6# pour obtenir votre code de paiement",
  DEFAULT: "Composez le code USSD Orange Money de votre pays pour obtenir votre code de paiement",
};

const ORANGE_USSD_CODES: Record<string, string> = {
  SN: "#144#391*PIN#",
  CI: "#144*82#",
  BF: "*144*4*6#",
  ML: "#144*8#",
  GN: "#144*6#",
  CM: "#150*50#",
  CD: "*144*1*1#",
  NE: "#144*4#",
  BJ: "#144*6#",
  TG: "#144*6#",
  DEFAULT: "#144#",
};

const ORANGE_USSD_HINTS: Record<string, string> = {
  SN: "Remplacez PIN par votre code secret Orange Money",
  CI: "Choisissez l'option 2 pour obtenir votre code",
  BF: "Suivez les instructions pour obtenir votre code",
  ML: "Suivez les instructions pour obtenir votre code",
  GN: "Suivez les instructions pour obtenir votre code",
  CM: "Suivez les instructions pour obtenir votre code",
  CD: "Suivez les instructions pour obtenir votre code",
  NE: "Suivez les instructions pour obtenir votre code",
  BJ: "Suivez les instructions pour obtenir votre code",
  TG: "Suivez les instructions pour obtenir votre code",
  DEFAULT: "Suivez les instructions pour obtenir votre code",
};

function getOrangeUssdCode(country: string): string {
  return ORANGE_USSD_CODES[country] || ORANGE_USSD_CODES.DEFAULT;
}

function getOrangeUssdHint(country: string): string {
  return ORANGE_USSD_HINTS[country] || ORANGE_USSD_HINTS.DEFAULT;
}

// Clé pour stocker l'état du paiement
function getMerchantPaymentStateKey(token: string): string {
  return `merchant_payment_state_${token}`;
}

interface MerchantPaymentState {
  stage: "form" | "ussd" | "otp" | "polling" | "completed" | "failed" | "redirect";
  invoiceToken: string | null;
  transactionId: string | null;
  ussdInstruction: string | null;
  wizallTransactionId: string | null;
  redirectUrl: string | null;
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
  const [paymentStage, setPaymentStage] = useState<"form" | "ussd" | "otp" | "polling" | "completed" | "failed" | "redirect">("form");
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [ussdInstruction, setUssdInstruction] = useState<string | null>(null);
  const [wizallTransactionId, setWizallTransactionId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [savedCountry, setSavedCountry] = useState<string>("");
  const [savedOperator, setSavedOperator] = useState<string>("");
  const [copiedUssd, setCopiedUssd] = useState(false);
  const [conversionData, setConversionData] = useState<ConversionData | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");
  const { toast } = useToast();
  
  // État pour le flux crypto en 2 étapes
  const [cryptoStep, setCryptoStep] = useState<"info" | "payment">("info");
  const [cryptoCustomerInfo, setCryptoCustomerInfo] = useState<{
    amount: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  } | null>(null);

  const copyUssdCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedUssd(true);
    setTimeout(() => setCopiedUssd(false), 2000);
    toast({
      title: "Code copié",
      description: "Le code USSD a été copié dans le presse-papiers",
    });
  };

  const { data: merchantLink, isLoading: linkLoading } = useQuery<MerchantLink>({
    queryKey: ["/api/merchant-links/public", token],
    enabled: !!token,
  });

  // Récupérer les opérateurs activés par l'admin
  const { data: enabledCountriesOperators, isLoading: isLoadingOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/deposits"],
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
      setRedirectUrl(savedState.redirectUrl);
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
  const selectedOperator = form.watch("operator");

  // Auto-detect country from IP address
  useEffect(() => {
    const detectCountry = async () => {
      // Only auto-detect if no country is selected yet and not resuming a saved state
      if (selectedCountry || savedCountry) return;
      
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
    
    if (enabledCountriesOperators && !selectedCountry && !savedCountry) {
      detectCountry();
    }
  }, [enabledCountriesOperators, selectedCountry, savedCountry, form]);
  
  // Vérifier si l'opérateur sélectionné est Orange (nécessite code OTP)
  // IMPORTANT: Orange RDC (CD) utilise MbiyoPay qui ne nécessite PAS d'OTP
  // Seuls certains pays avec Paydunya/FedaPay nécessitent OTP pour Orange
  const ORANGE_OTP_COUNTRIES = ["SN", "CI", "BF", "ML", "GN", "NE", "BJ", "TG", "CM"]; // Exclure CD
  const isOrangeOperator = selectedOperator?.toLowerCase().includes("orange");
  const showOrangeOtpOnForm = isOrangeOperator && selectedCountry && ORANGE_OTP_COUNTRIES.includes(selectedCountry);
  
  // Filtrer les opérateurs selon la configuration admin
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  // Logique de filtrage stricte:
  // - Pendant le chargement: montrer tous (select désactivé)
  // - Une fois chargé: utiliser UNIQUEMENT les opérateurs retournés par l'API
  // - Si le pays n'est pas dans la réponse ou liste vide: aucun opérateur disponible
  const enabledOperatorsForCountry = enabledCountriesOperators && selectedCountry 
    ? (enabledCountriesOperators[selectedCountry] || [])
    : [];
  
  const countryOperators = isLoadingOperators 
    ? allCountryOperators
    : allCountryOperators.filter(op => enabledOperatorsForCountry.includes(op.code));
  
  // Déterminer si aucun opérateur n'est disponible (après chargement)
  const noOperatorsAvailable = !isLoadingOperators && selectedCountry && countryOperators.length === 0;

  // Watch amount for currency conversion
  const watchedAmount = form.watch("amount");

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

  const ownerCountry = (merchantLink as any)?.ownerCountry || null;
  const ownerCurrency = (merchantLink as any)?.ownerCurrency || "XOF";
  
  // Currency conversion (ownerCurrency -> Target Currency)
  // IMPORTANT: Only calculate target currency if a country is selected
  // This prevents conversion from triggering before user selects a country
  const targetCurrency = selectedCountry
    ? (hasMultipleCurrencies(selectedCountry) 
        ? selectedCurrency 
        : (COUNTRIES.find(c => c.code === selectedCountry)?.currency || ownerCurrency))
    : ownerCurrency; // Default to owner's currency when no country selected
  const needsConversion = selectedCountry && targetCurrency !== ownerCurrency;
  
  const fetchConversion = useCallback(async (amountToConvert: number, fromCurrency: string, toCurrency: string) => {
    if (!amountToConvert || amountToConvert <= 0 || toCurrency === fromCurrency) {
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
    if (needsConversion && watchedAmount && watchedAmount > 0) {
      const debounceTimer = setTimeout(() => {
        fetchConversion(watchedAmount, ownerCurrency, targetCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, watchedAmount, ownerCurrency, targetCurrency, fetchConversion, selectedCurrency]);

  // Fonction pour recommencer un nouveau paiement
  const handleNewPayment = () => {
    if (token) clearMerchantPaymentState(token);
    setPaymentStage("form");
    setInvoiceToken(null);
    setTransactionId(null);
    setUssdInstruction(null);
    setWizallTransactionId(null);
    setRedirectUrl(null);
    setAuthCode("");
    setPaidAmount(0);
    setSavedCountry("");
    setSavedOperator("");
    form.reset();
    countdown.resetCountdown();
  };

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

  // FedaPay payment init mutation
  const initMutation = useMutation({
    mutationFn: async (data: MerchantPaymentFormData) => {
      // Send converted amount to provider, original amount for balance credit
      const providerAmount = needsConversion && conversionData?.convertedAmount 
        ? conversionData.convertedAmount 
        : data.amount;
      const providerCurrency = needsConversion && conversionData?.targetCurrency
        ? conversionData.targetCurrency
        : selectedCurrency;
      
      const res = await apiRequest("POST", `/api/fedapay/merchant-link/${token}`, {
        amount: providerAmount,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        country: data.country,
        operator: data.operator,
        currency: providerCurrency,
        originalAmount: data.amount,
        originalCurrency: ownerCurrency,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.transactionId) {
        const formData = form.getValues();
        setTransactionId(data.transactionId);
        setInvoiceToken(data.token || data.transactionId);
        setUssdInstruction(data.ussdInstruction || data.message || "Une demande de paiement a ete envoyee sur votre telephone.");
        setPaidAmount(formData.amount);
        setSavedCountry(formData.country);
        setSavedOperator(formData.operator);
        
        // Vérifier si c'est un opérateur qui nécessite une redirection (Wave)
        if (data.redirectUrl) {
          setRedirectUrl(data.redirectUrl);
          setPaymentStage("redirect");
          
          toast({
            title: "Redirection requise",
            description: "Cliquez sur le bouton pour finaliser le paiement",
          });
          
          if (token) {
            saveMerchantPaymentState(token, {
              stage: "redirect",
              invoiceToken: data.token || data.transactionId,
              transactionId: data.transactionId,
              ussdInstruction: data.ussdInstruction || data.message || null,
              wizallTransactionId: null,
              redirectUrl: data.redirectUrl,
              paidAmount: formData.amount,
              country: formData.country,
              operator: formData.operator,
              customerName: formData.customerName,
              customerEmail: formData.customerEmail,
              customerPhone: formData.customerPhone,
            });
          }
        } else if (data.requiresOTP) {
          // Opérateur Orange nécessite un code OTP
          setPaymentStage("otp");
          
          toast({
            title: "Code OTP requis",
            description: data.ussdInstruction || "Generez votre code de paiement",
          });
          
          if (token) {
            saveMerchantPaymentState(token, {
              stage: "otp",
              invoiceToken: data.token || data.transactionId,
              transactionId: data.transactionId,
              ussdInstruction: data.ussdInstruction || data.message || null,
              wizallTransactionId: null,
              redirectUrl: null,
              paidAmount: formData.amount,
              country: formData.country,
              operator: formData.operator,
              customerName: formData.customerName,
              customerEmail: formData.customerEmail,
              customerPhone: formData.customerPhone,
            });
          }
        } else if (data.requiresTwoStep) {
          // Paiement USSD en deux étapes (confirmation manuelle)
          setPaymentStage("ussd");
          
          toast({
            title: "Instructions de paiement",
            description: data.ussdInstruction || data.message || "Suivez les instructions sur votre telephone",
          });
          
          if (token) {
            saveMerchantPaymentState(token, {
              stage: "ussd",
              invoiceToken: data.token || data.transactionId,
              transactionId: data.transactionId,
              ussdInstruction: data.ussdInstruction || data.message || null,
              wizallTransactionId: null,
              redirectUrl: null,
              paidAmount: formData.amount,
              country: formData.country,
              operator: formData.operator,
              customerName: formData.customerName,
              customerEmail: formData.customerEmail,
              customerPhone: formData.customerPhone,
            });
          }
        } else {
          // Paiement standard avec polling
          countdown.startCountdown();
          setPaymentStage("polling");
          
          toast({
            title: "Paiement initie",
            description: data.message || "Veuillez valider le paiement sur votre telephone",
          });
          
          if (token) {
            saveMerchantPaymentState(token, {
              stage: "polling",
              invoiceToken: data.token || data.transactionId,
              transactionId: data.transactionId,
              ussdInstruction: data.ussdInstruction || data.message || null,
              wizallTransactionId: null,
              redirectUrl: null,
              paidAmount: formData.amount,
              country: formData.country,
              operator: formData.operator,
              customerName: formData.customerName,
              customerEmail: formData.customerEmail,
              customerPhone: formData.customerPhone,
            });
          }
        }
      } else {
        // Paiement échoué - afficher l'erreur et passer à l'état "failed"
        setPaymentStage("failed");
        if (token) clearMerchantPaymentState(token);
        toast({
          title: "Paiement echoue",
          description: data.error || "Erreur lors de l'initialisation du paiement",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setPaymentStage("failed");
      if (token) clearMerchantPaymentState(token);
      toast({
        title: "Paiement echoue",
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

  const formatAmount = (amount: number, currency: string = "XOF") => {
    const decimals = getCurrencyDecimals(currency);
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
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
                <span className="font-semibold text-foreground">{formatAmount(paidAmount, ownerCurrency)}</span>
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
                <span className="font-semibold text-foreground">{formatAmount(paidAmount, ownerCurrency)}</span>
              </div>
            </div>

            <Button
              onClick={handleNewPayment}
              variant="outline"
              className="w-full"
              data-testid="button-new-payment-failed"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer le paiement
            </Button>
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

  // STAGE: Wave Redirect - Bouton pour aller à Wave
  if (paymentStage === "redirect" && redirectUrl) {
    const handleWaveRedirect = () => {
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
      
      window.open(redirectUrl, "_blank");
    };
    
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Paiement Wave</CardTitle>
            <CardDescription>
              Cliquez sur le bouton ci-dessous pour compléter votre paiement via Wave
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                Vous serez redirigé vers Wave pour finaliser le paiement de manière sécurisée.
              </AlertDescription>
            </Alert>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Montant à payer</p>
              <p className="text-2xl font-bold text-primary">
                {paidAmount.toLocaleString()} FCFA
              </p>
            </div>
            
            <Button
              onClick={handleWaveRedirect}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
              data-testid="button-wave-redirect"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Aller à Wave pour payer
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Après le paiement, revenez sur cette page pour confirmer
            </p>
            
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
                  <strong>Instructions :</strong>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                      <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                        {getOrangeUssdCode(currentCountry)}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyUssdCode(getOrangeUssdCode(currentCountry))}
                      className="border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900"
                      data-testid="button-copy-ussd"
                    >
                      {copiedUssd ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                    {getOrangeUssdHint(currentCountry)}
                  </p>
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

  const mobileMoneyForm = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm">Montant ({ownerCurrency})</FormLabel>
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
                  {(enabledCountriesOperators 
                    ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
                    : []
                  ).map((country) => (
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
        {hasMultipleCurrencies(selectedCountry) && (
          <CurrencySelector
            countryCode={selectedCountry}
            selectedCurrency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
          />
        )}
        <FormField
          control={form.control}
          name="customerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm">Numéro de téléphone</FormLabel>
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
        <FormField
          control={form.control}
          name="operator"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm">Opérateur</FormLabel>
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
                  selectedOperator={field.value}
                  onSelect={field.onChange}
                  disabled={isLoadingOperators}
                  isLoading={isLoadingOperators}
                />
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Instructions OTP Orange sur le formulaire */}
        {showOrangeOtpOnForm && (
          <div className="space-y-3">
            <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Instructions Orange Money :</strong>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                    <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                      {getOrangeUssdCode(selectedCountry)}
                    </code>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyUssdCode(getOrangeUssdCode(selectedCountry))}
                    className="border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900"
                    data-testid="button-copy-ussd-form"
                  >
                    {copiedUssd ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                  {getOrangeUssdHint(selectedCountry)}
                </p>
              </AlertDescription>
            </Alert>
            
            <div>
              <FormLabel className="text-xs sm:text-sm">Code OTP Orange Money</FormLabel>
              <Input
                placeholder="Entrez le code obtenu"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="mt-1"
                data-testid="input-otp-form"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Composez le code USSD ci-dessus, puis entrez le code de paiement obtenu
              </p>
            </div>
          </div>
        )}
        
        {conversionData && (
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md border border-green-200 dark:border-green-800">
            <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">
              Montant à payer
            </p>
            {conversionData.isLoading ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                <span className="text-sm text-green-600">Conversion en cours...</span>
              </div>
            ) : (
              <p className="text-base sm:text-lg font-bold text-green-800 dark:text-green-200" data-testid="text-converted-amount">
                {new Intl.NumberFormat("fr-FR", {
                  minimumFractionDigits: getCurrencyDecimals(conversionData.targetCurrency),
                  maximumFractionDigits: getCurrencyDecimals(conversionData.targetCurrency),
                }).format(conversionData.convertedAmount)} {conversionData.targetCurrency}
              </p>
            )}
          </div>
        )}
        
        <Button
          type="submit"
          className="w-full"
          disabled={initMutation.isPending || isLoadingOperators || Boolean(noOperatorsAvailable) || (Boolean(showOrangeOtpOnForm) && !authCode.trim())}
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
  );

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
          <PaymentMethodSelector
            mobileMoneyContent={mobileMoneyForm}
            cryptoContent={
              cryptoStep === "payment" && cryptoCustomerInfo ? (
                <div className="space-y-4">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">Montant à payer</p>
                    <p className="text-xl font-bold">{cryptoCustomerInfo.amount.toLocaleString()} {ownerCurrency}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cryptoCustomerInfo.customerName} - {cryptoCustomerInfo.customerEmail}
                    </p>
                  </div>
                  <CryptoPaymentFlow
                    amount={cryptoCustomerInfo.amount}
                    currency={ownerCurrency}
                    merchantLinkId={merchantLink.id}
                    orderDescription={`Paiement à ${merchantLink.merchantName} par ${cryptoCustomerInfo.customerName}`}
                    customerName={cryptoCustomerInfo.customerName}
                    customerEmail={cryptoCustomerInfo.customerEmail}
                    customerPhone={cryptoCustomerInfo.customerPhone}
                    onSuccess={() => {
                      setPaymentStage("completed");
                      setPaidAmount(cryptoCustomerInfo.amount);
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
                    <div>
                      <label className="text-xs sm:text-sm font-medium">Montant ({ownerCurrency})</label>
                      <Input
                        type="number"
                        placeholder="10000"
                        min={500}
                        data-testid="input-crypto-amount"
                        value={cryptoCustomerInfo?.amount || ""}
                        onChange={(e) => setCryptoCustomerInfo(prev => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0,
                          customerName: prev?.customerName || "",
                          customerEmail: prev?.customerEmail || "",
                          customerPhone: prev?.customerPhone || "",
                        }))}
                      />
                      {cryptoCustomerInfo?.amount !== undefined && cryptoCustomerInfo.amount > 0 && cryptoCustomerInfo.amount < 500 && (
                        <p className="text-xs text-destructive mt-1">Le montant minimum est de 500 {ownerCurrency}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-medium">Nom complet</label>
                      <Input
                        placeholder="Jean Dupont"
                        data-testid="input-crypto-name"
                        value={cryptoCustomerInfo?.customerName || ""}
                        onChange={(e) => setCryptoCustomerInfo(prev => ({
                          ...prev,
                          amount: prev?.amount || 0,
                          customerName: e.target.value,
                          customerEmail: prev?.customerEmail || "",
                          customerPhone: prev?.customerPhone || "",
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        placeholder="jean@exemple.com"
                        data-testid="input-crypto-email"
                        value={cryptoCustomerInfo?.customerEmail || ""}
                        onChange={(e) => setCryptoCustomerInfo(prev => ({
                          ...prev,
                          amount: prev?.amount || 0,
                          customerName: prev?.customerName || "",
                          customerEmail: e.target.value,
                          customerPhone: prev?.customerPhone || "",
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-medium">Téléphone</label>
                      <Input
                        placeholder="+229 00 00 00 00"
                        data-testid="input-crypto-phone"
                        value={cryptoCustomerInfo?.customerPhone || ""}
                        onChange={(e) => setCryptoCustomerInfo(prev => ({
                          ...prev,
                          amount: prev?.amount || 0,
                          customerName: prev?.customerName || "",
                          customerEmail: prev?.customerEmail || "",
                          customerPhone: e.target.value,
                        }))}
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      !cryptoCustomerInfo?.amount || 
                      cryptoCustomerInfo.amount < 500 ||
                      !cryptoCustomerInfo?.customerName?.trim() ||
                      !cryptoCustomerInfo?.customerEmail?.trim() ||
                      !cryptoCustomerInfo?.customerPhone?.trim()
                    }
                    onClick={() => {
                      if (cryptoCustomerInfo && cryptoCustomerInfo.amount >= 500) {
                        setCryptoStep("payment");
                      }
                    }}
                    data-testid="button-continue-crypto"
                  >
                    Continuer vers le paiement crypto
                  </Button>
                </div>
              )
            }
          />
        </CardContent>
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
