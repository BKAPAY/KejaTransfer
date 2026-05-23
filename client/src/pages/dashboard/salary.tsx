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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import { CountryFlag } from "@/components/country-flag";
import { OperatorSelector } from "@/components/operator-selector";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { Wallet, ArrowUpFromLine, History, Loader2, CheckCircle2, Calendar, Clock, AlertCircle, ArrowRight, Briefcase, ArrowDownToLine, X, Copy, Search } from "lucide-react";
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

interface SalarySchedule {
  id: string;
  userId: string;
  amount: number;
  scheduleType: string;
  scheduleValue: number;
  label: string | null;
  isActive: boolean;
  lastPaidAt: string | null;
  nextPayAt: string | null;
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
  internalTransactionId: string | null;
  providerReference: string | null;
  createdAt: string;
}

const withdrawSchema = z.object({
  amount: z.number().min(1000, "Le montant minimum de retrait est 1 000"),
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

function scheduleLabel(s: SalarySchedule): string {
  if (s.scheduleType === "monthly_day") {
    return `Chaque ${s.scheduleValue}${s.scheduleValue === 1 ? "er" : "ème"} du mois`;
  }
  if (s.scheduleValue < 60) return `Toutes les ${s.scheduleValue} minute(s)`;
  if (s.scheduleValue < 1440) return `Toutes les ${Math.round(s.scheduleValue / 60)} heure(s)`;
  return `Tous les ${Math.round(s.scheduleValue / 1440)} jour(s)`;
}

export default function SalaryPage() {
  const { toast } = useToast();
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [selectedTx, setSelectedTx] = useState<SalaryTransaction | null>(null);
  const [txSearch, setTxSearch] = useState("");

  const { data: salaryAccount, isLoading: loadingAccount } = useQuery<SalaryAccount | null>({
    queryKey: ["/api/salary"],
    refetchInterval: 30000,
  });

  const { data: schedules, isLoading: loadingSchedules } = useQuery<SalarySchedule[]>({
    queryKey: ["/api/salary/schedules"],
    refetchInterval: 30000,
  });

  const { data: transactions, isLoading: loadingTx } = useQuery<SalaryTransaction[]>({
    queryKey: ["/api/salary/transactions"],
    refetchInterval: 8000,
  });

  const { data: enabledWithdrawals } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const form = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: undefined as any, country: "", operator: "", phone: "" },
  });

  const selectedCountry = form.watch("country");
  const watchedAmount = form.watch("amount");

  const availableCountries = enabledWithdrawals
    ? COUNTRIES.filter(c => (enabledWithdrawals[c.code] || []).length > 0)
    : COUNTRIES;

  const operatorsForCountry = selectedCountry && enabledWithdrawals
    ? (OPERATORS[selectedCountry as keyof typeof OPERATORS] || []).filter(
        op => (enabledWithdrawals[selectedCountry] || []).includes(op.code)
      )
    : [];

  const salaryCurrency = salaryAccount?.currency || "XOF";
  const destCurrency = selectedCountry
    ? (COUNTRIES.find(c => c.code === selectedCountry)?.currency || "XOF")
    : null;
  const needsConversion = !!(destCurrency && destCurrency !== salaryCurrency);
  const conversionEnabled = needsConversion && !!watchedAmount && Number(watchedAmount) > 0;

  const { data: conversionPreview, isFetching: loadingConversion } = useQuery<{
    success: boolean;
    convertedAmount: number;
    conversionRate: number;
    targetCurrency: string;
    error?: string;
  } | null>({
    queryKey: ["/api/convert-currency", watchedAmount, salaryCurrency, destCurrency],
    queryFn: async () => {
      if (!watchedAmount || !destCurrency) return null;
      const res = await apiRequest("POST", "/api/convert-currency", {
        amount: Number(watchedAmount),
        fromCurrency: salaryCurrency,
        toCurrency: destCurrency,
      });
      return res.json();
    },
    enabled: conversionEnabled,
    staleTime: 60 * 60 * 1000,
  });

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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const currency = salaryAccount?.currency || "XOF";

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Salaire</h1>
        <div className="flex items-center gap-2 mt-1">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          <span className={`text-sm ${salaryAccount?.label ? "font-medium" : "text-muted-foreground italic"}`} data-testid="text-job-label">
            {salaryAccount?.label || "Aucun poste défini"}
          </span>
        </div>
      </div>

      {/* Solde */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Solde disponible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold" data-testid="text-salary-balance">
            {formatAmount(salaryAccount?.balance ?? 0, currency)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{currency}</p>
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

      {/* Formulaire de retrait */}
      {showWithdrawForm && salaryAccount && (
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
                      <FormLabel>Montant ({currency}) — minimum 1 000</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1000}
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
                      <FormLabel>Pays de destination</FormLabel>
                      <Select
                        onValueChange={v => { field.onChange(v); form.setValue("operator", ""); form.setValue("phone", ""); }}
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
                              <span className="flex items-center gap-2">
                                <CountryFlag code={c.code} size="xs" />
                                {c.name}
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
                        <FormLabel>Opérateur / Porte-monnaie</FormLabel>
                        {operatorsForCountry.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                            Aucun opérateur disponible pour ce pays
                          </div>
                        ) : (
                          <OperatorSelector
                            operators={operatorsForCountry}
                            selectedOperator={field.value}
                            onSelect={field.onChange}
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Prévisualisation de conversion */}
                {needsConversion && watchedAmount > 0 && (
                  <div className="rounded-md border p-3 space-y-1" data-testid="div-conversion-preview">
                    {loadingConversion ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Calcul de la conversion en cours...
                      </div>
                    ) : conversionPreview?.success ? (
                      <>
                        <p className="text-xs text-muted-foreground">Montant estimé que vous recevrez</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">
                            {formatAmount(Number(watchedAmount), salaryCurrency)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-bold text-green-600 dark:text-green-400" data-testid="text-converted-amount">
                            {formatAmount(conversionPreview.convertedAmount, destCurrency!)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Taux : 1 {salaryCurrency} = {conversionPreview.conversionRate.toFixed(4)} {destCurrency}
                        </p>
                      </>
                    ) : conversionPreview && !conversionPreview.success ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        Taux de change indisponible — la conversion sera effectuée automatiquement lors du retrait.
                      </p>
                    ) : null}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de téléphone</FormLabel>
                      <FormControl>
                        <PhoneInputWithPrefix
                          country={selectedCountry}
                          value={field.value}
                          onChange={field.onChange}
                          data-testid="input-salary-phone"
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

      {/* Programmes de versement automatique */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Versements automatiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSchedules ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !schedules || schedules.length === 0 ? (
            <div className="flex items-start gap-3 py-4 text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                Aucun programme de salaire automatique n'est configuré pour le moment.
                Contactez votre administrateur pour mettre en place des versements automatiques.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.filter(s => s.isActive).map(s => (
                <div key={s.id} className="rounded-md border p-3 space-y-1" data-testid={`row-user-schedule-${s.id}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      +{formatAmount(s.amount, currency)}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      {scheduleLabel(s)}
                    </Badge>
                  </div>
                  {s.label && <p className="text-xs text-muted-foreground">{s.label}</p>}
                  <p className="text-xs text-muted-foreground">
                    Programmé le : <span className="font-medium">{formatDate(s.createdAt)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Prochain versement : <span className="font-medium">{formatDate(s.nextPayAt)}</span>
                  </p>
                  {s.lastPaidAt && (
                    <p className="text-xs text-muted-foreground">
                      Dernier versement : {formatDate(s.lastPaidAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique */}
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
            <>
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher par ID ou référence interne..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-salary-search"
                />
              </div>
              {(() => {
                const q = txSearch.trim().toLowerCase();
                const filtered = q
                  ? transactions.filter(tx =>
                      tx.id.toLowerCase().includes(q) ||
                      (tx.internalTransactionId || "").toLowerCase().includes(q) ||
                      (tx.providerReference || "").toLowerCase().includes(q)
                    )
                  : transactions;
                if (filtered.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-6">Aucun résultat pour « {txSearch} »</p>;
                }
                return (
                  <div className="space-y-0">
                    {filtered.map(tx => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover-elevate rounded-sm px-1"
                        data-testid={`row-salary-tx-${tx.id}`}
                        onClick={() => setSelectedTx(tx)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {tx.type === "credit" ? "Versement" : "Retrait"}
                            {tx.description ? ` — ${tx.description}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                          {tx.type === "withdrawal" && tx.country && (
                            <p className="text-xs text-muted-foreground">
                              {COUNTRIES.find(c => c.code === tx.country)?.name || tx.country}
                              {tx.operator ? ` · ${tx.operator.toUpperCase()}` : ""}
                              {tx.phone ? ` · ${tx.phone}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <span className={`font-semibold text-sm ${tx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount, tx.currency)}
                          </span>
                          <div className="mt-0.5">
                            <Badge
                              variant={
                                tx.status === "completed" ? "default" :
                                tx.status === "rejected" || tx.status === "failed" ? "destructive" :
                                "secondary"
                              }
                              className="text-xs"
                            >
                              {tx.status === "completed" ? "Complété" :
                               tx.status === "rejected" || tx.status === "failed" ? "Rejeté" :
                               "En attente"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de détail de transaction */}
      <Dialog open={!!selectedTx} onOpenChange={open => { if (!open) setSelectedTx(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTx?.type === "credit" ? (
                <ArrowDownToLine className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowUpFromLine className="w-4 h-4 text-red-600" />
              )}
              {selectedTx?.type === "credit" ? "Versement salaire" : "Retrait salaire"}
            </DialogTitle>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4">
              {/* Montant + statut */}
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${selectedTx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {selectedTx.type === "credit" ? "+" : "-"}{formatAmount(selectedTx.amount, selectedTx.currency)}
                </span>
                <Badge
                  variant={
                    selectedTx.status === "completed" ? "default" :
                    selectedTx.status === "rejected" || selectedTx.status === "failed" ? "destructive" :
                    "secondary"
                  }
                >
                  {selectedTx.status === "completed" ? "Complété" :
                   selectedTx.status === "rejected" || selectedTx.status === "failed" ? "Rejeté" :
                   "En attente"}
                </Badge>
              </div>

              <Separator />

              {/* Détails */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-right">{formatDate(selectedTx.createdAt)}</span>
                </div>

                {selectedTx.description && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium text-right">{selectedTx.description}</span>
                  </div>
                )}

                {selectedTx.type === "withdrawal" && selectedTx.country && (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Pays</span>
                      <span className="font-medium">{COUNTRIES.find(c => c.code === selectedTx.country)?.name || selectedTx.country}</span>
                    </div>
                    {selectedTx.operator && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Opérateur</span>
                        <span className="font-medium">{selectedTx.operator.toUpperCase()}</span>
                      </div>
                    )}
                    {selectedTx.phone && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Téléphone</span>
                        <span className="font-medium font-mono">{selectedTx.phone}</span>
                      </div>
                    )}
                  </>
                )}

                <Separator />

                {/* IDs */}
                <div className="flex justify-between gap-4 items-start">
                  <span className="text-muted-foreground flex-shrink-0">ID transaction</span>
                  <button
                    className="font-mono text-xs text-right break-all hover:text-foreground text-muted-foreground transition-colors"
                    onClick={() => { navigator.clipboard?.writeText(selectedTx.id); }}
                    title="Copier"
                  >
                    {selectedTx.id}
                  </button>
                </div>

                {selectedTx.internalTransactionId && (
                  <div className="flex justify-between gap-4 items-start">
                    <span className="text-muted-foreground flex-shrink-0">Réf. interne</span>
                    <button
                      className="font-mono text-xs text-right break-all hover:text-foreground text-muted-foreground transition-colors"
                      onClick={() => { navigator.clipboard?.writeText(selectedTx.internalTransactionId!); }}
                      title="Copier"
                    >
                      {selectedTx.internalTransactionId}
                    </button>
                  </div>
                )}

                {selectedTx.providerReference && (
                  <div className="flex justify-between gap-4 items-start">
                    <span className="text-muted-foreground flex-shrink-0">Réf. fournisseur</span>
                    <button
                      className="font-mono text-xs text-right break-all hover:text-foreground text-muted-foreground transition-colors"
                      onClick={() => { navigator.clipboard?.writeText(selectedTx.providerReference!); }}
                      title="Copier"
                    >
                      {selectedTx.providerReference}
                    </button>
                  </div>
                )}
              </div>

              {selectedTx.status === "pending" && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    En attente de confirmation du fournisseur…
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
