import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Building2, Mail, Shield, CheckCircle, Clock, XCircle } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function KycStatusBadge({ status }: { status: string }) {
  if (status === "verified") return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      <CheckCircle className="w-3 h-3 mr-1" /> Vérifié
    </Badge>
  );
  if (status === "submitted") return (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      <Clock className="w-3 h-3 mr-1" /> En cours d'examen
    </Badge>
  );
  if (status === "rejected") return (
    <Badge variant="destructive">
      <XCircle className="w-3 h-3 mr-1" /> Rejeté
    </Badge>
  );
  return (
    <Badge variant="secondary">
      <Clock className="w-3 h-3 mr-1" /> En attente
    </Badge>
  );
}

export default function BusinessProfile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Profil Entreprise</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informations de l'entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="font-medium">{user?.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prénom</p>
              <p className="font-medium">{user?.firstName}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Nom de l'entreprise</p>
              <p className="font-medium">{user?.businessName || "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Vérification KYC
          </CardTitle>
          <CardDescription>
            Votre identité et vos documents d'entreprise doivent être vérifiés pour utiliser toutes les fonctionnalités.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Statut de vérification</span>
            <KycStatusBadge status={user?.kycStatus || "pending"} />
          </div>

          {user?.kycStatus === "rejected" && user.kycRejectionReason && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">Motif de rejet :</p>
              <p className="text-sm text-destructive mt-1">{user.kycRejectionReason}</p>
            </div>
          )}

          {(user?.kycStatus === "pending" || user?.kycStatus === "rejected") && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-3">
                Documents requis :
              </p>
              <ul className="text-sm space-y-1 mb-4">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  Pièce d'identité (passeport ou carte nationale)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  Document d'entreprise (registre de commerce, etc.)
                </li>
              </ul>
              <Button
                onClick={() => setLocation("/dashboard/kyc")}
                data-testid="button-kyc-verify"
              >
                Soumettre les documents
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
