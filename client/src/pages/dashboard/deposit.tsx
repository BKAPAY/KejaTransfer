import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import { ArrowDownToLine } from "lucide-react";

const depositSchema = z.object({
  amount: z.number().min(1, "Le montant doit être supérieur à 0"),
  country: z.string().min(1, "Sélectionnez un pays"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
});

type DepositFormData = z.infer<typeof depositSchema>;

export default function Deposit() {
  const { toast } = useToast();

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: undefined as any,
      country: "",
      operator: "",
    },
  });

  const selectedCountry = form.watch("country");
  const countryOperators =
    OPERATORS[(selectedCountry as keyof typeof OPERATORS) || ("BJ" as const)] || [];

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      return await apiRequest("POST", "/api/deposits", data);
    },
    onSuccess: (response: any) => {
      toast({
        title: "Dépôt initié",
        description: "Vous allez être redirigé vers Paydunya",
      });
      // Redirect to Paydunya payment page
      window.location.href = response.redirectUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du dépôt",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DepositFormData) => {
    depositMutation.mutate(data);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <ArrowDownToLine className="h-8 w-8" />
          Effectuer un dépôt
        </h1>
        <p className="text-muted-foreground">
          Ajoutez des fonds à votre compte via mobile money
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détails du dépôt</CardTitle>
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
                        min="1"
                        step="100"
                        data-testid="input-amount"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={depositMutation.isPending}
                data-testid="button-submit-deposit"
              >
                {depositMutation.isPending ? "En cours..." : "Continuer vers le paiement"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
