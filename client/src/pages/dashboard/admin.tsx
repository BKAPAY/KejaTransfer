import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, UserCheck, TrendingDown, TrendingUp, Search, Settings, Globe, RefreshCw, Database, AlertCircle, CheckCircle2, Eye, History, MapPin, Mail, Phone, CreditCard, Percent, Lock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Bot, Power, Network } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { User, Transaction } from "@shared/schema";
import { TransactionDetailsDialog } from "@/components/transaction-details-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryFlag, getCountryName } from "@/components/country-flag";

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const ADMIN_ACCESS_CODE = "19992025";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  BF: "Burkina Faso",
  GN: "Guinée",
  NE: "Niger",
  ML: "Mali",
  CM: "Cameroun",
  TD: "Tchad",
  CG: "Congo-Brazzaville",
  CF: "Centrafrique",
  GA: "Gabon",
  CD: "RD Congo",
  GM: "Gambie",
  RW: "Rwanda",
};

const COUNTRY_CURRENCIES: Record<string, string> = {
  BJ: "XOF",
  TG: "XOF",
  CI: "XOF",
  SN: "XOF",
  BF: "XOF",
  GN: "GNF",
  NE: "XOF",
  ML: "XOF",
  CM: "XAF",
  TD: "XAF",
  CG: "XAF",
  CF: "XAF",
  GA: "XAF",
  CD: "CDF",
  GM: "GMD",
  RW: "RWF",
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
  const [accessCodeDialogOpen, setAccessCodeDialogOpen] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const [txItemsPerPage, setTxItemsPerPage] = useState(20);
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: emaliStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/platform-settings/emali-enabled"],
  });

  const toggleEmaliMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/toggle-emali", { enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-settings/emali-enabled"] });
      toast({
        title: data.enabled ? "Assistant active" : "Assistant desactive",
        description: data.enabled ? "EMALI AI est maintenant disponible pour les utilisateurs" : "EMALI AI est desormais desactive",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
    },
  });

  const handleProtectedNavigation = (path: string) => {
    setPendingNavigation(path);
    setAccessCode("");
    setAccessCodeDialogOpen(true);
  };

  const handleAccessCodeSubmit = () => {
    if (accessCode === ADMIN_ACCESS_CODE) {
      setAccessCodeDialogOpen(false);
      if (pendingNavigation) {
        setLocation(pendingNavigation);
        setPendingNavigation(null);
      }
      setAccessCode("");
    } else {
      toast({
        title: "Erreur",
        description: "Code d'accès incorrect",
        variant: "destructive",
      });
      setAccessCode("");
    }
  };

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
    depositsByCurrency?: { XOF: number; XAF: number; CDF: number; GNF: number; GMD: number; RWF: number };
    withdrawalsByCurrency?: { XOF: number; XAF: number; CDF: number; GNF: number; GMD: number; RWF: number };
  }>({
    queryKey: ["/api/admin/stats"],
    staleTime: 30000,
    refetchInterval: 60000,
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

  // Get all transactions for admin (recent 500 for display)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery<TransactionWithUser[]>({
    queryKey: ["/api/admin/all-transactions"],
    enabled: mainTab === "transactions",
  });

  // Server-side full-database transaction search (triggered when a search query is set)
  const { data: txSearchResults = [], isLoading: txSearchLoading } = useQuery<TransactionWithUser[]>({
    queryKey: ["/api/admin/search-transactions", txSearchQuery],
    queryFn: async () => {
      if (!txSearchQuery.trim()) return [];
      const res = await fetch(`/api/admin/search-transactions?q=${encodeURIComponent(txSearchQuery.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: txSearchQuery.trim().length >= 2 && mainTab === "transactions",
    staleTime: 10000,
  });

  // Display filtered results if searching, otherwise show all users
  const displayedUsers = searchQuery.length > 0 ? searchResults : allUsers;
  const isLoading = searchQuery.length > 0 ? searchLoading : usersLoading;

  // When searching: use server-side results. Otherwise: show the 500 recent transactions.
  const filteredTransactions: TransactionWithUser[] = txSearchQuery.trim().length >= 2
    ? txSearchResults
    : allTransactions;

  const txTotalPages = Math.ceil(filteredTransactions.length / txItemsPerPage);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (txCurrentPage - 1) * txItemsPerPage;
    const endIndex = startIndex + txItemsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, txCurrentPage, txItemsPerPage]);

  const handleTxSearchChange = (value: string) => {
    setTxSearchQuery(value);
    setTxCurrentPage(1);
  };

  const handleTxItemsPerPageChange = (value: string) => {
    setTxItemsPerPage(parseInt(value));
    setTxCurrentPage(1);
  };

  const goToTxPage = (page: number) => {
    if (page >= 1 && page <= txTotalPages) {
      setTxCurrentPage(page);
    }
  };

  const formatAmount = (amount: number, currency: string = "XOF") => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " " + currency;
  };

  const getUserCurrency = (country: string | null | undefined): string => {
    if (!country) return "XOF";
    return COUNTRY_CURRENCIES[country] || "XOF";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Panneau Administrateur</h1>
        <p className="text-sm text-muted-foreground mb-3">Gestion et surveillance de la plateforme</p>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => handleProtectedNavigation("/dashboard/fournisseurs")}
            data-testid="button-fournisseurs"
            className="gap-2"
            variant="destructive"
          >
            <Lock className="w-4 h-4" />
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
            onClick={() => handleProtectedNavigation("/dashboard/country-operator-config")}
            data-testid="button-country-operator-config"
            className="gap-2"
            variant="outline"
          >
            <Lock className="w-4 h-4" />
            Pays & Operateurs
          </Button>
          <Button
            onClick={() => handleProtectedNavigation("/dashboard/fee-config")}
            data-testid="button-fee-config"
            className="gap-2"
            variant="outline"
          >
            <Lock className="w-4 h-4" />
            Frais
          </Button>
          <Button
            onClick={() => handleProtectedNavigation("/dashboard/management")}
            data-testid="button-management"
            className="gap-2 border-yellow-500 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30"
            variant="outline"
          >
            <Lock className="w-4 h-4" />
            Gestionnaire
          </Button>
          <Button
            onClick={() => handleProtectedNavigation("/dashboard/support-config")}
            data-testid="button-support-config"
            className="gap-2"
            variant="outline"
          >
            <Lock className="w-4 h-4" />
            Infos Support
          </Button>
          <Button
            onClick={() => toggleEmaliMutation.mutate(!(emaliStatus?.enabled ?? true))}
            disabled={toggleEmaliMutation.isPending}
            data-testid="button-toggle-emali"
            className="gap-2"
            variant={emaliStatus?.enabled !== false ? "default" : "secondary"}
          >
            <Bot className="w-4 h-4" />
            {emaliStatus?.enabled !== false ? "EMALI AI : ON" : "EMALI AI : OFF"}
          </Button>
          <Button
            onClick={() => handleProtectedNavigation("/dashboard/ip-addresses")}
            data-testid="button-ip-addresses"
            className="gap-2"
            variant="outline"
          >
            <Network className="w-4 h-4" />
            Adresses IP
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
              <div className="space-y-1" data-testid="stat-total-deposits">
                {stats?.depositsByCurrency?.XOF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.depositsByCurrency.XOF, "XOF")}</div>
                ) : null}
                {stats?.depositsByCurrency?.XAF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.depositsByCurrency.XAF, "XAF")}</div>
                ) : null}
                {stats?.depositsByCurrency?.CDF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.depositsByCurrency.CDF, "CDF")}</div>
                ) : null}
                {stats?.depositsByCurrency?.GNF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.depositsByCurrency.GNF, "GNF")}</div>
                ) : null}
                {stats?.depositsByCurrency?.GMD ? (
                  <div className="text-lg font-bold">{formatAmount(stats.depositsByCurrency.GMD, "GMD")}</div>
                ) : null}
                {stats?.depositsByCurrency?.RWF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.depositsByCurrency.RWF, "RWF")}</div>
                ) : null}
                {!stats?.depositsByCurrency?.XOF && !stats?.depositsByCurrency?.XAF && !stats?.depositsByCurrency?.CDF && !stats?.depositsByCurrency?.GNF && !stats?.depositsByCurrency?.GMD && !stats?.depositsByCurrency?.RWF && (
                  <div className="text-lg font-bold">0 XOF</div>
                )}
                <p className="text-xs text-muted-foreground">Argent entrant</p>
              </div>
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
              <div className="space-y-1" data-testid="stat-total-withdrawals">
                {stats?.withdrawalsByCurrency?.XOF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.withdrawalsByCurrency.XOF, "XOF")}</div>
                ) : null}
                {stats?.withdrawalsByCurrency?.XAF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.withdrawalsByCurrency.XAF, "XAF")}</div>
                ) : null}
                {stats?.withdrawalsByCurrency?.CDF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.withdrawalsByCurrency.CDF, "CDF")}</div>
                ) : null}
                {stats?.withdrawalsByCurrency?.GNF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.withdrawalsByCurrency.GNF, "GNF")}</div>
                ) : null}
                {stats?.withdrawalsByCurrency?.GMD ? (
                  <div className="text-lg font-bold">{formatAmount(stats.withdrawalsByCurrency.GMD, "GMD")}</div>
                ) : null}
                {stats?.withdrawalsByCurrency?.RWF ? (
                  <div className="text-lg font-bold">{formatAmount(stats.withdrawalsByCurrency.RWF, "RWF")}</div>
                ) : null}
                {!stats?.withdrawalsByCurrency?.XOF && !stats?.withdrawalsByCurrency?.XAF && !stats?.withdrawalsByCurrency?.CDF && !stats?.withdrawalsByCurrency?.GNF && !stats?.withdrawalsByCurrency?.GMD && !stats?.withdrawalsByCurrency?.RWF && (
                  <div className="text-lg font-bold">0 XOF</div>
                )}
                <p className="text-xs text-muted-foreground">Argent sortant</p>
              </div>
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
                              <CountryFlag code={user.country} size="xs" />
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
                        <div className="flex items-center gap-2 mt-1">
                          {user.country && (
                            <span className="text-xs flex items-center gap-1" data-testid={`country-${user.id}`}>
                              <CountryFlag code={user.country} size="xs" />
                              <span className="text-muted-foreground">{COUNTRY_NAMES[user.country] || user.country}</span>
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            - Cree le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-sm" data-testid={`balance-${user.id}`}>
                            {formatAmount(user.balance, getUserCurrency(user.country))}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Toutes les Transactions ({allTransactions.length})
              </CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher transactions..."
                  value={txSearchQuery}
                  onChange={(e) => handleTxSearchChange(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-admin-transactions"
                />
              </div>
            </div>
            {txSearchQuery && (
              <p className="text-xs text-muted-foreground mt-2">
                {txSearchLoading ? "Recherche en cours…" : `${filteredTransactions.length} résultat(s) pour "${txSearchQuery}" (base entière)`}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {(transactionsLoading && !txSearchQuery) || (txSearchLoading && txSearchQuery) ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : paginatedTransactions.length > 0 ? (
              <>
                <div className="border rounded-lg divide-y">
                  {paginatedTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_130px] gap-3 p-4 hover:bg-muted/50 cursor-pointer items-start"
                      data-testid={`transaction-row-${tx.id}`}
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setTransactionDialogOpen(true);
                      }}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-sm truncate">
                          {tx.type === "deposit" ? "Dépôt" : tx.type === "withdrawal" ? "Retrait" : tx.type === "transfer" ? "Transfert" : tx.type === "payment_link" ? "Lien paiement" : tx.type === "merchant_link" ? "Lien marchand" : tx.type === "api_payment" ? "Paiement API" : tx.type}
                          {tx.description && ` - ${tx.description}`}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"}
                            className="text-xs shrink-0"
                          >
                            {tx.status === "completed" ? "Complète" : tx.status === "pending" ? "En attente" : tx.status === "failed" ? "Échouée" : "Annulée"}
                          </Badge>
                          {tx.country && (
                            <span className="text-xs text-muted-foreground">
                              <CountryFlag code={tx.country} size="xs" />
                            </span>
                          )}
                          {tx.operator && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {tx.operator}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {tx.user && ` • ${tx.user.firstName} ${tx.user.lastName}`}
                        </p>
                        {(tx.customerName || tx.customerPhone || tx.customerEmail) && (
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
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
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-base tabular-nums">
                          {formatAmount(tx.amount, tx.currency || getUserCurrency((tx as any).user?.country))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {txTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Afficher</span>
                      <Select value={txItemsPerPage.toString()} onValueChange={handleTxItemsPerPageChange}>
                        <SelectTrigger className="w-20 h-8" data-testid="select-admin-items-per-page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option.toString()}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>par page</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToTxPage(1)}
                        disabled={txCurrentPage === 1}
                        data-testid="button-admin-first-page"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToTxPage(txCurrentPage - 1)}
                        disabled={txCurrentPage === 1}
                        data-testid="button-admin-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex items-center gap-1 px-2">
                        <span className="text-sm font-medium">
                          Page {txCurrentPage} sur {txTotalPages}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({filteredTransactions.length} transactions)
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToTxPage(txCurrentPage + 1)}
                        disabled={txCurrentPage === txTotalPages}
                        data-testid="button-admin-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToTxPage(txTotalPages)}
                        disabled={txCurrentPage === txTotalPages}
                        data-testid="button-admin-last-page"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {txTotalPages <= 1 && filteredTransactions.length > 0 && (
                  <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                    {filteredTransactions.length} transaction(s) au total
                  </div>
                )}
              </>
            ) : txSearchQuery ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Aucune transaction trouvée pour "{txSearchQuery}"</p>
                <Button variant="ghost" onClick={() => setTxSearchQuery("")} className="mt-2">
                  Effacer la recherche
                </Button>
              </div>
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
                        <CountryFlag code={selectedUser.country} size="sm" />
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
                  <p className="text-lg font-bold">{formatAmount(selectedUser.balance, getUserCurrency(selectedUser.country))}</p>
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
        isAdmin={true}
      />

      {/* Dialogue de code d'accès */}
      <Dialog open={accessCodeDialogOpen} onOpenChange={setAccessCodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mx-auto mb-2">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Accès protégé</DialogTitle>
            <DialogDescription className="text-center">
              Veuillez entrer le code d'accès pour continuer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Entrez le code d'accès"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccessCodeSubmit()}
              className="text-center text-2xl tracking-widest"
              maxLength={8}
              data-testid="input-access-code"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAccessCodeDialogOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleAccessCodeSubmit}
                disabled={accessCode.length === 0}
                className="flex-1"
                data-testid="button-submit-access-code"
              >
                Accéder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
