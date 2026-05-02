import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Send, Info, CheckCircle2, Loader2, Lock, AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee, fetchFeeConfig, fetchExchangeFee } from "@/lib/fees";
import { useLocation } from "wouter";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { OperatorSelector } from "@/components/operator-selector";
import { hasMultiplePayoutCurrencies, getMbiyoPayPayoutCurrenciesForCountry } from "@shared/mbiyopay-countries";
import { useEffect, useCallback } from "react";
import { useConvertedMinimums } from "@/hooks/use-converted-minimums";
import { getCurrencyDecimals } from "@/lib/currency";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { CryptoWithdrawalFlow } from "@/components/crypto-withdrawal-flow";

const transferSchema = z.object({
  amount: z.number().min(1, "Veuillez saisir un montant valide"),
  country: z.string().min(1, "Selectionnez un pays"),
  operator: z.string().min(1, "Selectionnez un operateur"),
  phone: z.string().min(7, "Numero de telephone invalide").regex(/^\d+$/, "Le numero doit contenir uniquement des chiffres"),
  phoneConfirm: z.string().min(7, "Confirmez le numero de telephone"),
}).refine((data) => data.phone === data.phoneConfirm, {
  message: "Numero incorrect - les numeros ne correspondent pas",
  path: ["phoneConfirm"],
});

type TransferFormData = z.infer<typeof transferSchema>;

