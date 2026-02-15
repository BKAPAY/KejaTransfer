import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

type VerifyStep = "ready" | "loading" | "denied";

export default function LoginVerify() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<VerifyStep>("ready");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const getConnectionType = (): string => {
    try {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        const type = conn.type || "";
        const effectiveType = conn.effectiveType || "";
        if (type === "wifi") return "WiFi";
        if (type === "cellular") return `Cellulaire (${effectiveType.toUpperCase()})`;
        if (type === "ethernet") return "Ethernet";
        if (effectiveType) return effectiveType.toUpperCase();
      }
    } catch (e) {}
    return "Inconnu";
  };

  const gpsMutation = useMutation({
    mutationFn: async (data: { latitude: number; longitude: number; accuracy: number }) => {
      const connectionType = getConnectionType();
      const response = await apiRequest("POST", "/api/auth/login-verify", {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        connectionType,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/login-verify-status"] });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la vérification",
        variant: "destructive",
      });
      setStep("ready");
    },
  });

  const handleAuthorize = async () => {
    setStep("loading");
    setErrorMsg(null);

    if (!navigator.geolocation) {
      setErrorMsg("La géolocalisation n'est pas supportée par votre navigateur.");
      setStep("denied");
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          if (bestPosition) {
            resolve();
          } else {
            reject(new Error("timeout"));
          }
        }, 20000);

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
              bestPosition = position;
            }
            if (position.coords.accuracy <= 50) {
              clearTimeout(timeout);
              if (watchId !== null) navigator.geolocation.clearWatch(watchId);
              resolve();
            }
          },
          (err) => {
            clearTimeout(timeout);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }
        );
      });

      if (bestPosition) {
        const pos = bestPosition as GeolocationPosition;
        gpsMutation.mutate({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      } else {
        setErrorMsg("Impossible d'obtenir votre position. Activez le GPS et réessayez.");
        setStep("denied");
      }
    } catch (err: any) {
      console.error("[LoginVerify] GPS error:", err);
      setErrorMsg("Vous devez activer la localisation GPS pour accéder à votre compte. Vérifiez que le GPS est activé dans les paramètres de votre appareil.");
      setStep("denied");
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (e) {}
    sessionStorage.removeItem("bkapay_photo_taken");
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
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
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoImage} alt="BKApay" className="h-12" data-testid="img-logo" />
          </div>
          <CardTitle className="text-lg" data-testid="text-verify-title">Autorisation requise</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "ready" && (
            <div className="space-y-4">
              <Button
                className="w-full"
                onClick={handleAuthorize}
                data-testid="button-authorize"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Autoriser la connexion
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleLogout}
                data-testid="button-cancel-login"
              >
                Annuler
              </Button>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connexion en cours...</p>
            </div>
          )}

          {step === "denied" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
                <p className="text-sm text-destructive font-medium">Connexion impossible</p>
                <p className="text-xs text-muted-foreground mt-2">{errorMsg}</p>
              </div>
              <Button
                className="w-full"
                onClick={() => setStep("ready")}
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
