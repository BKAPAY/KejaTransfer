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
import { ArrowDownToLine, AlertCircle, Info, CheckCircle2, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateIncomingFee } from "@/lib/fees";
import { useState, useEffect } from "react";

const depositSchema = z.object({
  amount: z.number().min(1, "Le montant doit être supérieur à 0"),
  country: z.string().min(1, "Sélectionnez un pays"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
  phone: z.string().min(8, "Le numéro de téléphone est requis"),
});

type DepositFormData = z.infer<typeof depositSchema>;

export default function Deposit() {
  const { toast } = useToast();
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
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
  const amount = form.watch("amount");
  
  // Filter operators based on admin configuration
  const allCountryOperators =
    OPERATORS[(selectedCountry as keyof typeof OPERATORS) || ("BJ" as const)] || [];
  const countryOperators = enabledCountriesOperators 
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  // Calculate net amount in real-time
  const netAmount = selectedCountry && amount ? calculateIncomingFee(Math.floor(amount), selectedCountry).netAmount : 0;

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      return await apiRequest("POST", "/api/softpay/create-payment", {
        ...data,
        description: `Dépôt de ${data.amount} XOF`,
      });
    },
    onSuccess: (response: any) => {
      setInvoiceToken(response.token);
      setPaymentInProgress(true);
      setPollingStatus("waiting");
      toast({
        title: "Facture créée",
        description: "Veuillez compléter le paiement sur votre téléphone",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de la facture",
        variant: "destructive",
      });
    },
  });

  // Poll payment status
  useEffect(() => {
    if (!invoiceToken || !paymentInProgress) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiRequest("POST", "/api/softpay/verify-payment", {
          invoiceToken,
        });
        const result = await res.json();
        console.log("[Payment Status]", result);

        if (result.status === "completed" || result.response_code === "00") {
          setPollingStatus("completed");
          setPaymentInProgress(false);
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
            setInvoiceToken(null);
            setPollingStatus(null);
          }, 2000);
        }
      } catch (error) {
        console.error("Payment verification error:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [invoiceToken, paymentInProgress, toast, form]);

  const onSubmit = (data: DepositFormData) => {
    createPaymentMutation.mutate(data);
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

      {paymentInProgress && invoiceToken && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
          <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100 ml-2">
            <strong>Paiement en cours:</strong> Veuillez compléter le paiement sur votre téléphone (Mobile Money). 
            Nous vérifierons automatiquement l'état du paiement toutes les 5 secondes.
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
                        disabled={paymentInProgress}
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={paymentInProgress}>
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
                      <Select value={field.value} onValueChange={field.onChange} disabled={paymentInProgress}>
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
                        disabled={paymentInProgress}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                disabled={createPaymentMutation.isPending || paymentInProgress}
                data-testid="button-submit-deposit"
              >
                {createPaymentMutation.isPending ? (
                  <>En cours...</>
                ) : paymentInProgress ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Paiement en attente...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Créer la facture
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-xs text-blue-900 dark:text-blue-100 ml-2">
          <strong>Comment ça marche:</strong> Vous n'allez pas être redirigé vers Paydunya. Après avoir créé la facture, 
          complétez le paiement directement sur votre téléphone via votre porte-monnaie mobile money. 
          Nous vérifierons automatiquement l'état du paiement.
        </AlertDescription>
      </Alert>
    </div>
  );
}
