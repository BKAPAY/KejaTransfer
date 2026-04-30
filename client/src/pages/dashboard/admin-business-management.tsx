import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Transaction, COUNTRIES } from "@shared/schema";
import { CountryFlag } from "@/components/country-flag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Wallet, History, Trash2, Power, ArrowUpCircle, ArrowDownCircle,
  ChevronLeft, ChevronRight, User as UserIcon, Users, UserCheck, TrendingDown, TrendingUp,
  AlertCircle, Unlock, Check, X, RotateCcw, Monitor, Key, Globe, Banknote,
  CheckCircle2, Clock, Building2, Eye, ToggleLeft, ToggleRight, Percent, Loader2, Smartphone,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const BUSINESS_COUNTRIES = [
  "BJ", "CI", "SN", "TG", "BF", "ML", "GN", "NE", "CM", "CD",
  "TD", "CG", "CF", "GA", "RW", "GM", "GH", "KE", "TZ", "UG",
  "ZM", "MW", "MZ", "NG", "SL", "LS",
];

const WALLET_OPTIONS: { code: string; currency: string; name: string }[] = [
  ...BUSINESS_COUNTRIES.flatMap(code => {
    const c = COUNTRIES.find(cc => cc.code === code);
    if (!c) return [];
    const entries: { code: string; currency: string; name: string }[] = [
      { code, currency: c.currency, name: `${c.name} (${c.currency})` },
    ];
    if (code === "CD") {
      entries.push({ code: "CD", currency: "USD", name: "RD Congo (USD)" });
    }
    return entries;
  }),
];

interface BusinessStats {
  totalUsers: number;
  verifiedUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositsByCurrency: Record<string, number>;
  withdrawalsByCurrency: Record<string, number>;
}

interface CountryStat {
  country: string;
  currency: string;
  balance: number;
  walletCount: number;
  incomingCount: number;
  incomingTotal: number;
  outgoingCount: number;
  outgoingTotal: number;
}

interface SettlementAdmin {
  id: string;
  userId: string;
  walletCountry: string;
  walletCurrency: string;
  amount: number;
  status: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankName: string;
  bankSwiftBic: string;
  bankCountry: string;
  bankCurrency: string;
  settlementMethod: string | null;
  momoCountry: string | null;
  momoOperator: string | null;
  momoPhone: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  adminNotes: string | null;
  rejectionReason: string | null;
}

