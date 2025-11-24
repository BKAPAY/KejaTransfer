import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import { Video, Camera, CheckCircle2, Clock, AlertCircle, X, Loader } from "lucide-react";
import Tesseract from "tesseract.js";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [idFrontData, setIdFrontData] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  
  const [activeCamera, setActiveCamera] = useState<"front" | "back" | "selfie" | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async (type: "front" | "back" | "selfie") => {
    try {
      setActiveCamera(type);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: type === "selfie" ? "user" : "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive",
      });
      setActiveCamera(null);
    }
  };

  const validateDocument = async (imageData: string): Promise<boolean> => {
    if (activeCamera === "selfie") return true;

    try {
      setIsValidating(true);
      setValidationError(null);

      // Utiliser l'API Tesseract avec configuration optimisée
      const result = await Tesseract.recognize(imageData, "fra+eng", {
        logger: (info) => console.log("OCR Progress:", info),
      });

      const text = result.data.text.toLowerCase();
      const confidence = result.data.confidence;

      console.log("Texte reconnu:", text);
      console.log("Confiance:", confidence);

      // Mots-clés spécifiques aux documents d'identité
      const documentKeywords = [
        "identité",
        "carte",
        "passeport",
        "permis",
        "conduire",
        "national",
        "numero",
        "numéro",
        "nom",
        "prenom",
        "prénom",
        "date",
        "née",
        "sexe",
        "lieu",
        "signature",
        "validité",
        "valide",
      ];

      // Besoin d'au moins 2 mots-clés pour considérer que c'est un document valide
      const keywordMatches = documentKeywords.filter((keyword) =>
        text.includes(keyword)
      ).length;

      console.log("Correspondances détectées:", keywordMatches);

      if (keywordMatches < 2) {
        setValidationError(
          `Échec. Le système n'a pas détecté de pièce d'identité valide (${keywordMatches} indicateurs trouvés). Veuillez photographier la pièce directement en bon éclairage.`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Erreur validation:", error);
      setValidationError("Erreur lors de l'analyse. Veuillez réessayer.");
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !activeCamera) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const imageData = canvasRef.current.toDataURL("image/jpeg");

    stopCamera();

    const isValid = await validateDocument(imageData);

    if (!isValid) {
      toast({
        title: "Document non valide",
        description: validationError || "Veuillez utiliser un document d'identité valide",
        variant: "destructive",
      });
      return;
    }

    if (activeCamera === "front") setIdFrontData(imageData);
    else if (activeCamera === "back") setIdBackData(imageData);
    else if (activeCamera === "selfie") setSelfieData(imageData);

    toast({
      title: "Photo valide",
      description: "Votre document a été accepté",
    });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setActiveCamera(null);
  };

  const resetCapture = (type: "front" | "back" | "selfie") => {
    if (type === "front") setIdFrontData(null);
    else if (type === "back") setIdBackData(null);
    else if (type === "selfie") setSelfieData(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
        title: "Vérification soumise",
        description: "Vos documents ont été envoyés pour vérification",
      });
      setIdFrontData(null);
      setIdBackData(null);
      setSelfieData(null);
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
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Vérifié</span>
          </div>
        );
      case "submitted":
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Non vérifié</span>
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
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Non vérifié</span>
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
              <CardTitle className="text-lg">Vérification de compte</CardTitle>
            </div>
            {getKycStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {user?.kycStatus === "verified" ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400" />
              <p className="text-base font-medium text-foreground">Félicitations votre compte a été vérifié avec succès</p>
            </div>
          ) : user?.kycStatus === "submitted" ? (
            <div className="text-center py-4">
              <Clock className="w-12 h-12 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-foreground">Vérification en cours</p>
              <p className="text-xs text-muted-foreground mt-1">Nous vérifions vos documents...</p>
            </div>
          ) : user?.kycRejectionReason ? (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Vérification rejetée</p>
                    <p className="text-sm text-red-600 dark:text-red-400">{user.kycRejectionReason}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Veuillez soumettre à nouveau avec des documents conformes</p>
              <Button 
                onClick={() => {
                  setIdFrontData(null);
                  setIdBackData(null);
                  setSelfieData(null);
                  setValidationError(null);
                }}
                className="w-full"
                data-testid="button-resubmit-kyc"
              >
                <Camera className="w-4 h-4 mr-2" />
                Soumettre à nouveau
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCamera ? (
                <div className="space-y-3">
                  <div className="relative w-full bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-64 object-cover"
                      data-testid="video-camera"
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={capturePhoto}
                        disabled={isValidating}
                        data-testid="button-capture-photo"
                      >
                        {isValidating ? (
                          <>
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            Validation...
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            Capturer
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={stopCamera}
                        disabled={isValidating}
                        data-testid="button-cancel-camera"
                      >
                        Annuler
                      </Button>
                    </div>
                    {validationError && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
                        <p className="text-xs text-red-700 dark:text-red-300">{validationError}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Veuillez fournir les documents suivants:</p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Photo du recto de la pièce d'identité
                      </label>
                      {idFrontData ? (
                        <div className="relative">
                          <img src={idFrontData} alt="Recto" className="w-full h-40 object-cover rounded-lg" />
                          <button
                            onClick={() => resetCapture("front")}
                            className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                            data-testid="button-remove-front"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => startCamera("front")}
                          data-testid="button-camera-front"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Prendre une photo
                        </Button>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Photo du verso de la pièce d'identité
                      </label>
                      {idBackData ? (
                        <div className="relative">
                          <img src={idBackData} alt="Verso" className="w-full h-40 object-cover rounded-lg" />
                          <button
                            onClick={() => resetCapture("back")}
                            className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                            data-testid="button-remove-back"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => startCamera("back")}
                          data-testid="button-camera-back"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Prendre une photo
                        </Button>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Selfie en tenant votre pièce d'identité
                      </label>
                      {selfieData ? (
                        <div className="relative">
                          <img src={selfieData} alt="Selfie" className="w-full h-40 object-cover rounded-lg" />
                          <button
                            onClick={() => resetCapture("selfie")}
                            className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                            data-testid="button-remove-selfie"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => startCamera("selfie")}
                          data-testid="button-camera-selfie"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Prendre une photo
                        </Button>
                      )}
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
                    disabled={!idFrontData || !idBackData || !selfieData || submitKycMutation.isPending}
                    data-testid="button-submit-kyc"
                  >
                    {submitKycMutation.isPending ? "Envoi en cours..." : "Soumettre les documents"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
