import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { CryptoPaymentFlow } from "@/components/crypto-payment-flow";

interface ConversionData {
  convertedAmount: number;
  targetCurrency: string;
  conversionRate: number;
  isLoading: boolean;
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle2, Phone, Mail, User, Globe, XCircle, RefreshCw, ExternalLink, Copy, Check } from "lucide-react";
import { OPERATORS, COUNTRIES } from "@shared/schema";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePaymentCountdown } from "@/hooks/use-payment-countdown";
import logoImage from "@assets/bkapay-logo.png";
import { getCurrencyDecimals } from "@/lib/currency";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { OperatorSelector } from "@/components/operator-selector";
import { hasMultipleCurrencies, getMbiyoPayCurrenciesForCountry } from "@shared/mbiyopay-countries";
import { hasMultiplePawaPayCurrencies, getCurrenciesForCountry as getPawaPayCurrenciesForCountry, getOperatorCodesForCurrency, operatorSupportsCurrency } from "@shared/pawapay-countries";
import { CountryFlag } from "@/components/country-flag";

interface ApiKeyInfo {
  siteName: string;
  isActive: boolean;
  allowedCountries?: string[];
  customerPaysFee?: boolean;
}

type PaymentStage = "form" | "ussd" | "otp" | "polling" | "completed" | "failed" | "redirect" | "mbiyoOtp" | "mbiyoPin";

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

