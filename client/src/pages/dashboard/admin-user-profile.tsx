import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Shield, CheckCircle, XCircle, PlusCircle, MinusCircle } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustDir, setAdjustDir] = useState<"credit" | "debit">("credit");

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const balanceAdjustMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseInt(adjustAmount, 10);
      if (isNaN(parsed) || parsed <= 0) throw new Error("Montant invalide");
      const finalAmount = adjustDir === "credit" ? parsed : -parsed;
      const res = await apiRequest("POST", `/api/admin/user/${userId}/balance-adjust`, {
        amount: finalAmount,
        reason: adjustReason || "Ajustement manuel admin",
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Solde ajusté",
        description: `Solde mis à jour : ${data.previousBalance.toLocaleString("fr-FR")} → ${data.newBalance.toLocaleString("fr-FR")} ${userCurrency}`,
      });
      setAdjustAmount("");
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err.message || "Impossible d'ajuster le solde",
        variant: "destructive",
      });
    },
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
    <div className="container mx-auto p-6 max-w-4xl space-y-4">
      <Button variant="ghost" onClick={() => setLocation(backUrl)} className="mb-2" data-testid="button-back">
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

          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Ajustement manuel du solde</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={adjustDir === "credit" ? "default" : "outline"}
                onClick={() => setAdjustDir("credit")}
                data-testid="button-adjust-credit"
              >
                <PlusCircle className="w-3 h-3 mr-1" /> Créditer
              </Button>
              <Button
                size="sm"
                variant={adjustDir === "debit" ? "destructive" : "outline"}
                onClick={() => setAdjustDir("debit")}
                data-testid="button-adjust-debit"
              >
                <MinusCircle className="w-3 h-3 mr-1" /> Débiter
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="adjust-amount">Montant ({userCurrency})</Label>
                <Input
                  id="adjust-amount"
                  type="number"
                  min="1"
                  placeholder="ex: 1238"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  data-testid="input-adjust-amount"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="adjust-reason">Motif</Label>
                <Input
                  id="adjust-reason"
                  placeholder="ex: Correction double frais échange"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  data-testid="input-adjust-reason"
                />
              </div>
            </div>
            <Button
              size="sm"
              variant={adjustDir === "debit" ? "destructive" : "default"}
              disabled={!adjustAmount || balanceAdjustMutation.isPending}
              onClick={() => balanceAdjustMutation.mutate()}
              data-testid="button-confirm-adjust"
            >
              {balanceAdjustMutation.isPending
                ? "En cours..."
                : adjustDir === "credit"
                  ? `Créditer ${adjustAmount ? parseInt(adjustAmount).toLocaleString("fr-FR") : "..."} ${userCurrency}`
                  : `Débiter ${adjustAmount ? parseInt(adjustAmount).toLocaleString("fr-FR") : "..."} ${userCurrency}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
