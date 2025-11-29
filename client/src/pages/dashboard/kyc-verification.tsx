import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, X, Download, FileText, ArrowLeft, Search, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";
import html2pdf from "html2pdf.js";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function KycVerificationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: submissions, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/kyc-submissions"],
  });

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (!searchQuery.trim()) return submissions as User[];
    
    const query = searchQuery.toLowerCase().trim();
    return (submissions as User[]).filter((user: User) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [submissions, searchQuery]);

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
        <h1 style="font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #228B22; padding-bottom: 10px;">Vérification KYC</h1>
        
        <div style="margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Utilisateur:</strong> ${user.firstName} ${user.lastName}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 5px 0;"><strong>Statut:</strong> ${user.kycStatus}</p>
          <p style="margin: 5px 0;"><strong>Date de soumission:</strong> ${new Date(user.createdAt).toLocaleDateString("fr-FR")}</p>
          ${user.kycRejectionReason ? `<p style="margin: 5px 0; color: #d32f2f;"><strong>Raison de rejet:</strong> ${user.kycRejectionReason}</p>` : ""}
        </div>
        
        <h2 style="font-size: 18px; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Documents fournis</h2>
        
        ${user.kycIdFront ? `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <p style="font-weight: bold; margin-bottom: 8px;">Pièce d'identité (Recto)</p>
            <img src="${user.kycIdFront}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
          </div>
        ` : ""}
        
        ${user.kycIdBack ? `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <p style="font-weight: bold; margin-bottom: 8px;">Pièce d'identité (Verso)</p>
            <img src="${user.kycIdBack}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
          </div>
        ` : ""}
        
        ${user.kycSelfie ? `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <p style="font-weight: bold; margin-bottom: 8px;">Selfie</p>
            <img src="${user.kycSelfie}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
          </div>
        ` : ""}
      </div>
    `;
    
    const options = {
      margin: 10,
      filename: `KYC_${user.email}_${new Date().getTime()}.pdf`,
      image: { type: "png" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { orientation: "portrait" as const, unit: "mm", format: "a4" },
    };
    html2pdf().set(options).from(element).save();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard/management")}
          data-testid="button-back-to-management"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vérification KYC</h1>
          <p className="text-sm text-muted-foreground">Gérer les demandes de vérification d'identité</p>
        </div>
      </div>

      {!selectedUser ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email ou nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-kyc-verification"
            />
          </div>
          
          {isLoading ? (
            <div className="text-center py-12">Chargement...</div>
          ) : filteredSubmissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery ? `Aucune demande trouvée pour "${searchQuery}"` : "Aucune demande KYC en attente"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSubmissions.map((user: User) => (
                <Card
                  key={user.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedUser(user)}
                  data-testid={`kyc-card-${user.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">
                            {user.firstName} {user.lastName}
                          </CardTitle>
                          {user.kycStatus === "verified" && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1">
                              <BadgeCheck className="w-3 h-3" />
                              Approuvé
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPdf(user);
                        }}
                        data-testid={`button-download-pdf-${user.id}`}
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </CardTitle>
                    {selectedUser.kycStatus === "verified" && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1">
                        <BadgeCheck className="w-3 h-3" />
                        Approuvé
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{selectedUser.email}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPdf(selectedUser)}
                  data-testid="button-download-user-pdf"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Télécharger PDF
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Documents fournis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedUser.kycIdFront && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Pièce d'identité (Recto)</p>
                    <img
                      src={selectedUser.kycIdFront}
                      alt="ID Front"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUser.kycIdBack && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Pièce d'identité (Verso)</p>
                    <img
                      src={selectedUser.kycIdBack}
                      alt="ID Back"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUser.kycSelfie && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Selfie</p>
                    <img
                      src={selectedUser.kycSelfie}
                      alt="Selfie"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
              </div>
            </div>

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
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedUser(null);
                setRejectionReason("");
              }}
              data-testid="button-back-to-list"
            >
              Retour à la liste
            </Button>
            <Button
              variant="default"
              onClick={() => approveMutation.mutate(selectedUser.id)}
              disabled={approveMutation.isPending}
              data-testid="button-approve-user-kyc"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approuver KYC
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(selectedUser.id)}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              data-testid="button-reject-user-kyc"
            >
              <X className="w-4 h-4 mr-2" />
              Rejeter KYC
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
