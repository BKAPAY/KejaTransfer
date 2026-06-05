import { useState, useEffect, useCallback } from "react";
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
import { OPERATORS, COUNTRIES } from "@shared/schema";
import type { User } from "@shared/schema";
import { ArrowUpFromLine, Info, CheckCircle2, Loader2, Settings, AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee, fetchFeeConfig, fetchExchangeFee } from "@/lib/fees";
import { useLocation } from "wouter";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { OperatorSelector } from "@/components/operator-selector";
import { hasMultiplePayoutCurrencies, getMbiyoPayPayoutCurrenciesForCountry } from "@shared/mbiyopay-countries";
import { hasMultiplePawaPayCurrencies, getCurrenciesForCountry as getPawaPayCurrenciesForCountry } from "@shared/pawapay-countries";
import { useConvertedMinimums } from "@/hooks/use-converted-minimums";
import { getCurrencyDecimals } from "@/lib/currency";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { CryptoWithdrawalFlow } from "@/components/crypto-withdrawal-flow";

const withdrawalSchema = z.object({
  amount: z.number().min(1, "Veuillez saisir un montant valide"),
  withdrawalPhoneIndex: z.number().min(0, "Selectionnez un numero de retrait"),
  operator: z.string().min(1, "Selectionnez un operateur"),
});

type WithdrawalFormData = z.infer<typeof withdrawalSchema>;

