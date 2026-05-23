import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Wallet, PlusCircle, Trash2, Edit2, CheckCircle, XCircle, History, Calendar, Clock, Briefcase, Pencil, Search, ArrowUpFromLine, ArrowDownToLine, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";

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

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd MMM yyyy HH:mm", { locale: fr }); } catch { return dateStr; }
}

function scheduleLabel(s: SalarySchedule): string {
  if (s.scheduleType === "monthly_day") {
    return `Chaque ${s.scheduleValue}${s.scheduleValue === 1 ? "er" : "ème"} du mois`;
  }
  if (s.scheduleValue < 60) return `Toutes les ${s.scheduleValue} minute(s)`;
  if (s.scheduleValue < 1440) return `Toutes les ${Math.round(s.scheduleValue / 60)} heure(s)`;
  return `Tous les ${Math.round(s.scheduleValue / 1440)} jour(s)`;
}

interface ScheduleFormState {
  amount: string;
  scheduleType: string;
  scheduleValue: string;
  label: string;
}
const emptyForm: ScheduleFormState = { amount: "", scheduleType: "monthly_day", scheduleValue: "1", label: "" };

export default function AdminUserSalary() {
  const params = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const userId = params.userId;
  const { toast } = useToast();

  const [activateLabel, setActivateLabel] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(emptyForm);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<SalaryTransaction | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const { data: salaryData, isLoading } = useQuery<{ account: SalaryAccount | null; schedules: SalarySchedule[]; transactions: SalaryTransaction[] }>({
    queryKey: [`/api/admin/user/${userId}/salary`],
    enabled: !!userId,
  });

  const account = salaryData?.account ?? null;
  const schedules = salaryData?.schedules ?? [];
  const transactions = salaryData?.transactions ?? [];

  const userCurrency = user?.country ? (COUNTRIES.find(c => c.code === user.country)?.currency || "XOF") : "XOF";

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/user/${userId}/salary/activate`, { label: activateLabel || undefined, currency: userCurrency });
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: "Salarié activé", description: `${user?.firstName} ${user?.lastName} est maintenant salarié.` });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setActivateLabel("");
      } else {
        toast({ title: "Erreur", description: res.error, variant: "destructive" });
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/user/${userId}/salary/deactivate`, {});
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: "Salarié désactivé" });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        toast({ title: "Erreur", description: res.error, variant: "destructive" });
      }
    },
  });

  const deleteCompletelyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/admin/user/${userId}/salary`, {});
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({
          title: "Compte salarié supprimé",
          description: "Toutes les données salariales (compte, plannings, historique) ont été effacées définitivement.",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        toast({ title: "Erreur", description: res.error, variant: "destructive" });
      }
    },
  });

  const creditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/user/${userId}/salary/credit`, { amount: Number(creditAmount) });
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: "Solde crédité", description: `${creditAmount} ${account?.currency} ajoutés.` });
        setCreditAmount("");
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
      } else {
        toast({ title: "Erreur", description: res.error, variant: "destructive" });
      }
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        amount: Number(scheduleForm.amount),
        scheduleType: scheduleForm.scheduleType,
        scheduleValue: Number(scheduleForm.scheduleValue),
        label: scheduleForm.label || undefined,
      };
      if (editScheduleId) {
        const res = await apiRequest("PATCH", `/api/admin/user/${userId}/salary/schedules/${editScheduleId}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/admin/user/${userId}/salary/schedules`, payload);
        return res.json();
      }
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: editScheduleId ? "Planning modifié" : "Planning créé" });
        setShowScheduleDialog(false);
        setScheduleForm(emptyForm);
        setEditScheduleId(null);
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
      } else {
        toast({ title: "Erreur", description: res.error, variant: "destructive" });
      }
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/user/${userId}/salary/schedules/${scheduleId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Planning supprimé" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
    },
  });

  const updateLabelMutation = useMutation({
    mutationFn: async (newLabel: string) => {
      const res = await apiRequest("PATCH", `/api/admin/user/${userId}/salary/label`, { label: newLabel });
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: "Poste mis à jour" });
        setEditingLabel(false);
        queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/salary`] });
      } else {
        toast({ title: "Erreur", description: res.error, variant: "destructive" });
      }
    },
  });

  function openCreateDialog() {
    setScheduleForm(emptyForm);
    setEditScheduleId(null);
    setShowScheduleDialog(true);
  }

  function openEditDialog(s: SalarySchedule) {
    setScheduleForm({
      amount: String(s.amount),
      scheduleType: s.scheduleType,
      scheduleValue: String(s.scheduleValue),
      label: s.label || "",
    });
    setEditScheduleId(s.id);
    setShowScheduleDialog(true);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation(`/dashboard/admin/user/${userId}/profile`)} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Gestion salarié</h1>
          {user && <p className="text-sm text-muted-foreground">{user.firstName} {user.lastName}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !account || !account.isActive ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Activer le compte salarié
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Poste / Libellé (facultatif)</Label>
              <Input
                placeholder="ex: Développeur, Agent support..."
                value={activateLabel}
                onChange={e => setActivateLabel(e.target.value)}
                data-testid="input-salary-label"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Devise : <strong>{userCurrency}</strong> (devise du pays d'inscription de l'utilisateur)
            </p>
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              data-testid="button-activate-salary"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {activateMutation.isPending ? "Activation..." : "Activer comme salarié"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Compte salarié actif
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="button-deactivate-salary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Désactiver
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Désactiver ce salarié ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          L'accès au menu Salaire sera supprimé pour {user?.firstName}. Le solde, les plannings et l'historique sont conservés et seront restaurés si vous réactivez ce salarié.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deactivateMutation.mutate()}>Confirmer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" data-testid="button-delete-salary">
                        <Trash2 className="w-3 h-3 mr-1" />
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer définitivement le compte salarié ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est <strong>irréversible</strong>. Le compte salarié de {user?.firstName} {user?.lastName}, tous les plannings de versement et tout l'historique des transactions salariales seront effacés définitivement.
                          <br /><br />
                          Vous pourrez toujours réactiver cette personne comme salarié plus tard, mais ce sera un nouveau compte vierge — les anciennes données ne seront pas restaurées.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCompletelyMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Poste / Libellé */}
              <div className="flex items-center gap-2 flex-wrap">
                <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                {editingLabel ? (
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <Input
                      className="h-8 flex-1 min-w-[140px]"
                      placeholder="Poste / Libellé"
                      value={labelInput}
                      onChange={e => setLabelInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") updateLabelMutation.mutate(labelInput);
                        if (e.key === "Escape") setEditingLabel(false);
                      }}
                      autoFocus
                      data-testid="input-edit-label"
                    />
                    <Button
                      size="sm"
                      onClick={() => updateLabelMutation.mutate(labelInput)}
                      disabled={updateLabelMutation.isPending}
                      data-testid="button-save-label"
                    >
                      {updateLabelMutation.isPending ? "..." : "Enregistrer"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingLabel(false)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <>
                    <span
                      className={`text-sm font-medium ${account.label ? "" : "text-muted-foreground italic"}`}
                      data-testid="text-salary-label"
                    >
                      {account.label || "Aucun poste défini"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => { setLabelInput(account.label || ""); setEditingLabel(true); }}
                      data-testid="button-edit-label"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde actuel</p>
                <p className="text-3xl font-bold" data-testid="text-admin-salary-balance">
                  {formatAmount(account.balance, account.currency)}
                </p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Crédit manuel</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder={`Montant (${account.currency})`}
                    value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)}
                    data-testid="input-admin-salary-credit"
                  />
                  <Button
                    onClick={() => creditMutation.mutate()}
                    disabled={!creditAmount || creditMutation.isPending}
                    data-testid="button-admin-salary-credit"
                  >
                    {creditMutation.isPending ? "..." : "Créditer"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Plannings de versement
                </CardTitle>
                <Button size="sm" onClick={openCreateDialog} data-testid="button-add-schedule">
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun planning configuré</p>
              ) : (
                <div className="space-y-3">
                  {schedules.map(s => (
                    <div key={s.id} className="flex items-start justify-between border rounded-md p-3 gap-2" data-testid={`row-schedule-${s.id}`}>
                      <div>
                        <p className="font-medium text-sm">{formatAmount(s.amount, account.currency)}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {scheduleLabel(s)}
                          {s.label ? ` — ${s.label}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Programmé le : <span className="font-medium">{formatDate(s.createdAt)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prochain versement : {formatDate(s.nextPayAt)}
                        </p>
                        {s.lastPaidAt && (
                          <p className="text-xs text-muted-foreground">Dernier : {formatDate(s.lastPaidAt)}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(s)} data-testid={`button-edit-schedule-${s.id}`}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-schedule-${s.id}`}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce planning ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteScheduleMutation.mutate(s.id)}>Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Historique des transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher par ID ou référence interne..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-admin-salary-search"
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
                if (transactions.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-4">Aucune transaction</p>;
                }
                if (filtered.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-4">Aucun résultat pour « {txSearch} »</p>;
                }
                return (
                  <div className="space-y-0">
                    {filtered.map(tx => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-2.5 border-b last:border-0 cursor-pointer hover-elevate rounded-sm px-1"
                        data-testid={`row-admin-salary-tx-${tx.id}`}
                        onClick={() => setSelectedTx(tx)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {tx.type === "credit" ? "Versement" : "Retrait"}
                            {tx.description ? ` — ${tx.description}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                          {tx.type === "withdrawal" && tx.phone && (
                            <p className="text-xs text-muted-foreground">{tx.phone}{tx.operator ? ` · ${tx.operator.toUpperCase()}` : ""}</p>
                          )}
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <span className={`font-semibold text-sm ${tx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount, tx.currency)}
                          </span>
                          <div>
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

                    <div className="flex justify-between gap-4 items-start">
                      <span className="text-muted-foreground flex-shrink-0">ID transaction</span>
                      <button
                        className="font-mono text-xs text-right break-all hover:text-foreground text-muted-foreground transition-colors"
                        onClick={() => { navigator.clipboard?.writeText(selectedTx.id); toast({ title: "Copié" }); }}
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
                          onClick={() => { navigator.clipboard?.writeText(selectedTx.internalTransactionId!); toast({ title: "Copié" }); }}
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
                          onClick={() => { navigator.clipboard?.writeText(selectedTx.providerReference!); toast({ title: "Copié" }); }}
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
        </>
      )}

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editScheduleId ? "Modifier le planning" : "Nouveau planning de versement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Montant ({account?.currency || userCurrency})</Label>
              <Input
                type="number"
                min={1}
                placeholder="ex: 50000"
                value={scheduleForm.amount}
                onChange={e => setScheduleForm(f => ({ ...f, amount: e.target.value }))}
                data-testid="input-schedule-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>Type de versement</Label>
              <Select
                value={scheduleForm.scheduleType}
                onValueChange={v => setScheduleForm(f => ({ ...f, scheduleType: v, scheduleValue: v === "monthly_day" ? "1" : "60" }))}
              >
                <SelectTrigger data-testid="select-schedule-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly_day">Chaque X du mois</SelectItem>
                  <SelectItem value="interval_minutes">Intervalle (minutes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>
                {scheduleForm.scheduleType === "monthly_day"
                  ? "Jour du mois (1-28)"
                  : "Intervalle en minutes (ex: 60 = 1h, 1440 = 24h, 1 = toutes les minutes)"}
              </Label>
              <Input
                type="number"
                min={scheduleForm.scheduleType === "monthly_day" ? 1 : 1}
                max={scheduleForm.scheduleType === "monthly_day" ? 28 : undefined}
                value={scheduleForm.scheduleValue}
                onChange={e => setScheduleForm(f => ({ ...f, scheduleValue: e.target.value }))}
                data-testid="input-schedule-value"
              />
            </div>
            <div className="space-y-1">
              <Label>Libellé (facultatif)</Label>
              <Input
                placeholder="ex: Salaire mensuel"
                value={scheduleForm.label}
                onChange={e => setScheduleForm(f => ({ ...f, label: e.target.value }))}
                data-testid="input-schedule-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowScheduleDialog(false)}>Annuler</Button>
            <Button
              onClick={() => saveScheduleMutation.mutate()}
              disabled={!scheduleForm.amount || !scheduleForm.scheduleValue || saveScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {saveScheduleMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
