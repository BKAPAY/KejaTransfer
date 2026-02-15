import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Camera, MapPin, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

type VerifyStep = "permissions" | "capturing" | "done" | "denied";

export default function LoginVerify() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: verifyStatus, isLoading: statusLoading, error: statusError } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/auth/login-verify-status"],
  });

  useEffect(() => {
    if (statusError) {
      setLocation("/login");
    }
  }, [statusError, setLocation]);

  useEffect(() => {
    if (verifyStatus?.verified === true) {
      setLocation("/dashboard");
    }
  }, [verifyStatus, setLocation]);
  const [step, setStep] = useState<VerifyStep>("permissions");
  const [cameraReady, setCameraReady] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const requestPermissions = async () => {
    setStep("capturing");
    setCaptureError(null);

    let cameraOk = false;
    let gpsOk = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      cameraOk = true;
      setCameraReady(true);
    } catch (err) {
      console.error("[LoginVerify] Camera error:", err);
      setCaptureError("Vous devez autoriser l'accès à la caméra pour continuer.");
      setStep("denied");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      setGpsData({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      gpsOk = true;
      setGpsReady(true);
    } catch (err) {
      console.error("[LoginVerify] GPS error:", err);
      stopCamera();
      setCaptureError("Vous devez autoriser l'accès à la localisation pour continuer.");
      setStep("denied");
      return;
    }

    if (cameraOk && gpsOk) {
      setTimeout(() => {
        takePhoto();
      }, 1500);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      setPhotoData(dataUrl);
      stopCamera();
      submitVerification(dataUrl);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: { photoBase64: string; latitude: number; longitude: number; accuracy: number }) => {
      const response = await apiRequest("POST", "/api/auth/login-verify", data);
      return await response.json();
    },
    onSuccess: () => {
      setStep("done");
      toast({
        title: "Vérification réussie",
        description: "Accès au tableau de bord autorisé",
      });
      setTimeout(() => {
        setLocation("/dashboard");
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la vérification",
        variant: "destructive",
      });
    },
  });

  const submitVerification = (photo: string) => {
    if (!gpsData) return;
    submitMutation.mutate({
      photoBase64: photo,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      accuracy: gpsData.accuracy,
    });
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (e) {}
    setLocation("/login");
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoImage} alt="BKApay" className="h-12" data-testid="img-logo" />
          </div>
          <CardTitle className="text-xl" data-testid="text-verify-title">Vérification de sécurité</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Pour protéger votre compte, nous avons besoin de votre photo et votre position.
          </p>
        </CardHeader>
        <CardContent>
          {step === "permissions" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Camera className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Caméra</p>
                    <p className="text-xs text-muted-foreground">Une photo sera prise automatiquement</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Localisation GPS</p>
                    <p className="text-xs text-muted-foreground">Votre position exacte sera enregistrée</p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Si vous refusez ces autorisations, vous ne pourrez pas accéder à votre tableau de bord.
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={requestPermissions}
                data-testid="button-authorize"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Autoriser et continuer
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleLogout}
                data-testid="button-cancel-login"
              >
                Annuler la connexion
              </Button>
            </div>
          )}

          {step === "capturing" && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  data-testid="video-camera"
                />
                {!photoData && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-2 border-white/60 rounded-full" />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {cameraReady ? (
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <span className="text-sm">Caméra {cameraReady ? "activée" : "en cours..."}</span>
                </div>
                <div className="flex items-center gap-2">
                  {gpsReady ? (
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <span className="text-sm">GPS {gpsReady ? "activé" : "en cours..."}</span>
                </div>
              </div>

              {submitMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Envoi des données...</span>
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <ShieldCheck className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-sm font-medium">Vérification réussie</p>
              <p className="text-xs text-muted-foreground">Redirection vers le tableau de bord...</p>
            </div>
          )}

          {step === "denied" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
                <p className="text-sm font-medium text-destructive">Accès refusé</p>
                <p className="text-xs text-muted-foreground mt-2">{captureError}</p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setStep("permissions");
                  setCaptureError(null);
                  setCameraReady(false);
                  setGpsReady(false);
                }}
                data-testid="button-retry"
              >
                Réessayer
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleLogout}
                data-testid="button-logout-denied"
              >
                Se déconnecter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
