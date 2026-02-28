import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShieldCheck, AlertTriangle, Loader2, MapPin, Wifi } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

type VerifyStep = "ready" | "loading" | "denied";

function getConnectionType(): string {
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
}

async function getPositionFast(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation_unsupported"));
      return;
    }

    let resolved = false;
    let bestPos: GeolocationPosition | null = null;

    // Tentative rapide : position réseau (pas de GPS haute précision)
    // Résultat en moins d'une seconde sur la plupart des appareils
    const tryLowAccuracy = () =>
      new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 30000,
        });
      });

    // Tentative haute précision en parallèle (GPS réel)
    let watchId: number | null = null;
    const highAccuracyTimeout = setTimeout(() => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (!resolved) {
        if (bestPos) {
          resolved = true;
          resolve(bestPos);
        }
      }
    }, 8000);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (resolved) return;
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }
        // Accepter dès qu'on a une position précise OU après 2 secondes si on a n'importe quelle position
        if (pos.coords.accuracy <= 100) {
          clearTimeout(highAccuracyTimeout);
          navigator.geolocation.clearWatch(watchId!);
          resolved = true;
          resolve(pos);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    // Lancer la tentative rapide simultanément
    tryLowAccuracy()
      .then((pos) => {
        if (!resolved) {
          // On a une position rapide — on l'utilise immédiatement
          // mais on laisse la haute précision continuer 2 secondes
          bestPos = bestPos
            ? bestPos.coords.accuracy < pos.coords.accuracy ? bestPos : pos
            : pos;

          setTimeout(() => {
            if (!resolved) {
              clearTimeout(highAccuracyTimeout);
              if (watchId !== null) navigator.geolocation.clearWatch(watchId);
              resolved = true;
              resolve(bestPos!);
            }
          }, 2000);
        }
      })
      .catch(() => {
        // La tentative rapide a échoué → on attend la haute précision
      });

    // Timeout global de sécurité : 10 secondes max
    setTimeout(() => {
      if (!resolved) {
        clearTimeout(highAccuracyTimeout);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        if (bestPos) {
          resolved = true;
          resolve(bestPos);
        } else {
          reject(new Error("timeout"));
        }
      }
    }, 10000);
  });
}

export default function LoginVerify() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<VerifyStep>("ready");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Localisation en cours...");
  const loadingMsgRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { data: verifyStatus, isLoading: statusLoading, error: statusError } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/auth/login-verify-status"],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
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

  const clearLoadingTimers = () => {
    loadingMsgRef.current.forEach((t) => clearTimeout(t));
    loadingMsgRef.current = [];
  };

  const handleAuthorize = async () => {
    setStep("loading");
    setErrorMsg(null);
    setLoadingMsg("Localisation en cours...");

    // Messages de progression pour rassurer l'utilisateur
    const t1 = setTimeout(() => setLoadingMsg("Recherche du signal GPS..."), 2000);
    const t2 = setTimeout(() => setLoadingMsg("Connexion au serveur..."), 5000);
    const t3 = setTimeout(() => setLoadingMsg("Finalisation..."), 8000);
    loadingMsgRef.current = [t1, t2, t3];

    try {
      const pos = await getPositionFast();
      clearLoadingTimers();
      setLoadingMsg("Connexion au serveur...");
      gpsMutation.mutate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch (err: any) {
      clearLoadingTimers();
      if (err?.code === 1 || err?.message === "geolocation_unsupported") {
        setErrorMsg("Vous devez autoriser la localisation GPS pour accéder à votre compte. Activez-la dans les paramètres de votre navigateur/appareil.");
      } else {
        setErrorMsg("Impossible d'obtenir votre position. Vérifiez que le GPS est activé et réessayez.");
      }
      setStep("denied");
    }
  };

  const handleLogout = async () => {
    clearLoadingTimers();
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (e) {}
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
              <div className="flex items-start gap-3 bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Une localisation GPS est requise pour sécuriser votre connexion.</span>
              </div>
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
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <MapPin className="h-4 w-4 text-primary absolute inset-0 m-auto" />
              </div>
              <p className="text-sm font-medium">{loadingMsg}</p>
              <p className="text-xs text-muted-foreground text-center">
                Si cela prend du temps, vérifiez que le GPS est activé.
              </p>
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
                onClick={handleAuthorize}
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
