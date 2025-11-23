import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      if (!idFrontFile || !idBackFile || !selfieFile) {
        throw new Error("Tous les fichiers sont requis");
      }

      const kycIdFront = await fileToBase64(idFrontFile);
      const kycIdBack = await fileToBase64(idBackFile);
      const kycSelfie = await fileToBase64(selfieFile);

      await apiRequest("POST", "/api/kyc/submit", {
        kycIdFront,
        kycIdBack,
        kycSelfie,
      });
    },
    onSuccess: () => {
      toast({
        title: "Vérification soumise",
        description: "Vos documents ont été envoyés pour vérification",
      });
      setIdFrontFile(null);
      setIdBackFile(null);
      setSelfieFile(null);
      if (idFrontRef.current) idFrontRef.current.value = "";
      if (idBackRef.current) idBackRef.current.value = "";
      if (selfieRef.current) selfieRef.current.value = "";
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

  const getKycStatusBadge = () => {
    switch (user?.kycStatus) {
      case "verified":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-950">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Vérifiée</span>
          </div>
        );
      case "submitted":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">En attente</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Rejetée</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
            <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">En attente</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Configurez votre compte</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Vérification d'identité (KYC)</CardTitle>
              <CardDescription className="text-xs">Vérifiez votre identité pour accéder à toutes les fonctionnalités</CardDescription>
            </div>
            {getKycStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {user?.kycStatus === "verified" ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-foreground">Votre compte est vérifié</p>
              <p className="text-xs text-muted-foreground mt-1">Vous pouvez utiliser toutes les fonctionnalités</p>
            </div>
          ) : user?.kycStatus === "submitted" ? (
            <div className="text-center py-4">
              <Clock className="w-12 h-12 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-foreground">Vérification en cours</p>
              <p className="text-xs text-muted-foreground mt-1">Nous vérifions vos documents...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Veuillez fournir les documents suivants:</p>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Photo du recto de la pièce d'identité
                  </label>
                  <input
                    ref={idFrontRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)}
                    className="hidden"
                    data-testid="input-kyc-id-front"
                  />
                  <button
                    onClick={() => idFrontRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted transition-colors"
                  >
                    <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {idFrontFile ? idFrontFile.name : "Cliquez pour télécharger"}
                    </p>
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Photo du verso de la pièce d'identité
                  </label>
                  <input
                    ref={idBackRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdBackFile(e.target.files?.[0] || null)}
                    className="hidden"
                    data-testid="input-kyc-id-back"
                  />
                  <button
                    onClick={() => idBackRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted transition-colors"
                  >
                    <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {idBackFile ? idBackFile.name : "Cliquez pour télécharger"}
                    </p>
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Selfie en tenant votre pièce d'identité
                  </label>
                  <input
                    ref={selfieRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                    className="hidden"
                    data-testid="input-kyc-selfie"
                  />
                  <button
                    onClick={() => selfieRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted transition-colors"
                  >
                    <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {selfieFile ? selfieFile.name : "Cliquez pour télécharger"}
                    </p>
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <p className="text-xs text-blue-900 dark:text-blue-200">
                  ℹ️ Les documents acceptés: Passeport, Permis de conduire ou Pièce d'identité nationale.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => submitKycMutation.mutate()}
                disabled={!idFrontFile || !idBackFile || !selfieFile || submitKycMutation.isPending}
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
