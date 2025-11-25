import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowDownToLine, CheckCircle2, Clock, Info, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateIncomingFee } from "@/lib/fees";
import { useState, useEffect } from "react";

// Instructions USSD Orange par pays
const ORANGE_INSTRUCTIONS: Record<string, string> = {
  SN: "Composez #144#391*VOTRE CODE PIN ORANGE MONEY# pour obtenir votre code de paiement",
  CI: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
  BF: "Composez *555*6# sur votre téléphone pour obtenir votre code OTP",
};

const depositSchema = z.object({
  amount: z.number().min(1, "Le montant doit être supérieur à 0"),
  country: z.string().min(1, "Sélectionnez un pays"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
  phone: z.string().min(8, "Le numéro de téléphone est requis"),
});

type DepositFormData = z.infer<typeof depositSchema>;

export default function Deposit() {
  const { toast } = useToast();
  const [paymentStep, setPaymentStep] = useState<"form" | "otp" | "wizall-second" | "polling">("form");
  const [paymentData, setPaymentData] = useState<{
    transactionId?: string;
    token?: string;
    ussdInstruction?: string;
    requiresOTP?: boolean;
    requiresTwoStep?: boolean;
    wizallTransactionId?: string;
    redirectUrl?: string;
  }>({});
  const [otp, setOtp] = useState("");
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch enabled countries/operators for deposits
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
  const selectedOperator = form.watch("operator");
  const amount = form.watch("amount");
  
  // Filter operators based on admin configuration
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && selectedCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  // Calculate net amount in real-time
  const netAmount = selectedCountry && amount ? calculateIncomingFee(Math.floor(amount), selectedCountry).netAmount : 0;

  // INIT: Create invoice and get instructions
  const initPaymentMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const res = await apiRequest("POST", "/api/softpay/init-payment", {
        ...data,
        description: `Dépôt de ${data.amount} XOF`,
        customerName: `${user?.firstName} ${user?.lastName}`,
        customerEmail: user?.email,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      setPaymentData(response);
      
      // Handle Wave redirect
      if (response.redirectUrl) {
        toast({
          title: "Redirection",
          description: "Vous allez être redirigé vers Wave",
        });
        window.open(response.redirectUrl, "_blank");
        setPaymentStep("polling");
        return;
      }

      // If requires OTP, show OTP input
      if (response.requiresOTP) {
        setPaymentStep("otp");
        toast({
          title: "Instructions reçues",
          description: "Veuillez suivre les instructions USSD et entrer le code OTP",
        });
      } else {
        // No OTP required, start polling
        setPaymentStep("polling");
        toast({
          title: "Paiement initié",
          description: "Vérification automatique en cours",
        });
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

  // CONFIRM: Submit OTP
  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ transactionId, token, authorizationCode }: { 
      transactionId: string; 
      token: string; 
      authorizationCode: string;
    }) => {
      const res = await apiRequest("POST", "/api/softpay/confirm-payment", {
        transactionId,
        token,
        authorizationCode,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      // Check if this is Wizall first step (requires second OTP)
      if (response.requiresOTP && response.wizallTransactionId) {
        setPaymentData(prev => ({
          ...prev,
          wizallTransactionId: response.wizallTransactionId,
        }));
        setPaymentStep("wizall-second");
        setOtp("");
        toast({
          title: "Code OTP envoyé",
          description: "Veuillez entrer le code OTP reçu par SMS pour Wizall",
        });
        return;
      }

      // Payment confirmed, start polling
      setPaymentStep("polling");
      toast({
        title: "Paiement confirmé",
        description: "Vérification en cours",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la confirmation du paiement",
        variant: "destructive",
      });
    },
  });

  // Poll payment status
  useEffect(() => {
    if (paymentStep !== "polling" || !paymentData.token) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiRequest("POST", "/api/softpay/verify-payment", {
          invoiceToken: paymentData.token,
        });
        const result = await res.json();

        if (result.status === "completed" || result.response_code === "00") {
          setPollingStatus("completed");
          setPaymentStep("form");
          clearInterval(interval);
          
          toast({
            title: "Paiement réussi",
            description: "Votre dépôt a été complété",
          });

          // Refresh user balance and reset form
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
            form.reset();
            setPaymentData({});
            setOtp("");
            setPollingStatus(null);
          }, 2000);
        }
      } catch (error) {
        console.error("Payment verification error:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentStep, paymentData.token, toast, form]);

  const onSubmit = (data: DepositFormData) => {
    initPaymentMutation.mutate(data);
  };

  const handleConfirmOTP = () => {
    if (!otp || !paymentData.transactionId || !paymentData.token) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer le code OTP",
        variant: "destructive",
      });
      return;
    }

    confirmPaymentMutation.mutate({
      transactionId: paymentData.transactionId,
      token: paymentData.token,
      authorizationCode: otp,
    });
  };

  const handleBackToForm = () => {
    setPaymentStep("form");
    setPaymentData({});
    setOtp("");
    form.reset();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5" />
          Dépôt
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
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
          <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100 ml-2">
            <strong>Paiement en cours:</strong> Veuillez compléter le paiement sur votre téléphone. 
            Vérification automatique toutes les 5 secondes.
          </AlertDescription>
        </Alert>
      )}

      {pollingStatus === "completed" && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertDescription className="text-sm text-green-900 dark:text-green-100 ml-2">
            <strong>Paiement confirmé!</strong> Votre dépôt a été complété avec succès.
          </AlertDescription>
        </Alert>
      )}

      {paymentStep === "form" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Détails du dépôt</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Sélectionnez un pays" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name} ({country.code})
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
                        <FormLabel>Opérateur</FormLabel>
                        {countryOperators.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                            Aucun opérateur disponible pour ce pays. Contactez l'administrateur.
                          </div>
                        ) : (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-operator">
                                <SelectValue placeholder="Sélectionnez un opérateur" />
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
                      <FormLabel>Numéro de téléphone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="77123456"
                          data-testid="input-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedOperator?.toLowerCase().includes("orange") && selectedCountry && ORANGE_INSTRUCTIONS[selectedCountry] && (
                  <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
                    <Info className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                    <AlertDescription className="text-sm text-orange-900 dark:text-orange-100 ml-2">
                      <strong>Instructions Orange Money:</strong>
                      <p className="mt-1 font-mono text-xs">{ORANGE_INSTRUCTIONS[selectedCountry]}</p>
                    </AlertDescription>
                  </Alert>
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
                  disabled={initPaymentMutation.isPending}
                  data-testid="button-submit-deposit"
                >
                  {initPaymentMutation.isPending ? (
                    <>En cours...</>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Continuer
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {(paymentStep === "otp" || paymentStep === "wizall-second") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {paymentStep === "wizall-second" ? "Confirmation Wizall - Étape 2" : "Confirmation du paiement"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentData.ussdInstruction && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                <AlertDescription className="text-sm text-blue-900 dark:text-blue-100 ml-2">
                  <strong>Instructions USSD:</strong>
                  <p className="mt-1 font-mono">{paymentData.ussdInstruction}</p>
                </AlertDescription>
              </Alert>
            )}

            {paymentStep === "wizall-second" && paymentData.wizallTransactionId && (
              <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
                <Info className="h-4 w-4 text-purple-600 dark:text-purple-500" />
                <AlertDescription className="text-sm text-purple-900 dark:text-purple-100 ml-2">
                  <strong>Transaction Wizall:</strong>
                  <p className="mt-1 font-mono text-xs">{paymentData.wizallTransactionId}</p>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="otp">Code OTP</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Entrez le code OTP"
                data-testid="input-otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Entrez le code reçu par SMS sur votre téléphone
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBackToForm}
                className="flex-1"
                data-testid="button-cancel"
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirmOTP}
                disabled={confirmPaymentMutation.isPending || !otp}
                className="flex-1"
                data-testid="button-confirm-otp"
              >
                {confirmPaymentMutation.isPending ? (
                  <>Vérification...</>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
