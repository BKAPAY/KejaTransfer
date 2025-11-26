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
import html2pdf from "html2pdf.js";
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
    const element = document.createElement("div");
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>Vérification KYC</h1>
        <p><strong>Utilisateur:</strong> ${user.firstName} ${user.lastName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Statut:</strong> ${user.kycStatus}</p>
        <p><strong>Date de soumission:</strong> ${new Date(user.createdAt).toLocaleDateString("fr-FR")}</p>
        ${user.kycRejectionReason ? `<p><strong>Raison de rejet:</strong> ${user.kycRejectionReason}</p>` : ""}
        <br/>
        <h2>Documents</h2>
        ${user.kycIdFront ? `<p><strong>Pièce d'identité (Recto):</strong> Fournie</p>` : ""}
        ${user.kycIdBack ? `<p><strong>Pièce d'identité (Verso):</strong> Fournie</p>` : ""}
        ${user.kycSelfie ? `<p><strong>Selfie:</strong> Fourni</p>` : ""}
      </div>
    `;
    
    const options = {
      margin: 10,
      filename: `KYC_${user.email}_${new Date().getTime()}.pdf`,
      image: { type: "png" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "portrait" as const, unit: "mm", format: "a4" },
    };
    html2pdf().set(options).from(element).save();
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
