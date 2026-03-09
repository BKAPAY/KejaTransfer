import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Mail, Shield, CheckCircle, Clock, XCircle, Phone, Hash, Pencil, Check, X, Lock, MapPin } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
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
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    businessRegistrationNumber: "",
    businessCountry: "",
    businessPhone: "",
    businessEnterprisePhone: "",
    businessEmail: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("PUT", "/api/business/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profil mis à jour", description: "Les informations de l'entreprise ont été enregistrées." });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      return await apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({ title: "Mot de passe modifié", description: "Votre mot de passe a été changé avec succès." });
      setIsChangingPassword(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Mot de passe actuel incorrect ou erreur serveur.", variant: "destructive" });
    },
  });

  const u = user as any;

  const startEditing = () => {
    setFormData({
      businessRegistrationNumber: u?.businessRegistrationNumber || "",
      businessCountry: u?.businessCountry || "",
      businessPhone: u?.businessPhone || "",
      businessEnterprisePhone: u?.businessEnterprisePhone || "",
      businessEmail: u?.businessEmail || "",
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const getCountryDisplay = (code: string) => {
    const c = COUNTRIES.find(c => c.code === code);
    return c ? `${c.flag} ${c.name}` : code;
  };

  const getPhoneDisplay = (countryCode: string, digits: string) => {
    if (!digits) return null;
    const c = COUNTRIES.find(c => c.code === countryCode);
    if (c && c.phoneCode) return `${c.phoneCode} ${digits}`;
    return digits;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Profil Entreprise</h1>

      {/* Informations de base (non modifiables) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Prénom</p>
              <p className="font-medium">{user?.firstName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="font-medium">{user?.lastName}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Nom de l'entreprise</p>
              <p className="font-medium">{user?.businessName || "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Email d'inscription</p>
              <p className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations de l'entreprise (modifiables) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Informations de l'entreprise
            </CardTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-business-info">
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-business-info">
                  <Check className="w-4 h-4 mr-1" />
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending} data-testid="button-cancel-business-info">
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            Complétez les informations de votre entreprise pour faciliter les vérifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              {/* Pays de l'entreprise */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Pays de l'entreprise
                </Label>
                <Select
                  value={formData.businessCountry}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, businessCountry: v, businessPhone: "", businessEnterprisePhone: "" }))}
                >
                  <SelectTrigger data-testid="select-business-country">
                    <SelectValue placeholder="Sélectionnez un pays" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.phoneCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Numéro d'entreprise */}
              <div className="space-y-2">
                <Label htmlFor="reg-number" className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  Numéro d'entreprise (RCCM / Registre de commerce)
                </Label>
                <Input
                  id="reg-number"
                  placeholder="Ex: RB/COT/BJ/01/2024/B12345"
                  value={formData.businessRegistrationNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessRegistrationNumber: e.target.value }))}
                  data-testid="input-business-registration"
                />
              </div>

              {/* Téléphone personnel du dirigeant */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Téléphone personnel (dirigeant)
                </Label>
                <PhoneInputWithPrefix
                  country={formData.businessCountry}
                  value={formData.businessPhone}
                  onChange={(v) => setFormData(prev => ({ ...prev, businessPhone: v }))}
                  placeholder={formData.businessCountry ? undefined : "Sélectionnez un pays d'abord"}
                  data-testid="input-business-phone"
                />
              </div>

              {/* Téléphone de l'entreprise */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Téléphone de l'entreprise
                </Label>
                <PhoneInputWithPrefix
                  country={formData.businessCountry}
                  value={formData.businessEnterprisePhone}
                  onChange={(v) => setFormData(prev => ({ ...prev, businessEnterprisePhone: v }))}
                  placeholder={formData.businessCountry ? undefined : "Sélectionnez un pays d'abord"}
                  data-testid="input-business-enterprise-phone"
                />
              </div>

              {/* Email de l'entreprise */}
              <div className="space-y-2">
                <Label htmlFor="business-email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email professionnel de l'entreprise
                </Label>
                <Input
                  id="business-email"
                  type="email"
                  placeholder="contact@monentreprise.com"
                  value={formData.businessEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessEmail: e.target.value }))}
                  data-testid="input-business-email"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 py-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Pays de l'entreprise</p>
                  <p className="font-medium">
                    {u?.businessCountry ? getCountryDisplay(u.businessCountry) : (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 py-2">
                <Hash className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Numéro d'entreprise (RCCM)</p>
                  <p className="font-medium">
                    {u?.businessRegistrationNumber || (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 py-2">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Téléphone personnel (dirigeant)</p>
                  <p className="font-medium">
                    {getPhoneDisplay(u?.businessCountry, u?.businessPhone) || (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 py-2">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Téléphone de l'entreprise</p>
                  <p className="font-medium">
                    {getPhoneDisplay(u?.businessCountry, u?.businessEnterprisePhone) || (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 py-2">
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Email professionnel</p>
                  <p className="font-medium">
                    {u?.businessEmail || (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Changement de mot de passe */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Mot de passe
            </CardTitle>
            {!isChangingPassword ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChangingPassword(true)}
                data-testid="button-change-password"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => passwordMutation.mutate(passwordData)}
                  disabled={passwordMutation.isPending}
                  data-testid="button-save-password"
                >
                  <Check className="w-4 h-4 mr-1" />
                  {passwordMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  }}
                  disabled={passwordMutation.isPending}
                  data-testid="button-cancel-password"
                >
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        {isChangingPassword && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Mot de passe actuel</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="Votre mot de passe actuel"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Au moins 8 caractères"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Répétez le nouveau mot de passe"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                data-testid="input-confirm-password"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Vérification KYC */}
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
              <p className="text-sm text-muted-foreground mb-3">Documents requis :</p>
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
              <Button onClick={() => setLocation("/dashboard/kyc")} data-testid="button-kyc-verify">
                Soumettre les documents
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
