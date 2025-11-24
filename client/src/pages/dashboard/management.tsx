import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Shield, Trash2, Plus, Minus, History, Link as LinkIcon, Store, Key, User as UserIcon } from "lucide-react";
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
import type { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  HistoryDialog,
  PaymentLinksDialog,
  MerchantLinksDialog,
  ApiKeysDialog,
  ProfileDialog,
} from "./management-details";

export default function Management() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fundAmount, setFundAmount] = useState<{ [userId: string]: string }>({});
  const { toast } = useToast();

  // Dialog states
  const [promoteDialog, setPromoteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [removeAdminDialog, setRemoveAdminDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [addFundsDialog, setAddFundsDialog] = useState<{ open: boolean; userId?: string; userName?: string; amount?: number }>({ open: false });
  const [subtractFundsDialog, setSubtractFundsDialog] = useState<{ open: boolean; userId?: string; userName?: string; amount?: number }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  
  // Details view states
  const [historyViewUserId, setHistoryViewUserId] = useState<string | null>(null);
  const [paymentLinksViewUserId, setPaymentLinksViewUserId] = useState<string | null>(null);
  const [merchantLinksViewUserId, setMerchantLinksViewUserId] = useState<string | null>(null);
  const [apiKeysViewUserId, setApiKeysViewUserId] = useState<string | null>(null);
  const [profileViewUserId, setProfileViewUserId] = useState<string | null>(null);

  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">Administrer les utilisateurs de la plateforme</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Utilisateurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Rechercher par email, nom ou prénom..."
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
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`email-${user.id}`}>
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                        <p className="font-semibold text-sm mt-2" data-testid={`balance-${user.id}`}>
                          Solde: {formatAmount(user.balance)}
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
                            setAddFundsDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, amount });
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
                            setSubtractFundsDialog({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, amount });
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
                        onClick={() => setProfileViewUserId(user.id)}
                        data-testid={`button-view-profile-${user.id}`}
                      >
                        <UserIcon className="w-4 h-4 mr-1" />
                        Profil
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHistoryViewUserId(user.id)}
                        data-testid={`button-view-history-${user.id}`}
                      >
                        <History className="w-4 h-4 mr-1" />
                        Historique
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPaymentLinksViewUserId(user.id)}
                        data-testid={`button-view-payment-links-${user.id}`}
                      >
                        <LinkIcon className="w-4 h-4 mr-1" />
                        Liens
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setMerchantLinksViewUserId(user.id)}
                        data-testid={`button-view-merchant-${user.id}`}
                      >
                        <Store className="w-4 h-4 mr-1" />
                        Marchand
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setApiKeysViewUserId(user.id)}
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
              Êtes-vous sûr de vouloir ajouter <strong>{formatAmount(addFundsDialog.amount || 0)}</strong> au compte de <strong>{addFundsDialog.userName}</strong>?
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
              Êtes-vous sûr de vouloir retirer <strong>{formatAmount(subtractFundsDialog.amount || 0)}</strong> du compte de <strong>{subtractFundsDialog.userName}</strong>?
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
