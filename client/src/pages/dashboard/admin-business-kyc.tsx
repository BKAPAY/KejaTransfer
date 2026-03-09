import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminBusinessKyc() {
  const [, setLocation] = useLocation();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const kycUsers = users.filter(u => u.kycStatus === "submitted" || u.kycStatus === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Vérifications KYC Entreprise</h1>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : kycUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Aucun dossier en attente
                </TableCell>
              </TableRow>
            ) : (
              kycUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.businessName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.kycStatus === "submitted" ? "secondary" : "outline"}>
                      {user.kycStatus === "submitted" ? "Soumis" : "En attente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/dashboard/admin/business/kyc/${user.id}`)}
                      data-testid={`button-examine-kyc-${user.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Examiner
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

