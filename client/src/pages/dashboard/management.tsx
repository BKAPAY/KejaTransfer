import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Shield, Trash2, Plus, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import type { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Management() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fundAmount, setFundAmount] = useState<{ [userId: string]: string }>({});
  const { toast } = useToast();

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
                            addFundsMutation.mutate({ userId: user.id, amount });
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
                            subtractFundsMutation.mutate({ userId: user.id, amount });
                          }
                        }}
                        disabled={!fundAmount[user.id] || parseInt(fundAmount[user.id]) <= 0 || subtractFundsMutation.isPending}
                        data-testid={`button-subtract-funds-${user.id}`}
                      >
                        <Minus className="w-4 h-4 mr-1" />
                        Retirer
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {!user.isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promoteUserMutation.mutate(user.id)}
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
                          onClick={() => removeAdminMutation.mutate(user.id)}
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
                        onClick={() => {
                          if (confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur?")) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
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
    </div>
  );
}
