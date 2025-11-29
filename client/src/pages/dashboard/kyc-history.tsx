import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { CheckCircle2, X, ArrowLeft, Search, Download, Clock, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";
import { useState } from "react";

export default function KycHistoryPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: submissions } = useQuery({
    queryKey: ["/api/admin/kyc-submissions"],
  });

  const approvedSubmissions = (submissions as User[] || []).filter(
    (u: User) => u.kycStatus === "verified"
  );

  const rejectedSubmissions = (submissions as User[] || []).filter(
    (u: User) => u.kycStatus === "rejected"
  );

  const pendingSubmissions = (submissions as User[] || []).filter(
    (u: User) => u.kycStatus === "submitted"
  );

  const filterBySearch = (users: User[]): User[] => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((u: User) => {
      const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
      const email = u.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  };

  const filteredApproved = filterBySearch(approvedSubmissions);
  const filteredRejected = filterBySearch(rejectedSubmissions);
  const filteredPending = filterBySearch(pendingSubmissions);

  const downloadKycPDF = (user: User) => {
    // Generate a simple text-based KYC record and download as text file
    const content = `FORMULAIRE DE VÉRIFICATION D'IDENTITÉ (KYC)
=====================================

Date de traitement: ${new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}

INFORMATIONS PERSONNELLES
----------------------------
Nom: ${user.lastName}
Prénom: ${user.firstName}
Email: ${user.email}

STATUT DE VÉRIFICATION
------------------------
Statut: ${user.kycStatus === "verified" ? "APPROUVÉE" : user.kycStatus === "rejected" ? "REJETÉE" : "EN ATTENTE"}
Date de soumission: ${new Date(user.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}

${user.kycRejectionReason ? `\nRAISON DU REJET\n------------------\n${user.kycRejectionReason}\n` : ""}

DOCUMENTS FOURNIS
------------------
- Photo d'identité recto: ${user.kycIdFront ? "✓ Fourni" : "✗ Non fourni"}
- Photo d'identité verso: ${user.kycIdBack ? "✓ Fourni" : "✗ Non fourni"}
- Selfie: ${user.kycSelfie ? "✓ Fourni" : "✗ Non fourni"}

Note: Ce document certifie que les documents d'identité ont été soumis et traités conformément aux processus de BKApay.`;

    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `KYC_${user.firstName}_${user.lastName}_${new Date().getTime()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const renderSubmissionCard = (user: User) => (
    <Card key={user.id} className="overflow-hidden" data-testid={`kyc-history-card-${user.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">
                {user.firstName} {user.lastName}
              </CardTitle>
              {user.kycStatus === "verified" && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1">
                  <BadgeCheck className="w-3 h-3" />
                  Vérifié
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(user.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {user.kycStatus === "verified" && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-950">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">Approuvée</span>
              </div>
            )}
            {user.kycStatus === "rejected" && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-950">
                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-xs font-medium text-red-700 dark:text-red-300">Rejetée</span>
              </div>
            )}
            {user.kycStatus === "submitted" && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-950">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">En attente</span>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadKycPDF(user)}
              className="gap-2"
              data-testid={`button-download-kyc-${user.id}`}
            >
              <Download className="w-3 h-3" />
              Télécharger
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {user.kycRejectionReason && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Raison du rejet:</strong> {user.kycRejectionReason}
            </p>
          </div>
        )}

        <div>
          <h4 className="font-semibold text-sm mb-3">Documents fournis</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {user.kycIdFront && (
              <div className="border rounded-lg p-2 overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground mb-2">ID Recto</p>
                <img
                  src={user.kycIdFront}
                  alt="ID Front"
                  className="w-full h-32 object-cover rounded"
                />
              </div>
            )}
            {user.kycIdBack && (
              <div className="border rounded-lg p-2 overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground mb-2">ID Verso</p>
                <img
                  src={user.kycIdBack}
                  alt="ID Back"
                  className="w-full h-32 object-cover rounded"
                />
              </div>
            )}
            {user.kycSelfie && (
              <div className="border rounded-lg p-2 overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground mb-2">Selfie</p>
                <img
                  src={user.kycSelfie}
                  alt="Selfie"
                  className="w-full h-32 object-cover rounded"
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
          <h1 className="text-2xl font-bold text-foreground">Historique KYC</h1>
          <p className="text-sm text-muted-foreground">Vérifications approuvées et rejetées</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, prénom ou email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-kyc"
        />
      </div>

      <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="approved" data-testid="tab-kyc-approved">
            Approuvées ({filteredApproved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-kyc-rejected">
            Rejetées ({filteredRejected.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-kyc-pending">
            En attente ({filteredPending.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-4 mt-4">
          {filteredApproved.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucune vérification approuvée trouvée" : "Aucune vérification approuvée"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredApproved.map((user: User) => renderSubmissionCard(user))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4 mt-4">
          {filteredRejected.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <X className="w-12 h-12 mx-auto mb-3 text-red-600 dark:text-red-400" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucune vérification rejetée trouvée" : "Aucune vérification rejetée"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRejected.map((user: User) => renderSubmissionCard(user))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {filteredPending.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-600 dark:text-yellow-400" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucune vérification en attente trouvée" : "Aucune vérification en attente"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPending.map((user: User) => renderSubmissionCard(user))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
