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
import { ArrowDownToLine, CheckCircle2, Clock, Info, Loader2, Smartphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateIncomingFee } from "@/lib/fees";
import { useState, useEffect, useCallback } from "react";
import { PaymentMethodSelector } from "@/components/payment-method-selector";

interface ConversionData {
  convertedAmount: number;
  targetCurrency: string;
  conversionRate: number;
  isLoading: boolean;
}

const depositSchema = z.object({
  amount: z.number().min(100, "Le montant minimum est de 100 XOF"),
  country: z.string().min(1, "Selectionnez un pays"),
  operator: z.string().min(1, "Selectionnez un operateur"),
  phone: z.string().min(8, "Le numero de telephone est requis"),
});

type DepositFormData = z.infer<typeof depositSchema>;

export default function Deposit() {
  const { toast } = useToast();
  const [paymentStep, setPaymentStep] = useState<"form" | "polling" | "completed" | "otp">("form");
  const [paymentData, setPaymentData] = useState<{
    transactionId?: string;
    fedapayTransactionId?: number;
    message?: string;
    redirectUrl?: string;
    ussdInstruction?: string;
    paydunyaToken?: string;
    requiresOTP?: boolean;
  }>({});
  const [otpCode, setOtpCode] = useState("");
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [conversionData, setConversionData] = useState<ConversionData | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: enabledCountriesOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/deposits"],
  });

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: undefined as any,
      country: "",
      operator: "",
      phone: "",
    },
  });

  const selectedCountry = form.watch("country");
  const amount = form.watch("amount");

  // Filter countries to only show those enabled by admin (have at least one enabled operator)
  const collectCountries = enabledCountriesOperators 
    ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
    : [];
  
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && selectedCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  const netAmount = selectedCountry && amount ? calculateIncomingFee(Math.floor(amount), selectedCountry).netAmount : 0;

  // Currency conversion for non-XOF countries
  const targetCurrency = COUNTRIES.find(c => c.code === selectedCountry)?.currency || "XOF";
  const needsConversion = targetCurrency !== "XOF";

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
    if (needsConversion && amount && amount > 0) {
      const debounceTimer = setTimeout(() => {
        fetchConversion(amount, targetCurrency);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setConversionData(null);
    }
  }, [needsConversion, amount, targetCurrency, fetchConversion]);

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const res = await apiRequest("POST", "/api/fedapay/deposit", data);
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
        });
        
        if (response.requiresOTP) {
          setPaymentStep("otp");
          toast({
            title: "Code OTP requis",
            description: response.ussdInstruction || "Generez votre code de paiement",
          });
        } else {
          setPaymentStep("polling");
          toast({
            title: "Paiement initie",
            description: response.message || "Veuillez valider le paiement sur votre telephone",
          });
        }
      } else {
        toast({
          title: "Erreur",
          description: response.error || "Erreur lors du depot",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
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
        setPaymentStep("polling");
        setOtpCode("");
        toast({
          title: "Code valide",
          description: "Veuillez valider le paiement sur votre telephone",
        });
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
    
    if (!paymentData.paydunyaToken || !paymentData.transactionId) {
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

  useEffect(() => {
    if (paymentStep !== "polling" || !paymentData.transactionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/transactions/${paymentData.transactionId}`);
        if (res.ok) {
          const tx = await res.json();
          if (tx.status === "completed") {
            setPollingStatus("completed");
            setPaymentStep("completed");
            clearInterval(interval);
            
            toast({
              title: "Paiement reussi",
              description: "Votre depot a ete complete",
            });

            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
              queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
              form.reset();
              setPaymentData({});
              setPollingStatus(null);
              setPaymentStep("form");
            }, 3000);
          } else if (tx.status === "failed") {
            setPaymentStep("form");
            clearInterval(interval);
            toast({
              title: "Paiement echoue",
              description: "Le paiement n'a pas abouti",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Payment verification error:", error);
      }
    }, 5000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (paymentStep === "polling") {
        setPaymentStep("form");
        toast({
          title: "Delai expire",
          description: "Le paiement n'a pas ete confirme dans le delai imparti",
          variant: "destructive",
        });
      }
    }, 600000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentStep, paymentData.transactionId, toast, form]);

  const onSubmit = (data: DepositFormData) => {
    depositMutation.mutate(data);
  };

  const handleBackToForm = () => {
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
            <strong>Solde disponible:</strong> {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "XOF",
              minimumFractionDigits: 0,
            }).format(user.balance || 0)}
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
                {paymentData.message || "Une demande de paiement a ete envoyee sur votre telephone."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Veuillez valider le paiement sur votre application mobile money.
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
            {paymentData.redirectUrl && (
              <Button
                onClick={() => window.open(paymentData.redirectUrl, "_blank")}
                className="w-full"
                data-testid="button-redirect-wave"
              >
                Aller vers Wave pour payer
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
                {paymentData.ussdInstruction || "Generez votre code de paiement et entrez-le ci-dessous"}
              </p>
            </div>
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
          <CardContent>
            <PaymentMethodSelector
              mobileMoneyContent={
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant (XOF)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="10000"
                              data-testid="input-amount"
                              min="100"
                              value={field.value || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === "" ? undefined : Number(val));
                              }}
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
                                  <span className="flex items-center gap-2">
                                    <span className="text-base">{country.flag}</span>
                                    <span>{country.name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-operator">
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

                    {amount && selectedCountry && netAmount > 0 && (
                      <div className="bg-muted p-3 rounded-md border">
                        <p className="text-sm text-muted-foreground">
                          Vous recevrez
                        </p>
                        <p className="text-lg font-semibold text-foreground" data-testid="text-net-amount">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(netAmount)}
                        </p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={depositMutation.isPending || countryOperators.length === 0}
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
                          Continuer
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
