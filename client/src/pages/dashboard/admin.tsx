import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Users, UserCheck, TrendingDown, TrendingUp, Search, Settings, Globe, RefreshCw, Database, AlertCircle, CheckCircle2, Eye, History, MapPin, Mail, Phone, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { User, Transaction } from "@shared/schema";
import { TransactionDetailsDialog } from "@/components/transaction-details-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  BF: "Burkina Faso",
  GN: "Guinée",
  NE: "Niger",
};

const COUNTRY_FLAGS: Record<string, string> = {
  BJ: "🇧🇯",
  TG: "🇹🇬",
  CI: "🇨🇮",
  SN: "🇸🇳",
  BF: "🇧🇫",
  GN: "🇬🇳",
  NE: "🇳🇪",
};

interface DiagnosticResult {
  timestamp: string;
  environment: string;
  database: {
    connected: boolean;
    usersCount?: number;
    usersDetails?: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isAdmin: boolean;
      kycStatus: string;
      createdAt: string;
    }>;
    error?: string;
  };
  stats?: {
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
  };
  message: string;
}

interface TransactionWithUser extends Transaction {
  user?: User;
}

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "all">("all");
  const [mainTab, setMainTab] = useState<"users" | "transactions">("users");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      // Use the force-sync endpoint to get fresh data directly from DB
      const response = await fetch("/api/admin/force-sync", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) throw new Error("Sync failed");
      
      const syncData = await response.json();
      
      if (syncData.success) {
        // Update the query cache with the fresh data
        queryClient.setQueryData(["/api/admin/users"], syncData.users);
        queryClient.setQueryData(["/api/admin/stats"], syncData.stats);
        
        // Also invalidate to ensure future fetches get fresh data
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
        
        toast({
          title: "Synchronisation réussie",
          description: syncData.message,
        });
      } else {
        throw new Error(syncData.message || "Sync failed");
      }
    } catch (error: any) {
      toast({
        title: "Erreur de synchronisation",
        description: error.message || "Impossible de recharger les données",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDiagnostic = async () => {
    setIsDiagnosing(true);
    setShowDiagnostic(true);
    try {
      const response = await fetch("/api/admin/database-diagnostic");
      if (!response.ok) throw new Error("Diagnostic failed");
      const result = await response.json();
      setDiagnosticResult(result);
      toast({
        title: "Diagnostic terminé",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Erreur de diagnostic",
        description: "Impossible d'exécuter le diagnostic",
        variant: "destructive",
      });
      setDiagnosticResult({
        timestamp: new Date().toISOString(),
        environment: "unknown",
        database: { connected: false, error: "Erreur de connexion" },
        message: "Erreur lors du diagnostic"
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
  }>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 5000,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search users");
      return response.json();
    },
    enabled: searchQuery.length > 0,
  });

  // Get all transactions for admin
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery<TransactionWithUser[]>({
    queryKey: ["/api/admin/all-transactions"],
    enabled: mainTab === "transactions",
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
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setLocation("/dashboard/fournisseurs")}
            data-testid="button-fournisseurs"
            className="gap-2"
            variant="destructive"
          >
            <Database className="w-4 h-4" />
            FOURNISSEURS
          </Button>
          <Button
            onClick={handleSyncDatabase}
            disabled={isSyncing}
            data-testid="button-sync-database"
            className="gap-2"
            variant="default"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Synchronisation..." : "Synchroniser BD"}
          </Button>
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
            variant="outline"
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

      {/* Diagnostic de Base de Données */}
      {showDiagnostic && (
        <Card className="border-2 border-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                {diagnosticResult?.database.connected ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                Diagnostic de la Base de Données
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowDiagnostic(false)}>
                Fermer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDiagnosing ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Exécution du diagnostic...</span>
              </div>
            ) : diagnosticResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Environnement:</span>{" "}
                    <Badge variant={diagnosticResult.environment === "production" ? "destructive" : "secondary"}>
                      {diagnosticResult.environment}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Connexion:</span>{" "}
                    <Badge variant={diagnosticResult.database.connected ? "default" : "destructive"}>
                      {diagnosticResult.database.connected ? "Connectée" : "Erreur"}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Timestamp:</span>{" "}
                    {new Date(diagnosticResult.timestamp).toLocaleString("fr-FR")}
                  </div>
                  <div>
                    <span className="font-medium">Utilisateurs dans BD:</span>{" "}
                    <span className="text-xl font-bold text-primary">{diagnosticResult.database.usersCount || 0}</span>
                  </div>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium mb-2">{diagnosticResult.message}</p>
                  {diagnosticResult.database.error && (
                    <p className="text-red-600 text-sm">Erreur: {diagnosticResult.database.error}</p>
                  )}
                </div>

                {diagnosticResult.database.usersDetails && diagnosticResult.database.usersDetails.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Utilisateurs trouvés dans la base de données:</h4>
                    <ScrollArea className="h-[200px] border rounded-lg">
                      <div className="divide-y">
                        {diagnosticResult.database.usersDetails.map((user, index) => (
                          <div key={user.id} className="p-3 flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium">{user.firstName} {user.lastName}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={user.kycStatus === "verified" ? "default" : "secondary"}>
                                {user.kycStatus === "verified" ? "Vérifié" : "Non vérifié"}
                              </Badge>
                              {user.isAdmin && <Badge variant="destructive">Admin</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Cliquez sur "Diagnostic BD" pour analyser la base de données.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglets principaux */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={mainTab === "users" ? "default" : "outline"}
          size="lg"
          onClick={() => setMainTab("users")}
          data-testid="button-main-tab-users"
          className="gap-2"
        >
          <Users className="w-5 h-5" />
          Utilisateurs ({allUsers.length})
        </Button>
        <Button
          variant={mainTab === "transactions" ? "default" : "outline"}
          size="lg"
          onClick={() => setMainTab("transactions")}
          data-testid="button-main-tab-transactions"
          className="gap-2"
        >
          <History className="w-5 h-5" />
          Transactions
        </Button>
      </div>

      {/* Section Utilisateurs */}
      {mainTab === "users" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gestion des Utilisateurs
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setActiveTab("all");
                    setSearchQuery("");
                  }}
                  data-testid="button-tab-all-users"
                >
                  Tous ({allUsers.length})
                </Button>
                <Button
                  variant={activeTab === "search" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("search")}
                  data-testid="button-tab-search-users"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Rechercher
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === "search" && (
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
            )}

            {/* Liste des utilisateurs */}
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
              <ScrollArea className="h-[600px] border rounded-lg">
                <div className="divide-y pr-4">
                  {displayedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-muted/50 cursor-pointer"
                      data-testid={`user-row-${user.id}`}
                      onClick={() => {
                        setSelectedUser(user);
                        setUserDialogOpen(true);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-sm">
                            {user.firstName} {user.lastName}
                          </h4>
                          {user.country && (
                            <span className="text-sm" title={COUNTRY_NAMES[user.country] || user.country}>
                              {COUNTRY_FLAGS[user.country] || user.country}
                            </span>
                          )}
                          <Badge
                            variant={user.kycStatus === "verified" ? "default" : "secondary"}
                            className="text-xs"
                            data-testid={`badge-kyc-${user.id}`}
                          >
                            {user.kycStatus === "verified" ? "Verifie" : "Non verifie"}
                          </Badge>
                          {user.isAdmin && (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-admin-${user.id}`}>
                              Admin
                            </Badge>
                          )}
                          {user.suspended && (
                            <Badge variant="destructive" className="text-xs">
                              Suspendu
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`email-${user.id}`}>
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cree le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-sm" data-testid={`balance-${user.id}`}>
                            {formatAmount(user.balance)}
                          </p>
                          <p className="text-xs text-muted-foreground">Solde</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setUserDialogOpen(true);
                          }}
                          data-testid={`button-view-user-${user.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucun utilisateur trouve" : "Aucun utilisateur sur la plateforme"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section Transactions */}
      {mainTab === "transactions" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Toutes les Transactions ({allTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : allTransactions.length > 0 ? (
              <ScrollArea className="h-[600px] border rounded-lg">
                <div className="divide-y pr-4">
                  {allTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-muted/50 cursor-pointer"
                      data-testid={`transaction-row-${tx.id}`}
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setTransactionDialogOpen(true);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge
                            variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {tx.status === "completed" ? "Complete" : tx.status === "pending" ? "En attente" : "Echoue"}
                          </Badge>
                          <span className="text-sm font-medium">
                            {tx.type === "deposit" ? "Depot" : tx.type === "transfer" ? "Transfert" : tx.type === "payment_link" ? "Lien paiement" : tx.type === "merchant_link" ? "Lien marchand" : tx.type === "api_payment" ? "Paiement API" : tx.type}
                          </span>
                          {tx.country && (
                            <span className="text-sm">
                              {COUNTRY_FLAGS[tx.country] || tx.country}
                            </span>
                          )}
                          {tx.operator && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {tx.operator}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {tx.user && (
                            <span className="font-medium">
                              {tx.user.firstName} {tx.user.lastName}
                            </span>
                          )}
                          {tx.customerName && (
                            <span className="text-xs">| Client: {tx.customerName}</span>
                          )}
                          {tx.customerEmail && (
                            <span className="text-xs truncate max-w-[150px]">| {tx.customerEmail}</span>
                          )}
                          {tx.customerPhone && (
                            <span className="text-xs">| {tx.customerPhone}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-sm">
                            {formatAmount(tx.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">{tx.currency || "XOF"}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransaction(tx);
                            setTransactionDialogOpen(true);
                          }}
                          data-testid={`button-view-tx-${tx.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Aucune transaction sur la plateforme</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogue de détails utilisateur */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Details de l'utilisateur</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="bg-muted p-3 rounded-md border border-border">
                <label className="text-xs font-medium text-muted-foreground block mb-2">ID Utilisateur</label>
                <code className="text-xs font-mono break-all">{selectedUser.id}</code>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nom complet</p>
                  <p className="text-lg font-semibold">{selectedUser.firstName} {selectedUser.lastName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pays</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {selectedUser.country ? (
                      <>
                        <span className="text-lg">{COUNTRY_FLAGS[selectedUser.country]}</span>
                        {COUNTRY_NAMES[selectedUser.country] || selectedUser.country}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Non defini</span>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </p>
                  <p className="text-sm font-medium">{selectedUser.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Solde
                  </p>
                  <p className="text-lg font-bold">{formatAmount(selectedUser.balance)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Statut KYC</p>
                  <Badge variant={selectedUser.kycStatus === "verified" ? "default" : "secondary"}>
                    {selectedUser.kycStatus === "verified" ? "Verifie" : selectedUser.kycStatus === "submitted" ? "Soumis" : selectedUser.kycStatus === "rejected" ? "Rejete" : "En attente"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Statut Admin</p>
                  <div className="flex items-center gap-2">
                    {selectedUser.isAdmin ? (
                      <Badge variant="destructive">Administrateur</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Utilisateur</span>
                    )}
                    {selectedUser.isPrimaryAdmin && (
                      <Badge variant="default">Principal</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Statut du compte</p>
                  {selectedUser.suspended ? (
                    <Badge variant="destructive">Suspendu</Badge>
                  ) : (
                    <Badge variant="default">Actif</Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date d'inscription</p>
                  <p className="text-sm">
                    {new Date(selectedUser.createdAt).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {selectedUser.withdrawalPhones && selectedUser.withdrawalPhones.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Numeros de retrait configures
                  </h3>
                  <div className="space-y-1">
                    {selectedUser.withdrawalPhones.map((phone, index) => (
                      <p key={index} className="text-sm font-mono bg-muted p-2 rounded">
                        {phone}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/dashboard/management?userId=${selectedUser.id}`)}
                  data-testid="button-manage-user"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Gerer cet utilisateur
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogue de détails transaction */}
      <TransactionDetailsDialog
        transaction={selectedTransaction}
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
      />

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