export default function Transfer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityCode, setSecurityCode] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [pendingData, setPendingData] = useState<TransferFormData | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [feePercentage, setFeePercentage] = useState<number>(60);
  const [outgoingExchangeFeePercentage, setOutgoingExchangeFeePercentage] = useState<number>(0);
  const [conversionData, setConversionData] = useState<{
    convertedAmount: number;
    targetCurrency: string;
    conversionRate: number;
    isLoading: boolean;
  } | null>(null);
  const [paymentAmountOverride, setPaymentAmountOverride] = useState<number | undefined>(undefined);
  const [editingDirection, setEditingDirection] = useState<"balance" | "payment">("balance");
  const [reverseLoading, setReverseLoading] = useState(false);
  const [isPaymentFocused, setIsPaymentFocused] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  
  const userBalanceCurrency = user?.currency || (user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF");

  const { transferMin, cryptoTransferMin } = useConvertedMinimums(userBalanceCurrency);

  const { data: enabledCountriesOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      amount: undefined as any,
      country: "",
      operator: "",
      phone: "",
      phoneConfirm: "",
    },
  });

  const selectedCountry = form.watch("country");
  const amount = form.watch("amount");

  // Filter countries to only show those enabled by admin (have at least one enabled operator for payout)
  const payoutCountries = enabledCountriesOperators 
    ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
    : [];
  
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && selectedCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  const selectedOperator = form.watch("operator");

  // Fetch dynamic fee from database when country/operator changes
  useEffect(() => {
    if (selectedCountry && selectedOperator) {
      fetchFeeConfig(selectedCountry, selectedOperator).then(fees => {
        setFeePercentage(fees.outgoing);
      });
    }
  }, [selectedCountry, selectedOperator]);

  const feeInfo = amount ? calculateOutgoingFee(Math.floor(amount), feePercentage) : null;

  // Handle currency selection when country changes
  useEffect(() => {
    if (selectedCountry && hasMultiplePayoutCurrencies(selectedCountry)) {
      const currencies = getMbiyoPayPayoutCurrenciesForCountry(selectedCountry);
      setSelectedCurrency(currencies[0]);
    } else if (selectedCountry) {
      const countryCurrency = COUNTRIES.find(c => c.code === selectedCountry)?.currency || "XOF";
      setSelectedCurrency(countryCurrency);
    }
  }, [selectedCountry]);

  // Currency conversion when source and destination currencies differ
  // IMPORTANT: Only calculate target currency if a country is actually selected
  const targetCurrency = selectedCountry 
    ? (hasMultiplePayoutCurrencies(selectedCountry) 
        ? selectedCurrency 
        : (COUNTRIES.find(c => c.code === selectedCountry)?.currency || userBalanceCurrency))
    : userBalanceCurrency; // Default to user's currency when no country selected
  // Only need conversion if a country is selected AND target currency is determined AND currencies differ
  const needsConversion = !!selectedCountry && !!targetCurrency && targetCurrency !== userBalanceCurrency;

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
    if (needsConversion && amount && amount > 0 && editingDirection === "balance") {
      const debounceTimer = setTimeout(() => {
        fetchConversion(amount, userBalanceCurrency, targetCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else if (!needsConversion) {
      setConversionData(null);
    }
  }, [needsConversion, amount, userBalanceCurrency, targetCurrency, fetchConversion, selectedCurrency, editingDirection]);

  // Reset payment override when country/currency changes
  useEffect(() => {
    setPaymentAmountOverride(undefined);
    setEditingDirection("balance");
  }, [selectedCountry, targetCurrency]);

  // Reverse conversion: targetCurrency -> balanceCurrency (when user edits the green box)
  useEffect(() => {
    let cancelled = false;
    if (editingDirection === "payment" && needsConversion && paymentAmountOverride && paymentAmountOverride > 0) {
      setReverseLoading(true);
      const t = setTimeout(async () => {
        try {
          const res = await fetch("/api/convert-currency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: paymentAmountOverride, fromCurrency: targetCurrency, toCurrency: userBalanceCurrency }),
          });
          if (res.ok && !cancelled) {
            const data = await res.json();
            const decimals = getCurrencyDecimals(userBalanceCurrency);
            const rounded = decimals === 0 ? Math.round(data.convertedAmount) : Number(data.convertedAmount.toFixed(decimals));
            form.setValue("amount", rounded);
          }
        } finally {
          if (!cancelled) setReverseLoading(false);
        }
      }, 500);
      return () => { cancelled = true; clearTimeout(t); };
    }
  }, [editingDirection, paymentAmountOverride, needsConversion, targetCurrency, userBalanceCurrency, form]);

  // Fetch outgoing exchange fee for personal accounts when currencies differ
  useEffect(() => {
    let cancelled = false;
    if (needsConversion && targetCurrency && userBalanceCurrency && user?.accountType === "personal") {
      fetchExchangeFee(userBalanceCurrency, targetCurrency).then(result => {
        if (!cancelled) {
          setOutgoingExchangeFeePercentage(result.isActive ? result.feePercentage : 0);
        }
      });
    } else {
      setOutgoingExchangeFeePercentage(0);
    }
    return () => { cancelled = true; };
  }, [needsConversion, userBalanceCurrency, targetCurrency, user?.accountType]);

  const outgoingExchangeFeeAmount = (amount && outgoingExchangeFeePercentage > 0)
    ? Math.floor(amount * outgoingExchangeFeePercentage / 1000)
    : 0;

  const transferMutation = useMutation({
    mutationFn: async (data: { formData: TransferFormData; securityCode: string }) => {
      const res = await apiRequest("POST", "/api/fedapay/withdrawal", {
        amount: data.formData.amount,
        phone: data.formData.phone,
        country: data.formData.country,
        operator: data.formData.operator,
        type: "transfer",
        securityCode: data.securityCode,
        currency: userBalanceCurrency,
        targetCurrency: targetCurrency,
        originalAmount: data.formData.amount,
        originalCurrency: userBalanceCurrency,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        toast({
          title: "Transfert initie",
          description: `Le transfert de ${pendingData?.amount} ${userBalanceCurrency} a ete initie avec succes.`,
        });
        form.reset();
        setShowSecurityModal(false);
        setSecurityCode("");
        setSecurityError("");
        setPendingData(null);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      } else {
        if (response.error?.includes("Code de securite")) {
          setSecurityError(response.error);
        } else {
          setShowSecurityModal(false);
          setSecurityCode("");
          toast({
            title: "Transfert échoué",
            description: "Votre transfert n'a pas pu être effectué. Veuillez réessayer plus tard.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "";
      if (errorMessage.includes("Code de securite") || errorMessage.includes("incorrect")) {
        setSecurityError(errorMessage);
      } else {
        setShowSecurityModal(false);
        setSecurityCode("");
        toast({
          title: "Transfert échoué",
          description: "Votre transfert n'a pas pu être effectué. Veuillez réessayer plus tard.",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: TransferFormData) => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Utilisateur non trouve",
        variant: "destructive",
      });
      return;
    }

    if (data.amount < transferMin) {
      toast({
        title: "Montant insuffisant",
        description: `Le montant minimum est de ${transferMin.toLocaleString("fr-FR")} ${userBalanceCurrency}`,
        variant: "destructive",
      });
      return;
    }

    if (user.kycStatus !== "verified") {
      toast({
        title: "Verification requise",
        description: "Rendez-vous dans la section Verification KYC pour verifier votre compte et acceder a toutes les fonctionnalites.",
        variant: "destructive",
      });
      return;
    }

    if (!user.securityCode) {
      toast({
        title: "Code de securite requis",
        description: "Veuillez d'abord configurer votre code de securite dans les parametres",
        variant: "destructive",
      });
      return;
    }

    const feeInfoCalc = calculateOutgoingFee(data.amount, feePercentage);
    const totalDeducted = data.amount + feeInfoCalc.feeAmount;
    if (user.balance < totalDeducted) {
      toast({
        title: "Solde insuffisant",
        description: `Vous avez ${user.balance} ${userBalanceCurrency}. Total a deduire: ${totalDeducted} ${userBalanceCurrency}`,
        variant: "destructive",
      });
      return;
    }

    setPendingData(data);
    setSecurityCode("");
    setSecurityError("");
    setShowSecurityModal(true);
  };

  const handleSecurityCodeSubmit = () => {
    if (!securityCode || securityCode.length !== 6 || !/^\d+$/.test(securityCode)) {
      setSecurityError("Le code de securite doit contenir 6 chiffres");
      return;
    }

    if (!pendingData) return;

    setSecurityError("");
    transferMutation.mutate({ formData: pendingData, securityCode });
  };

  const hasNoSecurityCode = !user?.securityCode;

  if (hasNoSecurityCode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transfert
          </h1>
          <p className="text-sm text-muted-foreground">
            Envoyez de l'argent vers n'importe quel numero mobile money
          </p>
        </div>

        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100 ml-2">
            <strong>Configuration requise</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
              <li>Configurez votre code de securite a 6 chiffres dans les parametres</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={() => setLocation("/dashboard/settings")}
          className="w-full"
          data-testid="button-go-to-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          Aller dans les parametres
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Send className="h-5 w-5" />
          Transfert
        </h1>
        <p className="text-sm text-muted-foreground">
          Envoyez de l'argent vers n'importe quel numero mobile money
        </p>
      </div>

      {user && (
        <Alert className="py-2 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <AlertDescription className="text-xs text-blue-900 dark:text-blue-100">
            <strong>Solde disponible:</strong> {new Intl.NumberFormat("fr-FR").format(user.balance || 0)} {userBalanceCurrency}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Details du transfert</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant ({userBalanceCurrency})</label>
              <Input
                type="number"
                placeholder="500"
                data-testid="input-transfer-amount"
                min="500"
                value={amount || ""}
                onChange={(e) => {
                  setEditingDirection("balance");
                  setPaymentAmountOverride(undefined);
                  const val = e.target.value;
                  form.setValue("amount", val === "" ? undefined as any : Number(val));
                }}
              />
              <p className="text-xs text-muted-foreground">Montant minimum: {transferMin.toLocaleString("fr-FR")} {userBalanceCurrency}</p>
            </div>

            <PaymentMethodSelector
              mobileMoneyContent={
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pays de destination</FormLabel>
                          <Select value={field.value} onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("operator", "");
                          }}>
                            <FormControl>
                              <SelectTrigger data-testid="select-transfer-country">
                                <SelectValue placeholder="Selectionnez un pays" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {payoutCountries.map((country) => (
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

                    {selectedCountry && hasMultiplePayoutCurrencies(selectedCountry) && (
                      <CurrencySelector
                        countryCode={selectedCountry}
                        selectedCurrency={selectedCurrency}
                        onCurrencyChange={setSelectedCurrency}
                        mode="payout"
                      />
                    )}

                    {selectedCountry && (
                      <FormField
                        control={form.control}
                        name="operator"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operateur/Porte-monnaie</FormLabel>
                            {countryOperators.length === 0 ? (
                              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                                Aucun operateur disponible pour ce pays
                              </div>
                            ) : (
                              <OperatorSelector
                                operators={countryOperators}
                                selectedOperator={field.value}
                                onSelect={field.onChange}
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
                              data-testid="input-transfer-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneConfirm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmer le numero de telephone</FormLabel>
                          <FormControl>
                            <PhoneInputWithPrefix
                              country={selectedCountry}
                              value={field.value}
                              onChange={field.onChange}
                              data-testid="input-transfer-phone-confirm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {amount && selectedCountry && selectedOperator && feeInfo && (
                      <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-md border space-y-1.5">
                          {feeInfo.feeAmount > 0 && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Frais de service</p>
                              <p className="text-xs text-muted-foreground" data-testid="text-tx-fee-transfer">
                                -{new Intl.NumberFormat("fr-FR").format(feeInfo.feeAmount)} {userBalanceCurrency}
                              </p>
                            </div>
                          )}
                          {outgoingExchangeFeeAmount > 0 && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Frais d'échange ({userBalanceCurrency}&rarr;{targetCurrency})</p>
                              <p className="text-xs text-muted-foreground" data-testid="text-exchange-fee-transfer">
                                -{new Intl.NumberFormat("fr-FR").format(outgoingExchangeFeeAmount)} {userBalanceCurrency}
                              </p>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-0.5 border-t">
                            <p className="text-sm text-muted-foreground">Total débité du solde</p>
                            <p className="text-lg font-semibold text-foreground" data-testid="text-total-deducted">
                              {new Intl.NumberFormat("fr-FR").format(amount + feeInfo.feeAmount + outgoingExchangeFeeAmount)} {userBalanceCurrency}
                            </p>
                          </div>
                        </div>
                        {needsConversion && (conversionData || (editingDirection === "payment" && paymentAmountOverride)) && (() => {
                          const rawValue = editingDirection === "payment"
                            ? paymentAmountOverride
                            : conversionData?.convertedAmount;
                          const decimals = getCurrencyDecimals(targetCurrency);
                          const formattedValue = rawValue !== undefined && rawValue !== null
                            ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(rawValue)
                            : "";
                          const editValue = rawValue !== undefined && rawValue !== null
                            ? Number(rawValue.toFixed(decimals)).toString()
                            : "";
                          return (
                            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800 flex justify-between items-center gap-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-green-700 dark:text-green-400 whitespace-nowrap">Destinataire recevra</p>
                                {(reverseLoading || conversionData?.isLoading) && (
                                  <Loader2 className="h-3 w-3 animate-spin text-green-600" />
                                )}
                              </div>
                              <div className="flex items-baseline gap-1 min-w-0">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  className="bg-transparent border-0 shadow-none text-lg font-semibold text-green-700 dark:text-green-400 px-0 focus-visible:ring-0 h-auto py-0 text-right max-w-[140px]"
                                  value={isPaymentFocused ? editValue : formattedValue}
                                  onFocus={() => setIsPaymentFocused(true)}
                                  onBlur={() => setIsPaymentFocused(false)}
                                  onChange={(e) => {
                                    setEditingDirection("payment");
                                    const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                                    setPaymentAmountOverride(val === "" ? undefined : Number(val));
                                  }}
                                  data-testid="input-recipient-amount"
                                />
                                <span className="text-sm font-semibold text-green-700 dark:text-green-400">{targetCurrency}</span>
                              </div>
                            </div>
                          );
                        })()}
                        {needsConversion && !conversionData && !paymentAmountOverride && (
                          <div className="bg-muted p-3 rounded-md border flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-sm">Calcul de la conversion...</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={transferMutation.isPending || !user || countryOperators.length === 0}
                      data-testid="button-submit-transfer"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Effectuer le transfert
                    </Button>
                  </form>
                </Form>
              }
              cryptoContent={
                amount && amount >= cryptoTransferMin && user ? (
                  <CryptoWithdrawalFlow
                    amount={amount}
                    currency={userBalanceCurrency}
                    userBalance={user.balance || 0}
                    type="transfer"
                    onSuccess={() => {
                      form.reset();
                      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
                    }}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Entrez un montant d'au moins {cryptoTransferMin.toLocaleString("fr-FR")} {userBalanceCurrency} pour transférer en crypto
                  </div>
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-xs text-blue-900 dark:text-blue-100 ml-2">
          <strong>Conseil de securite:</strong> Verifiez toujours le numero de telephone avant de soumettre le transfert. Les transferts sont irrevocables une fois soumis.
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
              Entrez votre code de securite a 6 chiffres pour confirmer le transfert
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <PasswordInput
                placeholder="******"
                maxLength={6}
                inputMode="numeric"
                value={securityCode}
                onChange={(e) => {
                  setSecurityCode(e.target.value.replace(/\D/g, ""));
                  setSecurityError("");
                }}
                data-testid="input-modal-security-code"
                className="text-center text-2xl tracking-widest"
              />
              {securityError && (
                <p className="text-sm text-destructive text-center">{securityError}</p>
              )}
            </div>
            <div className="bg-muted p-3 rounded-md text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant:</span>
                <span className="font-medium">{pendingData?.amount} {userBalanceCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Numero:</span>
                <span className="font-medium">{pendingData?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pays:</span>
                <span className="font-medium">{pendingData?.country}</span>
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
              data-testid="button-cancel-security"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSecurityCodeSubmit}
              disabled={transferMutation.isPending || securityCode.length !== 6}
              data-testid="button-confirm-security"
            >
              {transferMutation.isPending ? (
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
