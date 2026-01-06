import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, X, Download, FileText } from "lucide-react";
import type { User } from "@shared/schema";
import { jsPDF } from "jspdf";
import { queryClient } from "@/lib/queryClient";

export function KycVerificationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: submissions, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/kyc-submissions"],
    enabled: open,
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
      toast({ title: "Succès", description: "KYC approuvée" });
      setSelectedUser(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
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
      toast({ title: "Succès", description: "KYC rejetée" });
      setSelectedUser(null);
      setRejectionReason("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de rejeter la KYC", variant: "destructive" });
    },
  });

  const downloadPdf = (user: User) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    
    doc.setFontSize(20);
    doc.text("Verification KYC - BKApay", pageWidth / 2, y, { align: "center" });
    y += 15;
    
    doc.setFontSize(12);
    doc.text(`Utilisateur: ${user.firstName} ${user.lastName}`, 20, y);
    y += 8;
    doc.text(`Email: ${user.email}`, 20, y);
    y += 8;
    doc.text(`Statut: ${user.kycStatus}`, 20, y);
    y += 8;
    doc.text(`Date de soumission: ${new Date(user.createdAt).toLocaleDateString("fr-FR")}`, 20, y);
    y += 8;
    
    if (user.kycRejectionReason) {
      doc.text(`Raison de rejet: ${user.kycRejectionReason}`, 20, y);
      y += 8;
    }
    
    y += 10;
    doc.setFontSize(16);
    doc.text("Documents", 20, y);
    y += 10;
    
    doc.setFontSize(12);
    if (user.kycIdFront) {
      doc.text("Piece d'identite (Recto): Fournie", 20, y);
      y += 8;
    }
    if (user.kycIdBack) {
      doc.text("Piece d'identite (Verso): Fournie", 20, y);
      y += 8;
    }
    if (user.kycSelfie) {
      doc.text("Selfie: Fourni", 20, y);
    }
    
    doc.save(`KYC_${user.email}_${new Date().getTime()}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vérification KYC</DialogTitle>
          <DialogDescription>
            Gérer les demandes de vérification d'identité en attente
          </DialogDescription>
        </DialogHeader>

        {!selectedUser ? (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : !submissions || (submissions as any[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune demande KYC en attente
              </div>
            ) : (
              <div className="grid gap-4">
                {(submissions as User[]).map((user: User) => (
                  <Card key={user.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedUser(user)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {user.firstName} {user.lastName}
                          </CardTitle>
                          <CardDescription>{user.email}</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPdf(user);
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Soumis le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold">
                {selectedUser.firstName} {selectedUser.lastName}
              </h3>
              <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3">Documents fournis</h4>
                <div className="grid grid-cols-1 gap-4">
                  {selectedUser.kycIdFront && (
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Pièce d'identité (Recto)</p>
                      <img
                        src={selectedUser.kycIdFront}
                        alt="ID Front"
                        className="max-h-64 max-w-full object-contain"
                      />
                    </div>
                  )}
                  {selectedUser.kycIdBack && (
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Pièce d'identité (Verso)</p>
                      <img
                        src={selectedUser.kycIdBack}
                        alt="ID Back"
                        className="max-h-64 max-w-full object-contain"
                      />
                    </div>
                  )}
                  {selectedUser.kycSelfie && (
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Selfie</p>
                      <img
                        src={selectedUser.kycSelfie}
                        alt="Selfie"
                        className="max-h-64 max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Raison de rejet (optionnel)</label>
                <Textarea
                  placeholder="Expliquez pourquoi vous rejetez cette demande KYC..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUser(null);
                  setRejectionReason("");
                }}
              >
                Retour
              </Button>
              <Button
                variant="default"
                onClick={() => approveMutation.mutate(selectedUser.id)}
                disabled={approveMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approuver
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate(selectedUser.id)}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                <X className="w-4 h-4 mr-2" />
                Rejeter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadPdf(selectedUser)}
                className="ml-auto"
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
