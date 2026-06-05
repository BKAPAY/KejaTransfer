import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Shield, CheckCircle, XCircle,
  PlusCircle, MinusCircle, Pencil, Save, X, Building2, KeyRound, RotateCcw, TrendingUp,
} from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { getSectorLabel, getSubSectorLabel } from "@shared/activity-sectors";
import { COUNTRIES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin", TG: "Togo", CI: "Côte d'Ivoire", SN: "Sénégal", BF: "Burkina Faso",
  GN: "Guinée", NE: "Niger", CM: "Cameroun", CD: "RD Congo", CG: "Congo-Brazzaville",
  TD: "Tchad", CF: "Centrafrique", GA: "Gabon", ML: "Mali", GM: "Gambie", RW: "Rwanda",
};

interface EditState {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  businessName: string;
  businessRegistrationNumber: string;
  businessCountry: string;
  businessPhone: string;
  businessEnterprisePhone: string;
  businessEmail: string;
}

const emptyEdit: EditState = {
  firstName: "", lastName: "", email: "", country: "",
  businessName: "", businessRegistrationNumber: "", businessCountry: "",
  businessPhone: "", businessEnterprisePhone: "", businessEmail: "",
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

  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState<EditState>(emptyEdit);

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  useEffect(() => {
    if (user && !editMode) {
      setEdit({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        country: user.country || "",
        businessName: user.businessName || "",
        businessRegistrationNumber: user.businessRegistrationNumber || "",
        businessCountry: user.businessCountry || "",
        businessPhone: user.businessPhone || "",
        businessEnterprisePhone: user.businessEnterprisePhone || "",
        businessEmail: user.businessEmail || "",
      });
    }
  }, [user, editMode]);

  const isBusinessAccount = user?.accountType === "business";

  const profileMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        firstName: edit.firstName.trim(),
        lastName: edit.lastName.trim(),
        email: edit.email.trim().toLowerCase(),
        country: edit.country || undefined,
      };
      if (isBusinessAccount) {
        payload.businessName = edit.businessName.trim() || null;
        payload.businessRegistrationNumber = edit.businessRegistrationNumber.trim() || null;
        payload.businessCountry = edit.businessCountry || null;
        payload.businessPhone = edit.businessPhone.trim() || null;
        payload.businessEnterprisePhone = edit.businessEnterprisePhone.trim() || null;
        payload.businessEmail = edit.businessEmail.trim() || null;
      }
      const res = await apiRequest("PATCH", `/api/admin/user/${userId}/profile`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profil mis à jour", description: "Les informations ont été enregistrées." });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de mettre à jour le profil",
        variant: "destructive",
      });
    },
  });

  const multiCountryMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", `/api/admin/user/${userId}/profile`, { multiCountryEnabled: enabled });
      return res.json();
    },
    onSuccess: (_data, enabled) => {
      toast({
        title: "Restriction pays mise à jour",
        description: enabled
          ? "L'utilisateur peut désormais opérer dans tous les pays."
          : "L'utilisateur est restreint à son propre pays.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de mettre à jour la restriction pays",
        variant: "destructive",
      });
    },
  });

  const validateSectorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/user/${userId}/profile`, { sectorStatus: "approved" });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Secteur validé",
        description: "L'utilisateur peut désormais effectuer des retraits.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de valider le secteur",
        variant: "destructive",
      });
    },
  });

  const resetSecurityCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/user/${userId}/reset-security-code`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Code de retrait réinitialisé",
        description: data?.message || "L'utilisateur peut définir un nouveau code depuis Paramètres.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de réinitialiser le code",
        variant: "destructive",
      });
    },
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

  const [monthlyLimitInput, setMonthlyLimitInput] = useState<string>("");

  const DEFAULT_LIMITS: Record<string, number> = { XOF: 1_000_000, XAF: 1_000_000, CDF: 5_000_000 };

  const setMonthlyLimitMutation = useMutation({
    mutationFn: async (limit: number | null) => {
      const res = await apiRequest("PATCH", `/api/admin/user/${userId}/monthly-limit`, { limit });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Limite mise à jour", description: "La limite mensuelle a été modifiée avec succès." });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err?.message || "Impossible de modifier la limite", variant: "destructive" });
    },
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
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

  const cancelEdit = () => {
    setEditMode(false);
    setEdit({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      country: user.country || "",
      businessName: user.businessName || "",
      businessRegistrationNumber: user.businessRegistrationNumber || "",
      businessCountry: user.businessCountry || "",
      businessPhone: user.businessPhone || "",
      businessEnterprisePhone: user.businessEnterprisePhone || "",
      businessEmail: user.businessEmail || "",
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-4">
      <Button variant="ghost" onClick={() => setLocation(backUrl)} className="mb-2" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la gestion
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profil de {user.firstName} {user.lastName}
          </CardTitle>
          {!editMode ? (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-profile">
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={profileMutation.isPending} data-testid="button-cancel-edit">
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={() => profileMutation.mutate()}
                disabled={profileMutation.isPending || !edit.firstName.trim() || !edit.lastName.trim() || !edit.email.trim()}
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                {profileMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              {isBusinessAccount ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {isBusinessAccount ? "Compte entreprise" : "Compte personnel"}
            </Badge>
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

          {/* Informations personnelles */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations personnelles
            </h3>
            {!editMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Prénom</p>
                  <p className="font-medium" data-testid="text-firstname">{user.firstName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium" data-testid="text-lastname">{user.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email d'inscription
                  </p>
                  <p className="font-medium break-all" data-testid="text-email">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Pays
                  </p>
                  <p className="font-medium" data-testid="text-country">
                    {user.country ? COUNTRY_NAMES[user.country] || user.country : "Non défini"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-firstName">Prénom</Label>
                  <Input
                    id="edit-firstName"
                    value={edit.firstName}
                    onChange={e => setEdit(s => ({ ...s, firstName: e.target.value }))}
                    data-testid="input-firstName"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-lastName">Nom</Label>
                  <Input
                    id="edit-lastName"
                    value={edit.lastName}
                    onChange={e => setEdit(s => ({ ...s, lastName: e.target.value }))}
                    data-testid="input-lastName"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-email">Email d'inscription</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={edit.email}
                    onChange={e => setEdit(s => ({ ...s, email: e.target.value }))}
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground">L'utilisateur se connectera avec ce nouvel email.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-country">Pays</Label>
                  <Select value={edit.country} onValueChange={(v) => setEdit(s => ({ ...s, country: v }))}>
                    <SelectTrigger id="edit-country" data-testid="select-country">
                      <SelectValue placeholder="Sélectionner un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                        <SelectItem key={code} value={code}>{name} ({code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {edit.country && user.country && edit.country !== user.country && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Attention : changer de pays modifie la devise affichée du solde, mais le montant ({user.balance.toLocaleString("fr-FR")}) ne sera pas reconverti automatiquement.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Informations entreprise (uniquement comptes business) */}
          {isBusinessAccount && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Informations entreprise
              </h3>
              {!editMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nom de l'entreprise</p>
                    <p className="font-medium" data-testid="text-businessName">{user.businessName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">N° d'enregistrement (RCCM)</p>
                    <p className="font-medium" data-testid="text-businessRegistration">{user.businessRegistrationNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Pays de l'entreprise
                    </p>
                    <p className="font-medium" data-testid="text-businessCountry">
                      {user.businessCountry ? (COUNTRY_NAMES[user.businessCountry] || user.businessCountry) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email professionnel
                    </p>
                    <p className="font-medium break-all" data-testid="text-businessEmail">{user.businessEmail || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Téléphone du dirigeant
                    </p>
                    <p className="font-medium" data-testid="text-businessPhone">{user.businessPhone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Téléphone de l'entreprise
                    </p>
                    <p className="font-medium" data-testid="text-businessEnterprisePhone">{user.businessEnterprisePhone || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessName">Nom de l'entreprise</Label>
                    <Input
                      id="edit-businessName"
                      value={edit.businessName}
                      onChange={e => setEdit(s => ({ ...s, businessName: e.target.value }))}
                      data-testid="input-businessName"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessRegistration">N° d'enregistrement (RCCM)</Label>
                    <Input
                      id="edit-businessRegistration"
                      value={edit.businessRegistrationNumber}
                      onChange={e => setEdit(s => ({ ...s, businessRegistrationNumber: e.target.value }))}
                      data-testid="input-businessRegistration"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessCountry">Pays de l'entreprise</Label>
                    <Select value={edit.businessCountry} onValueChange={(v) => setEdit(s => ({ ...s, businessCountry: v }))}>
                      <SelectTrigger id="edit-businessCountry" data-testid="select-businessCountry">
                        <SelectValue placeholder="Sélectionner un pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                          <SelectItem key={code} value={code}>{name} ({code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessEmail">Email professionnel</Label>
                    <Input
                      id="edit-businessEmail"
                      type="email"
                      value={edit.businessEmail}
                      onChange={e => setEdit(s => ({ ...s, businessEmail: e.target.value }))}
                      data-testid="input-businessEmail"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessPhone">Téléphone du dirigeant</Label>
                    <Input
                      id="edit-businessPhone"
                      value={edit.businessPhone}
                      onChange={e => setEdit(s => ({ ...s, businessPhone: e.target.value.replace(/[^0-9+]/g, "") }))}
                      data-testid="input-businessPhone"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessEnterprisePhone">Téléphone de l'entreprise</Label>
                    <Input
                      id="edit-businessEnterprisePhone"
                      value={edit.businessEnterprisePhone}
                      onChange={e => setEdit(s => ({ ...s, businessEnterprisePhone: e.target.value.replace(/[^0-9+]/g, "") }))}
                      data-testid="input-businessEnterprisePhone"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code de retrait — uniquement pour les comptes personnels */}
          {!isBusinessAccount && (
            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Code de retrait (sécurité)
              </h3>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm">
                    Statut :{" "}
                    {user.securityCode ? (
                      <Badge variant="default" data-testid="status-security-code">Configuré</Badge>
                    ) : (
                      <Badge variant="outline" data-testid="status-security-code">Non configuré</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    La réinitialisation supprime le code actuel. L'utilisateur pourra ensuite définir un nouveau code à 6 chiffres depuis Paramètres &gt; Sécurité.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!user.securityCode || resetSecurityCodeMutation.isPending}
                      data-testid="button-reset-security-code"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Réinitialiser le code
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Réinitialiser le code de retrait ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le code de retrait actuel de {user.firstName} {user.lastName} sera supprimé.
                        L'utilisateur ne pourra plus effectuer de retrait ni de transfert tant qu'il n'aura
                        pas défini un nouveau code à 6 chiffres depuis Paramètres &gt; Sécurité.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-reset-code">Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => resetSecurityCodeMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-reset-code"
                      >
                        {resetSecurityCodeMutation.isPending ? "Réinitialisation..." : "Confirmer la réinitialisation"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {/* Limite mensuelle — uniquement pour les comptes personnels */}
          {!isBusinessAccount && (
            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Limite mensuelle de réception
              </h3>
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Limite actuelle :{" "}
                  <strong className="text-foreground">
                    {(user as any).monthlyLimit != null
                      ? Number((user as any).monthlyLimit).toLocaleString("fr-FR")
                      : (DEFAULT_LIMITS[userCurrency] ?? 1_000_000).toLocaleString("fr-FR")}{" "}
                    {userCurrency}
                  </strong>
                  {(user as any).monthlyLimit == null && (
                    <span className="ml-1 text-muted-foreground">(valeur par défaut)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Limite par défaut : {(DEFAULT_LIMITS[userCurrency] ?? 1_000_000).toLocaleString("fr-FR")} {userCurrency} / mois.
                  Laissez vide pour revenir à la valeur par défaut.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 flex-1 min-w-[160px]">
                  <Label htmlFor="monthly-limit-input">Nouvelle limite ({userCurrency})</Label>
                  <Input
                    id="monthly-limit-input"
                    type="number"
                    min="0"
                    placeholder={`ex: ${(DEFAULT_LIMITS[userCurrency] ?? 1_000_000).toLocaleString("fr-FR")}`}
                    value={monthlyLimitInput}
                    onChange={e => setMonthlyLimitInput(e.target.value)}
                    data-testid="input-monthly-limit-profile"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={setMonthlyLimitMutation.isPending}
                  onClick={() => {
                    const val = monthlyLimitInput.trim();
                    const limit = val === "" ? null : Number(val);
                    if (val !== "" && (isNaN(limit!) || limit! < 0)) {
                      toast({ title: "Valeur invalide", description: "Entrez un montant valide ou laissez vide pour la valeur par défaut.", variant: "destructive" });
                      return;
                    }
                    setMonthlyLimitMutation.mutate(limit);
                  }}
                  data-testid="button-save-monthly-limit-profile"
                >
                  {setMonthlyLimitMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
                {(user as any).monthlyLimit != null && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setMonthlyLimitMutation.isPending}
                    onClick={() => {
                      setMonthlyLimitInput("");
                      setMonthlyLimitMutation.mutate(null);
                    }}
                    data-testid="button-reset-monthly-limit-profile"
                  >
                    Remettre par défaut
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Statut & métadonnées */}
          <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isBusinessAccount && (
              <div>
                <p className="text-sm text-muted-foreground">Solde</p>
                <p className="font-bold text-xl" data-testid="text-balance">{formatAmount(user.balance)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date d'inscription
              </p>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Statut KYC</p>
              <Badge variant={user.kycStatus === "verified" ? "default" : user.kycStatus === "pending" ? "secondary" : "outline"}>
                {user.kycStatus === "verified" ? "Vérifié" : user.kycStatus === "pending" ? "En attente" : user.kycStatus === "submitted" ? "Soumis" : "Rejeté"}
              </Badge>
            </div>
            {((user as any).kycSector || (user as any).kycSubSector) && (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                {(user as any).kycSector && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium" data-testid="text-admin-sector">
                    {getSectorLabel((user as any).kycSector)}
                  </span>
                )}
                {(user as any).kycSubSector && (user as any).kycSector && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
                    {getSubSectorLabel((user as any).kycSector, (user as any).kycSubSector)}
                  </span>
                )}
                <Badge
                  variant={(user as any).sectorStatus === "pending" ? "secondary" : "default"}
                  data-testid="badge-sector-status"
                >
                  {(user as any).sectorStatus === "pending" ? "Secteur en attente" : "Secteur validé"}
                </Badge>
              </div>
            )}
            {(user as any).sectorStatus === "pending" && (user as any).kycSector && (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
                  Ce secteur a été renseigné par l'utilisateur et doit être validé avant qu'il puisse effectuer des retraits.
                </p>
                <Button
                  size="sm"
                  onClick={() => validateSectorMutation.mutate()}
                  disabled={validateSectorMutation.isPending}
                  data-testid="button-validate-sector"
                >
                  {validateSectorMutation.isPending ? "Validation..." : "Valider le secteur"}
                </Button>
              </div>
            )}
          </div>

          {/* Restriction pays par secteur d'activité */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Autoriser tous les pays
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(user as any).multiCountryEnabled
                    ? "L'utilisateur peut collecter et opérer dans tous les pays disponibles."
                    : "L'utilisateur est restreint à son propre pays (secteur d'activité local). Activez pour autoriser tous les pays."}
                </p>
              </div>
              <Switch
                checked={!!(user as any).multiCountryEnabled}
                onCheckedChange={(v) => multiCountryMutation.mutate(v)}
                disabled={multiCountryMutation.isPending}
                data-testid="switch-multi-country"
              />
            </div>
          </div>

          {/* Compte salarié — uniquement pour les comptes personnels */}
          {!isBusinessAccount && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">💼</span> Compte salarié
                </p>
                {(user as any).isSalary ? (
                  <p className="text-xs text-muted-foreground">Ce compte dispose d'un compte salarié actif.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pas de compte salarié configuré.</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(`/dashboard/admin/user/${userId}/salary`)}
                data-testid="button-nav-salary"
              >
                Gérer le salaire
              </Button>
            </div>
          </div>
          )}

          {/* Ajustement manuel du solde — uniquement pour les comptes personnels */}
          {!isBusinessAccount && (
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Ajustement manuel du solde</p>
            <div className="flex flex-wrap gap-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