export default function Withdrawal() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityCode, setSecurityCode] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [pendingData, setPendingData] = useState<WithdrawalFormData | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");
  const [feePercentage, setFeePercentage] = useState<number>(60);
  const [outgoingExchangeFeePercentage, setOutgoingExchangeFeePercentage] = useState<number>(0);
  const [conversionData, setConversionData] = useState<{
    convertedAmount: number;
    targetCurrency: string;
    conversionRate: number;
    isLoading: boolean;
  } | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  
  const userBalanceCurrency = user?.currency || (user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF");

  const { withdrawalMin, cryptoWithdrawalMin } = useConvertedMinimums(userBalanceCurrency);

  const { data: enabledCountriesOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: undefined as any,
      withdrawalPhoneIndex: undefined as any,
      operator: "",
    },
  });

  const selectedPhoneIndex = form.watch("withdrawalPhoneIndex");
  const amount = form.watch("amount");

  const withdrawalPhones = user?.withdrawalPhones || [];
  const userCountry = user?.country || "";

  const allCountryOperators = userCountry
    ? (OPERATORS[userCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && userCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[userCountry] || []).includes(op.code))
    : allCountryOperators;

  const selectedOperator = form.watch("operator");

  // Fetch dynamic fee from database when country/operator changes
  useEffect(() => {
    if (userCountry && selectedOperator) {
      fetchFeeConfig(userCountry, selectedOperator).then(fees => {
        setFeePercentage(fees.outgoing);
      });
    }
  }, [userCountry, selectedOperator]);

  const feeInfo = amount ? calculateOutgoingFee(Math.floor(amount), feePercentage) : null;

  // Handle currency selection when country changes
  useEffect(() => {
    if (userCountry && hasMultiplePawaPayCurrencies(userCountry)) {
      const currencies = getPawaPayCurrenciesForCountry(userCountry);
      setSelectedCurrency(currencies[0]);
    } else if (userCountry && hasMultiplePayoutCurrencies(userCountry)) {
      const currencies = getMbiyoPayPayoutCurrenciesForCountry(userCountry);
      setSelectedCurrency(currencies[0]);
    } else if (userCountry) {
      const countryCurrency = COUNTRIES.find(c => c.code === userCountry)?.currency || "XOF";
      setSelectedCurrency(countryCurrency);
    }
  }, [userCountry]);

  // Currency conversion: user balance currency -> withdrawal currency
  // Priority: 1. PawaPay multi-currency selector (e.g. CDF/USD for DRC)
  //           2. MbiyoPay multi-currency selector
  //           3. Country default currency
  const withdrawalCurrency = userCountry
    ? ((hasMultiplePawaPayCurrencies(userCountry) || hasMultiplePayoutCurrencies(userCountry))
        ? selectedCurrency
        : (COUNTRIES.find(c => c.code === userCountry)?.currency || userBalanceCurrency))
    : userBalanceCurrency;
  // Only need conversion if user country is loaded AND currencies differ AND withdrawal currency is determined
  const needsConversion = !!userCountry && !!withdrawalCurrency && withdrawalCurrency !== userBalanceCurrency;

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
        fetchConversion(amount, userBalanceCurrency, withdrawalCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, amount, userBalanceCurrency, withdrawalCurrency, fetchConversion, selectedCurrency]);

  // Frais d'échange sortant pour comptes personnels inter-devises
  useEffect(() => {
    let cancelled = false;
    if (needsConversion && withdrawalCurrency && userBalanceCurrency && user?.accountType === "personal") {
      fetchExchangeFee(userBalanceCurrency, withdrawalCurrency).then(result => {
        if (!cancelled) {
          setOutgoingExchangeFeePercentage(result.isActive ? result.feePercentage : 0);
        }
      });
    } else {
      setOutgoingExchangeFeePercentage(0);
    }
    return () => { cancelled = true; };
  }, [needsConversion, userBalanceCurrency, withdrawalCurrency, user?.accountType]);

  const outgoingExchangeFeeAmount = (amount && outgoingExchangeFeePercentage > 0)
    ? Math.floor(amount * outgoingExchangeFeePercentage / 1000)
    : 0;

  const withdrawalMutation = useMutation({
    mutationFn: async (data: { formData: WithdrawalFormData; securityCode: string }) => {
      const selectedPhone = withdrawalPhones[data.formData.withdrawalPhoneIndex];
      if (!selectedPhone) {
        throw new Error("Numero de retrait invalide");
      }
      
      const res = await apiRequest("POST", "/api/fedapay/withdrawal", {
        amount: data.formData.amount,
        phone: selectedPhone,
        operator: data.formData.operator,
        country: userCountry,
        securityCode: data.securityCode,
        type: "withdrawal",
        currency: userBalanceCurrency,
        targetCurrency: withdrawalCurrency,
        originalAmount: data.formData.amount,
        originalCurrency: userBalanceCurrency,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        toast({
          title: "Retrait initie",
          description: `Le retrait de ${pendingData?.amount} ${userBalanceCurrency} a ete initie avec succes.`,
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
            title: "Retrait échoué",
            description: "Votre retrait n'a pas pu être effectué. Veuillez réessayer plus tard.",
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
          title: "Retrait échoué",
          description: "Votre retrait n'a pas pu être effectué. Veuillez réessayer plus tard.",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: WithdrawalFormData) => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Utilisateur non trouve",
        variant: "destructive",
      });
      return;
    }

    if (data.amount < withdrawalMin) {
      toast({
        title: "Montant insuffisant",
        description: `Le montant minimum est de ${withdrawalMin.toLocaleString("fr-FR")} ${userBalanceCurrency}`,
        variant: "destructive",
      });
      return;
    }

    if (!user.country) {
      toast({
        title: "Pays requis",
        description: "Veuillez d'abord selectionner votre pays dans votre profil",
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

    if (withdrawalPhones.length === 0) {
      toast({
        title: "Numeros de retrait requis",
        description: "Veuillez d'abord configurer vos numeros de retrait dans les parametres",
        variant: "destructive",
      });
      return;
    }

    const feeInfoCalc = calculateOutgoingFee(data.amount, feePercentage);
    if (user.balance < feeInfoCalc.totalDeductedFromBalance) {
      toast({
        title: "Solde insuffisant",
        description: `Vous avez ${user.balance} ${userBalanceCurrency}. Total a deduire: ${feeInfoCalc.totalDeductedFromBalance} ${userBalanceCurrency}`,
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
    withdrawalMutation.mutate({ formData: pendingData, securityCode });
  };

  const hasNoWithdrawalPhones = withdrawalPhones.length === 0;
  const hasNoSecurityCode = !user?.securityCode;
  const hasNoCountry = !user?.country;
  const hasNoSector = user?.kycStatus === "verified" && !(user as any)?.kycSector;

  if (hasNoSector) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5" />
            Retrait
          </h1>
          <p className="text-sm text-muted-foreground">
            Retirez vers vos numeros pre-configures
          </p>
        </div>

        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-sm text-orange-900 dark:text-orange-100 ml-2">
            <strong>Secteur d'activité requis</strong>
            <p className="mt-1 text-xs">
              Pour des raisons de conformité, vous devez renseigner votre secteur d'activité avant d'effectuer un retrait.
            </p>
          </AlertDescription>
        </Alert>

        <Button
          onClick={() => setLocation("/dashboard/profile")}
          className="w-full"
          data-testid="button-go-to-profile-sector"
        >
          <Settings className="h-4 w-4 mr-2" />
          Compléter mon profil
        </Button>
      </div>
    );
  }

  if (hasNoCountry || hasNoWithdrawalPhones || hasNoSecurityCode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5" />
            Retrait
          </h1>
          <p className="text-sm text-muted-foreground">
            Retirez vers vos numeros pre-configures
          </p>
        </div>

        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100 ml-2">
            <strong>Configuration requise</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
              {hasNoCountry && <li>Selectionnez votre pays dans votre profil</li>}
              {hasNoWithdrawalPhones && <li>Configurez au moins un numero de retrait dans les parametres</li>}
              {hasNoSecurityCode && <li>Configurez votre code de securite a 6 chiffres dans les parametres</li>}
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
          <ArrowUpFromLine className="h-5 w-5" />
          Retrait
        </h1>
        <p className="text-sm text-muted-foreground">
          Retirez vers vos numeros pre-configures
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
          <CardTitle className="text-lg">Details du retrait</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant ({userBalanceCurrency})</label>
              <Input
                type="number"
                placeholder="5000"
                data-testid="input-withdrawal-amount"
                min="1000"
                value={amount || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  form.setValue("amount", val === "" ? undefined as any : Number(val));
                }}
              />
              <p className="text-xs text-muted-foreground">Montant minimum: {withdrawalMin.toLocaleString("fr-FR")} {userBalanceCurrency}</p>
            </div>

            <PaymentMethodSelector
              mobileMoneyContent={
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="withdrawalPhoneIndex"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numero de retrait</FormLabel>
                          <Select 
                            value={field.value !== undefined ? String(field.value) : ""} 
                            onValueChange={(value) => field.onChange(Number(value))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-withdrawal-phone">
                                <SelectValue placeholder="Selectionnez un numero" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {withdrawalPhones.map((phone, index) => (
                                <SelectItem key={index} value={String(index)}>
                                  {phone}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Numero configure dans vos parametres
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pays</label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-withdrawal-country">
                          {COUNTRIES.find(c => c.code === userCountry)?.name || userCountry}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pays configure dans votre profil (non modifiable)
                      </p>
                    </div>

                    {hasMultiplePawaPayCurrencies(userCountry) && (
                      <CurrencySelector
                        countryCode={userCountry}
                        selectedCurrency={selectedCurrency}
                        onCurrencyChange={setSelectedCurrency}
                        overrideCurrencies={getPawaPayCurrenciesForCountry(userCountry)}
                      />
                    )}

                    {!hasMultiplePawaPayCurrencies(userCountry) && hasMultiplePayoutCurrencies(userCountry) && (
                      <CurrencySelector
                        countryCode={userCountry}
                        selectedCurrency={selectedCurrency}
                        onCurrencyChange={setSelectedCurrency}
                        mode="payout"
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="operator"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operateur/Porte-monnaie</FormLabel>
                          {countryOperators.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                              Aucun operateur disponible pour votre pays
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

                    {amount && userCountry && selectedOperator && feeInfo && (
                      <div className="bg-muted p-4 rounded-md border space-y-3">
                        <div className="flex items-start gap-3">
                          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div className="text-sm space-y-2 w-full">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Montant saisi:</span>
                              <span className="font-medium">
                                {new Intl.NumberFormat("fr-FR", {
                                  style: "currency",
                                  currency: userBalanceCurrency,
                                  minimumFractionDigits: 0,
                                }).format(amount)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Frais de service:</span>
                              <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-fee-amount">
                                -{new Intl.NumberFormat("fr-FR", {
                                  style: "currency",
                                  currency: userBalanceCurrency,
                                  minimumFractionDigits: 0,
                                }).format(feeInfo.feeAmount)}
                              </span>
                            </div>
                            {outgoingExchangeFeeAmount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Frais d'echange:</span>
                                <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-exchange-fee-amount">
                                  -{new Intl.NumberFormat("fr-FR", {
                                    style: "currency",
                                    currency: userBalanceCurrency,
                                    minimumFractionDigits: 0,
                                  }).format(outgoingExchangeFeeAmount)}
                                </span>
                              </div>
                            )}
                            {!needsConversion && (
                              <div className="flex justify-between font-semibold text-green-600 dark:text-green-400">
                                <span>Montant recu ({userBalanceCurrency}):</span>
                                <span data-testid="text-amount-received">
                                  {new Intl.NumberFormat("fr-FR", {
                                    style: "currency",
                                    currency: userBalanceCurrency,
                                    minimumFractionDigits: 0,
                                  }).format(feeInfo.amountReceived)}
                                </span>
                              </div>
                            )}
                            {needsConversion && conversionData && !conversionData.isLoading && conversionData.convertedAmount > 0 && (
                              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md">
                                <div className="flex justify-between font-semibold text-blue-700 dark:text-blue-400">
                                  <span>Destinataire recoit ({conversionData.targetCurrency}):</span>
                                  <span data-testid="text-converted-amount">
                                    {new Intl.NumberFormat("fr-FR", {
                                      style: "currency",
                                      currency: conversionData.targetCurrency,
                                      minimumFractionDigits: getCurrencyDecimals(conversionData.targetCurrency),
                                      maximumFractionDigits: getCurrencyDecimals(conversionData.targetCurrency),
                                    }).format(conversionData.convertedAmount)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Taux: 1 {userBalanceCurrency} = {conversionData.conversionRate.toFixed(6)} {conversionData.targetCurrency}
                                </p>
                              </div>
                            )}
                            {needsConversion && (conversionData?.isLoading || !conversionData) && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-xs">Calcul de la conversion {userBalanceCurrency} → {withdrawalCurrency}...</span>
                              </div>
                            )}
                            <div className="border-t pt-2 flex justify-between font-semibold">
                              <span className="text-muted-foreground">Debite du solde:</span>
                              <span className="text-foreground" data-testid="text-total-deducted">
                                {new Intl.NumberFormat("fr-FR", {
                                  style: "currency",
                                  currency: userBalanceCurrency,
                                  minimumFractionDigits: 0,
                                }).format(feeInfo.totalDeductedFromBalance + outgoingExchangeFeeAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={withdrawalMutation.isPending || !user || countryOperators.length === 0}
                      data-testid="button-submit-withdrawal"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Effectuer le retrait
                    </Button>
                  </form>
                </Form>
              }
              cryptoContent={
                amount && amount >= cryptoWithdrawalMin && user ? (
                  <CryptoWithdrawalFlow
                    amount={amount}
                    currency={userBalanceCurrency}
                    userBalance={user.balance || 0}
                    type="withdrawal"
                    onSuccess={() => {
                      form.reset();
                      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
                    }}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Entrez un montant d'au moins {cryptoWithdrawalMin.toLocaleString("fr-FR")} {userBalanceCurrency} pour retirer en crypto
                  </div>
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-xs text-green-900 dark:text-green-100 ml-2">
          <strong>Securite renforcee:</strong> Les retraits ne sont possibles que vers vos numeros pre-configures dans les parametres.
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
              Entrez votre code de securite a 6 chiffres pour confirmer le retrait
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
                <span className="font-medium">{pendingData && withdrawalPhones[pendingData.withdrawalPhoneIndex]}</span>
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
              disabled={withdrawalMutation.isPending || securityCode.length !== 6}
              data-testid="button-confirm-security"
            >
              {withdrawalMutation.isPending ? (
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
