import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle, X, Image, Phone, Lock, Plus, Trash2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [idFrontData, setIdFrontData] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  
  const [withdrawalPhones, setWithdrawalPhones] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState("");
  
  const [securityCode, setSecurityCode] = useState("");
  const [currentSecurityCode, setCurrentSecurityCode] = useState("");
  const [confirmSecurityCode, setConfirmSecurityCode] = useState("");
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.withdrawalPhones) {
      setWithdrawalPhones(user.withdrawalPhones);
    }
  }, [user?.withdrawalPhones]);

  const handleFileSelect = (type: "front" | "back" | "selfie") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      if (type === "front") setIdFrontData(fileData);
      else if (type === "back") setIdBackData(fileData);
      else if (type === "selfie") setSelfieData(fileData);
    };
    reader.readAsDataURL(file);
  };

  const resetCapture = (type: "front" | "back" | "selfie") => {
    if (type === "front") {
      setIdFrontData(null);
      if (frontInputRef.current) frontInputRef.current.value = "";
    } else if (type === "back") {
      setIdBackData(null);
      if (backInputRef.current) backInputRef.current.value = "";
    } else if (type === "selfie") {
      setSelfieData(null);
      if (selfieInputRef.current) selfieInputRef.current.value = "";
    }
  };

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      if (!idFrontData || !idBackData || !selfieData) {
        throw new Error("Tous les documents sont requis");
      }

      await apiRequest("POST", "/api/kyc/submit", {
        kycIdFront: idFrontData,
        kycIdBack: idBackData,
        kycSelfie: selfieData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Verification soumise",
        description: "Vos documents ont ete envoyes pour verification",
      });
      setIdFrontData(null);
      setIdBackData(null);
      setSelfieData(null);
      setIsResubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'envoi des documents",
        variant: "destructive",
      });
    },
  });

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

  const getKycStatusBadge = () => {
    switch (user?.kycStatus) {
      case "verified":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-950">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Verifie</span>
          </div>
        );
      case "submitted":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-100 dark:bg-yellow-950">
            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">En attente</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Rejetee</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Non verifie</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Parametres</h1>
        <p className="text-sm text-muted-foreground">Configurez votre compte</p>
      </div>

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
            {withdrawalPhones.map((phone, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 font-mono text-sm" data-testid={`text-phone-${index}`}>{phone}</span>
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
            ))}
          </div>

          {withdrawalPhones.length < 3 && (
            <div className="flex gap-2">
              <Input
                placeholder="Numero de telephone (ex: 97123456)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                maxLength={15}
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
                  <Input
                    type="password"
                    placeholder="******"
                    value={currentSecurityCode}
                    onChange={(e) => setCurrentSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    data-testid="input-current-security-code"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nouveau code</label>
                  <Input
                    type="password"
                    placeholder="******"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    data-testid="input-new-security-code"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Confirmer le nouveau code</label>
                  <Input
                    type="password"
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
                <Input
                  type="password"
                  placeholder="******"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  data-testid="input-security-code"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Confirmer le code</label>
                <Input
                  type="password"
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

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Verification de compte</CardTitle>
            </div>
            {getKycStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {user?.kycStatus === "verified" ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400" />
              <p className="text-base font-medium text-foreground">Felicitations votre compte a ete verifie avec succes</p>
            </div>
          ) : user?.kycStatus === "submitted" && !isResubmitting ? (
            <div className="text-center py-4">
              <Clock className="w-12 h-12 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm font-medium text-foreground">Verification en cours</p>
              <p className="text-xs text-muted-foreground mt-1">Nous verifions vos documents...</p>
            </div>
          ) : user?.kycRejectionReason && !isResubmitting ? (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Verification rejetee</p>
                    <p className="text-sm text-red-600 dark:text-red-400">{user.kycRejectionReason}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Veuillez soumettre a nouveau avec des documents conformes</p>
              <Button 
                onClick={() => {
                  setIsResubmitting(true);
                  setIdFrontData(null);
                  setIdBackData(null);
                  setSelfieData(null);
                }}
                className="w-full"
                data-testid="button-resubmit-kyc"
              >
                <Upload className="w-4 h-4 mr-2" />
                Soumettre a nouveau
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Veuillez fournir les documents suivants:</p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Photo du recto de la piece d'identite
                  </label>
                  <input
                    ref={frontInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect("front")}
                    className="hidden"
                    data-testid="input-file-front"
                  />
                  {idFrontData ? (
                    <div className="relative">
                      <img src={idFrontData} alt="Recto" className="w-full h-40 object-cover rounded-lg border" />
                      <button
                        onClick={() => resetCapture("front")}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600"
                        data-testid="button-remove-front"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-24 border-dashed"
                      onClick={() => frontInputRef.current?.click()}
                      data-testid="button-upload-front"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Image className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Choisir une photo</span>
                      </div>
                    </Button>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Photo du verso de la piece d'identite
                  </label>
                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect("back")}
                    className="hidden"
                    data-testid="input-file-back"
                  />
                  {idBackData ? (
                    <div className="relative">
                      <img src={idBackData} alt="Verso" className="w-full h-40 object-cover rounded-lg border" />
                      <button
                        onClick={() => resetCapture("back")}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600"
                        data-testid="button-remove-back"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-24 border-dashed"
                      onClick={() => backInputRef.current?.click()}
                      data-testid="button-upload-back"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Image className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Choisir une photo</span>
                      </div>
                    </Button>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Photo de vous (selfie)
                  </label>
                  <input
                    ref={selfieInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect("selfie")}
                    className="hidden"
                    data-testid="input-file-selfie"
                  />
                  {selfieData ? (
                    <div className="relative">
                      <img src={selfieData} alt="Selfie" className="w-full h-40 object-cover rounded-lg border" />
                      <button
                        onClick={() => resetCapture("selfie")}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600"
                        data-testid="button-remove-selfie"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-24 border-dashed"
                      onClick={() => selfieInputRef.current?.click()}
                      data-testid="button-upload-selfie"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Image className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Choisir une photo</span>
                      </div>
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <p className="text-xs text-blue-900 dark:text-blue-200">
                  Documents acceptes: Passeport, Permis de conduire ou Piece d'identite nationale.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => submitKycMutation.mutate()}
                disabled={!idFrontData || !idBackData || !selfieData || submitKycMutation.isPending}
                data-testid="button-submit-kyc"
              >
                {submitKycMutation.isPending ? "Envoi en cours..." : "Soumettre les documents"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
