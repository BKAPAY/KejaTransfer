import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Shield, CheckCircle, XCircle } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  BF: "Burkina Faso",
  GN: "Guinée",
  NE: "Niger",
  CM: "Cameroun",
  CD: "RD Congo",
  CG: "Congo-Brazzaville",
  TD: "Tchad",
  CF: "Centrafrique",
  GA: "Gabon",
  ML: "Mali",
  GM: "Gambie",
  RW: "Rwanda",
};

export default function AdminUserProfile() {
  const params = useParams<{ userId: string }>();
  const [location, setLocation] = useLocation();
  const userId = params.userId;
  const isBusinessContext = location.includes("/admin/business/");
  const backUrl = isBusinessContext ? "/dashboard/admin/business/management" : "/dashboard/management";

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const userCurrency = user?.country
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString("fr-FR")} ${userCurrency}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => setLocation(backUrl)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <p className="text-center text-muted-foreground">Utilisateur non trouvé</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => setLocation(backUrl)} className="mb-6" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la gestion
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profil de {user.firstName} {user.lastName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {user.kycStatus === "verified" && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Vérifié
              </Badge>
            )}
            {user.isAdmin && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </Badge>
            )}
            {user.suspended && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Suspendu
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nom complet</p>
                <p className="font-medium">{user.firstName} {user.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Pays
                </p>
                <p className="font-medium">{user.country ? COUNTRY_NAMES[user.country] || user.country : "Non défini"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde</p>
                <p className="font-bold text-xl">{formatAmount(user.balance)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date d'inscription
                </p>
                <p className="font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Statut KYC</p>
            <Badge variant={user.kycStatus === "verified" ? "default" : user.kycStatus === "pending" ? "secondary" : "outline"}>
              {user.kycStatus === "verified" ? "Vérifié" : user.kycStatus === "pending" ? "En attente" : "Non vérifié"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
