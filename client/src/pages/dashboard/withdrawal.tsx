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
import { ArrowUpFromLine, Info, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee } from "@/lib/fees";

const withdrawalSchema = z.object({
  amount: z.number().min(500, "Le montant minimum est de 500 XOF"),
  country: z.string().min(1, "Sélectionnez un pays"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
  phone: z.string().min(7, "Numéro de téléphone invalide").regex(/^\d+$/, "Le numéro doit contenir uniquement des chiffres"),
  phoneConfirm: z.string().min(7, "Confirmez le numéro de téléphone"),
}).refine((data) => data.phone === data.phoneConfirm, {
  message: "Numéro incorrect - les numéros ne correspondent pas",
  path: ["phoneConfirm"],
});

type WithdrawalFormData = z.infer<typeof withdrawalSchema>;

export default function Withdrawal() {
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch enabled countries/operators for withdrawals
  const { data: enabledCountriesOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
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
  
  // Filter operators based on admin configuration
  const allCountryOperators = selectedCountry
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || [])
    : [];
  
  const countryOperators = enabledCountriesOperators && selectedCountry
    ? allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))
    : allCountryOperators;

  // Calculate total deducted in real-time
  const totalDeducted = selectedCountry && amount ? calculateOutgoingFee(Math.floor(amount), selectedCountry).totalDeductedFromBalance : 0;
  const feeInfo = selectedCountry && amount ? calculateOutgoingFee(Math.floor(amount), selectedCountry) : null;

  const withdrawalMutation = useMutation({
    mutationFn: async (data: WithdrawalFormData) => {
      const res = await apiRequest("POST", "/api/withdrawals", data);
      return res.json();
    },
    onSuccess: (response: any) => {
      toast({
        title: "Retrait effectué",
        description: `Retrait de ${amount} XOF approuvé. Le montant de ${response.totalDeducted || totalDeducted} XOF a été débité de votre solde.`,
      });
      form.reset();
      // Refetch user balance
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || error.response?.data?.error || "Erreur lors du retrait";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WithdrawalFormData) => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Utilisateur non trouvé",
        variant: "destructive",
      });
      return;
    }

    // Check KYC verification
    if (user.kycStatus !== "verified") {
      toast({
        title: "Vérification KYC requise",
        description: "Vous devez vérifier votre identité (KYC) avant de faire des retraits. Veuillez compléter la vérification dans vos paramètres.",
        variant: "destructive",
      });
      return;
    }

    const feeInfo = calculateOutgoingFee(data.amount, selectedCountry);
    if (user.balance < feeInfo.totalDeductedFromBalance) {
      toast({
        title: "Solde insuffisant",
        description: `Vous avez ${user.balance} XOF. Total à déduire: ${feeInfo.totalDeductedFromBalance} XOF`,
        variant: "destructive",
      });
      return;
    }

    withdrawalMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <ArrowUpFromLine className="h-5 w-5" />
          Retrait
        </h1>
        <p className="text-sm text-muted-foreground">
          Transférez de l'argent vers votre porte-monnaie mobile money
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
          <CardTitle className="text-lg">Détails du retrait</CardTitle>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-withdrawal-country">
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
                      <FormLabel>Opérateur/Porte-monnaie</FormLabel>
                      {countryOperators.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                          Aucun opérateur disponible pour ce pays
                        </div>
                      ) : (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-withdrawal-operator">
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
                    <FormLabel>Numéro de téléphone (sans code pays)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="771234567"
                        data-testid="input-withdrawal-phone"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exemple pour Sénégal: 771234567 (sans le +221)
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
                    <FormLabel>Confirmer le numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="771234567"
                        data-testid="input-withdrawal-phone-confirm"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Saisissez à nouveau le numéro pour confirmer
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amount && selectedCountry && totalDeducted > 0 && feeInfo && (
                <div className="bg-muted p-4 rounded-md border space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant à envoyer:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(amount)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total débité du solde:</span>
                        <span className="text-foreground" data-testid="text-total-deducted">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(totalDeducted)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={withdrawalMutation.isPending || !user || user.kycStatus !== "verified"}
                data-testid="button-submit-withdrawal"
              >
                {withdrawalMutation.isPending ? (
                  <>Traitement en cours...</>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Effectuer le retrait
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
          <strong>Conseil de sécurité:</strong> Vérifiez toujours le numéro de téléphone avant de soumettre le retrait. Les retraits sont irrévocables une fois soumis.
        </AlertDescription>
      </Alert>
    </div>
  );
}
