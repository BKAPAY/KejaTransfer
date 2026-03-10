import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Transaction, BusinessWallet, COUNTRIES } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Wallet, History, Trash2, Power, ArrowUpCircle, ArrowDownCircle,
  ChevronLeft, User as UserIcon, Users, UserCheck, TrendingDown, TrendingUp,
  AlertCircle, Unlock, Check, X, RotateCcw, Monitor, Key,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryFlag } from "@/components/country-flag";

const BUSINESS_COUNTRIES = ["BJ", "TG", "CI", "BF", "SN", "CM", "CD", "GA", "CG", "ZM", "UG"];

interface BusinessStats {
  totalUsers: number;
  verifiedUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositsByCurrency: Record<string, number>;
  withdrawalsByCurrency: Record<string, number>;
}

export default function AdminBusinessManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [unsuspendDialog, setUnsuspendDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });

  const { data: stats, isLoading: statsLoading } = useQuery<BusinessStats>({
    queryKey: ["/api/admin/business/stats"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const depositMutation = useMutation({
    mutationFn: async ({ userId, amount, country, currency }: { userId: string; amount: number; country: string; currency: string }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/wallet/deposit`, { amount, country, currency });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      setDepositDialogOpen(false);
      setAmount("");
      setSelectedCountry("");
      toast({ title: "Succes", description: "Depot effectue avec succes" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ userId, amount, country, currency }: { userId: string; amount: number; country: string; currency: string }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/wallet/withdraw`, { amount, country, currency });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      setWithdrawDialogOpen(false);
      setAmount("");
      setSelectedCountry("");
      toast({ title: "Succes", description: "Retrait effectue avec succes" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const payoutToggleMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/payout-toggle`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      toast({ title: "Succes", description: "Statut Payout mis a jour" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/business/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      setDeleteDialog({ open: false });
      toast({ title: "Succes", description: "Utilisateur supprime" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/wallet/withdraw`, {});
      return res;
    },
  });

  const filteredUsers = users.filter(user =>
    user.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatAmount = (amount: number, currency: string = "XOF") => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " " + currency;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")} data-testid="button-back-business">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-page-title">Gestion des comptes entreprise</h1>
          <p className="text-sm text-muted-foreground">Administrer les utilisateurs entreprise</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Entreprises</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total-business-users">
                {stats?.totalUsers || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Comptes entreprise</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Entreprises Verifiees</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-verified-business-users">
                  {stats?.verifiedUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats && stats.totalUsers > 0
                    ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% de verification`
                    : "0%"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Depots</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1" data-testid="stat-business-deposits">
                {stats?.depositsByCurrency && Object.entries(stats.depositsByCurrency)
                  .filter(([, val]) => val > 0)
                  .map(([currency, val]) => (
                    <div key={currency} className="text-lg font-bold">{formatAmount(val, currency)}</div>
                  ))}
                {(!stats?.depositsByCurrency || Object.values(stats.depositsByCurrency).every(v => v === 0)) && (
                  <div className="text-lg font-bold">0 XOF</div>
                )}
                <p className="text-xs text-muted-foreground">Argent entrant</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Retraits</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1" data-testid="stat-business-withdrawals">
                {stats?.withdrawalsByCurrency && Object.entries(stats.withdrawalsByCurrency)
                  .filter(([, val]) => val > 0)
                  .map(([currency, val]) => (
                    <div key={currency} className="text-lg font-bold">{formatAmount(val, currency)}</div>
                  ))}
                {(!stats?.withdrawalsByCurrency || Object.values(stats.withdrawalsByCurrency).every(v => v === 0)) && (
                  <div className="text-lg font-bold">0 XOF</div>
                )}
                <p className="text-xs text-muted-foreground">Argent sortant</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Utilisateurs Entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-business-users"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              Reinitialiser
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-users">
                Aucun utilisateur entreprise trouve
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 flex flex-col gap-4"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-sm" data-testid={`text-business-name-${user.id}`}>
                            {COUNTRIES.find(c => c.code === user.country)?.flag || ""} {user.businessName || `${user.firstName} ${user.lastName}`}
                          </h4>
                          <Badge
                            variant={user.kycStatus === "verified" ? "default" : user.kycStatus === "rejected" ? "destructive" : "secondary"}
                            className="text-xs"
                            data-testid={`badge-kyc-${user.id}`}
                          >
                            {user.kycStatus === "verified" ? "Verifie" :
                             user.kycStatus === "pending" ? "En attente" :
                             user.kycStatus === "submitted" ? "En examen" :
                             user.kycStatus === "rejected" ? "Rejete" : user.kycStatus}
                          </Badge>
                          <Badge
                            variant={user.payoutApiEnabled ? "default" : "secondary"}
                            className="text-xs"
                            data-testid={`badge-payout-${user.id}`}
                          >
                            {user.payoutApiEnabled ? "Payout ON" : "Payout OFF"}
                          </Badge>
                          {user.suspended && (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-suspended-${user.id}`}>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Suspendu
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`text-email-${user.id}`}>
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.firstName} {user.lastName} - Cree le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/dashboard/admin/business/users/${user.id}/profile`)}
                        data-testid={`button-view-profile-${user.id}`}
                      >
                        <UserIcon className="w-4 h-4 mr-1" />
                        Profil
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/dashboard/admin/business/users/${user.id}/history`)}
                        data-testid={`button-view-history-${user.id}`}
                      >
                        <History className="w-4 h-4 mr-1" />
                        Historique
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/dashboard/admin/business/users/${user.id}/transactions`)}
                        data-testid={`button-view-all-transactions-${user.id}`}
                      >
                        <Wallet className="w-4 h-4 mr-1" />
                        Transactions
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/dashboard/admin/business/users/${user.id}/api`)}
                        data-testid={`button-view-api-${user.id}`}
                      >
                        <Key className="w-4 h-4 mr-1" />
                        API
                      </Button>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user);
                          setDepositDialogOpen(true);
                        }}
                        data-testid={`button-deposit-${user.id}`}
                      >
                        <ArrowUpCircle className="w-4 h-4 mr-1" />
                        Depot
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user);
                          setWithdrawDialogOpen(true);
                        }}
                        data-testid={`button-withdraw-${user.id}`}
                      >
                        <ArrowDownCircle className="w-4 h-4 mr-1" />
                        Retrait
                      </Button>
                      <Button
                        size="sm"
                        variant={user.payoutApiEnabled ? "default" : "outline"}
                        onClick={() => payoutToggleMutation.mutate({ userId: user.id, enabled: !user.payoutApiEnabled })}
                        disabled={payoutToggleMutation.isPending}
                        data-testid={`button-toggle-payout-${user.id}`}
                      >
                        <Power className={`w-4 h-4 mr-1 ${user.payoutApiEnabled ? "text-green-400" : "text-muted-foreground"}`} />
                        {user.payoutApiEnabled ? "Payout ON" : "Payout OFF"}
                      </Button>
                      {user.kycStatus === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={async () => {
                              try {
                                await apiRequest("POST", "/api/admin/approve-kyc", { userId: user.id });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
                                toast({ title: "Succes", description: "KYC approuvee" });
                              } catch {
                                toast({ title: "Erreur", description: "Impossible d'approuver la KYC", variant: "destructive" });
                              }
                            }}
                            data-testid={`button-approve-kyc-${user.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approuver KYC
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              try {
                                await apiRequest("POST", "/api/admin/reject-kyc", { userId: user.id });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
                                toast({ title: "Succes", description: "KYC rejetee" });
                              } catch {
                                toast({ title: "Erreur", description: "Impossible de rejeter la KYC", variant: "destructive" });
                              }
                            }}
                            data-testid={`button-reject-kyc-${user.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Rejeter KYC
                          </Button>
                        </>
                      )}
                      {user.kycStatus === "verified" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await apiRequest("POST", "/api/admin/reject-kyc", { userId: user.id });
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
                              toast({ title: "Succes", description: "KYC retiree" });
                            } catch {
                              toast({ title: "Erreur", description: "Impossible de retirer la KYC", variant: "destructive" });
                            }
                          }}
                          data-testid={`button-unverify-kyc-${user.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Retirer KYC
                        </Button>
                      )}
                      {!user.suspended ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSuspendDialog({ open: true, userId: user.id, userName: user.businessName || `${user.firstName} ${user.lastName}` })}
                          data-testid={`button-suspend-${user.id}`}
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Suspendre
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUnsuspendDialog({ open: true, userId: user.id, userName: user.businessName || `${user.firstName} ${user.lastName}` })}
                          data-testid={`button-unsuspend-${user.id}`}
                        >
                          <Unlock className="w-4 h-4 mr-1" />
                          Reactiver
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteDialog({ open: true, userId: user.id, userName: user.businessName || `${user.firstName} ${user.lastName}` })}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={depositDialogOpen} onOpenChange={(open) => {
        setDepositDialogOpen(open);
        if (!open) { setSelectedCountry(""); setAmount(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depot Manuel - {selectedUser?.businessName}</DialogTitle>
            <DialogDescription>Crediter le portefeuille d'un pays specifique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pays</label>
              <Select onValueChange={setSelectedCountry} value={selectedCountry}>
                <SelectTrigger data-testid="select-deposit-country">
                  <SelectValue placeholder="Choisir un pays" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.filter(c => BUSINESS_COUNTRIES.includes(c.code)).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Montant a deposer"
                data-testid="input-deposit-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialogOpen(false)} data-testid="button-cancel-deposit">Annuler</Button>
            <Button
              onClick={() => {
                const countryData = COUNTRIES.find(c => c.code === selectedCountry);
                depositMutation.mutate({
                  userId: selectedUser!.id,
                  amount: parseInt(amount),
                  country: selectedCountry,
                  currency: countryData?.currency || "XOF"
                });
              }}
              disabled={!amount || !selectedCountry || depositMutation.isPending}
              data-testid="button-confirm-deposit"
            >
              Confirmer le depot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawDialogOpen} onOpenChange={(open) => {
        setWithdrawDialogOpen(open);
        if (!open) { setSelectedCountry(""); setAmount(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retrait Manuel - {selectedUser?.businessName}</DialogTitle>
            <DialogDescription>Debiter le portefeuille d'un pays specifique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pays</label>
              <Select onValueChange={setSelectedCountry} value={selectedCountry}>
                <SelectTrigger data-testid="select-withdraw-country">
                  <SelectValue placeholder="Choisir un pays" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.filter(c => BUSINESS_COUNTRIES.includes(c.code)).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Montant a retirer"
                data-testid="input-withdraw-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)} data-testid="button-cancel-withdraw">Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const countryData = COUNTRIES.find(c => c.code === selectedCountry);
                withdrawMutation.mutate({
                  userId: selectedUser!.id,
                  amount: parseInt(amount),
                  country: selectedCountry,
                  currency: countryData?.currency || "XOF"
                });
              }}
              disabled={!amount || !selectedCountry || withdrawMutation.isPending}
              data-testid="button-confirm-withdraw"
            >
              Confirmer le retrait
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteDialog.userName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va suspendre le compte entreprise. Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.userId) deleteUserMutation.mutate(deleteDialog.userId);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={suspendDialog.open} onOpenChange={(open) => setSuspendDialog({ ...suspendDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre {suspendDialog.userName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur ne pourra plus acceder a son compte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel data-testid="button-cancel-suspend">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (suspendDialog.userId) {
                  try {
                    await apiRequest("POST", "/api/admin/suspend", { userId: suspendDialog.userId });
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
                    setSuspendDialog({ open: false });
                    toast({ title: "Succes", description: "Compte suspendu" });
                  } catch {
                    toast({ title: "Erreur", description: "Impossible de suspendre le compte", variant: "destructive" });
                  }
                }
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-suspend"
            >
              Suspendre
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unsuspendDialog.open} onOpenChange={(open) => setUnsuspendDialog({ ...unsuspendDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactiver {unsuspendDialog.userName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur pourra a nouveau acceder a son compte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel data-testid="button-cancel-unsuspend">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (unsuspendDialog.userId) {
                  try {
                    await apiRequest("POST", "/api/admin/unsuspend", { userId: unsuspendDialog.userId });
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
                    setUnsuspendDialog({ open: false });
                    toast({ title: "Succes", description: "Compte reactive" });
                  } catch {
                    toast({ title: "Erreur", description: "Impossible de reactiver le compte", variant: "destructive" });
                  }
                }
              }}
              data-testid="button-confirm-unsuspend"
            >
              Reactiver
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
