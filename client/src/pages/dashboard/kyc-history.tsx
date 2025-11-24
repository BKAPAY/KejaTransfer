import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, X, ArrowLeft } from "lucide-react";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";

export default function KycHistoryPage() {
  const [, navigate] = useLocation();

  const { data: submissions } = useQuery({
    queryKey: ["/api/admin/kyc-submissions"],
  });

  const approvedSubmissions = (submissions as User[] || []).filter(
    (u: User) => u.kycStatus === "verified"
  );

  const rejectedSubmissions = (submissions as User[] || []).filter(
    (u: User) => u.kycStatus === "rejected"
  );

  const renderSubmissionCard = (user: User) => (
    <Card key={user.id} className="overflow-hidden" data-testid={`kyc-history-card-${user.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {user.firstName} {user.lastName}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(user.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
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

      <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="approved" data-testid="tab-kyc-approved">
            Approuvées ({approvedSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-kyc-rejected">
            Rejetées ({rejectedSubmissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-4 mt-4">
          {approvedSubmissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400" />
                <p className="text-muted-foreground">Aucune vérification approuvée</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {approvedSubmissions.map((user: User) => renderSubmissionCard(user))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4 mt-4">
          {rejectedSubmissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <X className="w-12 h-12 mx-auto mb-3 text-red-600 dark:text-red-400" />
                <p className="text-muted-foreground">Aucune vérification rejetée</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rejectedSubmissions.map((user: User) => renderSubmissionCard(user))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
