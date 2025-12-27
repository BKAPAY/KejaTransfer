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
import { OPERATORS } from "@shared/schema";
import type { User } from "@shared/schema";
import { ArrowUpFromLine, Info, CheckCircle2, Loader2, Settings, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateOutgoingFee } from "@/lib/fees";
import { useLocation } from "wouter";

const withdrawalSchema = z.object({
  amount: z.number().min(500, "Le montant minimum est de 500 XOF"),
  withdrawalPhoneIndex: z.number().min(0, "Selectionnez un numero de retrait"),
  operator: z.string().min(1, "Selectionnez un operateur"),
  securityCode: z.string().length(6, "Le code de securite doit contenir 6 chiffres").regex(/^\d+$/, "Le code doit contenir uniquement des chiffres"),
});

type WithdrawalFormData = z.infer<typeof withdrawalSchema>;

export default function Withdrawal() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: enabledCountriesOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: undefined as any,
      withdrawalPhoneIndex: undefined as any,
      operator: "",
      securityCode: "",
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

  const totalDeducted = userCountry && amount ? calculateOutgoingFee(Math.floor(amount), userCountry).totalDeductedFromBalance : 0;
  const feeInfo = userCountry && amount ? calculateOutgoingFee(Math.floor(amount), userCountry) : null;

  const withdrawalMutation = useMutation({
    mutationFn: async (data: WithdrawalFormData) => {
      const selectedPhone = withdrawalPhones[data.withdrawalPhoneIndex];
      if (!selectedPhone) {
        throw new Error("Numero de retrait invalide");
      }
      
      const res = await apiRequest("POST", "/api/withdrawal", {
        amount: data.amount,
        phone: selectedPhone,
        operator: data.operator,
        country: userCountry,
        securityCode: data.securityCode,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        toast({
          title: "Retrait initie",
          description: `Le retrait de ${amount} XOF a ete initie avec succes.`,
        });
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      } else {
        toast({
          title: "Erreur",
          description: response.error || "Erreur lors du retrait",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Erreur lors du retrait";
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
        description: "Utilisateur non trouve",
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
        description: "Rendez-vous dans Parametres pour verifier votre compte et acceder a toutes les fonctionnalites.",
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

    const feeInfo = calculateOutgoingFee(data.amount, userCountry);
    if (user.balance < feeInfo.totalDeductedFromBalance) {
      toast({
        title: "Solde insuffisant",
        description: `Vous avez ${user.balance} XOF. Total a deduire: ${feeInfo.totalDeductedFromBalance} XOF`,
        variant: "destructive",
      });
      return;
    }

    withdrawalMutation.mutate(data);
  };

  const hasNoWithdrawalPhones = withdrawalPhones.length === 0;
  const hasNoSecurityCode = !user?.securityCode;
  const hasNoCountry = !user?.country;

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
          <CardTitle className="text-lg">Details du retrait</CardTitle>
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

              <FormField
                control={form.control}
                name="securityCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code de securite (6 chiffres)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="******"
                        maxLength={6}
                        data-testid="input-security-code"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Entrez votre code de securite a 6 chiffres
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amount && userCountry && feeInfo && (
                <div className="bg-muted p-4 rounded-md border space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm space-y-2 w-full">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant saisi:</span>
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
                          -{new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(feeInfo.feeAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-green-600 dark:text-green-400">
                        <span>Montant recu:</span>
                        <span data-testid="text-amount-received">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(feeInfo.amountReceived)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-muted-foreground">Debite du solde:</span>
                        <span className="font-medium text-foreground" data-testid="text-total-deducted">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "XOF",
                            minimumFractionDigits: 0,
                          }).format(feeInfo.totalDeductedFromBalance)}
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
                {withdrawalMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement en cours...
                  </>
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

      <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-xs text-green-900 dark:text-green-100 ml-2">
          <strong>Securite renforcee:</strong> Les retraits ne sont possibles que vers vos numeros pre-configures dans les parametres.
        </AlertDescription>
      </Alert>
    </div>
  );
}
