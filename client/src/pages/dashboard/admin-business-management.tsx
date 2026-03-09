import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Transaction, BusinessWallet } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Wallet, History, Trash2, Power, ArrowUpCircle, ArrowDownCircle, ChevronLeft } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminBusinessManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const depositMutation = useMutation({
    mutationFn: async ({ userId, amount, country }: { userId: string, amount: number, country: string }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/wallet/deposit`, { amount, country });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      setDepositDialogOpen(false);
      setAmount("");
      toast({ title: "Succès", description: "Dépôt effectué avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ userId, amount, country }: { userId: string, amount: number, country: string }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/wallet/withdraw`, { amount, country });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      setWithdrawDialogOpen(false);
      setAmount("");
      toast({ title: "Succès", description: "Retrait effectué avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const payoutToggleMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string, enabled: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/business/users/${userId}/payout-toggle`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      toast({ title: "Succès", description: "Statut Payout mis à jour" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/business/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      toast({ title: "Succès", description: "Utilisateur supprimé" });
    },
  });

  const filteredUsers = users.filter(user => 
    user.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Gestion des comptes entreprise</h1>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par nom ou email..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>Payout API</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.businessName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.kycStatus === 'verified' ? 'default' : user.kycStatus === 'rejected' ? 'destructive' : 'secondary'}>
                      {user.kycStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.payoutApiEnabled ? 'default' : 'secondary'}>
                      {user.payoutApiEnabled ? 'Activé' : 'Désactivé'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setDepositDialogOpen(true);
                      }}
                      title="Dépôt"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setWithdrawDialogOpen(true);
                      }}
                      title="Retrait"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => payoutToggleMutation.mutate({ userId: user.id, enabled: !user.payoutApiEnabled })}
                      title="Toggle Payout"
                    >
                      <Power className={`h-4 w-4 ${user.payoutApiEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setLocation(`/dashboard/admin/user/${user.id}/history`)}
                      title="Transactions"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Supprimer ce compte entreprise ?")) {
                          deleteUserMutation.mutate(user.id);
                        }
                      }}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dépôt Manuel - {selectedUser?.businessName}</DialogTitle>
            <DialogDescription>Créditer le portefeuille d'un pays spécifique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pays</label>
              <Select onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BJ">Bénin (XOF)</SelectItem>
                  <SelectItem value="TG">Togo (XOF)</SelectItem>
                  <SelectItem value="CI">Côte d'Ivoire (XOF)</SelectItem>
                  <SelectItem value="SN">Sénégal (XOF)</SelectItem>
                  <SelectItem value="CD-CDF">RD Congo (CDF)</SelectItem>
                  <SelectItem value="CD-USD">RD Congo (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant</label>
              <Input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="Montant à déposer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={() => depositMutation.mutate({ 
                userId: selectedUser!.id, 
                amount: parseInt(amount), 
                country: selectedCountry 
              })}
              disabled={!amount || !selectedCountry || depositMutation.isPending}
            >
              Confirmer le dépôt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retrait Manuel - {selectedUser?.businessName}</DialogTitle>
            <DialogDescription>Débiter le portefeuille d'un pays spécifique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pays</label>
              <Select onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BJ">Bénin (XOF)</SelectItem>
                  <SelectItem value="TG">Togo (XOF)</SelectItem>
                  <SelectItem value="CI">Côte d'Ivoire (XOF)</SelectItem>
                  <SelectItem value="SN">Sénégal (XOF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant</label>
              <Input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="Montant à retirer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>Annuler</Button>
            <Button 
              variant="destructive"
              onClick={() => withdrawMutation.mutate({ 
                userId: selectedUser!.id, 
                amount: parseInt(amount), 
                country: selectedCountry 
              })}
              disabled={!amount || !selectedCountry || withdrawMutation.isPending}
            >
              Confirmer le retrait
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
