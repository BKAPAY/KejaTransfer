import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, ChevronLeft, Search, Clock, History, XCircle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function getStatusBadge(status: string | null) {
  switch (status) {
    case "submitted":
      return <Badge variant="secondary">En examen</Badge>;
    case "verified":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Vérifié</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejeté</Badge>;
    default:
      return <Badge variant="outline">En attente</Badge>;
  }
}

export default function AdminBusinessKyc() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const reapproveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", "/api/admin/approve-kyc", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      toast({
        title: "KYC réapprouvé",
        description: "Le dossier a été réapprouvé avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de réapprouver le dossier.",
        variant: "destructive",
      });
    },
  });

  const kycUsers = useMemo(() => {
    return users.filter(u =>
      u.kycStatus === "submitted" ||
      u.kycStatus === "verified" ||
      u.kycStatus === "rejected"
    );
  }, [users]);

  const pendingUsers = useMemo(() =>
    kycUsers.filter(u => u.kycStatus === "submitted"), [kycUsers]);

  const rejectedUsers = useMemo(() =>
    kycUsers.filter(u => u.kycStatus === "rejected"), [kycUsers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return kycUsers;
    const q = search.toLowerCase();
    return kycUsers.filter(u =>
      (u.businessName || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [kycUsers, search]);

  const filteredPending = useMemo(() => {
    if (!search.trim()) return pendingUsers;
    const q = search.toLowerCase();
    return pendingUsers.filter(u =>
      (u.businessName || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [pendingUsers, search]);

  const filteredRejected = useMemo(() => {
    if (!search.trim()) return rejectedUsers;
    const q = search.toLowerCase();
    return rejectedUsers.filter(u =>
      (u.businessName || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [rejectedUsers, search]);

  const KycTable = ({ rows, emptyMsg, showReapprove }: { rows: User[]; emptyMsg: string; showReapprove?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Entreprise</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Date de soumission</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              Chargement...
            </TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              {emptyMsg}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.businessName || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>{getStatusBadge(user.kycStatus)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(user.createdAt).toLocaleDateString("fr-FR")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {(showReapprove || user.kycStatus === "rejected") && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (confirm(`Réapprouver le dossier KYC de ${user.businessName || user.email} ?`)) {
                          reapproveMutation.mutate(user.id);
                        }
                      }}
                      disabled={reapproveMutation.isPending}
                      data-testid={`button-reapprove-kyc-${user.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Réapprouver
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLocation(`/dashboard/admin/business/kyc/${user.id}`)}
                    data-testid={`button-examine-kyc-${user.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Examiner
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Vérifications KYC Entreprise</h1>
            <p className="text-sm text-muted-foreground">
              {pendingUsers.length} dossier{pendingUsers.length !== 1 ? "s" : ""} en attente · {rejectedUsers.length} rejeté{rejectedUsers.length !== 1 ? "s" : ""} · {kycUsers.length} au total
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-kyc"
          />
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            En attente
            {pendingUsers.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejetés
            {rejectedUsers.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{rejectedUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historique complet
            <Badge variant="outline" className="ml-1 text-xs">{kycUsers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              <KycTable
                rows={filteredPending}
                emptyMsg="Aucun dossier en attente de vérification"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardContent className="p-0">
              <KycTable
                rows={filteredRejected}
                emptyMsg="Aucun dossier rejeté"
                showReapprove
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <KycTable
                rows={filtered}
                emptyMsg="Aucun dossier KYC trouvé"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