// Instructions USSD Orange par pays (tous les pays où Orange est disponible)
const ORANGE_INSTRUCTIONS: Record<string, string> = {
  SN: "Composez #144#391*VOTRE CODE PIN ORANGE MONEY# pour obtenir votre code de paiement",
  CI: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
  BF: "Composez *144*4*6*MONTANT# pour obtenir votre code de paiement",
  ML: "Composez #144#77# pour obtenir votre code de paiement",
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
  BF: "*144*4*6*MONTANT#",
  ML: "#144#77#",
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

function getOrangeUssdCode(country: string, amount?: number): string {
  const code = ORANGE_USSD_CODES[country] || ORANGE_USSD_CODES.DEFAULT;
  if (amount && amount > 0) return code.replace(/MONTANT/g, String(Math.round(amount)));
  return code;
}

function getOrangeUssdHint(country: string): string {
  return ORANGE_USSD_HINTS[country] || ORANGE_USSD_HINTS.DEFAULT;
}

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
  const isInlineMode = urlParams.get("mode") === "inline";
  const prefilledName = urlParams.get("customerName") || "";
  const prefilledEmail = urlParams.get("customerEmail") || "";
  const rawPrefilledPhone = urlParams.get("customerPhone") || "";

  const stripCountryCode = (phone: string): string => {
    let cleaned = phone.replace(/[^0-9+]/g, "");
    if (!cleaned) return "";
    for (const c of COUNTRIES) {
      const code = c.phoneCode.replace("+", "");
      if (cleaned.startsWith("+" + code)) {
        return cleaned.substring(code.length + 1);
      }
      if (cleaned.startsWith(code) && cleaned.length > code.length + 4) {
        return cleaned.substring(code.length);
      }
    }
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  };

  const prefilledPhone = stripCountryCode(rawPrefilledPhone);
  
  const [paymentStage, setPaymentStage] = useState<PaymentStage>("form");
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [ussdInstruction, setUssdInstruction] = useState<string | null>(null);
  const [wizallTransactionId, setWizallTransactionId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [mbiyoInstructions, setMbiyoInstructions] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [mbiyoOtpInstructions, setMbiyoOtpInstructions] = useState("");
  const [mbiyoOtpUssdCode, setMbiyoOtpUssdCode] = useState("");
  const [mbiyoOtpHint, setMbiyoOtpHint] = useState("");
  const [mbiyoProvider, setMbiyoProvider] = useState("");
  const [mbiyoOtpCode, setMbiyoOtpCode] = useState("");
  const [mbiyoPinCode, setMbiyoPinCode] = useState("");
  const [mbiyoPinTransactionId, setMbiyoPinTransactionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customerName, setCustomerName] = useState(prefilledName);
  const [customerEmail, setCustomerEmail] = useState(prefilledEmail);
  const [customerPhone, setCustomerPhone] = useState(prefilledPhone);
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [copiedUssd, setCopiedUssd] = useState(false);
  const [cryptoStep, setCryptoStep] = useState<"info" | "payment">("info");
  const [cryptoCustomerInfo, setCryptoCustomerInfo] = useState<{
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  } | null>(null);
  const [conversionData, setConversionData] = useState<ConversionData | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");
  const [dynamicFee, setDynamicFee] = useState<{ feePercentage: number; feeAmount: number } | null>(null);
  const [isLoadingFees, setIsLoadingFees] = useState(false);

  const { data: apiKeyInfo, isLoading: isLoadingKey, error: keyError } = useQuery<ApiKeyInfo>({
    queryKey: [`/api/api-key-info/${key}`],
    enabled: !!key,
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

  // Auto-detect country from IP address
  useEffect(() => {
    const detectCountry = async () => {
      // Only auto-detect if no country is selected yet
      if (country) return;
      
      try {
        const response = await fetch("/api/detect-country");
        if (response.ok) {
          const data = await response.json();
          if (data.detected && data.country && enabledCountriesOperators) {
            // Only set if the detected country is enabled
            if (Object.keys(enabledCountriesOperators).includes(data.country)) {
              setCountry(data.country);
              console.log(`[GeoIP] Auto-selected country: ${data.country}`);
            }
          }
        }
      } catch (error) {
        console.error("[GeoIP] Failed to detect country:", error);
      }
    };
    
    if (enabledCountriesOperators && !country) {
      detectCountry();
    }
  }, [enabledCountriesOperators, country]);

  // Fetch dynamic fees when country and operator are selected
  useEffect(() => {
    const fetchDynamicFee = async () => {
      if (!country || !operator || !amount || amount <= 0) {
        setDynamicFee(null);
        setIsLoadingFees(false);
        return;
      }
      
      setIsLoadingFees(true);
      try {
        const res = await fetch(`/api/fees/${country}/${operator}`);
        if (res.ok) {
          const data = await res.json();
          const feePercentage = data.incomingFeePercentage || 60; // Default 6%
          const feeAmount = Math.floor((amount * feePercentage) / 1000);
          setDynamicFee({ feePercentage, feeAmount });
        } else {
          // Fallback to default 6% if endpoint fails
          const feeAmount = Math.floor((amount * 60) / 1000);
          setDynamicFee({ feePercentage: 60, feeAmount });
        }
      } catch (error) {
        console.error("Failed to fetch dynamic fees:", error);
        // Fallback to default 6%
        const feeAmount = Math.floor((amount * 60) / 1000);
        setDynamicFee({ feePercentage: 60, feeAmount });
      } finally {
        setIsLoadingFees(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchDynamicFee, 300);
    return () => clearTimeout(debounceTimer);
  }, [country, operator, amount]);

  // Handle currency selection when country changes
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

  // Currency conversion: owner currency -> target currency (country selected)
  // Priority: 1. PawaPay multi-currency selector (e.g. CDF/USD for DRC)
  //           2. MbiyoPay multi-currency selector
  //           3. Country default currency
  const ownerCurrency = (apiKeyInfo as any)?.ownerCurrency || "XOF";
  const targetCurrency = country
    ? ((hasMultiplePawaPayCurrencies(country) || hasMultipleCurrencies(country))
        ? selectedCurrency
        : (COUNTRIES.find(c => c.code === country)?.currency || ownerCurrency))
    : ownerCurrency;
  const needsConversion = country && targetCurrency !== ownerCurrency;

  const copyUssdCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedUssd(true);
    setTimeout(() => setCopiedUssd(false), 2000);
    toast({
      title: "Code copié",
      description: "Le code USSD a été copié dans le presse-papiers",
    });
  };

  const allCountryOperators = country
    ? (OPERATORS[country as keyof typeof OPERATORS] || [])
    : [];
  
  // Logique de filtrage:
  // - Pendant le chargement: montrer tous (select désactivé)
  // - Une fois chargé: construire depuis la réponse API (opérateurs activés en admin)
  //   en utilisant le schéma hardcodé comme dictionnaire de noms
  const enabledOperatorsForCountry = enabledCountriesOperators && country 
    ? (enabledCountriesOperators[country] || [])
    : [];
  
  const enabledFilteredOperators = isLoadingOperators 
    ? allCountryOperators
    : enabledOperatorsForCountry.map(code => {
        const known = (allCountryOperators as readonly { code: string; name: string; requiresOtp: boolean }[]).find(op => op.code === code);
        return known ?? { code, name: code.charAt(0).toUpperCase() + code.slice(1), requiresOtp: false };
      });
  
  const countryOperators = (country && hasMultiplePawaPayCurrencies(country))
    ? enabledFilteredOperators.filter(op => operatorSupportsCurrency(country, op.code, selectedCurrency))
    : enabledFilteredOperators;
  
  const noOperatorsAvailable = !isLoadingOperators && !!country && countryOperators.length === 0;

  const operatorOtpDetail = country && operator && depositsDetails
    ? depositsDetails[country]?.[operator]
    : null;
  const showOtpOnForm = operatorOtpDetail?.requiresOtp || false;
  const isMbiyoOtpOperator = operatorOtpDetail?.provider === "mbiyopay" && showOtpOnForm;
  const mbiyoOtpInfo = isMbiyoOtpOperator && operatorOtpDetail
    ? { ussdCode: operatorOtpDetail.otpUssdCode || "", instructions: operatorOtpDetail.otpInstructions || "", hint: operatorOtpDetail.otpHint || "" }
    : null;

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

  // Calcul du montant total à convertir (avec frais dynamiques si customerPaysFee est activé)
  // Les frais ne s'affichent que lorsque le pays ET l'opérateur sont sélectionnés
  const hasOperatorSelected = country && operator;
  const totalWithFees = (hasOperatorSelected && dynamicFee) ? amount + dynamicFee.feeAmount : amount;
  const displayAmount = (apiKeyInfo?.customerPaysFee && hasOperatorSelected && dynamicFee) ? totalWithFees : amount;
  const amountToConvert = apiKeyInfo?.customerPaysFee ? totalWithFees : amount;
  
  useEffect(() => {
    if (needsConversion && amountToConvert && amountToConvert > 0) {
      const debounceTimer = setTimeout(() => {
        fetchConversion(amountToConvert, ownerCurrency, targetCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, amountToConvert, ownerCurrency, targetCurrency, fetchConversion]);

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
      if (isInlineMode && window.parent !== window) {
        setTimeout(() => {
          window.parent.postMessage({
            type: "bkapay_payment_success",
            transactionId,
            amount,
            status: "completed",
          }, "*");
        }, 3000);
      } else if (callbackUrl) {
        setTimeout(() => {
          window.location.href = `${callbackUrl}?status=success&transactionId=${transactionId}&amount=${amount}`;
        }, 2000);
      }
    },
    onFailed: () => {
      setPaymentStage("failed");
      if (key) clearPaymentState(key);
      toast({
        title: "Transaction non aboutie",
        description: "Le paiement n'a pas pu etre effectue. Veuillez verifier votre solde mobile money et reessayer.",
        variant: "destructive",
      });
      if (isInlineMode && window.parent !== window) {
        setTimeout(() => {
          window.parent.postMessage({
            type: "bkapay_payment_error",
            message: "La transaction n'a pas pu etre completee",
            transactionId,
            status: "failed",
          }, "*");
        }, 3000);
      } else if (callbackUrl) {
        setTimeout(() => {
          window.location.href = `${callbackUrl}?status=failed&transactionId=${transactionId}`;
        }, 2000);
      }
    },
    onExpired: () => {
      setPaymentStage("failed");
      if (key) clearPaymentState(key);
      toast({
        title: "Delai de validation depasse",
        description: "La transaction n'a pas ete confirmee dans le temps imparti. Aucun montant n'a ete debite. Veuillez reessayer.",
        variant: "destructive",
      });
      if (isInlineMode && window.parent !== window) {
        setTimeout(() => {
          window.parent.postMessage({
            type: "bkapay_payment_error",
            message: "Le temps de validation a expire",
            transactionId,
            status: "expired",
          }, "*");
        }, 3000);
      }
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
    setMbiyoOtpCode("");
    setMbiyoOtpInstructions("");
    setMbiyoOtpUssdCode("");
    setMbiyoOtpHint("");
    setMbiyoProvider("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCountry("");
    setOperator("");
  };

  const initMutation = useMutation({
    mutationFn: async () => {
      const bodyData: any = {
        publicKey: key,
        amount,
        description,
        customerName,
        customerEmail,
        customerPhone,
        country,
        operator,
        currency: selectedCurrency,
        callbackUrl: callbackUrl || null,
      };
      if (mbiyoOtpCode || authCode) {
        bodyData.otpCode = mbiyoOtpCode || authCode;
      }
      const response = await fetch("/api/api-pay/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'initialisation");
      return data;
    },
    onSuccess: (data) => {
      if (!data.success && data.requiresOTP && !showOtpOnForm) {
        countdown.resetCountdown();
        setMbiyoOtpInstructions(data.otpInstructions || "");
        setMbiyoOtpUssdCode(data.otpUssdCode || "");
        setMbiyoOtpHint(data.otpHint || "");
        setMbiyoProvider(data.provider || "");
        setPaymentStage("mbiyoOtp");
        toast({
          title: "Code OTP requis",
          description: data.otpInstructions || "Generez votre code de paiement Orange Money",
        });
        return;
      }

      setTransactionId(data.transactionId);
      setInvoiceToken(data.token);
      setUssdInstruction(data.ussdInstruction || data.message || null);
      if (data.instructions) {
        setMbiyoInstructions(data.instructions);
      }

      if (data.authMode === "pin" && data.mbiyopayTransactionId) {
        setMbiyoPinTransactionId(data.mbiyopayTransactionId);
        setPaymentStage("mbiyoPin");
        toast({ title: "Code PIN requis", description: "Entrez votre code PIN pour confirmer le paiement." });
        return;
      }
      
      let newStage: PaymentStage = "polling";
      
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        newStage = "redirect";
        toast({
          title: "Redirection requise",
          description: "Cliquez sur le bouton pour finaliser le paiement",
        });
      } else if (data.requiresTwoStep) {
        countdown.resetCountdown();
        newStage = "ussd";
      } else if (data.requiresOTP && !showOtpOnForm) {
        countdown.resetCountdown();
        newStage = "otp";
      }
      
      setPaymentStage(newStage);
      
      if (newStage === "polling") {
        countdown.startCountdown();
      }
      
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
      countdown.resetCountdown();
      setPaymentStage("failed");
      toast({
        title: "Paiement non effectue",
        description: error.message || "Le paiement n'a pas pu etre initie. Veuillez verifier vos informations et reessayer.",
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
        title: "Confirmation echouee",
        description: error.message || "La confirmation du paiement n'a pas abouti. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      if (!mbiyoPinTransactionId) throw new Error("Transaction ID manquant");
      const res = await fetch(`/api/mbiyopay/finalize-public/${mbiyoPinTransactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinCode }),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        countdown.startCountdown();
        setPaymentStage("polling");
        toast({ title: "Code PIN soumis", description: "En attente de confirmation du paiement." });
      } else {
        toast({ title: "Erreur", description: data.error || "Erreur lors de la soumission du PIN", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de soumettre le code PIN", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!customerName || !customerEmail || !customerPhone || !country || !operator) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs avant de continuer.",
        variant: "destructive",
      });
      return;
    }
    if (!showOtpOnForm) {
      countdown.startCountdown();
      setPaymentStage("polling");
    }
    initMutation.mutate();
  };

  const handleConfirm = () => {
    if (!transactionId || !invoiceToken) {
      toast({
        title: "Donnees manquantes",
        description: "Les informations de paiement sont incompletes. Veuillez recommencer.",
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

  const formatAmount = (amt: number, currency: string = ownerCurrency) => {
    const decimals = getCurrencyDecimals(currency);
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amt) + " " + currency;
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
                  <p className="font-semibold text-foreground">Page introuvable</p>
                  <p className="text-sm text-muted-foreground">
                    Ce lien de paiement n'existe plus ou n'est plus disponible.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!amount || amount < 200) {
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
                    Le montant doit etre superieur a 200 {ownerCurrency}
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
            
            {isInlineMode ? (
              <p className="text-xs text-muted-foreground">Fermeture automatique...</p>
            ) : callbackUrl ? (
              <p className="text-xs text-muted-foreground">Redirection en cours...</p>
            ) : null}
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

            {isInlineMode ? (
              <p className="text-xs text-muted-foreground">Fermeture automatique...</p>
            ) : (
              <Button
                onClick={handleNewPayment}
                variant="outline"
                className="w-full"
                data-testid="button-retry"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reessayer le paiement
              </Button>
            )}
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
    const isWave = operator?.toLowerCase() === "wave";
    const isOrange = operator?.toLowerCase() === "orange";
    const redirectTitle = isWave ? "Paiement Wave" : isOrange ? "Paiement Orange Money" : "Finaliser le paiement";
    const redirectDesc = isWave 
      ? "Cliquez sur le bouton ci-dessous pour completer votre paiement via Wave"
      : isOrange
        ? "Cliquez sur le bouton ci-dessous pour completer votre paiement via Orange Money"
        : "Cliquez sur le bouton ci-dessous pour finaliser votre paiement";
    const redirectBtnText = isWave 
      ? "Aller a Wave pour payer"
      : isOrange
        ? "Aller a Orange Money pour payer"
        : "Finaliser le paiement";
    
    const handleRedirectPayment = () => {
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
            <CardTitle>{redirectTitle}</CardTitle>
            <CardDescription>
              {redirectDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                Vous serez redirige pour finaliser le paiement de maniere securisee.
              </AlertDescription>
            </Alert>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Montant a payer</p>
              <p className="text-2xl font-bold text-primary">
                {displayAmount.toLocaleString()} {ownerCurrency}
              </p>
            </div>
            
            {mbiyoInstructions && (
              <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm text-purple-800 dark:text-purple-200">
                  <p className="font-semibold mb-1">Instructions de l'operateur</p>
                  <p className="whitespace-pre-line">{mbiyoInstructions}</p>
                </AlertDescription>
              </Alert>
            )}
            
            <Button
              onClick={handleRedirectPayment}
              className="w-full bg-blue-600"
              size="lg"
              data-testid="button-wave-redirect"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              {redirectBtnText}
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
                  <strong>Instructions :</strong>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                      <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                        {getOrangeUssdCode(country, displayAmount)}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyUssdCode(getOrangeUssdCode(country, displayAmount))}
                      className="bg-green-600 border-green-600 text-white shrink-0"
                      data-testid="button-copy-ussd"
                    >
                      {copiedUssd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                    {getOrangeUssdHint(country)}
                  </p>
                </AlertDescription>
              </Alert>
            )}
            
            {ussdInstruction && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">Composez ce code USSD:</p>
                <p className="text-xl font-bold text-primary font-mono">{ussdInstruction}</p>
              </div>
            )}
            
            {mbiyoInstructions && (
              <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm text-purple-800 dark:text-purple-200">
                  <p className="font-semibold mb-1">Instructions de l'operateur</p>
                  <p className="whitespace-pre-line">{mbiyoInstructions}</p>
                </AlertDescription>
              </Alert>
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
    const isOrangeOperator = operator.toLowerCase().includes("orange");
    const orangeInstruction = isOrangeOperator && country ? ORANGE_INSTRUCTIONS[country] : null;
    
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <Link href="/">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto cursor-pointer" />
            </Link>
            <CardTitle>Code de confirmation</CardTitle>
            <CardDescription>
              {isOrangeOperator 
                ? "Generez votre code de paiement Orange Money" 
                : "Entrez le code OTP recu par SMS"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orangeInstruction && (
              <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>Instructions :</strong>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                      <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                        {getOrangeUssdCode(country, displayAmount)}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyUssdCode(getOrangeUssdCode(country, displayAmount))}
                      className="bg-green-600 border-green-600 text-white shrink-0"
                      data-testid="button-copy-ussd-otp"
                    >
                      {copiedUssd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                    Composez ce code, puis entrez le code obtenu ci-dessous
                  </p>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="otp">Code de paiement</Label>
              <Input
                id="otp"
                placeholder="Entrez le code obtenu"
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

  if (paymentStage === "mbiyoOtp") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Code de paiement Orange Money</CardTitle>
            <CardDescription>
              {mbiyoOtpInstructions || "Generez votre code de paiement et entrez-le ci-dessous"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mbiyoOtpUssdCode && (
              <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  <p className="font-semibold mb-1">Composez ce code USSD sur votre telephone :</p>
                  <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2 my-2 text-center">
                    <code className="text-lg font-bold text-orange-700 dark:text-orange-400">
                      {mbiyoOtpUssdCode}
                    </code>
                  </div>
                  {mbiyoOtpHint && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">{mbiyoOtpHint}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Code de paiement</label>
              <Input
                type="text"
                value={mbiyoOtpCode}
                onChange={(e) => setMbiyoOtpCode(e.target.value)}
                placeholder="Entrez le code obtenu"
                data-testid="input-mbiyo-otp-code"
              />
            </div>
            <Button
              onClick={() => {
                countdown.startCountdown();
                setPaymentStage("polling");
                initMutation.mutate();
              }}
              disabled={initMutation.isPending || !mbiyoOtpCode.trim()}
              className="w-full"
              data-testid="button-submit-mbiyo-otp"
            >
              {initMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validation...
                </>
              ) : (
                "Valider le code"
              )}
            </Button>
            <Button
              onClick={() => { setPaymentStage("form"); setMbiyoOtpCode(""); }}
              variant="outline"
              className="w-full"
              data-testid="button-cancel-mbiyo-otp"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStage === "mbiyoPin") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Code PIN requis</CardTitle>
            <CardDescription>
              Entrez votre code PIN mobile money pour confirmer le paiement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Code PIN</label>
              <Input
                type="password"
                value={mbiyoPinCode}
                onChange={(e) => setMbiyoPinCode(e.target.value)}
                placeholder="Entrez votre code PIN"
                data-testid="input-mbiyo-pin"
              />
            </div>
            <Button
              onClick={() => pinMutation.mutate(mbiyoPinCode)}
              disabled={pinMutation.isPending || !mbiyoPinCode.trim()}
              className="w-full"
              data-testid="button-submit-mbiyo-pin"
            >
              {pinMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirmation...
                </>
              ) : (
                "Confirmer le paiement"
              )}
            </Button>
            <Button
              onClick={() => { setPaymentStage("form"); setMbiyoPinCode(""); }}
              variant="outline"
              className="w-full"
              data-testid="button-cancel-mbiyo-pin"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mobileMoneyForm = (
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
            {(() => {
              // Use countries enabled by admin (from API) with flags
              const adminEnabledCountries = enabledCountriesOperators 
                ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
                    .sort((a, b) => {
                      const aHasOps = (enabledCountriesOperators[a.code] || []).length > 0;
                      const bHasOps = (enabledCountriesOperators[b.code] || []).length > 0;
                      if (aHasOps && !bHasOps) return -1;
                      if (!aHasOps && bHasOps) return 1;
                      return 0;
                    })
                : COUNTRIES;
              
              // Further filter by API key's allowed countries if specified
              const allowed = apiKeyInfo?.allowedCountries;
              const filteredCountries = (allowed && allowed.length > 0)
                ? adminEnabledCountries.filter(c => allowed.includes(c.code))
                : adminEnabledCountries;
              
              return filteredCountries.map(c => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="flex items-center gap-2"><CountryFlag code={c.code} size="xs" />{c.name}</span>
                </SelectItem>
              ));
            })()}
          </SelectContent>
        </Select>
      </div>

      {/* Currency selector for multi-currency countries (e.g., RDC with CDF/USD) */}
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
        <Label htmlFor="customerPhone" className="flex items-center gap-2">
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
        <Label htmlFor="operator">Operateur Mobile Money</Label>
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
            onSelect={setOperator}
            disabled={!country || isLoadingOperators}
            isLoading={isLoadingOperators}
            disabledOperators={!(apiKeyInfo as any)?.ownerWavePayinEnabled ? { wave: "Le wave de ce marchand n'est pas activé." } : {}}
          />
        )}
      </div>

      {showOtpOnForm && (
        <div className="space-y-3">
          <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Instructions pour obtenir votre code OTP :</strong>
              {isMbiyoOtpOperator && mbiyoOtpInfo ? (
                <>
                  <p className="mt-1 whitespace-pre-line">{mbiyoOtpInfo.instructions}</p>
                  {mbiyoOtpInfo.ussdCode && (
                    <div className="mt-2 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2 text-center">
                      <code className="text-lg font-bold text-orange-700 dark:text-orange-400">
                        {mbiyoOtpInfo.ussdCode}
                      </code>
                    </div>
                  )}
                  {mbiyoOtpInfo.hint && (
                    <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">{mbiyoOtpInfo.hint}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-md px-3 py-2">
                      <code className="text-base font-bold text-orange-700 dark:text-orange-400">
                        {getOrangeUssdCode(country, displayAmount)}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyUssdCode(getOrangeUssdCode(country, displayAmount))}
                      className="bg-green-600 border-green-600 text-white shrink-0"
                      data-testid="button-copy-ussd-form"
                    >
                      {copiedUssd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                    {getOrangeUssdHint(country)}
                  </p>
                </>
              )}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label>Code OTP</Label>
            <Input
              placeholder="Entrez le code obtenu"
              value={isMbiyoOtpOperator ? mbiyoOtpCode : authCode}
              onChange={(e) => isMbiyoOtpOperator ? setMbiyoOtpCode(e.target.value) : setAuthCode(e.target.value)}
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
        onClick={handleSubmit}
        disabled={initMutation.isPending || noOperatorsAvailable || (Boolean(showOtpOnForm) && !(isMbiyoOtpOperator ? mbiyoOtpCode.trim() : authCode.trim()))}
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
          `Payer ${displayAmount.toLocaleString()} ${ownerCurrency}`
        )}
      </Button>
    </div>
  );

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
                {displayAmount.toLocaleString()} <span className="text-lg">{ownerCurrency}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completez votre paiement en remplissant les informations</p>
              {description && (
                <p className="text-sm text-foreground mt-1">{description}</p>
              )}
            </div>
          </div>

          <PaymentMethodSelector
            defaultMethod={(() => {
              try {
                const cryptoKey = `bkapay_crypto_${key}`;
                const saved = localStorage.getItem(cryptoKey);
                if (saved) {
                  const data = JSON.parse(saved);
                  if (data.paymentDetails && data.createdAt) {
                    const elapsed = Math.floor((Date.now() - data.createdAt) / 1000);
                    if ((data.expiresIn || 1800) - elapsed > 0) {
                      if (cryptoStep === "info" && data.cryptoCustomerInfo) {
                        setCryptoStep("payment");
                        setCryptoCustomerInfo(data.cryptoCustomerInfo);
                      }
                      return "crypto";
                    }
                  }
                }
              } catch {}
              return "mobile_money";
            })()}
            mobileMoneyContent={mobileMoneyForm}
            cryptoContent={
              amount && amount >= 500 ? (
                cryptoStep === "payment" && cryptoCustomerInfo ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm text-muted-foreground">Montant a payer</p>
                      <p className="text-xl font-bold">{displayAmount.toLocaleString()} {ownerCurrency}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {cryptoCustomerInfo.customerName} - {cryptoCustomerInfo.customerEmail}
                      </p>
                    </div>
                    <CryptoPaymentFlow
                      amount={amount}
                      currency={ownerCurrency}
                      apiKeyId={key}
                      customerPaysFee={(apiKeyInfo as any)?.customerPaysCryptoFee || false}
                      orderDescription={description || `Paiement a ${apiKeyInfo?.siteName}`}
                      customerName={cryptoCustomerInfo.customerName}
                      customerEmail={cryptoCustomerInfo.customerEmail}
                      customerPhone={cryptoCustomerInfo.customerPhone}
                      onSuccess={() => {
                        setPaymentStage("completed");
                        if (key) clearPaymentState(key);
                        toast({
                          title: "Paiement reussi",
                          description: "Votre transaction crypto a ete confirmee",
                        });
                        if (isInlineMode && window.parent !== window) {
                          setTimeout(() => {
                            window.parent.postMessage({
                              type: "bkapay_payment_success",
                              transactionId,
                              amount,
                              status: "completed",
                            }, "*");
                          }, 3000);
                        } else if (callbackUrl) {
                          setTimeout(() => {
                            window.location.href = `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}status=success&amount=${amount}`;
                          }, 2000);
                        }
                      }}
                      onError={() => {
                        setPaymentStage("failed");
                        if (key) clearPaymentState(key);
                        toast({
                          title: "Paiement echoue",
                          description: "La transaction crypto a echoue",
                          variant: "destructive",
                        });
                        if (isInlineMode && window.parent !== window) {
                          setTimeout(() => {
                            window.parent.postMessage({
                              type: "bkapay_payment_failed",
                              transactionId,
                              amount,
                              status: "failed",
                            }, "*");
                          }, 3000);
                        } else if (callbackUrl) {
                          setTimeout(() => {
                            window.location.href = `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}status=failed&amount=${amount}`;
                          }, 5000);
                        }
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
                <div className="p-4 text-center text-muted-foreground">
                  Le montant minimum pour payer en crypto est de 500 {ownerCurrency}
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
