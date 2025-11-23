import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import { Video, Camera, CheckCircle2, Clock, AlertCircle, X } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [idFrontData, setIdFrontData] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  
  const [activeCamera, setActiveCamera] = useState<"front" | "back" | "selfie" | null>(null);
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

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !activeCamera) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    
    const imageData = canvasRef.current.toDataURL("image/jpeg");
    
    if (activeCamera === "front") setIdFrontData(imageData);
    else if (activeCamera === "back") setIdBackData(imageData);
    else if (activeCamera === "selfie") setSelfieData(imageData);

    stopCamera();
    toast({
      title: "Photo capturée",
      description: "Votre photo a été capturée avec succès",
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
                  
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={capturePhoto}
                      data-testid="button-capture-photo"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Capturer
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={stopCamera}
                      data-testid="button-cancel-camera"
                    >
                      Annuler
                    </Button>
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
