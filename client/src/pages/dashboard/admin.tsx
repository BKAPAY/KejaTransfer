import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, UserCheck, TrendingDown, TrendingUp, Search, Settings, Globe, Clock, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useLocation } from "wouter";
import type { User, Transaction } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PendingTransaction = Transaction & { user?: User };

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
  }>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 5000,
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: pendingTransactions, isLoading: pendingLoading, refetch: refetchPending } = useQuery<PendingTransaction[]>({
    queryKey: ["/api/admin/pending-transactions"],
    refetchInterval: 10000,
  });

  const validateMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return apiRequest("POST", "/api/admin/validate-transaction", { transactionId });
    },
    onSuccess: () => {
      toast({
        title: "Transaction validée",
        description: "Le solde de l'utilisateur a été crédité.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de valider la transaction.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return apiRequest("POST", "/api/admin/reject-transaction", { transactionId });
    },
    onSuccess: () => {
      toast({
        title: "Transaction rejetée",
        description: "La transaction a été marquée comme échouée.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-transactions"] });
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

  // Display filtered results if searching, otherwise show all users
  const displayedUsers = searchQuery.length > 0 ? searchResults : allUsers;
  const isLoading = searchQuery.length > 0 ? searchLoading : usersLoading;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Panneau Administrateur</h1>
          <p className="text-sm text-muted-foreground">Gestion et surveillance de la plateforme</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setLocation("/dashboard/country-operator-config")}
            data-testid="button-country-operator-config"
            className="gap-2"
            variant="outline"
          >
            <Globe className="w-4 h-4" />
            Pays & Opérateurs
          </Button>
          <Button
            onClick={() => setLocation("/dashboard/management")}
            data-testid="button-management"
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Gestionnaire
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Utilisateurs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total-users">
                {stats?.totalUsers || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Tous les utilisateurs</p>
          </CardContent>
        </Card>

        {/* Utilisateurs Vérifiés */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Utilisateurs Vérifiés</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-verified-users">
                  {stats?.verifiedUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats && stats.totalUsers > 0
                    ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% de vérification`
                    : "0%"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Dépôts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Dépôts</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-total-deposits">
                  {formatAmount(stats?.totalDeposits || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Argent entrant</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Retraits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Retraits</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-total-withdrawals">
                  {formatAmount(stats?.totalWithdrawals || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Argent sortant</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions en attente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Transactions en Attente
            {pendingTransactions && pendingTransactions.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingTransactions.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
              {pendingTransactions.map((tx) => {
                const isIncoming = ["deposit", "payment_link", "merchant_link", "api_payment"].includes(tx.type);
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
                            {formatAmount(tx.amount)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {typeLabels[tx.type] || tx.type}
                          </Badge>
                          {tx.country && (
                            <Badge variant="outline" className="text-xs">
                              {tx.country}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : "Utilisateur inconnu"}
                        </p>
                        {tx.customerName && (
                          <p className="text-xs text-muted-foreground">
                            Client: {tx.customerName}
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
                        onClick={() => validateMutation.mutate(tx.id)}
                        disabled={validateMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-validate-${tx.id}`}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {validateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        <span className="ml-1 hidden sm:inline">Valider</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(tx.id)}
                        disabled={validateMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-reject-${tx.id}`}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        <span className="ml-1 hidden sm:inline">Rejeter</span>
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
        </CardContent>
      </Card>

      {/* Recherche d'utilisateurs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Rechercher Utilisateurs
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

          {/* Liste des utilisateurs */}
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
                    className="p-4 flex items-center justify-between gap-4 hover:bg-muted/50"
                    data-testid={`user-row-${user.id}`}
                  >
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
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm" data-testid={`balance-${user.id}`}>
                        {formatAmount(user.balance)}
                      </p>
                      <p className="text-xs text-muted-foreground">Solde</p>
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

      {/* Informations */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle>À propos de l'Administration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Ce panneau vous permet de superviser l'ensemble de la plateforme BKApay:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>✓ Voir le nombre total d'utilisateurs</li>
            <li>✓ Voir le nombre d'utilisateurs vérifiés (KYC)</li>
            <li>✓ Voir le total des dépôts sur la plateforme</li>
            <li>✓ Voir le total des retraits sur la plateforme</li>
            <li>✓ Rechercher les utilisateurs par email, nom ou prénom</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
