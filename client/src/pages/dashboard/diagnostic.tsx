import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Search, 
  Users, 
  FileCheck, 
  History, 
  Wallet, 
  RefreshCw, 
  ArrowLeft,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  BadgeCheck
} from "lucide-react";

interface DiagnosticUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  balance: number;
  kycStatus: string;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  suspended: boolean;
  createdAt: string;
}

interface PendingKycUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  kycStatus: string;
  kycIdFront: string | null;
  kycIdBack: string | null;
  kycSelfie: string | null;
  createdAt: string;
}

interface DiagnosticTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  fee: number;
  status: string;
  country: string | null;
  operator: string | null;
  customerName: string | null;
  customerPhone: string | null;
  description: string | null;
  paydunyaToken: string | null;
  createdAt: string;
}

interface DiagnosticData {
  success: boolean;
  timestamp: string;
  environment: string;
  users: DiagnosticUser[];
  pendingKyc: PendingKycUser[];
  transactions: DiagnosticTransaction[];
  stats: {
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
  };
  message: string;
}

export default function DiagnosticPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DiagnosticUser | null>(null);
  const [selectedKycUser, setSelectedKycUser] = useState<PendingKycUser | null>(null);

  const { data: diagnosticData, isLoading, refetch } = useQuery<DiagnosticData>({
    queryKey: ["/api/admin/diagnostic-advanced"],
    refetchOnMount: true,
    staleTime: 0,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Actualisation réussie",
        description: `${diagnosticData?.users?.length || 0} utilisateur(s) chargé(s)`,
      });
    } catch (error) {
      toast({
        title: "Erreur d'actualisation",
        description: "Impossible de rafraîchir les données",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!diagnosticData?.users) return [];
    if (!searchQuery.trim()) return diagnosticData.users;
    
    const query = searchQuery.toLowerCase().trim();
    
    // First, find users by name or email
    const matchedByUserInfo = diagnosticData.users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
    
    // Also search by transaction token (paydunyaToken)
    const matchingTransactions = diagnosticData.transactions?.filter(
      (t) => (t.paydunyaToken && t.paydunyaToken.toLowerCase().includes(query)) ||
             t.id.toLowerCase().includes(query)
    ) || [];
    
    const userIdsFromTransactions = new Set(matchingTransactions.map(t => t.userId));
    const matchedByToken = diagnosticData.users.filter(u => userIdsFromTransactions.has(u.id));
    
    // Combine results, avoiding duplicates
    const resultMap = new Map<string, DiagnosticUser>();
    matchedByUserInfo.forEach(u => resultMap.set(u.id, u));
    matchedByToken.forEach(u => resultMap.set(u.id, u));
    
    return Array.from(resultMap.values());
  }, [diagnosticData?.users, diagnosticData?.transactions, searchQuery]);

  const getUserTransactions = (userId: string) => {
    if (!diagnosticData?.transactions) return [];
    return diagnosticData.transactions.filter(t => t.userId === userId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " XOF";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Complété</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">En attente</Badge>;
      case "failed":
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"><BadgeCheck className="h-3 w-3 mr-1" />Vérifié</Badge>;
      case "submitted":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Non soumis</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    if (type === "withdrawal") {
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    }
    return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard/admin")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Diagnostic Base de Données</h1>
            <p className="text-sm text-muted-foreground">
              {diagnosticData?.message || "Chargement..."}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {diagnosticData?.stats?.totalUsers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">KYC Vérifiés</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-verified-users">
              {diagnosticData?.stats?.verifiedUsers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">KYC en Attente</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-kyc">
              {diagnosticData?.pendingKyc?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Dépôts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-deposits">
              {formatCurrency(diagnosticData?.stats?.totalDeposits || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Utilisateurs ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="kyc" data-testid="tab-kyc">
            <FileCheck className="h-4 w-4 mr-2" />
            KYC en Attente ({diagnosticData?.pendingKyc?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            <History className="h-4 w-4 mr-2" />
            Transactions ({diagnosticData?.transactions?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, prénom, email ou token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Utilisateurs triés par solde (du plus grand au plus petit)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                      data-testid={`row-user-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.firstName} {user.lastName}
                            {user.isAdmin && (
                              <Badge variant="secondary" className="text-xs">Admin</Badge>
                            )}
                            {user.suspended && (
                              <Badge variant="destructive" className="text-xs">Suspendu</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getKycStatusBadge(user.kycStatus)}
                        <div className="text-right">
                          <div className="font-bold text-lg">{formatCurrency(user.balance)}</div>
                          <div className="text-xs text-muted-foreground">
                            Inscrit le {formatDate(user.createdAt)}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" data-testid={`button-view-user-${user.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur trouvé
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KYC Soumises en Attente de Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {diagnosticData?.pendingKyc?.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                      onClick={() => setSelectedKycUser(user)}
                      data-testid={`row-kyc-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <FileCheck className="h-8 w-8 text-yellow-500" />
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                          <Clock className="h-3 w-3 mr-1" />
                          En attente
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Soumis le {formatDate(user.createdAt)}
                        </div>
                        <Button size="icon" variant="ghost" data-testid={`button-view-kyc-${user.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!diagnosticData?.pendingKyc || diagnosticData.pendingKyc.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>Aucune KYC en attente de validation</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Transactions (Toutes)</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {diagnosticData?.transactions?.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`row-transaction-${transaction.id}`}
                    >
                      <div className="flex items-center gap-4">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <div className="font-medium capitalize">
                            {transaction.type === "deposit" && "Dépôt"}
                            {transaction.type === "withdrawal" && "Retrait"}
                            {transaction.type === "payment_link" && "Lien de paiement"}
                            {transaction.type === "merchant_link" && "Lien marchand"}
                            {transaction.type === "api_payment" && "Paiement API"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.customerName || "Client anonyme"} 
                            {transaction.operator && ` • ${transaction.operator.toUpperCase()}`}
                            {transaction.country && ` (${transaction.country})`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(transaction.status)}
                        <div className="text-right">
                          <div className={`font-bold ${transaction.type === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                            {transaction.type === "withdrawal" ? "-" : "+"}{formatCurrency(transaction.amount)}
                          </div>
                          {transaction.fee > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Frais: {formatCurrency(transaction.fee)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatDate(transaction.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!diagnosticData?.transactions || diagnosticData.transactions.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucune transaction trouvée
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Détails de {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Solde</label>
                  <p className="font-bold text-lg text-green-600">{formatCurrency(selectedUser.balance)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut KYC</label>
                  <div className="mt-1">{getKycStatusBadge(selectedUser.kycStatus)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date d'inscription</label>
                  <p>{formatDate(selectedUser.createdAt)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historique des transactions
                </h3>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {getUserTransactions(selectedUser.id).map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(t.type)}
                          <div>
                            <div className="font-medium capitalize">
                              {t.type === "deposit" && "Dépôt"}
                              {t.type === "withdrawal" && "Retrait"}
                              {t.type === "payment_link" && "Lien de paiement"}
                              {t.type === "merchant_link" && "Lien marchand"}
                              {t.type === "api_payment" && "Paiement API"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(t.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(t.status)}
                          <span className={`font-bold ${t.type === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                            {t.type === "withdrawal" ? "-" : "+"}{formatCurrency(t.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {getUserTransactions(selectedUser.id).length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        Aucune transaction
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedKycUser} onOpenChange={() => setSelectedKycUser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Documents KYC de {selectedKycUser?.firstName} {selectedKycUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          {selectedKycUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="font-medium">{selectedKycUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date de soumission</label>
                  <p>{formatDate(selectedKycUser.createdAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedKycUser.kycIdFront && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">Pièce d'identité (Recto)</label>
                    <img 
                      src={selectedKycUser.kycIdFront} 
                      alt="ID Front" 
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}
                {selectedKycUser.kycIdBack && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">Pièce d'identité (Verso)</label>
                    <img 
                      src={selectedKycUser.kycIdBack} 
                      alt="ID Back" 
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}
                {selectedKycUser.kycSelfie && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">Selfie</label>
                    <img 
                      src={selectedKycUser.kycSelfie} 
                      alt="Selfie" 
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/dashboard/kyc-verification")}
                  data-testid="button-go-to-kyc"
                >
                  Aller à la vérification KYC
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
