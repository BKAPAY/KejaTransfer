import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Check, X, ChevronLeft, FileText, MapPin } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminBusinessKyc() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [kycDialogOpen, setKycDialogOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const kycUsers = users.filter(u => u.kycStatus === 'submitted' || u.kycStatus === 'pending');

  const verifyMutation = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string, status: string, reason?: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/kyc`, { status, rejectionReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      setKycDialogOpen(false);
      toast({ title: "Succès", description: "Statut KYC mis à jour" });
    },
  });

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
              <TableHead>Soumis le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : kycUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun dossier en attente
                </TableCell>
              </TableRow>
            ) : (
              kycUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.businessName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.kycStatus}</Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setKycDialogOpen(true);
                      }}
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

      <Dialog open={kycDialogOpen} onOpenChange={setKycDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Examen KYC : {selectedUser?.businessName}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents d'entreprise
              </h3>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                {selectedUser?.kycIdFront ? (
                  <img src={selectedUser.kycIdFront} alt="ID Front" className="max-h-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Pièce d'identité (Recto)</p>
                )}
              </div>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                {selectedUser?.kycIdBack ? (
                  <img src={selectedUser.kycIdBack} alt="ID Back" className="max-h-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Pièce d'identité (Verso)</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Localisation & Activité
              </h3>
              <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
                <p><strong>Description :</strong> {selectedUser?.kycActivityDescription}</p>
                <p><strong>Adresse :</strong> {selectedUser?.kycAddress}</p>
                <p><strong>Coordonnées :</strong> {selectedUser?.kycLatitude}, {selectedUser?.kycLongitude}</p>
              </div>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                {selectedUser?.kycSelfie ? (
                  <img src={selectedUser.kycSelfie} alt="Selfie" className="max-h-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Photo de l'administrateur</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button 
              variant="destructive"
              onClick={() => {
                const reason = prompt("Raison du rejet :");
                if (reason) verifyMutation.mutate({ userId: selectedUser!.id, status: 'rejected', reason });
              }}
              disabled={verifyMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" /> Rejeter
            </Button>
            <Button 
              variant="default"
              onClick={() => {
                if (confirm("Approuver ce compte entreprise ?")) {
                  verifyMutation.mutate({ userId: selectedUser!.id, status: 'verified' });
                }
              }}
              disabled={verifyMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" /> Approuver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
