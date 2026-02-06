import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Shield, Trash2, Plus, Minus, History, Link as LinkIcon, Store, Key, User as UserIcon, Check, X, FileCheck, AlertCircle, Unlock, Lock, Clock, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User, Transaction } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  HistoryDialog,
  PaymentLinksDialog,
  MerchantLinksDialog,
  ApiKeysDialog,
  ProfileDialog,
} from "./management-details";
import { useLocation } from "wouter";

type PendingTransaction = Transaction & { user?: User };

export default function Management() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fundAmount, setFundAmount] = useState<{ [userId: string]: string }>({});
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Dialog states
  const [promoteDialog, setPromoteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [removeAdminDialog, setRemoveAdminDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [addFundsDialog, setAddFundsDialog] = useState<{ open: boolean; userId?: string; userName?: string; amount?: number; currency?: string }>({ open: false });
  const [subtractFundsDialog, setSubtractFundsDialog] = useState<{ open: boolean; userId?: string; userName?: string; amount?: number; currency?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [unsuspendDialog, setUnsuspendDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [pendingTransactionsDialog, setPendingTransactionsDialog] = useState(false);
  
  // Details view states
  const [historyViewUserId, setHistoryViewUserId] = useState<string | null>(null);
  const [paymentLinksViewUserId, setPaymentLinksViewUserId] = useState<string | null>(null);
  const [merchantLinksViewUserId, setMerchantLinksViewUserId] = useState<string | null>(null);
  const [apiKeysViewUserId, setApiKeysViewUserId] = useState<string | null>(null);
  const [profileViewUserId, setProfileViewUserId] = useState<string | null>(null);

  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: pendingTransactions, isLoading: pendingLoading } = useQuery<PendingTransaction[]>({
    queryKey: ["/api/admin/pending-transactions"],
    refetchInterval: 10000,
  });

  const { data: pendingKycCount } = useQuery<number>({
    queryKey: ["/api/admin/pending-kyc-count"],
    refetchInterval: 30000,
  });

  const validateTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return apiRequest("POST", "/api/admin/validate-transaction", { transactionId });
    },
    onSuccess: () => {
      toast({
        title: "Transaction validée",
        description: "La transaction a été validée avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de valider la transaction.",
        variant: "destructive",
      });
    },
  });

  const rejectTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return apiRequest("POST", "/api/admin/reject-transaction", { transactionId });
    },
    onSuccess: () => {
      toast({
        title: "Transaction rejetée",
        description: "La transaction a été marquée comme échouée.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de rejeter la transaction.",
        variant: "destructive",
      });
    },
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return allUsers || [];
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search users");
      return response.json();
    },
    enabled: true,
  });

  const displayedUsers = searchQuery.length > 0 ? searchResults : allUsers;
  const isLoading = searchQuery.length > 0 ? searchLoading : usersLoading;

  const promoteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/promote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to promote user");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur promu en administrateur" });
      setPromoteDialog({ open: false });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de promouvoir l'utilisateur", variant: "destructive" });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/remove-admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to remove admin privilege");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Droits administrateur révoqués" });
      setRemoveAdminDialog({ open: false });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de révoquer les droits", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to delete user");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur supprimé" });
      setDeleteDialog({ open: false });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer l'utilisateur", variant: "destructive" });
    },
  });

  const addFundsMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const response = await fetch("/api/admin/add-funds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount }),
      });
      if (!response.ok) throw new Error("Failed to add funds");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Fonds ajoutés avec succès" });
      setAddFundsDialog({ open: false });
      setFundAmount({});
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'ajouter les fonds", variant: "destructive" });
    },
  });

  const subtractFundsMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const response = await fetch("/api/admin/subtract-funds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount }),
      });
      if (!response.ok) throw new Error("Failed to subtract funds");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Fonds retirés avec succès" });
      setSubtractFundsDialog({ open: false });
      setFundAmount({});
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de retirer les fonds", variant: "destructive" });
    },
  });

  const approveKycMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/approve-kyc", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to approve KYC");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "KYC approuvée" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'approuver la KYC", variant: "destructive" });
    },
  });

  const rejectKycMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/reject-kyc", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to reject KYC");
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data?.autoSuspended) {
        toast({ title: "Compte suspendu", description: `Le compte a ete automatiquement suspendu apres ${data.kycRejectionCount} rejets KYC consecutifs`, variant: "destructive" });
      } else {
        toast({ title: "Succès", description: "KYC rejetée" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de rejeter la KYC", variant: "destructive" });
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/suspend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to suspend user");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Compte suspendu" });
      setSuspendDialog({ open: false });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de suspendre le compte", variant: "destructive" });
    },
  });

  const unsuspendUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/unsuspend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to unsuspend user");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Compte réactivé" });
      setUnsuspendDialog({ open: false });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de réactiver le compte", variant: "destructive" });
    },
  });


  // Helper function to get currency for a user's country
  const getCurrencyForUser = (user: User) => {
    return user?.country 
      ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
      : "XOF";
  };

  const formatAmount = (amount: number, currency: string = "XOF") => {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  };

  const handleLockAccess = () => {
    localStorage.removeItem("adminAccessCode");
    toast({
      title: "Accès verrouillé",
      description: "Vous devrez entrer le code pour accéder à nouveau à cette page",
    });
    navigate("/dashboard/admin-access-code");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Administrer les utilisateurs de la plateforme</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/support-config")}
            data-testid="button-support-config"
          >
            <Users className="w-4 h-4 mr-2" />
            Infos Support
          </Button>
          <Button
            variant="outline"
            onClick={handleLockAccess}
            data-testid="button-lock-access"
          >
            <Lock className="w-4 h-4 mr-2" />
            Verrouiller l'accès
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Utilisateurs
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingTransactionsDialog(true)}
              data-testid="button-pending-transactions"
              className="relative"
            >
              <Clock className="w-4 h-4 mr-2" />
              Transactions
              {pendingTransactions && pendingTransactions.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                  {pendingTransactions.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard/kyc-verification")}
              data-testid="button-kyc-verification"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              KYC
              {pendingKycCount && pendingKycCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                  {pendingKycCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard/kyc-history")}
              data-testid="button-kyc-history"
            >
              <History className="w-4 h-4 mr-2" />
              Historique
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Rechercher par token, email, nom ou prénom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-users"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              Réinitialiser
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedUsers && displayedUsers.length > 0 ? (
              <div className="border rounded-lg divide-y">
                {displayedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 flex flex-col gap-4"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-sm">
                            {user.firstName} {user.lastName}
                          </h4>
                          <Badge
                            variant={user.kycStatus === "verified" ? "default" : "secondary"}
                            className="text-xs"
                            data-testid={`badge-kyc-${user.id}`}
                          >
                            {user.kycStatus === "verified" ? "✓ Vérifiée" : "Non vérifiée"}
                          </Badge>
                          {user.isAdmin && (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-admin-${user.id}`}>
                              Admin
                            </Badge>
                          )}
                          {(user as any).suspended && (
                            <Badge variant="destructive" className="text-xs bg-red-600" data-testid={`badge-suspended-${user.id}`}>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Suspendu
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`email-${user.id}`}>
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                        <p className="font-semibold text-sm mt-2" data-testid={`balance-${user.id}`}>
                          Solde: {formatAmount(user.balance, getCurrencyForUser(user))}
                        </p>
                      </div>
                    </div>

                    {/* Gestion des fonds */}
                    <div className="flex gap-2 flex-wrap items-center">
                      <Input
                        type="number"
                        placeholder="Montant"
                        min="0"
                        value={fundAmount[user.id] || ""}
                        onChange={(e) => setFundAmount({ ...fundAmount, [user.id]: e.target.value })}
                        className="w-32"
                        data-testid={`input-fund-amount-${user.id}`}
                      />
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          const amount = parseInt(fundAmount[user.id] || "0");
                          if (amount > 0) {
                            setAddFundsDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, amount, currency: getCurrencyForUser(user) });
                          }
                        }}
                        disabled={!fundAmount[user.id] || parseInt(fundAmount[user.id]) <= 0 || addFundsMutation.isPending}
                        data-testid={`button-add-funds-${user.id}`}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const amount = parseInt(fundAmount[user.id] || "0");
                          if (amount > 0) {
                            setSubtractFundsDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, amount, currency: getCurrencyForUser(user) });
                          }
                        }}
                        disabled={!fundAmount[user.id] || parseInt(fundAmount[user.id]) <= 0 || subtractFundsMutation.isPending}
                        data-testid={`button-subtract-funds-${user.id}`}
                      >
                        <Minus className="w-4 h-4 mr-1" />
                        Retirer
                      </Button>
                    </div>

                    {/* View Details */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/admin/user/${user.id}/profile`)}
                        data-testid={`button-view-profile-${user.id}`}
                      >
                        <UserIcon className="w-4 h-4 mr-1" />
                        Profil
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/admin/user/${user.id}/history`)}
                        data-testid={`button-view-history-${user.id}`}
                      >
                        <History className="w-4 h-4 mr-1" />
                        Historique
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/admin/user/${user.id}/links`)}
                        data-testid={`button-view-payment-links-${user.id}`}
                      >
                        <LinkIcon className="w-4 h-4 mr-1" />
                        Liens
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/admin/user/${user.id}/merchant`)}
                        data-testid={`button-view-merchant-${user.id}`}
                      >
                        <Store className="w-4 h-4 mr-1" />
                        Marchand
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/admin/user/${user.id}/api`)}
                        data-testid={`button-view-api-${user.id}`}
                      >
                        <Key className="w-4 h-4 mr-1" />
                        API
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {!user.isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPromoteDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}` })}
                          disabled={promoteUserMutation.isPending}
                          data-testid={`button-promote-${user.id}`}
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Promouvoir Admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRemoveAdminDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}` })}
                          disabled={removeAdminMutation.isPending}
                          data-testid={`button-remove-admin-${user.id}`}
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Révoquer Admin
                        </Button>
                      )}
                      {!(user as any).suspended ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSuspendDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}` })}
                          disabled={suspendUserMutation.isPending}
                          data-testid={`button-suspend-${user.id}`}
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Suspendre
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUnsuspendDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}` })}
                          disabled={unsuspendUserMutation.isPending}
                          data-testid={`button-unsuspend-${user.id}`}
                        >
                          <Unlock className="w-4 h-4 mr-1" />
                          Réactiver
                        </Button>
                      )}
                      {user.kycStatus === "submitted" ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveKycMutation.mutate(user.id)}
                            disabled={approveKycMutation.isPending}
                            data-testid={`button-approve-kyc-${user.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approuver KYC
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectKycMutation.mutate(user.id)}
                            disabled={rejectKycMutation.isPending}
                            data-testid={`button-reject-kyc-${user.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Rejeter KYC
                          </Button>
                        </>
                      ) : user.kycStatus === "verified" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectKycMutation.mutate(user.id)}
                          disabled={rejectKycMutation.isPending}
                          data-testid={`button-unverify-kyc-${user.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Retirer KYC
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}` })}
                        disabled={deleteUserMutation.isPending}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucun utilisateur trouvé" : "Aucun utilisateur sur la plateforme"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Promotion Dialog */}
      <AlertDialog open={promoteDialog.open} onOpenChange={(open) => setPromoteDialog({ ...promoteDialog, open })}>
        <AlertDialogContent data-testid="dialog-promote">
          <AlertDialogHeader>
            <AlertDialogTitle>Promouvoir en administrateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir promouvoir <strong>{promoteDialog.userName}</strong> en administrateur? Cet utilisateur aura accès à tous les panneaux d'administration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-promote">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (promoteDialog.userId) {
                  promoteUserMutation.mutate(promoteDialog.userId);
                }
              }}
              disabled={promoteUserMutation.isPending}
              data-testid="button-confirm-promote"
            >
              {promoteUserMutation.isPending ? "Promotion en cours..." : "Confirmer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Admin Dialog */}
      <AlertDialog open={removeAdminDialog.open} onOpenChange={(open) => setRemoveAdminDialog({ ...removeAdminDialog, open })}>
        <AlertDialogContent data-testid="dialog-remove-admin">
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer les droits administrateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir révoquer les droits administrateur de <strong>{removeAdminDialog.userName}</strong>? Il ne pourra plus accéder aux panneaux d'administration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-remove-admin">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeAdminDialog.userId) {
                  removeAdminMutation.mutate(removeAdminDialog.userId);
                }
              }}
              disabled={removeAdminMutation.isPending}
              data-testid="button-confirm-remove-admin"
            >
              {removeAdminMutation.isPending ? "Révocation en cours..." : "Confirmer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Funds Dialog */}
      <AlertDialog open={addFundsDialog.open} onOpenChange={(open) => setAddFundsDialog({ ...addFundsDialog, open })}>
        <AlertDialogContent data-testid="dialog-add-funds">
          <AlertDialogHeader>
            <AlertDialogTitle>Ajouter des fonds</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir ajouter <strong>{formatAmount(addFundsDialog.amount || 0, addFundsDialog.currency || "XOF")}</strong> au compte de <strong>{addFundsDialog.userName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-add-funds">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (addFundsDialog.userId && addFundsDialog.amount) {
                  addFundsMutation.mutate({ userId: addFundsDialog.userId, amount: addFundsDialog.amount });
                }
              }}
              disabled={addFundsMutation.isPending}
              data-testid="button-confirm-add-funds"
            >
              {addFundsMutation.isPending ? "Ajout en cours..." : "Confirmer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subtract Funds Dialog */}
      <AlertDialog open={subtractFundsDialog.open} onOpenChange={(open) => setSubtractFundsDialog({ ...subtractFundsDialog, open })}>
        <AlertDialogContent data-testid="dialog-subtract-funds">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer des fonds</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir retirer <strong>{formatAmount(subtractFundsDialog.amount || 0, subtractFundsDialog.currency || "XOF")}</strong> du compte de <strong>{subtractFundsDialog.userName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-subtract-funds">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (subtractFundsDialog.userId && subtractFundsDialog.amount) {
                  subtractFundsMutation.mutate({ userId: subtractFundsDialog.userId, amount: subtractFundsDialog.amount });
                }
              }}
              disabled={subtractFundsMutation.isPending}
              data-testid="button-confirm-subtract-funds"
            >
              {subtractFundsMutation.isPending ? "Retrait en cours..." : "Confirmer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteDialog.userName}</strong>? Cette action est irréversible et toutes les données associées seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.userId) {
                  deleteUserMutation.mutate(deleteDialog.userId);
                }
              }}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Suppression en cours..." : "Supprimer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Dialog */}
      <AlertDialog open={suspendDialog.open} onOpenChange={(open) => setSuspendDialog({ ...suspendDialog, open })}>
        <AlertDialogContent data-testid="dialog-suspend">
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre le compte</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir suspendre le compte de <strong>{suspendDialog.userName}</strong>? Son compte sera verrouillé et il ne pourra plus se connecter ni utiliser la plateforme. Ses liens de paiement, liens marchands et clés API ne fonctionneront plus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-suspend">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (suspendDialog.userId) {
                  suspendUserMutation.mutate(suspendDialog.userId);
                }
              }}
              disabled={suspendUserMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              {suspendUserMutation.isPending ? "Suspension en cours..." : "Confirmer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsuspend Dialog */}
      <AlertDialog open={unsuspendDialog.open} onOpenChange={(open) => setUnsuspendDialog({ ...unsuspendDialog, open })}>
        <AlertDialogContent data-testid="dialog-unsuspend">
          <AlertDialogHeader>
            <AlertDialogTitle>Réactiver le compte</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir réactiver le compte de <strong>{unsuspendDialog.userName}</strong>? Il pourra à nouveau se connecter et utiliser la plateforme normalement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel data-testid="button-cancel-unsuspend">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unsuspendDialog.userId) {
                  unsuspendUserMutation.mutate(unsuspendDialog.userId);
                }
              }}
              disabled={unsuspendUserMutation.isPending}
              data-testid="button-confirm-unsuspend"
            >
              {unsuspendUserMutation.isPending ? "Réactivation en cours..." : "Confirmer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pending Transactions Dialog */}
      <Dialog open={pendingTransactionsDialog} onOpenChange={setPendingTransactionsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-pending-transactions">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Transactions en Attente
              {pendingTransactions && pendingTransactions.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingTransactions.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pendingLoading ? (
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
            ) : pendingTransactions && pendingTransactions.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
                {pendingTransactions.map((tx) => {
                  const isIncoming = ["deposit", "payment_link", "merchant_link", "api_payment"].includes(tx.type);
                  const isWithdrawal = tx.type === "withdrawal";
                  const typeLabels: Record<string, string> = {
                    deposit: "Dépôt",
                    payment_link: "Lien de paiement",
                    merchant_link: "Lien marchand",
                    api_payment: "Paiement API",
                    withdrawal: "Retrait",
                    transfer: "Transfert",
                  };
                  
                  return (
                    <div
                      key={tx.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/50"
                      data-testid={`pending-tx-${tx.id}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isIncoming ? "bg-green-100 dark:bg-green-900" : "bg-orange-100 dark:bg-orange-900"
                        }`}>
                          {isIncoming ? (
                            <ArrowDownLeft className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">
                              {formatAmount(tx.amount, tx.currency || (tx.user ? getCurrencyForUser(tx.user) : "XOF"))}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {typeLabels[tx.type] || tx.type}
                            </Badge>
                            {tx.country && (
                              <Badge variant="outline" className="text-xs">
                                {tx.country}
                              </Badge>
                            )}
                            {tx.operator && (
                              <Badge variant="outline" className="text-xs">
                                {tx.operator}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : "Utilisateur inconnu"}
                          </p>
                          {(tx.customerName || tx.customerPhone || tx.customerEmail) && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {tx.customerName && (
                                <p><span className="font-medium">Client:</span> {tx.customerName}</p>
                              )}
                              {tx.customerPhone && (
                                <p><span className="font-medium">Tél:</span> {tx.customerPhone}</p>
                              )}
                              {tx.customerEmail && (
                                <p><span className="font-medium">Email:</span> {tx.customerEmail}</p>
                              )}
                            </div>
                          )}
                          {isWithdrawal && (
                            <p className="text-xs text-muted-foreground">
                              Frais: {formatAmount(tx.fee, tx.currency || "XOF")} | Total déduit: {formatAmount(tx.amount + tx.fee, tx.currency || "XOF")}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => validateTransactionMutation.mutate(tx.id)}
                          disabled={validateTransactionMutation.isPending || rejectTransactionMutation.isPending}
                          data-testid={`button-validate-${tx.id}`}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {validateTransactionMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          <span className="ml-1">Valider</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectTransactionMutation.mutate(tx.id)}
                          disabled={validateTransactionMutation.isPending || rejectTransactionMutation.isPending}
                          data-testid={`button-reject-${tx.id}`}
                        >
                          {rejectTransactionMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span className="ml-1">Rejeter</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Aucune transaction en attente</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      {profileViewUserId && <ProfileDialog userId={profileViewUserId} onOpenChange={() => setProfileViewUserId(null)} />}
      
      {/* History Dialog */}
      {historyViewUserId && <HistoryDialog userId={historyViewUserId} onOpenChange={() => setHistoryViewUserId(null)} />}
      
      {/* Payment Links Dialog */}
      {paymentLinksViewUserId && <PaymentLinksDialog userId={paymentLinksViewUserId} onOpenChange={() => setPaymentLinksViewUserId(null)} />}
      
      {/* Merchant Links Dialog */}
      {merchantLinksViewUserId && <MerchantLinksDialog userId={merchantLinksViewUserId} onOpenChange={() => setMerchantLinksViewUserId(null)} />}
      
      {/* API Keys Dialog */}
      {apiKeysViewUserId && <ApiKeysDialog userId={apiKeysViewUserId} onOpenChange={() => setApiKeysViewUserId(null)} />}
    </div>
  );
}