export default function AdminBusinessManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const initialTab = new URLSearchParams(search).get("tab") || "users";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab) setActiveTab(tab);
  }, [search]);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  const [amount, setAmount] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [unsuspendDialog, setUnsuspendDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });
  const [bankDetailDialog, setBankDetailDialog] = useState<{ open: boolean; user?: User }>({ open: false });
  const [momoDetailDialog, setMomoDetailDialog] = useState<{ open: boolean; user?: User }>({ open: false });
  const [validateDialog, setValidateDialog] = useState<{ open: boolean; settlement?: SettlementAdmin }>({ open: false });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; settlement?: SettlementAdmin }>({ open: false });
  const [validateBatchDialog, setValidateBatchDialog] = useState<{ open: boolean; settlements?: SettlementAdmin[] }>({ open: false });
  const [rejectBatchDialog, setRejectBatchDialog] = useState<{ open: boolean; settlements?: SettlementAdmin[] }>({ open: false });
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settlementFilter, setSettlementFilter] = useState<"pending" | "rejected" | "completed">("pending");

  const { data: stats, isLoading: statsLoading } = useQuery<BusinessStats>({
    queryKey: ["/api/admin/business/stats"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const { data: countryStats = [], isLoading: countryStatsLoading } = useQuery<CountryStat[]>({
    queryKey: ["/api/admin/business/country-stats"],
    enabled: activeTab === "countries",
  });

  const { data: settlements = [], isLoading: settlementsLoading } = useQuery<SettlementAdmin[]>({
    queryKey: ["/api/admin/settlements"],
    enabled: activeTab === "settlements",
  });

  const { data: pendingSettlementCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/settlements/pending-count"],
    refetchInterval: 30000,
  });

  const { data: walletCountrySettings, isLoading: walletSettingsLoading } = useQuery<{ disabled: string[] }>({
    queryKey: ["/api/admin/business/disabled-wallet-countries"],
    enabled: activeTab === "wallets",
  });
  const disabledWalletCountries: string[] = walletCountrySettings?.disabled ?? [];

  const toggleWalletCountryMutation = useMutation({
    mutationFn: async (country: string) => {
      const current = disabledWalletCountries;
      const updated = current.includes(country)
        ? current.filter((c) => c !== country)
        : [...current, country];
      const res = await apiRequest("PUT", "/api/admin/business/disabled-wallet-countries", { disabled: updated });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/business/disabled-wallet-countries"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/business/wallet-country-settings"] });
      toast({ title: "Mis à jour", description: "Statut du wallet modifié." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut.", variant: "destructive" });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async ({ userId, amount, country, currency }: { userId: string; amount: number; country: string; currency: string }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/wallet/deposit`, { amount, country, currency });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-stats"] });
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
      const res = await apiRequest("POST", `/api/admin/delete-user`, { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      setDeleteDialog({ open: false });
      toast({ title: "Compte supprime", description: "Le compte et toutes ses données ont été effacés définitivement." });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const validateSettlementMutation = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: string; adminNotes: string }) => {
      const res = await apiRequest("POST", `/api/admin/settlements/${id}/validate`, { adminNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/pending-count"] });
      setValidateDialog({ open: false });
      setSettlementNotes("");
      toast({ title: "Validé", description: "Le règlement a été validé avec succès." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const rejectSettlementMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const res = await apiRequest("POST", `/api/admin/settlements/${id}/reject`, { rejectionReason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/pending-count"] });
      setRejectDialog({ open: false });
      setSettlementNotes("");
      toast({ title: "Rejeté", description: "Le règlement a été rejeté. Le solde a été recrédité." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const validateBatchMutation = useMutation({
    mutationFn: async ({ settlements, adminNotes }: { settlements: SettlementAdmin[]; adminNotes: string }) => {
      for (const s of settlements) {
        const res = await apiRequest("POST", `/api/admin/settlements/${s.id}/validate`, { adminNotes });
        if (!res.ok) throw new Error(`Erreur sur ${s.walletCountry}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/pending-count"] });
      setValidateBatchDialog({ open: false });
      setSettlementNotes("");
      toast({ title: "Lot validé", description: "Tous les règlements du lot ont été validés." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const rejectBatchMutation = useMutation({
    mutationFn: async ({ settlements, rejectionReason }: { settlements: SettlementAdmin[]; rejectionReason: string }) => {
      for (const s of settlements) {
        const res = await apiRequest("POST", `/api/admin/settlements/${s.id}/reject`, { rejectionReason });
        if (!res.ok) throw new Error(`Erreur sur ${s.walletCountry}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/pending-count"] });
      setRejectBatchDialog({ open: false });
      setSettlementNotes("");
      toast({ title: "Lot rejeté", description: "Tous les règlements du lot ont été rejetés. Les soldes ont été recrédités." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const { data: searchResults = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/business/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/admin/business/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchQuery.trim().length > 0,
    staleTime: 10000,
  });

  const filteredUsers = searchQuery.trim()
    ? (() => {
        const localMatches = users.filter(user =>
          user.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const resultMap = new Map<string, User>();
        localMatches.forEach(u => resultMap.set(u.id, u));
        searchResults.forEach(u => resultMap.set(u.id, u));
        return Array.from(resultMap.values());
      })()
    : users;

  const formatAmount = (amount: number, currency: string = "XOF") => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " " + currency;
  };

  const pendingSettlements = settlements.filter(s => s.status === "pending");
  const completedSettlements = settlements.filter(s => s.status === "completed");
  const rejectedSettlements = settlements.filter(s => s.status === "rejected");

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

      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-1" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="countries" data-testid="tab-countries">
            <Globe className="w-4 h-4 mr-1" />
            Pays
          </TabsTrigger>
          <TabsTrigger value="wallets" data-testid="tab-wallets">
            <Wallet className="w-4 h-4 mr-1" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="settlements" data-testid="tab-settlements">
            <Banknote className="w-4 h-4 mr-1" />
            Reglements
            {(pendingSettlementCount?.count || 0) > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {pendingSettlementCount?.count}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
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
                              {(user as any).bankAccountNumber && (
                                <Badge variant="outline" className="text-xs">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  Banque
                                </Badge>
                              )}
                              {(user as any).momoPhone && (
                                <Badge variant="outline" className="text-xs">
                                  <Smartphone className="w-3 h-3 mr-1" />
                                  MOMO
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLocation(`/dashboard/admin/business/users/${user.id}/wallets`)}
                            data-testid={`button-view-wallets-${user.id}`}
                          >
                            <Banknote className="w-4 h-4 mr-1" />
                            Soldes
                          </Button>
                          {(user as any).bankAccountNumber && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setBankDetailDialog({ open: true, user })}
                              data-testid={`button-view-bank-${user.id}`}
                            >
                              <Building2 className="w-4 h-4 mr-1" />
                              Banque
                            </Button>
                          )}
                          {(user as any).momoPhone && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setMomoDetailDialog({ open: true, user })}
                              data-testid={`button-view-momo-${user.id}`}
                            >
                              <Smartphone className="w-4 h-4 mr-1" />
                              MOMO
                            </Button>
                          )}
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/dashboard/admin/business/users/${user.id}/fees`)}
                            data-testid={`button-fees-${user.id}`}
                          >
                            <Percent className="w-4 h-4 mr-1" />
                            Frais
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
        </TabsContent>

        <TabsContent value="countries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Fonds par pays
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countryStatsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border rounded-md p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-14 w-full rounded-md" />
                        <Skeleton className="h-14 w-full rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="space-y-3">
                {WALLET_OPTIONS.map((w) => {
                  const cd = COUNTRIES.find(c => c.code === w.code);
                  if (!cd) return null;
                  const cs = countryStats.find(s => s.country === w.code && s.currency === w.currency);
                  const incomingTotal = cs?.incomingTotal || 0;
                  const outgoingTotal = cs?.outgoingTotal || 0;
                  const toggleKey = w.code === "CD" && w.currency === "USD" ? "CD:USD" : w.code;
                  const isDisabled = disabledWalletCountries.includes(toggleKey);
                  return (
                    <div key={`${w.code}-${w.currency}`} className={`border rounded-md p-4 transition-opacity ${isDisabled ? "opacity-60" : ""}`} data-testid={`country-stat-${w.code}-${w.currency}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <CountryFlag code={w.code} size="md" />
                        <div>
                          <h4 className="font-semibold text-sm">{w.name}</h4>
                          <p className="text-xs text-muted-foreground">{w.currency}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-2 bg-muted rounded-md">
                          <div className="flex items-center gap-1 mb-1">
                            <TrendingDown className="w-3 h-3 text-blue-600" />
                            <span className="text-xs font-medium">Fonds entrants</span>
                          </div>
                          <p className="text-sm font-bold">{formatAmount(incomingTotal, w.currency)}</p>
                        </div>
                        <div className="p-2 bg-muted rounded-md">
                          <div className="flex items-center gap-1 mb-1">
                            <TrendingUp className="w-3 h-3 text-orange-600" />
                            <span className="text-xs font-medium">Fonds sortants</span>
                          </div>
                          <p className="text-sm font-bold">{formatAmount(outgoingTotal, w.currency)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Gestion des wallets par pays
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Activez ou désactivez les wallets par pays. Un wallet désactivé reste visible pour l'utilisateur mais apparaît flou et inactif en bas de la liste.
              </p>
            </CardHeader>
            <CardContent>
              {walletSettingsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-28 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : (
              <>
              <div className="mb-4 flex items-center gap-3 p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ToggleLeft className="w-4 h-4" /> = Désactivé (flou chez l'utilisateur)
                  </span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1">
                    <ToggleRight className="w-4 h-4 text-green-600" /> = Actif (visible normalement)
                  </span>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {disabledWalletCountries.length} désactivé{disabledWalletCountries.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {WALLET_OPTIONS.map((w) => {
                  const cd = COUNTRIES.find(c => c.code === w.code);
                  if (!cd) return null;
                  const toggleKey = w.code === "CD" && w.currency === "USD" ? "CD:USD" : w.code;
                  const isDisabled = disabledWalletCountries.includes(toggleKey);
                  return (
                    <div
                      key={`${w.code}-${w.currency}`}
                      className={`flex items-center justify-between gap-3 p-3 rounded-md border transition-opacity ${isDisabled ? "opacity-60" : ""}`}
                      data-testid={`wallet-manage-row-${w.code}-${w.currency}`}
                    >
                      <div className="flex items-center gap-3">
                        <CountryFlag code={w.code} size="md" />
                        <div>
                          <p className="text-sm font-medium leading-tight">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{w.currency}</p>
                        </div>
                        {isDisabled && (
                          <Badge variant="destructive" className="text-xs">Désactivé</Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isDisabled ? "outline" : "default"}
                        onClick={() => toggleWalletCountryMutation.mutate(toggleKey)}
                        disabled={toggleWalletCountryMutation.isPending}
                        data-testid={`button-wallet-toggle-${w.code}-${w.currency}`}
                        className="gap-1.5 min-w-[110px] justify-center"
                      >
                        {isDisabled ? (
                          <><ToggleLeft className="w-4 h-4" />Activer</>
                        ) : (
                          <><ToggleRight className="w-4 h-4" />Désactiver</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements" className="mt-4 space-y-4">
          {settlementsLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-md p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-9 w-28 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={settlementFilter === "pending" ? "secondary" : "ghost"}
                className={settlementFilter === "pending" ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
                onClick={() => setSettlementFilter("pending")}
                data-testid="filter-settlements-pending"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
                En attente
                {pendingSettlements.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-xs">{pendingSettlements.length}</Badge>
                )}
              </Button>
              <Button
                size="sm"
                variant={settlementFilter === "rejected" ? "secondary" : "ghost"}
                className={settlementFilter === "rejected" ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
                onClick={() => setSettlementFilter("rejected")}
                data-testid="filter-settlements-rejected"
              >
                <X className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                Rejeté
                {rejectedSettlements.length > 0 && (
                  <Badge variant="outline" className="ml-1.5 text-xs">{rejectedSettlements.length}</Badge>
                )}
              </Button>
              <Button
                size="sm"
                variant={settlementFilter === "completed" ? "secondary" : "ghost"}
                className={settlementFilter === "completed" ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
                onClick={() => setSettlementFilter("completed")}
                data-testid="filter-settlements-completed"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                Validé
                {completedSettlements.length > 0 && (
                  <Badge variant="outline" className="ml-1.5 text-xs">{completedSettlements.length}</Badge>
                )}
              </Button>
            </div>

            <Card>
              <CardContent className="pt-4">
                {(() => {
                  const source =
                    settlementFilter === "pending" ? pendingSettlements :
                    settlementFilter === "rejected" ? rejectedSettlements :
                    completedSettlements;

                  if (source.length === 0) {
                    const label =
                      settlementFilter === "pending" ? "en attente" :
                      settlementFilter === "rejected" ? "rejeté" : "validé";
                    return (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        Aucun règlement {label}
                      </div>
                    );
                  }

                  const buckets = new Map<string, SettlementAdmin[]>();
                  for (const s of source) {
                    const key = (s as any).batchId || s.id;
                    if (!buckets.has(key)) buckets.set(key, []);
                    buckets.get(key)!.push(s);
                  }

                  return (
                    <div className="divide-y">
                      {Array.from(buckets.entries())
                        .sort((a, b) => new Date(b[1][0].createdAt).getTime() - new Date(a[1][0].createdAt).getTime())
                        .map(([batchKey, items]) => {
                          const first = items[0];
                          const batchDate = new Date(first.createdAt);
                          const dateLabel = batchDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
                          const timeLabel = batchDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                          return (
                            <button
                              key={batchKey}
                              className="w-full text-left py-3 flex items-center justify-between gap-4 hover-elevate"
                              onClick={() => setLocation(`/dashboard/admin/settlement-batch/${first.userId}/${encodeURIComponent(batchKey)}`)}
                              data-testid={`batch-${settlementFilter}-${batchKey}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-semibold text-sm">{first.userName}</span>
                                  {items.length > 1 && (
                                    <Badge variant="outline" className="text-xs">{items.length} pays</Badge>
                                  )}
                                  {settlementFilter === "pending" && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Clock className="w-3 h-3 mr-1" />En attente
                                    </Badge>
                                  )}
                                  {settlementFilter === "rejected" && (
                                    <Badge variant="destructive" className="text-xs">
                                      <X className="w-3 h-3 mr-1" />Rejeté
                                    </Badge>
                                  )}
                                  {settlementFilter === "completed" && (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />Validé
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">{dateLabel} à {timeLabel}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {items.map(s => {
                                    const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                                    return cd ? <CountryFlag key={s.id} code={cd.code} size="xs" /> : null;
                                  })}
                                  <span className="text-xs text-muted-foreground">
                                    {items.map(s => COUNTRIES.find(c => c.code === s.walletCountry)?.name).filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                          );
                        })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={validateDialog.open} onOpenChange={(open) => { if (!open) { setValidateDialog({ open: false }); setSettlementNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider le règlement</DialogTitle>
            <DialogDescription>
              {validateDialog.settlement && (
                <span>
                  {validateDialog.settlement.userName} — {formatAmount(validateDialog.settlement.amount, validateDialog.settlement.walletCurrency)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <label className="text-sm font-medium">Notes de validation <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex : Virement effectué le 25/04/2026, référence TXN-XXXX..."
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              rows={4}
              data-testid="textarea-validate-notes"
            />
            <p className="text-xs text-muted-foreground">Ces notes seront visibles par l'utilisateur dans son historique de règlement.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidateDialog({ open: false }); setSettlementNotes(""); }}>Annuler</Button>
            <Button
              onClick={() => {
                if (!validateDialog.settlement || !settlementNotes.trim()) return;
                validateSettlementMutation.mutate({ id: validateDialog.settlement.id, adminNotes: settlementNotes.trim() });
              }}
              disabled={!settlementNotes.trim() || validateSettlementMutation.isPending}
              data-testid="button-confirm-validate"
            >
              {validateSettlementMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => { if (!open) { setRejectDialog({ open: false }); setSettlementNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le règlement</DialogTitle>
            <DialogDescription>
              {rejectDialog.settlement && (
                <span>
                  {rejectDialog.settlement.userName} — {formatAmount(rejectDialog.settlement.amount, rejectDialog.settlement.walletCurrency)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <label className="text-sm font-medium">Motif de rejet <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex : Documents manquants, informations bancaires incorrectes..."
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              rows={4}
              data-testid="textarea-reject-reason"
            />
            <p className="text-xs text-muted-foreground">Le solde sera recrédité automatiquement sur le wallet de l'utilisateur. Ce motif sera visible dans son historique.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false }); setSettlementNotes(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectDialog.settlement || !settlementNotes.trim()) return;
                rejectSettlementMutation.mutate({ id: rejectDialog.settlement.id, rejectionReason: settlementNotes.trim() });
              }}
              disabled={!settlementNotes.trim() || rejectSettlementMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectSettlementMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={validateBatchDialog.open} onOpenChange={(open) => { if (!open) { setValidateBatchDialog({ open: false }); setSettlementNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider le lot de règlements</DialogTitle>
            <DialogDescription>
              {validateBatchDialog.settlements && (
                <span>{validateBatchDialog.settlements[0].userName} — {validateBatchDialog.settlements.length} pays</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {validateBatchDialog.settlements && (
            <div className="py-2">
              <div className="space-y-1 mb-3 bg-muted rounded-md p-3">
                {validateBatchDialog.settlements.map(s => {
                  const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">{cd && <CountryFlag code={cd.code} size="xs" />}{cd?.name}</span>
                      <span className="font-bold">{formatAmount(s.amount, s.walletCurrency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes de validation <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex : Virement effectué le 25/04/2026, référence TXN-XXXX..."
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              rows={3}
              data-testid="textarea-validate-batch-notes"
            />
            <p className="text-xs text-muted-foreground">Ces notes seront visibles pour chaque règlement du lot.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidateBatchDialog({ open: false }); setSettlementNotes(""); }}>Annuler</Button>
            <Button
              onClick={() => {
                if (!validateBatchDialog.settlements || !settlementNotes.trim()) return;
                validateBatchMutation.mutate({ settlements: validateBatchDialog.settlements, adminNotes: settlementNotes.trim() });
              }}
              disabled={!settlementNotes.trim() || validateBatchMutation.isPending}
              data-testid="button-confirm-validate-batch"
            >
              {validateBatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Valider tout le lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectBatchDialog.open} onOpenChange={(open) => { if (!open) { setRejectBatchDialog({ open: false }); setSettlementNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le lot de règlements</DialogTitle>
            <DialogDescription>
              {rejectBatchDialog.settlements && (
                <span>{rejectBatchDialog.settlements[0].userName} — {rejectBatchDialog.settlements.length} pays</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {rejectBatchDialog.settlements && (
            <div className="py-2">
              <div className="space-y-1 mb-3 bg-muted rounded-md p-3">
                {rejectBatchDialog.settlements.map(s => {
                  const cd = COUNTRIES.find(c => c.code === s.walletCountry);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">{cd && <CountryFlag code={cd.code} size="xs" />}{cd?.name}</span>
                      <span className="font-bold">{formatAmount(s.amount, s.walletCurrency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Motif de rejet <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex : Documents manquants, informations bancaires incorrectes..."
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              rows={3}
              data-testid="textarea-reject-batch-reason"
            />
            <p className="text-xs text-muted-foreground">Tous les soldes seront recrédités automatiquement. Le motif sera visible pour chaque règlement.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectBatchDialog({ open: false }); setSettlementNotes(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectBatchDialog.settlements || !settlementNotes.trim()) return;
                rejectBatchMutation.mutate({ settlements: rejectBatchDialog.settlements, rejectionReason: settlementNotes.trim() });
              }}
              disabled={!settlementNotes.trim() || rejectBatchMutation.isPending}
              data-testid="button-confirm-reject-batch"
            >
              {rejectBatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
              Rejeter tout le lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {WALLET_OPTIONS.map((w) => (
                    <SelectItem key={`${w.code}:${w.currency}`} value={`${w.code}:${w.currency}`}>
                      <span className="flex items-center gap-1"><CountryFlag code={w.code} size="xs" /> {w.name}</span>
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
                const [country, currency] = selectedCountry.split(":");
                depositMutation.mutate({
                  userId: selectedUser!.id,
                  amount: parseInt(amount),
                  country,
                  currency
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
                  {WALLET_OPTIONS.map((w) => (
                    <SelectItem key={`${w.code}:${w.currency}`} value={`${w.code}:${w.currency}`}>
                      <span className="flex items-center gap-1"><CountryFlag code={w.code} size="xs" /> {w.name}</span>
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
                const [country, currency] = selectedCountry.split(":");
                withdrawMutation.mutate({
                  userId: selectedUser!.id,
                  amount: parseInt(amount),
                  country,
                  currency
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

      <Dialog open={bankDetailDialog.open} onOpenChange={(open) => setBankDetailDialog({ ...bankDetailDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Building2 className="w-5 h-5 inline mr-2" />
              Compte bancaire - {bankDetailDialog.user?.businessName || `${bankDetailDialog.user?.firstName} ${bankDetailDialog.user?.lastName}`}
            </DialogTitle>
          </DialogHeader>
          {bankDetailDialog.user && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Titulaire</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankAccountHolder || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Numero de compte</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankAccountNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Banque</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SWIFT/BIC</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankSwiftBic || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agence</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankBranchName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Code guichet</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankBranchSortCode || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Adresse agence</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankBranchAddress || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pays banque</p>
                  <p className="font-medium flex items-center gap-1">
                    {(() => { const bc = (bankDetailDialog.user as any).bankCountry; const cd = COUNTRIES.find(c => c.code === bc); return cd ? <><CountryFlag code={cd.code} size="xs" /> {cd.name}</> : (bc || "-"); })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Devise</p>
                  <p className="font-medium">{(bankDetailDialog.user as any).bankCurrency || "-"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={momoDetailDialog.open} onOpenChange={(open) => setMomoDetailDialog({ ...momoDetailDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Smartphone className="w-5 h-5 inline mr-2" />
              Mobile Money - {momoDetailDialog.user?.businessName || `${momoDetailDialog.user?.firstName} ${momoDetailDialog.user?.lastName}`}
            </DialogTitle>
          </DialogHeader>
          {momoDetailDialog.user && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Pays</p>
                  <p className="font-medium flex items-center gap-1">
                    {(() => {
                      const mc = (momoDetailDialog.user as any).momoCountry;
                      const cd = COUNTRIES.find(c => c.code === mc);
                      return cd ? <><CountryFlag code={cd.code} size="xs" /> {cd.name}</> : (mc || "-");
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Opérateur</p>
                  <p className="font-medium">{(momoDetailDialog.user as any).momoOperator || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Numéro</p>
                  <p className="font-medium text-base">{(momoDetailDialog.user as any).momoPhone || "-"}</p>
                </div>
              </div>
            </div>
          )}
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
