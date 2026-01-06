import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { jsPDF } from "jspdf";
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
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  BadgeCheck,
  Download,
  X
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

interface KycUser {
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
  pendingKyc: KycUser[];
  verifiedKyc: KycUser[];
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
  const [selectedKycUser, setSelectedKycUser] = useState<KycUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: diagnosticData, isLoading, refetch } = useQuery<DiagnosticData>({
    queryKey: ["/api/admin/diagnostic-advanced"],
    refetchOnMount: true,
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/approve-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to approve KYC");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succes", description: "KYC approuvee avec succes" });
      setSelectedKycUser(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/diagnostic-advanced"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'approuver la KYC", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/reject-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: rejectionReason }),
      });
      if (!response.ok) throw new Error("Failed to reject KYC");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succes", description: "KYC rejetee" });
      setSelectedKycUser(null);
      setRejectionReason("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/diagnostic-advanced"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de rejeter la KYC", variant: "destructive" });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Actualisation reussie",
        description: `${diagnosticData?.users?.length || 0} utilisateur(s) charge(s)`,
      });
    } catch (error) {
      toast({
        title: "Erreur d'actualisation",
        description: "Impossible de rafraichir les donnees",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const downloadKycPdf = (user: KycUser) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    
    doc.setFontSize(24);
    doc.text("BKApay", pageWidth / 2, y, { align: "center" });
    y += 10;
    doc.setFontSize(12);
    doc.text("Document de Verification KYC", pageWidth / 2, y, { align: "center" });
    y += 20;
    
    doc.setFontSize(16);
    doc.text("Informations de l'Utilisateur", 20, y);
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`Nom complet: ${user.firstName} ${user.lastName}`, 20, y);
    y += 8;
    doc.text(`Email: ${user.email}`, 20, y);
    y += 8;
    const statusText = user.kycStatus === 'verified' ? 'Verifie' : user.kycStatus === 'submitted' ? 'En attente' : user.kycStatus;
    doc.text(`Statut KYC: ${statusText}`, 20, y);
    y += 8;
    doc.text(`Date de soumission: ${new Date(user.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, 20, y);
    y += 8;
    doc.text(`Date du rapport: ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, 20, y);
    y += 15;
    
    doc.setFontSize(16);
    doc.text("Documents Fournis", 20, y);
    y += 10;
    
    doc.setFontSize(12);
    doc.text(user.kycIdFront ? "Piece d'identite (Recto): Fournie" : "Piece d'identite (Recto): Non fournie", 20, y);
    y += 8;
    doc.text(user.kycIdBack ? "Piece d'identite (Verso): Fournie" : "Piece d'identite (Verso): Non fournie", 20, y);
    y += 8;
    doc.text(user.kycSelfie ? "Selfie de verification: Fourni" : "Selfie de verification: Non fourni", 20, y);
    y += 20;
    
    doc.setFontSize(10);
    doc.text("Document genere automatiquement par BKApay", pageWidth / 2, 280, { align: "center" });
    
    doc.save(`KYC_${user.firstName}_${user.lastName}_${new Date().getTime()}.pdf`);
    
    toast({
      title: "Telechargement lance",
      description: `PDF de ${user.firstName} ${user.lastName} en cours de generation...`,
    });
  };

  const filteredUsers = useMemo(() => {
    if (!diagnosticData?.users) return [];
    if (!searchQuery.trim()) return diagnosticData.users;
    
    const query = searchQuery.toLowerCase().trim();
    
    const matchedByUserInfo = diagnosticData.users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
    
    const matchingTransactions = diagnosticData.transactions?.filter(
      (t) => (t.paydunyaToken && t.paydunyaToken.toLowerCase().includes(query)) ||
             t.id.toLowerCase().includes(query)
    ) || [];
    
    const userIdsFromTransactions = new Set(matchingTransactions.map(t => t.userId));
    const matchedByToken = diagnosticData.users.filter(u => userIdsFromTransactions.has(u.id));
    
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
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Complete</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">En attente</Badge>;
      case "failed":
        return <Badge variant="destructive">Echoue</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"><BadgeCheck className="h-3 w-3 mr-1" />Verifie</Badge>;
      case "submitted":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejete</Badge>;
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
      <div className="flex items-center justify-between flex-wrap gap-4">
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
            <h1 className="text-2xl font-bold">Diagnostic Base de Donnees</h1>
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
            <CardTitle className="text-sm font-medium">KYC Verifies</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-verified-users">
              {diagnosticData?.verifiedKyc?.length || 0}
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
            <CardTitle className="text-sm font-medium">Total Depots</CardTitle>
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Utilisateurs ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="kyc-pending" data-testid="tab-kyc-pending">
            <Clock className="h-4 w-4 mr-2" />
            KYC en Attente ({diagnosticData?.pendingKyc?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="kyc-verified" data-testid="tab-kyc-verified">
            <BadgeCheck className="h-4 w-4 mr-2" />
            Historique KYC ({diagnosticData?.verifiedKyc?.length || 0})
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
                placeholder="Rechercher par nom, prenom, email ou token..."
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
                Utilisateurs tries par solde (du plus grand au plus petit)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer flex-wrap gap-2"
                      onClick={() => setSelectedUser(user)}
                      data-testid={`row-user-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2 flex-wrap">
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
                      <div className="flex items-center gap-4 flex-wrap">
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
                      Aucun utilisateur trouve
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc-pending" className="space-y-4">
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
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer flex-wrap gap-2"
                      onClick={() => setSelectedKycUser(user)}
                      data-testid={`row-kyc-pending-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <FileCheck className="h-8 w-8 text-yellow-500" />
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                          <Clock className="h-3 w-3 mr-1" />
                          En attente
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Soumis le {formatDate(user.createdAt)}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadKycPdf(user);
                          }}
                          data-testid={`button-download-pdf-pending-${user.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button size="icon" variant="ghost" data-testid={`button-view-kyc-pending-${user.id}`}>
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

        <TabsContent value="kyc-verified" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des KYC Verifiees</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {diagnosticData?.verifiedKyc?.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer flex-wrap gap-2"
                      onClick={() => setSelectedKycUser(user)}
                      data-testid={`row-kyc-verified-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <BadgeCheck className="h-8 w-8 text-green-500" />
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verifie
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Inscrit le {formatDate(user.createdAt)}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadKycPdf(user);
                          }}
                          data-testid={`button-download-pdf-verified-${user.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button size="icon" variant="ghost" data-testid={`button-view-kyc-verified-${user.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!diagnosticData?.verifiedKyc || diagnosticData.verifiedKyc.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p>Aucun utilisateur verifie pour le moment</p>
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
                      className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-2"
                      data-testid={`row-transaction-${transaction.id}`}
                    >
                      <div className="flex items-center gap-4">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <div className="font-medium capitalize">
                            {transaction.type === "deposit" && "Depot"}
                            {transaction.type === "withdrawal" && "Retrait"}
                            {transaction.type === "payment_link" && "Lien de paiement"}
                            {transaction.type === "merchant_link" && "Lien marchand"}
                            {transaction.type === "api_payment" && "Paiement API"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.customerName || "Client anonyme"} 
                            {transaction.operator && ` - ${transaction.operator.toUpperCase()}`}
                            {transaction.country && ` (${transaction.country})`}
                          </div>
                          {transaction.paydunyaToken && (
                            <div className="text-xs text-muted-foreground font-mono">
                              Token: {transaction.paydunyaToken.substring(0, 20)}...
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
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
                      Aucune transaction trouvee
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
              Details de {selectedUser?.firstName} {selectedUser?.lastName}
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
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg text-sm flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(t.type)}
                          <div>
                            <div className="font-medium capitalize">
                              {t.type === "deposit" && "Depot"}
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
                        <div className="flex items-center gap-2 flex-wrap">
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

      <Dialog open={!!selectedKycUser} onOpenChange={() => { setSelectedKycUser(null); setRejectionReason(""); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Verification KYC - {selectedKycUser?.firstName} {selectedKycUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          {selectedKycUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="font-medium">{selectedKycUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut</label>
                  <div className="mt-1">{getKycStatusBadge(selectedKycUser.kycStatus)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date de soumission</label>
                  <p>{formatDate(selectedKycUser.createdAt)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Documents fournis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedKycUser.kycIdFront && (
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-3">Piece d'identite (Recto)</p>
                      <img
                        src={selectedKycUser.kycIdFront}
                        alt="ID Front"
                        className="w-full h-48 object-contain rounded bg-muted"
                      />
                    </div>
                  )}
                  {selectedKycUser.kycIdBack && (
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-3">Piece d'identite (Verso)</p>
                      <img
                        src={selectedKycUser.kycIdBack}
                        alt="ID Back"
                        className="w-full h-48 object-contain rounded bg-muted"
                      />
                    </div>
                  )}
                  {selectedKycUser.kycSelfie && (
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-3">Selfie</p>
                      <img
                        src={selectedKycUser.kycSelfie}
                        alt="Selfie"
                        className="w-full h-48 object-contain rounded bg-muted"
                      />
                    </div>
                  )}
                </div>
              </div>

              {selectedKycUser.kycStatus === "submitted" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Raison de rejet (optionnel)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Expliquez pourquoi vous rejetez cette demande KYC..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="min-h-24"
                      data-testid="textarea-rejection-reason"
                    />
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => { setSelectedKycUser(null); setRejectionReason(""); }}
                  data-testid="button-close-kyc-modal"
                >
                  Fermer
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => downloadKycPdf(selectedKycUser)}
                  data-testid="button-download-kyc-pdf"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger PDF
                </Button>

                {selectedKycUser.kycStatus === "submitted" && (
                  <>
                    <Button
                      variant="default"
                      onClick={() => approveMutation.mutate(selectedKycUser.id)}
                      disabled={approveMutation.isPending}
                      data-testid="button-approve-kyc"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {approveMutation.isPending ? "Validation..." : "Valider KYC"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate(selectedKycUser.id)}
                      disabled={rejectMutation.isPending || !rejectionReason.trim()}
                      data-testid="button-reject-kyc"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {rejectMutation.isPending ? "Rejet..." : "Rejeter KYC"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
