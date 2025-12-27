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
import { COUNTRIES, OPERATORS, PAYOUT_COUNTRIES } from "@shared/schema";
import type { User } from "@shared/schema";
import { Send, Info, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee } from "@/lib/fees";

const transferSchema = z.object({
  amount: z.number().min(500, "Le montant minimum est de 500 XOF"),
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

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

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

  const payoutCountries = COUNTRIES.filter(c => PAYOUT_COUNTRIES.includes(c.code as any));
  
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && selectedCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  const totalDeducted = selectedCountry && amount ? calculateOutgoingFee(Math.floor(amount), selectedCountry).totalDeductedFromBalance : 0;
  const feeInfo = selectedCountry && amount ? calculateOutgoingFee(Math.floor(amount), selectedCountry) : null;

  const transferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const res = await apiRequest("POST", "/api/fedapay/withdrawal", data);
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        toast({
          title: "Transfert initie",
          description: `Le transfert de ${amount} XOF a ete initie avec succes.`,
        });
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      } else {
        toast({
          title: "Erreur",
          description: response.error || "Erreur lors du transfert",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Erreur lors du transfert";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
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

    if (user.kycStatus !== "verified") {
      toast({
        title: "Verification requise",
        description: "Rendez-vous dans Parametres pour verifier votre compte et acceder a toutes les fonctionnalites.",
        variant: "destructive",
      });
      return;
    }

    const feeInfo = calculateOutgoingFee(data.amount, selectedCountry);
    if (user.balance < feeInfo.totalDeductedFromBalance) {
      toast({
        title: "Solde insuffisant",
        description: `Vous avez ${user.balance} XOF. Total a deduire: ${feeInfo.totalDeductedFromBalance} XOF`,
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate(data);
  };

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
            <strong>Solde disponible:</strong> {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "XOF",
              minimumFractionDigits: 0,
            }).format(user.balance || 0)}
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
                    <FormLabel>Montant (XOF)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5000"
                        data-testid="input-withdrawal-amount"
                        min="500"
                        value={field.value || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : Number(val));
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Montant minimum: 500 XOF</p>
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
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("operator", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-withdrawal-country">
                          <SelectValue placeholder="Selectionnez un pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {payoutCountries.map((country) => (
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
                      <FormLabel>Operateur/Porte-monnaie</FormLabel>
                      {countryOperators.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                          Aucun operateur disponible pour ce pays
                        </div>
                      ) : (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-withdrawal-operator">
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
                    <FormLabel>Numero de telephone (sans code pays)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="771234567"
                        data-testid="input-withdrawal-phone"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exemple pour Senegal: 771234567 (sans le +221)
                    </p>
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
                      <Input
                        placeholder="771234567"
                        data-testid="input-withdrawal-phone-confirm"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Saisissez a nouveau le numero pour confirmer
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amount && selectedCountry && feeInfo && (
                <div className="bg-muted p-4 rounded-md border space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm space-y-2 w-full">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant a envoyer:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais (6%):</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-fee-amount">
                          +{new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(feeInfo.feeAmount)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total debite du solde:</span>
                        <span className="text-foreground" data-testid="text-total-deducted">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(amount + feeInfo.feeAmount)}
                        </span>
                      </div>
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
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Effectuer le transfert
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
          <strong>Conseil de securite:</strong> Verifiez toujours le numero de telephone avant de soumettre le transfert. Les transferts sont irrevocables une fois soumis.
        </AlertDescription>
      </Alert>
    </div>
  );
}
