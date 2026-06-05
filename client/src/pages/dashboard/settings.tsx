import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Phone, Lock, Plus, Trash2, Briefcase, Clock } from "lucide-react";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { COUNTRIES } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_SECTORS, getSectorLabel, getSubSectorLabel } from "@shared/activity-sectors";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [withdrawalPhones, setWithdrawalPhones] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState("");
  
  const [securityCode, setSecurityCode] = useState("");
  const [currentSecurityCode, setCurrentSecurityCode] = useState("");
  const [confirmSecurityCode, setConfirmSecurityCode] = useState("");

  const [selectedSector, setSelectedSector] = useState("");
  const [selectedSubSector, setSelectedSubSector] = useState("");

  useEffect(() => {
    if (user?.withdrawalPhones) {
      setWithdrawalPhones(user.withdrawalPhones);
    }
  }, [user?.withdrawalPhones]);

  const updateWithdrawalPhonesMutation = useMutation({
    mutationFn: async (phones: string[]) => {
      await apiRequest("PATCH", "/api/user/withdrawal-phones", { withdrawalPhones: phones });
    },
    onSuccess: () => {
      toast({
        title: "Numeros enregistres",
        description: "Vos numeros de retrait ont ete mis a jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise a jour",
        variant: "destructive",
      });
    },
  });

  const updateSecurityCodeMutation = useMutation({
    mutationFn: async (data: { securityCode: string; currentSecurityCode?: string }) => {
      await apiRequest("POST", "/api/user/security-code", data);
    },
    onSuccess: () => {
      toast({
        title: "Code de securite enregistre",
        description: "Votre code de securite a ete mis a jour",
      });
      setSecurityCode("");
      setCurrentSecurityCode("");
      setConfirmSecurityCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise a jour du code",
        variant: "destructive",
      });
    },
  });

  const updateSectorMutation = useMutation({
    mutationFn: async (data: { kycSector: string; kycSubSector: string }) => {
      await apiRequest("POST", "/api/user/activity-sector", data);
    },
    onSuccess: () => {
      toast({
        title: "Secteur d'activité enregistré",
        description: "Votre secteur sera validé par un administrateur avant de pouvoir effectuer des retraits.",
      });
      setSelectedSector("");
      setSelectedSubSector("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'enregistrement du secteur",
        variant: "destructive",
      });
    },
  });

  const handleSaveSector = () => {
    if (!selectedSector) {
      toast({
        title: "Secteur requis",
        description: "Veuillez sélectionner un secteur d'activité",
        variant: "destructive",
      });
      return;
    }
    updateSectorMutation.mutate({ kycSector: selectedSector, kycSubSector: selectedSubSector });
  };

  const sectorStatus = (user as any)?.sectorStatus as string | undefined;
  const userSector = (user as any)?.kycSector as string | undefined;
  const userSubSector = (user as any)?.kycSubSector as string | undefined;
  const sectorApproved = !!userSector && sectorStatus === "approved";
  const sectorPending = sectorStatus === "pending";
  const sectorNeedsConfig = !userSector;
  const showSectorCard = user?.kycStatus === "verified" || !!userSector;
  const currentSectorObj = ACTIVITY_SECTORS.find((s) => s.code === selectedSector);

  const handleAddPhone = () => {
    if (!newPhone || !/^\d{8,15}$/.test(newPhone)) {
      toast({
        title: "Numero invalide",
        description: "Le numero doit contenir entre 8 et 15 chiffres",
        variant: "destructive",
      });
      return;
    }
    if (withdrawalPhones.length >= 3) {
      toast({
        title: "Limite atteinte",
        description: "Maximum 3 numeros de retrait autorises",
        variant: "destructive",
      });
      return;
    }
    if (withdrawalPhones.includes(newPhone)) {
      toast({
        title: "Numero deja ajoute",
        description: "Ce numero est deja dans votre liste",
        variant: "destructive",
      });
      return;
    }
    const updatedPhones = [...withdrawalPhones, newPhone];
    setWithdrawalPhones(updatedPhones);
    setNewPhone("");
    updateWithdrawalPhonesMutation.mutate(updatedPhones);
  };

  const handleRemovePhone = (index: number) => {
    const updatedPhones = withdrawalPhones.filter((_, i) => i !== index);
    setWithdrawalPhones(updatedPhones);
    updateWithdrawalPhonesMutation.mutate(updatedPhones);
  };

  const handleUpdateSecurityCode = () => {
    if (!/^\d{6}$/.test(securityCode)) {
      toast({
        title: "Code invalide",
        description: "Le code de securite doit contenir exactement 6 chiffres",
        variant: "destructive",
      });
      return;
    }
    if (securityCode !== confirmSecurityCode) {
      toast({
        title: "Codes non identiques",
        description: "Les codes de securite ne correspondent pas",
        variant: "destructive",
      });
      return;
    }
    if (user?.securityCode && !currentSecurityCode) {
      toast({
        title: "Code actuel requis",
        description: "Veuillez saisir votre code de securite actuel",
        variant: "destructive",
      });
      return;
    }
    updateSecurityCodeMutation.mutate({
      securityCode,
      currentSecurityCode: user?.securityCode ? currentSecurityCode : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Parametres</h1>
        <p className="text-sm text-muted-foreground">Configurez votre compte</p>
      </div>

      {showSectorCard && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              <CardTitle className="text-lg">Secteur d'activité</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sectorApproved ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">Secteur d'activité validé</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium" data-testid="text-sector-label">
                    {getSectorLabel(userSector!)}
                  </span>
                  {userSubSector && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs" data-testid="text-subsector-label">
                      {getSubSectorLabel(userSector!, userSubSector)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Votre secteur est validé. Pour toute modification, veuillez contacter le support.
                </p>
              </div>
            ) : (
              <>
                {sectorPending ? (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      <p className="font-medium">Secteur en attente de validation</p>
                      <p className="text-xs mt-1">
                        {userSector ? `${getSectorLabel(userSector)}${userSubSector ? ` — ${getSubSectorLabel(userSector, userSubSector)}` : ""}. ` : ""}
                        Vos retraits et transferts seront possibles dès la validation par un administrateur. Vous pouvez modifier votre choix ci-dessous tant qu'il n'est pas validé.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      <p className="font-medium">Secteur d'activité requis</p>
                      <p className="text-xs mt-1">
                        Pour des raisons de conformité, vous devez renseigner votre secteur d'activité. Une fois enregistré et validé par un administrateur, vos retraits seront de nouveau possibles.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Secteur principal</label>
                    <Select
                      value={selectedSector}
                      onValueChange={(v) => { setSelectedSector(v); setSelectedSubSector(""); }}
                    >
                      <SelectTrigger data-testid="select-sector">
                        <SelectValue placeholder="Sélectionnez votre secteur" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_SECTORS.map((s) => (
                          <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {currentSectorObj && currentSectorObj.subSectors.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Sous-secteur (optionnel)</label>
                      <Select value={selectedSubSector} onValueChange={setSelectedSubSector}>
                        <SelectTrigger data-testid="select-subsector">
                          <SelectValue placeholder="Sélectionnez un sous-secteur" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentSectorObj.subSectors.map((ss) => (
                            <SelectItem key={ss.code} value={ss.code}>{ss.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveSector}
                  disabled={!selectedSector || updateSectorMutation.isPending}
                  data-testid="button-save-sector"
                >
                  {updateSectorMutation.isPending ? "Enregistrement..." : "Enregistrer le secteur d'activité"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            <CardTitle className="text-lg">Numeros de retrait</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configurez jusqu'a 3 numeros de telephone pour vos retraits. Les retraits ne seront possibles que vers ces numeros.
          </p>
          
          <div className="space-y-2">
            {withdrawalPhones.map((phone, index) => {
              const countryData = user?.country ? COUNTRIES.find(c => c.code === user.country) : null;
              const displayPhone = countryData?.phoneCode ? `${countryData.phoneCode} ${phone}` : phone;
              return (
                <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 font-mono text-sm" data-testid={`text-phone-${index}`}>{displayPhone}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemovePhone(index)}
                    disabled={updateWithdrawalPhonesMutation.isPending}
                    data-testid={`button-remove-phone-${index}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              );
            })}
          </div>

          {withdrawalPhones.length < 3 && user?.country && (
            <div className="flex gap-2">
              <PhoneInputWithPrefix
                country={user.country}
                value={newPhone}
                onChange={(val) => setNewPhone(val)}
                placeholder="Numero local"
                data-testid="input-new-phone"
              />
              <Button
                onClick={handleAddPhone}
                disabled={!newPhone || updateWithdrawalPhonesMutation.isPending}
                data-testid="button-add-phone"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>
          )}

          {!user?.country && withdrawalPhones.length < 3 && (
            <p className="text-xs text-muted-foreground">
              Veuillez d'abord selectionner votre pays dans votre profil pour ajouter des numeros de retrait.
            </p>
          )}

          {withdrawalPhones.length >= 3 && (
            <p className="text-xs text-muted-foreground">
              Vous avez atteint le maximum de 3 numeros. Supprimez un numero pour en ajouter un autre.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            <CardTitle className="text-lg">Code de securite</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le code de securite a 6 chiffres est requis pour effectuer des retraits. Ce code protege votre compte contre les acces non autorises.
          </p>
          
          {user?.securityCode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">Code de securite configure</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Code actuel</label>
                  <PasswordInput
                    placeholder="******"
                    value={currentSecurityCode}
                    onChange={(e) => setCurrentSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    data-testid="input-current-security-code"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nouveau code</label>
                  <PasswordInput
                    placeholder="******"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    data-testid="input-new-security-code"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Confirmer le nouveau code</label>
                  <PasswordInput
                    placeholder="******"
                    value={confirmSecurityCode}
                    onChange={(e) => setConfirmSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    data-testid="input-confirm-security-code"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">Aucun code de securite configure</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Nouveau code (6 chiffres)</label>
                <PasswordInput
                  placeholder="******"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  data-testid="input-security-code"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Confirmer le code</label>
                <PasswordInput
                  placeholder="******"
                  value={confirmSecurityCode}
                  onChange={(e) => setConfirmSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  data-testid="input-confirm-security-code-new"
                />
              </div>
            </div>
          )}
          
          <Button
            className="w-full"
            onClick={handleUpdateSecurityCode}
            disabled={!securityCode || !confirmSecurityCode || updateSecurityCodeMutation.isPending}
            data-testid="button-save-security-code"
          >
            {updateSecurityCodeMutation.isPending ? "Enregistrement..." : "Enregistrer le code de securite"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
