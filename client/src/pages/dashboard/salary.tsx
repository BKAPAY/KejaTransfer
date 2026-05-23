import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import type { User } from "@shared/schema";
import { Wallet, ArrowUpFromLine, History, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SalaryAccount {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  label: string | null;
  createdAt: string;
}

interface SalaryTransaction {
  id: string;
  userId: string;
  type: "credit" | "withdrawal";
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  country: string | null;
  operator: string | null;
  phone: string | null;
  createdAt: string;
}

const withdrawSchema = z.object({
  amount: z.number().min(1, "Montant invalide"),
  country: z.string().min(1, "Sélectionnez un pays"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
  phone: z.string().min(6, "Numéro invalide"),
});
type WithdrawFormData = z.infer<typeof withdrawSchema>;

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd MMM yyyy HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

export default function SalaryPage() {
  const { toast } = useToast();
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const { data: user } = useQuery<User>({ queryKey: ["/api/auth/me"] });

  const { data: salaryAccount, isLoading: loadingAccount } = useQuery<SalaryAccount>({
    queryKey: ["/api/salary"],
  });

  const { data: transactions, isLoading: loadingTx } = useQuery<SalaryTransaction[]>({
    queryKey: ["/api/salary/transactions"],
  });

  const { data: enabledWithdrawals } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const form = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: undefined as any, country: "", operator: "", phone: "" },
  });

  const selectedCountry = form.watch("country");

  const availableCountries = enabledWithdrawals
    ? COUNTRIES.filter(c => (enabledWithdrawals[c.code] || []).length > 0)
    : COUNTRIES;

  const operatorsForCountry = selectedCountry && enabledWithdrawals
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || []).filter(
        op => (enabledWithdrawals[selectedCountry] || []).includes(op.code)
      )
    : [];

  const withdrawMutation = useMutation({
    mutationFn: async (data: WithdrawFormData) => {
      const res = await apiRequest("POST", "/api/salary/withdraw", data);
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: "Retrait initié", description: res.message || "Votre retrait de salaire est en cours." });
        form.reset();
        setShowWithdrawForm(false);
        queryClient.invalidateQueries({ queryKey: ["/api/salary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/salary/transactions"] });
      } else {
        toast({ title: "Erreur", description: res.error || "Retrait échoué", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Erreur", description: "Retrait échoué", variant: "destructive" });
    },
  });

  if (loadingAccount) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!salaryAccount || !salaryAccount.isActive) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun compte salaire actif pour ce compte.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Salaire</h1>
        {salaryAccount.label && (
          <p className="text-muted-foreground text-sm mt-1">{salaryAccount.label}</p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Solde disponible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold" data-testid="text-salary-balance">
            {formatAmount(salaryAccount.balance, salaryAccount.currency)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{salaryAccount.currency}</p>
          <div className="mt-4">
            <Button
              onClick={() => setShowWithdrawForm(v => !v)}
              data-testid="button-salary-withdraw"
            >
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Retrait
            </Button>
          </div>
        </CardContent>
      </Card>

      {showWithdrawForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Retrait salaire — sans frais</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(data => withdrawMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant ({salaryAccount.currency})</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="ex: 5000"
                          data-testid="input-salary-amount"
                          {...field}
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                        onValueChange={v => { field.onChange(v); form.setValue("operator", ""); }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-salary-country">
                            <SelectValue placeholder="Choisir un pays" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCountries.map(c => (
                            <SelectItem key={c.code} value={c.code} data-testid={`option-country-${c.code}`}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opérateur</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedCountry}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-salary-operator">
                            <SelectValue placeholder="Choisir un opérateur" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {operatorsForCountry.map(op => (
                            <SelectItem key={op.code} value={op.code} data-testid={`option-operator-${op.code}`}>
                              {op.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de téléphone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="ex: +22996000000"
                          data-testid="input-salary-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={withdrawMutation.isPending}
                    data-testid="button-confirm-salary-withdraw"
                  >
                    {withdrawMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmer le retrait</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowWithdrawForm(false); form.reset(); }}
                    data-testid="button-cancel-salary-withdraw"
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Historique
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune transaction salaire</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                  data-testid={`row-salary-tx-${tx.id}`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type === "credit" ? "Versement" : "Retrait"}
                      {tx.description ? ` — ${tx.description}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    {tx.type === "withdrawal" && tx.country && (
                      <p className="text-xs text-muted-foreground">
                        {COUNTRIES.find(c => c.code === tx.country)?.name || tx.country}
                        {tx.operator ? ` · ${tx.operator}` : ""}
                        {tx.phone ? ` · ${tx.phone}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${tx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount, tx.currency)}
                    </span>
                    <div>
                      <Badge variant={tx.status === "completed" ? "default" : tx.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                        {tx.status === "completed" ? "Complété" : tx.status === "failed" ? "Échoué" : "En cours"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
