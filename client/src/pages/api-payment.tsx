import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { OPERATORS, COUNTRIES } from "@shared/schema";
import { CurrencySelector, getCurrencyLabel } from "@/components/currency-selector";
import { hasMultipleCurrencies, getMbiyoPayCurrenciesForCountry } from "@shared/mbiyopay-countries";
import type { Transaction } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";

interface ConversionData {
  convertedAmount: number;
  targetCurrency: string;
  conversionRate: number;
  isLoading: boolean;
}

export default function ApiPayment() {
  const [, setLocation] = useLocation();
  const { transactionId } = useParams<{ transactionId: string }>();
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversionData, setConversionData] = useState<ConversionData | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XOF");

  // Handle currency selection when country changes
  useEffect(() => {
    if (country && hasMultipleCurrencies(country)) {
      const currencies = getMbiyoPayCurrenciesForCountry(country);
      setSelectedCurrency(currencies[0]);
    } else if (country) {
      const countryCurrency = COUNTRIES.find(c => c.code === country)?.currency || "XOF";
      setSelectedCurrency(countryCurrency);
    }
  }, [country]);

  // Currency conversion for non-XOF countries
  const targetCurrency = hasMultipleCurrencies(country) 
    ? selectedCurrency 
    : (COUNTRIES.find(c => c.code === country)?.currency || "XOF");
  const needsConversion = targetCurrency !== "XOF";

  // Fetch transaction details
  const { data: transaction, isLoading: isLoadingTransaction, error } = useQuery<Transaction>({
    queryKey: [`/api/transactions/${transactionId}`],
  });

  const countryOperators = OPERATORS[(country as keyof typeof OPERATORS) || ("BJ" as const)] || [];

  const fetchConversion = useCallback(async (amountToConvert: number, toCurrency: string) => {
    if (!amountToConvert || amountToConvert <= 0 || toCurrency === "XOF") {
      setConversionData(null);
      return;
    }

    setConversionData(prev => prev ? { ...prev, isLoading: true } : { convertedAmount: 0, targetCurrency: toCurrency, conversionRate: 0, isLoading: true });

    try {
      const res = await fetch("/api/convert-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountToConvert, fromCurrency: "XOF", toCurrency }),
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
    if (needsConversion && transaction?.amount && transaction.amount > 0) {
      const debounceTimer = setTimeout(() => {
        fetchConversion(transaction.amount, targetCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, transaction?.amount, targetCurrency, fetchConversion, selectedCurrency]);

  const handlePayment = async () => {
    if (!country || !operator || !transactionId) {
      return;
    }

    setIsLoading(true);
    try {
      // Call payment API to get payment URL
      const response = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          country,
          operator,
          currency: selectedCurrency,
        }),
      });

      const data = await response.json();

      if (data.transactionId) {
        // Redirect to payment status page - will show loading, then success or error
        window.location.href = `/payment-status/${data.transactionId}`;
      }
    } catch (err: any) {
      // Silently fail - redirect to status page which will show error
      window.location.href = `/payment-status/${transactionId}`;
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingTransaction) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-background overflow-hidden">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-background overflow-hidden">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Erreur</p>
                <p className="text-sm text-muted-foreground">La transaction n'a pas pu être trouvée</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 overflow-hidden">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">B</span>
            </div>
            <p className="font-bold text-lg text-foreground">BKApay</p>
          </div>
          <CardTitle>Paiement Sécurisé</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Transaction Details */}
          <div className="space-y-3 pb-4 border-b">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
              <p className="text-3xl font-bold text-primary">
                {transaction.amount.toLocaleString()} <span className="text-lg">XOF</span>
              </p>
            </div>
            {transaction.description && (
              <div>
                <p className="text-sm text-muted-foreground">Détail</p>
                <p className="text-sm text-foreground">{transaction.description}</p>
              </div>
            )}
            {transaction.customerName && (
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="text-sm text-foreground">{transaction.customerName}</p>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Choisissez votre méthode de paiement</h3>

            <div className="space-y-2">
              <Label htmlFor="country">Pays</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country" data-testid="select-country">
                  <SelectValue placeholder="Sélectionnez un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SN">Senegal</SelectItem>
                  <SelectItem value="CI">Cote d'Ivoire</SelectItem>
                  <SelectItem value="BF">Burkina Faso</SelectItem>
                  <SelectItem value="BJ">Benin</SelectItem>
                  <SelectItem value="TG">Togo</SelectItem>
                  <SelectItem value="GN">Guinee</SelectItem>
                  <SelectItem value="NE">Niger</SelectItem>
                  <SelectItem value="CD">RD Congo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasMultipleCurrencies(country) && (
              <CurrencySelector
                countryCode={country}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="operator">Opérateur Mobile Money</Label>
              <Select value={operator} onValueChange={setOperator} disabled={!country}>
                <SelectTrigger id="operator" data-testid="select-operator">
                  <SelectValue placeholder={country ? "Sélectionnez un opérateur" : "Choisissez un pays d'abord"} />
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
          </div>

          {/* Currency Conversion for non-XOF countries */}
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
                  {new Intl.NumberFormat("fr-FR").format(conversionData.convertedAmount)} {conversionData.targetCurrency}
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              Vous serez redirige vers votre operateur pour confirmer le paiement. Vos donnees de paiement sont securisees.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handlePayment}
            disabled={!country || !operator || isLoading}
            className="w-full"
            size="lg"
            data-testid="button-submit-payment"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              `Payer ${transaction.amount.toLocaleString()} XOF`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
