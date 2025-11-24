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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import type { User } from "@shared/schema";
import { ArrowUpFromLine, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee } from "@/lib/fees";

const transferSchema = z.object({
  amount: z.number().min(1, "Le montant doit être supérieur à 0"),
  country: z.string().min(1, "Sélectionnez un pays"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
  phone: z.string().min(7, "Numéro de téléphone invalide"),
});

type TransferFormData = z.infer<typeof transferSchema>;

export default function Transfer() {
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      amount: undefined as any,
      country: "",
      operator: "",
      phone: "",
    },
  });

  const selectedCountry = form.watch("country");
  const amount = form.watch("amount");
  const countryOperators =
    OPERATORS[(selectedCountry as keyof typeof OPERATORS) || ("BJ" as const)] || [];

  // Calculate total deducted in real-time
  const totalDeducted = selectedCountry && amount ? calculateOutgoingFee(Math.floor(amount), selectedCountry).totalDeductedFromBalance : 0;

  const transferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      return await apiRequest("POST", "/api/transfers", data);
    },
    onSuccess: () => {
      toast({
        title: "Transfert effectué",
        description: "Le transfert a été effectué avec succès",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du transfert",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransferFormData) => {
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
        description: "Vous devez vérifier votre identité (KYC) avant de faire des transferts. Veuillez compléter la vérification dans vos paramètres.",
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

    transferMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <ArrowUpFromLine className="h-5 w-5" />
          Transférer
        </h1>
        <p className="text-sm text-muted-foreground">
          Envoyez de l'argent via mobile money
        </p>
      </div>

      {user && (
        <Alert className="py-2">
          <AlertDescription className="text-xs">
            <strong>Solde:</strong> {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "XOF",
              minimumFractionDigits: 0,
            }).format(user.balance || 0)}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Détails</CardTitle>
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
                        data-testid="input-transfer-amount"
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
                        <SelectTrigger data-testid="select-transfer-country">
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-transfer-operator">
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
                        data-testid="input-transfer-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amount && selectedCountry && totalDeducted > 0 && (
                <div className="bg-muted p-3 rounded-md border">
                  <p className="text-sm text-muted-foreground">
                    Total déducté de votre solde
                  </p>
                  <p className="text-lg font-semibold text-foreground" data-testid="text-total-deducted">
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "XOF",
                      minimumFractionDigits: 0,
                    }).format(totalDeducted)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Montant envoyé: {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "XOF",
                      minimumFractionDigits: 0,
                    }).format(amount)}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={transferMutation.isPending}
                data-testid="button-submit-transfer"
              >
                {transferMutation.isPending ? "En cours..." : "Effectuer le transfert"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
