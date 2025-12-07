import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, X, Download, FileText, ArrowLeft, Search, BadgeCheck, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";
import html2pdf from "html2pdf.js";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

type PartialUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'kycStatus' | 'kycRejectionReason' | 'createdAt' | 'balance' | 'isAdmin' | 'suspended'>;

export default function KycVerificationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: submissions, isLoading, refetch } = useQuery<PartialUser[]>({
    queryKey: ["/api/admin/kyc-submissions"],
  });

  const { data: selectedUserDetails, isLoading: isLoadingDetails } = useQuery<User>({
    queryKey: ["/api/admin/user", selectedUserId, "profile"],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const response = await fetch(`/api/admin/user/${selectedUserId}/profile`);
      if (!response.ok) throw new Error("Failed to fetch user details");
      return response.json();
    },
  });

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (!searchQuery.trim()) return submissions;
    
    const query = searchQuery.toLowerCase().trim();
    return submissions.filter((user) => {
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
      toast({ title: "Succes", description: "KYC approuvee" });
      setSelectedUserId(null);
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
      toast({ title: "Succes", description: "KYC rejetee" });
      setSelectedUserId(null);
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
        <h1 style="font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #228B22; padding-bottom: 10px;">Verification KYC</h1>
        
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
            <p style="font-weight: bold; margin-bottom: 8px;">Piece d'identite (Recto)</p>
            <img src="${user.kycIdFront}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
          </div>
        ` : ""}
        
        ${user.kycIdBack ? `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <p style="font-weight: bold; margin-bottom: 8px;">Piece d'identite (Verso)</p>
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verifie</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejete</Badge>;
      case "submitted":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">En attente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectedUserId ? setSelectedUserId(null) : navigate("/dashboard/management")}
          data-testid="button-back-to-management"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verification KYC</h1>
          <p className="text-sm text-muted-foreground">Gerer les demandes de verification d'identite</p>
        </div>
      </div>

      {!selectedUserId ? (
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
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Chargement...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery ? `Aucune demande trouvee pour "${searchQuery}"` : "Aucune demande KYC"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSubmissions.map((user) => (
                <Card
                  key={user.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedUserId(user.id)}
                  data-testid={`kyc-card-${user.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {user.firstName} {user.lastName}
                          </CardTitle>
                          {getStatusBadge(user.kycStatus)}
                        </div>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
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
      ) : isLoadingDetails ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Chargement des documents...</p>
        </div>
      ) : selectedUserDetails ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>
                      {selectedUserDetails.firstName} {selectedUserDetails.lastName}
                    </CardTitle>
                    {getStatusBadge(selectedUserDetails.kycStatus)}
                  </div>
                  <CardDescription>{selectedUserDetails.email}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPdf(selectedUserDetails)}
                  data-testid="button-download-user-pdf"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Telecharger PDF
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Documents fournis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedUserDetails.kycIdFront && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Piece d'identite (Recto)</p>
                    <img
                      src={selectedUserDetails.kycIdFront}
                      alt="ID Front"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUserDetails.kycIdBack && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Piece d'identite (Verso)</p>
                    <img
                      src={selectedUserDetails.kycIdBack}
                      alt="ID Back"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUserDetails.kycSelfie && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Selfie</p>
                    <img
                      src={selectedUserDetails.kycSelfie}
                      alt="Selfie"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            {selectedUserDetails.kycStatus === "submitted" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Raison de rejet (optionnel)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Indiquez la raison du rejet si necessaire..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    data-testid="textarea-rejection-reason"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => approveMutation.mutate(selectedUserDetails.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="button-approve-kyc"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Approuver
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate(selectedUserDetails.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1"
                      data-testid="button-reject-kyc"
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Rejeter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedUserDetails.kycRejectionReason && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-base text-red-600 dark:text-red-400">Raison du rejet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selectedUserDetails.kycRejectionReason}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">Utilisateur non trouve</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
