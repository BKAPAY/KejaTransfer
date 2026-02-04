import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Send, Info, CheckCircle2, Loader2, Lock, AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee, fetchFeeConfig, formatFeePercentage } from "@/lib/fees";
import { useLocation } from "wouter";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { hasMultipleCurrencies, getMbiyoPayCurrenciesForCountry } from "@shared/mbiyopay-countries";
import { useEffect, useCallback } from "react";
import { useConvertedMinimums } from "@/hooks/use-converted-minimums";
import { getCurrencyDecimals } from "@/lib/currency";

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
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");
  const [feePercentage, setFeePercentage] = useState<number>(60);
  const [conversionData, setConversionData] = useState<{
    convertedAmount: number;
    targetCurrency: string;
    conversionRate: number;
    isLoading: boolean;
  } | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });
  
  const userBalanceCurrency = user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const { transferMin } = useConvertedMinimums(userBalanceCurrency);

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
    if (selectedCountry && hasMultipleCurrencies(selectedCountry)) {
      const currencies = getMbiyoPayCurrenciesForCountry(selectedCountry);
      setSelectedCurrency(currencies[0]);
    } else if (selectedCountry) {
      const countryCurrency = COUNTRIES.find(c => c.code === selectedCountry)?.currency || "XOF";
      setSelectedCurrency(countryCurrency);
    }
  }, [selectedCountry]);

  // Currency conversion when source and destination currencies differ
  // IMPORTANT: Only calculate target currency if a country is actually selected
  const targetCurrency = selectedCountry 
    ? (hasMultipleCurrencies(selectedCountry) 
        ? selectedCurrency 
        : (COUNTRIES.find(c => c.code === selectedCountry)?.currency || userBalanceCurrency))
    : userBalanceCurrency; // Default to user's currency when no country selected
  // Only need conversion if a country is selected AND its currency differs from user's currency
  const needsConversion = selectedCountry && targetCurrency !== userBalanceCurrency;

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
    if (needsConversion && amount && amount > 0) {
      const debounceTimer = setTimeout(() => {
        fetchConversion(amount, userBalanceCurrency, targetCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, amount, userBalanceCurrency, targetCurrency, fetchConversion, selectedCurrency]);

  const transferMutation = useMutation({
    mutationFn: async (data: { formData: TransferFormData; securityCode: string }) => {
      // Always send the original amount in user's currency - backend handles conversion
      const res = await apiRequest("POST", "/api/fedapay/withdrawal", {
        amount: data.formData.amount, // Original amount in user's currency
        phone: data.formData.phone,
        country: data.formData.country,
        operator: data.formData.operator,
        type: "transfer",
        securityCode: data.securityCode,
        currency: userBalanceCurrency, // User's currency (e.g., CDF)
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
            title: "Erreur",
            description: response.error || "Erreur lors du transfert",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Erreur lors du transfert";
      if (errorMessage.includes("Code de securite") || errorMessage.includes("incorrect")) {
        setSecurityError(errorMessage);
      } else {
        setShowSecurityModal(false);
        setSecurityCode("");
        toast({
          title: "Erreur",
          description: errorMessage,
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant ({userBalanceCurrency})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="500"
                        data-testid="input-transfer-amount"
                        min="500"
                        value={field.value || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : Number(val));
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Montant minimum: {transferMin.toLocaleString("fr-FR")} {userBalanceCurrency}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                            {country.flag} {country.name}
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
                      <FormLabel>Operateur/Porte-monnaie</FormLabel>
                      {countryOperators.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                          Aucun operateur disponible pour ce pays
                        </div>
                      ) : (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-transfer-operator">
                              <SelectValue placeholder="Selectionnez un operateur" />
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
                <div className="bg-muted p-4 rounded-md border space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm space-y-2 w-full">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant a envoyer:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: userBalanceCurrency,
                            minimumFractionDigits: 0,
                          }).format(amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais:</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-fee-amount">
                          +{new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: userBalanceCurrency,
                            minimumFractionDigits: 0,
                          }).format(feeInfo.feeAmount)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total debite du solde:</span>
                        <span className="text-foreground" data-testid="text-total-deducted">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: userBalanceCurrency,
                            minimumFractionDigits: 0,
                          }).format(amount + feeInfo.feeAmount)}
                        </span>
                      </div>
                      {needsConversion && conversionData && !conversionData.isLoading && (
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold">
                            <span>Destinataire recevra:</span>
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
                      {needsConversion && conversionData?.isLoading && (
                        <div className="border-t pt-2 mt-2 flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Calcul de la conversion...</span>
                        </div>
                      )}
                    </div>
                  </div>
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
              <Input
                type="password"
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
