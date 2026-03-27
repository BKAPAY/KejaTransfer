import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, AlertCircle, X, Camera, Shield, ArrowRight, ArrowLeft, User, FileText, PenTool, Trash2, Loader2, MapPin, Briefcase, Navigation, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CountryFlag, getCountryName } from "@/components/country-flag";
import { Textarea } from "@/components/ui/textarea";
import { MapContainer, TileLayer, Marker, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const COUNTRY_DATA: Record<string, { name: string }> = {
  BJ: { name: "Benin" },
  TG: { name: "Togo" },
  CI: { name: "Cote d'Ivoire" },
  SN: { name: "Senegal" },
  BF: { name: "Burkina Faso" },
  GN: { name: "Guinee" },
  NE: { name: "Niger" },
  ML: { name: "Mali" },
  CM: { name: "Cameroun" },
  TD: { name: "Tchad" },
  CG: { name: "Congo-Brazzaville" },
  CF: { name: "Centrafrique" },
  GA: { name: "Gabon" },
  CD: { name: "RD Congo" },
};

type CameraMode = "front" | "back" | "selfie" | null;
type UploadStatus = "idle" | "uploading" | "done" | "error";

interface UploadState {
  front: { status: UploadStatus; progress: number };
  back: { status: UploadStatus; progress: number };
  selfie: { status: UploadStatus; progress: number };
  signature: { status: UploadStatus; progress: number };
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

export default function KYC() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [idFrontData, setIdFrontData] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [activityDescription, setActivityDescription] = useState("");
  const [locationData, setLocationData] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showSelfieInstructions, setShowSelfieInstructions] = useState(false);
  const [selfieInstructionsAcknowledged, setSelfieInstructionsAcknowledged] = useState(false);
  const [kycPhone, setKycPhone] = useState("");
  const [kycWhatsapp, setKycWhatsapp] = useState("");
  const [kycActivityUrl, setKycActivityUrl] = useState("");
  const [kycUrlWebsite, setKycUrlWebsite] = useState("");
  const [kycUrlInstagram, setKycUrlInstagram] = useState("");
  const [kycUrlFacebook, setKycUrlFacebook] = useState("");
  const [kycUrlTiktok, setKycUrlTiktok] = useState("");
  const [kycUrlWhatsappGroup, setKycUrlWhatsappGroup] = useState("");
  const [kycUrlWhatsappChannel, setKycUrlWhatsappChannel] = useState("");
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    front: { status: "idle", progress: 0 },
    back: { status: "idle", progress: 0 },
    selfie: { status: "idle", progress: 0 },
    signature: { status: "idle", progress: 0 },
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);

  const uploadDocument = async (type: "front" | "back" | "selfie" | "signature", data: string) => {
    setUploadState(prev => ({
      ...prev,
      [type]: { status: "uploading", progress: 0 }
    }));

    const interval = setInterval(() => {
      setUploadState(prev => {
        const current = prev[type].progress;
        if (current < 90) {
          return { ...prev, [type]: { ...prev[type], progress: current + 10 } };
        }
        return prev;
      });
    }, 100);

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiRequest("POST", "/api/kyc/upload", { type, data });

        clearInterval(interval);
        setUploadState(prev => ({
          ...prev,
          [type]: { status: "done", progress: 100 }
        }));

        toast({
          title: "Document telecharge",
          description: "Le document a ete enregistre avec succes",
        });
        return;
      } catch (error) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        clearInterval(interval);
        setUploadState(prev => ({
          ...prev,
          [type]: { status: "error", progress: 0 }
        }));

        toast({
          title: "Erreur",
          description: "Erreur lors du telechargement. Verifiez votre connexion internet et reessayez.",
          variant: "destructive",
        });
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraMode(null);
  }, [stream]);

  const startCamera = async (mode: CameraMode) => {
    try {
      setCameraError("");
      stopCamera();
      setCameraMode(mode);

      const facingMode = mode === "selfie" ? "user" : "environment";
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 2560 }, height: { ideal: 1920 } },
        audio: false,
      });

      setStream(mediaStream);
    } catch (error: any) {
      console.error("Camera error:", error);
      setCameraMode(null);
      const isPermissionDenied =
        error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      if (isPermissionDenied) {
        setCameraError("permission_denied");
      } else {
        toast({
          title: "Erreur",
          description: "Impossible d'acceder a la camera. Verifiez que votre appareil dispose d'une camera fonctionnelle.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
      };
    }
  }, [stream]);

  const capturePhoto = async () => {
    if (!videoRef.current || !captureCanvasRef.current || !cameraMode || isCapturing) return;

    setIsCapturing(true);

    for (let i = 3; i >= 1; i--) {
      setCaptureCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCaptureCountdown(0);
    await new Promise((r) => setTimeout(r, 300));

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const ctx = canvas.getContext("2d");

    setCaptureCountdown(null);
    setIsCapturing(false);

    if (!ctx) return;

    const maxWidth = 1920;
    const maxHeight = 1440;
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;
    if (targetWidth > maxWidth) {
      targetHeight = Math.round(targetHeight * (maxWidth / targetWidth));
      targetWidth = maxWidth;
    }
    if (targetHeight > maxHeight) {
      targetWidth = Math.round(targetWidth * (maxHeight / targetHeight));
      targetHeight = maxHeight;
    }
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    const imageData = canvas.toDataURL("image/jpeg", 0.92);
    const currentMode = cameraMode;

    if (currentMode === "front") {
      setIdFrontData(imageData);
    } else if (currentMode === "back") {
      setIdBackData(imageData);
    } else if (currentMode === "selfie") {
      setSelfieData(imageData);
    }

    stopCamera();

    await uploadDocument(currentMode, imageData);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (currentStep === 6 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [currentStep]);

  const resetCapture = (type: "front" | "back" | "selfie") => {
    if (type === "front") {
      setIdFrontData(null);
      setUploadState(prev => ({ ...prev, front: { status: "idle", progress: 0 } }));
    } else if (type === "back") {
      setIdBackData(null);
      setUploadState(prev => ({ ...prev, back: { status: "idle", progress: 0 } }));
    } else if (type === "selfie") {
      setSelfieData(null);
      setUploadState(prev => ({ ...prev, selfie: { status: "idle", progress: 0 } }));
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      const pos = getMousePos(e);
      lastPosRef.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      const pos = getMousePos(e);
      if (lastPosRef.current) {
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      lastPosRef.current = pos;
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData(null);
    setUploadState(prev => ({ ...prev, signature: { status: "idle", progress: 0 } }));
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const data = canvas.toDataURL("image/png");
      setSignatureData(data);
      await uploadDocument("signature", data);
    }
  };

  const requestLocation = async () => {
    setLocationLoading(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("La geolocalisation n'est pas supportee par votre navigateur.");
      setLocationLoading(false);
      return;
    }

    const tryGetPosition = (attempt: number) => {
      const maxAttempts = 10;
      const useHighAccuracy = attempt <= 5;
      const timeout = useHighAccuracy ? 10000 : 20000;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocationData({ lat: latitude, lng: longitude });

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr`
            );
            const data = await response.json();
            if (data.display_name) {
              setLocationAddress(data.display_name);
            } else {
              setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          } catch {
            setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }

          setLocationLoading(false);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError("PERMISSION_DENIED");
            setLocationLoading(false);
            return;
          }

          if (attempt < maxAttempts) {
            setTimeout(() => tryGetPosition(attempt + 1), 1500);
          } else {
            setLocationError("Impossible de recuperer votre position. Verifiez que le GPS est active et reessayez.");
            setLocationLoading(false);
          }
        },
        { enableHighAccuracy: useHighAccuracy, timeout, maximumAge: 0 }
      );
    };

    tryGetPosition(1);
  };

  const allUploaded =
    uploadState.front.status === "done" &&
    uploadState.back.status === "done" &&
    uploadState.selfie.status === "done" &&
    uploadState.signature.status === "done" &&
    activityDescription.trim().length >= 10 &&
    !!locationData &&
    !!locationAddress;

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      if (!idFrontData || !idBackData || !selfieData || !signatureData) {
        throw new Error("Tous les documents sont requis");
      }
      if (!activityDescription.trim()) {
        throw new Error("La description d'activite est requise");
      }
      if (!locationData || !locationAddress) {
        throw new Error("La localisation est requise");
      }

      const acceptedTerms = [
        "Je certifie que les informations personnelles fournies sont exactes et correspondent a mes documents officiels.",
        "Je declare exercer l'activite decrite de maniere legale et m'engage a utiliser BKApay conformement aux lois en vigueur.",
        "Je confirme etre le titulaire des documents d'identite soumis et autorise BKApay a les utiliser pour la verification de mon identite.",
        "J'autorise BKApay a collecter et utiliser ma position geographique dans le cadre de la verification de mon compte.",
        "En signant, je certifie l'exactitude de toutes les informations fournies et j'accepte les conditions generales d'utilisation de BKApay. Toute fausse declaration pourra entrainer la suspension de mon compte.",
      ];

      await apiRequest("POST", "/api/kyc/submit", {
        kycIdFront: idFrontData,
        kycIdBack: idBackData,
        kycSelfie: selfieData,
        kycSignature: signatureData,
        kycActivityDescription: activityDescription,
        kycLatitude: locationData?.lat.toString() || "",
        kycLongitude: locationData?.lng.toString() || "",
        kycAddress: locationAddress,
        kycAcceptedTerms: JSON.stringify(acceptedTerms),
        kycPhone: kycPhone,
        kycWhatsapp: kycWhatsapp,
        kycActivityUrl: kycActivityUrl,
        kycUrlWebsite: kycUrlWebsite,
        kycUrlInstagram: kycUrlInstagram,
        kycUrlFacebook: kycUrlFacebook,
        kycUrlTiktok: kycUrlTiktok,
        kycUrlWhatsappGroup: kycUrlWhatsappGroup,
        kycUrlWhatsappChannel: kycUrlWhatsappChannel,
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
      setSignatureData(null);
      setActivityDescription("");
      setLocationData(null);
      setLocationAddress("");
      setCurrentStep(1);
      setIsResubmitting(false);
      setUploadState({
        front: { status: "idle", progress: 0 },
        back: { status: "idle", progress: 0 },
        selfie: { status: "idle", progress: 0 },
        signature: { status: "idle", progress: 0 },
      });
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

  const getCountryInfo = (code: string) => {
    return COUNTRY_DATA[code] || { name: code };
  };

  const renderUploadStatus = (type: "front" | "back" | "selfie" | "signature") => {
    const state = uploadState[type];

    if (state.status === "idle") return null;

    if (state.status === "uploading") {
      return (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Telechargement en cours...</span>
          </div>
          <Progress value={state.progress} className="h-1" />
        </div>
      );
    }

    if (state.status === "done") {
      return (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>Telecharge avec succes</span>
        </div>
      );
    }

    if (state.status === "error") {
      const retryData = type === "front" ? idFrontData : type === "back" ? idBackData : type === "selfie" ? selfieData : null;
      return (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>Echec du telechargement</span>
          </div>
          {retryData && (
            <button
              onClick={() => uploadDocument(type, retryData)}
              className="text-xs text-primary underline"
              data-testid={`btn-retry-upload-${type}`}
            >
              Reessayer
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              currentStep === step
                ? "bg-primary text-primary-foreground"
                : currentStep > step
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {currentStep > step ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          {step < totalSteps && (
            <div className={`w-6 sm:w-10 h-1 mx-0.5 rounded ${currentStep > step ? "bg-green-500" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderCameraView = () => {
    if (!cameraMode) return null;

    const labels: Record<string, string> = {
      front: "Recto de la piece d'identite",
      back: "Verso de la piece d'identite",
      selfie: "Photo avec piece en main",
    };

    const instructions: Record<string, string[]> = {
      front: [
        "Posez la piece sur une surface plate",
        "Eclairage direct, evitez les reflets",
        "Tenez l'appareil stable",
      ],
      back: [
        "Retournez la piece, meme cote verso",
        "Bonne lumiere, pas de reflet",
        "Gardez l'appareil immobile",
      ],
      selfie: [
        "Tenez la piece a cote de votre visage",
        "Regardez directement la camera",
        "Endroit bien eclaire",
      ],
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-black rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-black/80">
            <h3 className="text-white text-sm font-medium">{labels[cameraMode]}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={stopCamera}
              disabled={isCapturing}
              className="text-white hover:bg-white/20"
              data-testid="button-close-camera"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="relative" style={{ height: "420px" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {captureCountdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                {captureCountdown > 0 ? (
                  <span className="text-white font-bold" style={{ fontSize: "72px", lineHeight: 1 }}>
                    {captureCountdown}
                  </span>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/30 border-4 border-white animate-ping" />
                )}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2">
              <ul className="space-y-0.5">
                {instructions[cameraMode].map((tip, i) => (
                  <li key={i} className="text-white/90 text-xs flex items-start gap-1.5">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="py-3 bg-black/80 flex flex-col items-center gap-2">
            <Button
              onClick={capturePhoto}
              disabled={isCapturing}
              className="rounded-full w-14 h-14 bg-white hover:bg-gray-200"
              data-testid="button-capture-photo"
            >
              {isCapturing ? (
                <Loader2 className="w-6 h-6 text-black animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-black" />
              )}
            </Button>
            {!isCapturing && (
              <p className="text-white/60 text-xs">Appuyez quand vous etes pret</p>
            )}
            {isCapturing && (
              <p className="text-yellow-400 text-xs font-medium">Restez immobile...</p>
            )}
          </div>
        </div>

        <canvas ref={captureCanvasRef} className="hidden" />
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <User className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 1 : Vos informations</h3>
        <p className="text-sm text-muted-foreground">Verifiez les informations de votre compte</p>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Prenom</p>
              <p className="text-sm font-medium bg-muted/50 p-2 rounded">{user?.firstName || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Nom</p>
              <p className="text-sm font-medium bg-muted/50 p-2 rounded">{user?.lastName || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Email</p>
              <p className="text-sm font-medium bg-muted/50 p-2 rounded">{user?.email || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Pays</p>
              <p className="text-sm font-medium bg-muted/50 p-2 rounded flex items-center gap-2">
                {user?.country && <CountryFlag code={user.country} size="xs" />}
                {user?.country ? getCountryInfo(user.country).name : "-"}
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Date d'inscription</p>
              <p className="text-sm font-medium bg-muted/50 p-2 rounded">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Numero de telephone</p>
              <PhoneInputWithPrefix
                country={user?.country || "BJ"}
                value={kycPhone}
                onChange={setKycPhone}
                placeholder="97 00 00 00"
                data-testid="input-kyc-phone"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Numero WhatsApp</p>
              <PhoneInputWithPrefix
                country={user?.country || "BJ"}
                value={kycWhatsapp}
                onChange={setKycWhatsapp}
                placeholder="97 00 00 00"
                data-testid="input-kyc-whatsapp"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <div className="flex gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            En continuant, je certifie que les informations personnelles fournies sont exactes et correspondent a mes documents officiels.
          </p>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => setCurrentStep(2)}
        data-testid="button-next-step-1"
        disabled={!kycPhone.trim() || !kycWhatsapp.trim()}
      >
        Etape suivante
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <Briefcase className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 2 : Description de votre activite</h3>
        <p className="text-sm text-muted-foreground">Decrivez votre activite professionnelle ou commerciale</p>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground block">
              Quelle est votre activite ?
            </label>
            <Textarea
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="Decrivez votre activite professionnelle, le type de produits ou services que vous proposez, et comment vous comptez utiliser BKApay... (minimum 100 caracteres)"
              className="min-h-[120px] resize-none"
              data-testid="input-activity-description"
            />
            <p className={`text-xs ${activityDescription.length < 100 ? "text-red-500" : "text-muted-foreground"}`}>
              {activityDescription.length}/100 caracteres minimum
            </p>
          </div>
          
        </CardContent>
      </Card>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <div className="flex gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            En continuant, je declare exercer l'activite decrite de maniere legale et m'engage a utiliser BKApay conformement aux lois en vigueur.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setCurrentStep(1)}
          data-testid="button-prev-step-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          className="flex-1"
          onClick={() => setCurrentStep(3)}
          disabled={activityDescription.trim().length < 100}
          data-testid="button-next-step-2"
        >
          Etape suivante
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const filledUrlCount = [kycUrlWebsite, kycUrlInstagram, kycUrlFacebook, kycUrlTiktok, kycUrlWhatsappGroup, kycUrlWhatsappChannel].filter(u => u.trim()).length;

  const isWhatsappPersonalLink = (url: string) => /wa\.me\//i.test(url);

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <Globe className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 3 : Liens de votre activite</h3>
        <p className="text-sm text-muted-foreground">Renseignez au moins 2 liens parmi les 6 ci-dessous</p>
      </div>

      <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Informations importantes :</p>
          <ul className="text-xs text-orange-700 dark:text-orange-400 space-y-1 list-disc pl-4">
            <li>Vous n'etes pas oblige de remplir tous les champs. Seuls <strong>2 liens minimum</strong> sont requis parmi les 6 proposes.</li>
            <li>Les liens fournis doivent correspondre a des pages ou chaines <strong>actives</strong> qui presentent clairement votre activite. Les pages vides, nouvelles ou sans contenu lie a votre activite entraineront un <strong>rejet de votre verification</strong>.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-sm font-medium">{filledUrlCount}/2 lien(s) renseigne(s) minimum</p>
            <Badge variant={filledUrlCount >= 2 ? "default" : "destructive"}>
              {filledUrlCount >= 2 ? "OK" : "Insuffisant"}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" /> Site web
              </label>
              <Input
                type="url"
                value={kycUrlWebsite}
                onChange={(e) => setKycUrlWebsite(e.target.value)}
                placeholder="https://www.monsite.com"
                data-testid="input-url-website"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                Instagram
              </label>
              <Input
                type="url"
                value={kycUrlInstagram}
                onChange={(e) => setKycUrlInstagram(e.target.value)}
                placeholder="https://instagram.com/moncompte"
                data-testid="input-url-instagram"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </label>
              <Input
                type="url"
                value={kycUrlFacebook}
                onChange={(e) => setKycUrlFacebook(e.target.value)}
                placeholder="https://facebook.com/mapage"
                data-testid="input-url-facebook"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61.01 3.91.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                TikTok
              </label>
              <Input
                type="url"
                value={kycUrlTiktok}
                onChange={(e) => setKycUrlTiktok(e.target.value)}
                placeholder="https://tiktok.com/@moncompte"
                data-testid="input-url-tiktok"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Groupe WhatsApp
              </label>
              <Input
                type="url"
                value={kycUrlWhatsappGroup}
                onChange={(e) => setKycUrlWhatsappGroup(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                data-testid="input-url-whatsapp-group"
              />
              {kycUrlWhatsappGroup && isWhatsappPersonalLink(kycUrlWhatsappGroup) && (
                <p className="text-xs text-red-500">Ce lien semble etre un lien personnel. Veuillez entrer un lien de groupe WhatsApp.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Chaine WhatsApp
              </label>
              <Input
                type="url"
                value={kycUrlWhatsappChannel}
                onChange={(e) => setKycUrlWhatsappChannel(e.target.value)}
                placeholder="https://whatsapp.com/channel/..."
                data-testid="input-url-whatsapp-channel"
              />
              {kycUrlWhatsappChannel && isWhatsappPersonalLink(kycUrlWhatsappChannel) && (
                <p className="text-xs text-red-500">Ce lien semble etre un lien personnel. Veuillez entrer un lien de chaine WhatsApp.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setCurrentStep(2)}
          data-testid="button-prev-step-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          className="flex-1"
          onClick={() => setCurrentStep(4)}
          disabled={filledUrlCount < 2 || (kycUrlWhatsappGroup ? isWhatsappPersonalLink(kycUrlWhatsappGroup) : false) || (kycUrlWhatsappChannel ? isWhatsappPersonalLink(kycUrlWhatsappChannel) : false)}
          data-testid="button-next-step-3"
        >
          Etape suivante
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <FileText className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 4 : Piece d'identite</h3>
        <p className="text-sm text-muted-foreground">Prenez en photo vos pieces d'identite</p>
      </div>

      {cameraError === "permission_denied" && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Acces a la camera refuse</p>
              <p className="text-sm text-red-700 dark:text-red-300">Pour autoriser la camera, suivez ces etapes sur votre telephone :</p>
              <ol className="text-sm text-red-700 dark:text-red-300 space-y-1 list-none">
                <li>1. Allez dans les <strong>Parametres</strong> de votre telephone</li>
                <li>2. Appuyez sur <strong>Applications</strong></li>
                <li>3. Recherchez et ouvrez votre <strong>navigateur</strong> (Chrome, Firefox...)</li>
                <li>4. Appuyez sur <strong>Autorisations</strong></li>
                <li>5. Appuyez sur <strong>Camera</strong> puis choisissez <strong>Autoriser</strong></li>
                <li>6. Revenez ici et reessayez</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCameraError(""); startCamera("front"); }}
                data-testid="button-retry-camera"
              >
                Reessayer
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Photo du recto de la piece d'identite
          </label>
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
              {renderUploadStatus("front")}
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => startCamera("front")}
              data-testid="button-camera-front"
            >
              <div className="flex flex-col items-center gap-2">
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Prendre une photo</span>
              </div>
            </Button>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Photo du verso de la piece d'identite
          </label>
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
              {renderUploadStatus("back")}
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => startCamera("back")}
              data-testid="button-camera-back"
            >
              <div className="flex flex-col items-center gap-2">
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Prendre une photo</span>
              </div>
            </Button>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Photo de vous avec la piece d'identite en main
          </label>
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
              {renderUploadStatus("selfie")}
            </div>
          ) : !selfieInstructionsAcknowledged ? (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex justify-center mb-4">
                  <img
                    src="/selfie-instruction.jpg"
                    alt="Instruction selfie"
                    className="w-48 h-auto rounded-lg"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">Comment prendre votre selfie</p>
                  <p className="text-xs text-muted-foreground">
                    Tenez votre piece d'identite en main, bien visible a cote de votre visage, comme sur l'image ci-dessus. Assurez-vous que votre visage et le document sont clairement visibles.
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => setSelfieInstructionsAcknowledged(true)}
                data-testid="button-selfie-understood"
              >
                J'ai compris
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => startCamera("selfie")}
              data-testid="button-camera-selfie"
            >
              <div className="flex flex-col items-center gap-2">
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Prendre une photo</span>
              </div>
            </Button>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <div className="flex gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            En continuant, je confirme etre le titulaire des documents d'identite soumis et autorise BKApay a les utiliser pour la verification de mon identite.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setCurrentStep(3)}
          data-testid="button-prev-step-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          className="flex-1"
          onClick={() => setCurrentStep(5)}
          disabled={uploadState.front.status !== "done" || uploadState.back.status !== "done" || uploadState.selfie.status !== "done"}
          data-testid="button-next-step-4"
        >
          Etape suivante
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <MapPin className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 5 : Votre emplacement</h3>
        <p className="text-sm text-muted-foreground">Nous devons verifier votre emplacement actuel</p>
      </div>

      {!locationData && !locationLoading && (
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6 text-center space-y-4">
            <Navigation className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Activez votre localisation</p>
              <p className="text-xs text-muted-foreground">
                Appuyez sur le bouton ci-dessous et autorisez l'acces a votre position lorsque votre appareil vous le demande.
              </p>
            </div>
            <Button
              onClick={requestLocation}
              className="w-full"
              data-testid="button-request-location"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Localiser ma position
            </Button>
          </CardContent>
        </Card>
      )}

      {locationLoading && (
        <Card className="border-2">
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Recherche de votre position en cours...</p>
            <p className="text-xs text-muted-foreground">Veuillez patienter quelques instants</p>
          </CardContent>
        </Card>
      )}

      {locationError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              {locationError === "PERMISSION_DENIED" ? (
                <>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Acces a la localisation refuse</p>
                  <p className="text-sm text-red-700 dark:text-red-300">Pour autoriser la localisation, suivez ces etapes sur votre telephone :</p>
                  <ol className="text-sm text-red-700 dark:text-red-300 space-y-1 list-none">
                    <li>1. Allez dans les <strong>Parametres</strong> de votre telephone</li>
                    <li>2. Appuyez sur <strong>Applications</strong></li>
                    <li>3. Recherchez et ouvrez votre <strong>navigateur</strong> (Chrome, Firefox...)</li>
                    <li>4. Appuyez sur <strong>Autorisations</strong></li>
                    <li>5. Appuyez sur <strong>Position</strong> puis choisissez <strong>Autoriser</strong></li>
                    <li>6. Revenez ici et reessayez</li>
                  </ol>
                </>
              ) : (
                <p className="text-sm text-red-700 dark:text-red-300">{locationError}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={requestLocation}
                data-testid="button-retry-location"
              >
                Reessayer
              </Button>
            </div>
          </div>
        </div>
      )}

      {locationData && (
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border-2" style={{ height: "300px" }}>
            <MapContainer
              center={[locationData.lat, locationData.lng]}
              zoom={17}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
              dragging={true}
              zoomControl={true}
            >
              <LayersControl position="topright">
                <LayersControl.BaseLayer name="Plan">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked name="Satellite">
                  <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              <Marker position={[locationData.lat, locationData.lng]} />
              <RecenterMap lat={locationData.lat} lng={locationData.lng} />
            </MapContainer>
          </div>

          <Card className="border-2">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Votre adresse detectee</p>
                  <p className="text-sm text-foreground break-words">{locationAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-700 dark:text-green-300">Position localisee avec succes</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={requestLocation}
            className="w-full"
            data-testid="button-refresh-location"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Actualiser ma position
          </Button>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <div className="flex gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            En continuant, j'autorise BKApay a collecter et utiliser ma position geographique dans le cadre de la verification de mon compte.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setCurrentStep(4)}
          data-testid="button-prev-step-5"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          className="flex-1"
          onClick={() => setCurrentStep(6)}
          disabled={!locationData}
          data-testid="button-next-step-5"
        >
          Etape suivante
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <PenTool className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 6 : Signature</h3>
        <p className="text-sm text-muted-foreground">Signez dans le cadre ci-dessous</p>
      </div>

      <div className="border-2 border-dashed rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          width={350}
          height={200}
          className="w-full border rounded cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          data-testid="canvas-signature"
        />
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={clearSignature}
            className="flex-1"
            data-testid="button-clear-signature"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Effacer
          </Button>
          <Button
            size="sm"
            onClick={saveSignature}
            className="flex-1"
            disabled={uploadState.signature.status === "uploading"}
            data-testid="button-save-signature"
          >
            {uploadState.signature.status === "uploading" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1" />
            )}
            Enregistrer
          </Button>
        </div>
        {renderUploadStatus("signature")}
      </div>

      {uploadState.signature.status === "done" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">Signature enregistree et telechargee</span>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <div className="flex gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            En signant et soumettant, je certifie l'exactitude de toutes les informations fournies et j'accepte les conditions generales d'utilisation de BKApay. Toute fausse declaration pourra entrainer la suspension de mon compte.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setCurrentStep(5)}
          data-testid="button-prev-step-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          className="flex-1"
          onClick={() => submitKycMutation.mutate()}
          disabled={!allUploaded || submitKycMutation.isPending}
          data-testid="button-submit-kyc"
        >
          {submitKycMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Finalisation...
            </>
          ) : (
            "Soumettre"
          )}
        </Button>
      </div>
    </div>
  );

  const startKycProcess = () => {
    setIsResubmitting(true);
    setCurrentStep(1);
    setIdFrontData(null);
    setIdBackData(null);
    setSelfieData(null);
    setSignatureData(null);
    setActivityDescription("");
    setKycUrlWebsite("");
    setKycUrlInstagram("");
    setKycUrlFacebook("");
    setKycUrlTiktok("");
    setKycUrlWhatsappGroup("");
    setKycUrlWhatsappChannel("");
    setLocationData(null);
    setLocationAddress("");
    setLocationError("");
    setUploadState({
      front: { status: "idle", progress: 0 },
      back: { status: "idle", progress: 0 },
      selfie: { status: "idle", progress: 0 },
      signature: { status: "idle", progress: 0 },
    });
  };

  return (
    <div className="space-y-6">
      {renderCameraView()}

      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Verification KYC
        </h1>
        <p className="text-sm text-muted-foreground">Verifiez votre identite pour acceder a toutes les fonctionnalites</p>
      </div>

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
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">Attention</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      Veuillez utiliser vos vraies informations personnelles et des documents authentiques. Apres 10 rejets consecutifs, votre compte sera automatiquement suspendu.
                      {(user as any).kycRejectionCount > 0 && (
                        <span className="font-semibold"> ({(user as any).kycRejectionCount}/10 rejet{(user as any).kycRejectionCount > 1 ? "s" : ""})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={startKycProcess}
                className="w-full"
                data-testid="button-resubmit-kyc"
              >
                Soumettre a nouveau
              </Button>
            </div>
          ) : user?.kycStatus === "pending" && !isResubmitting ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Shield className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Verification d'identite requise</p>
                <p className="text-xs text-muted-foreground mt-1">Completez la verification en 5 etapes simples</p>
              </div>
              <Button
                onClick={startKycProcess}
                className="w-full"
                data-testid="button-start-kyc"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Commencer la verification
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {renderStepIndicator()}
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}
              {currentStep === 6 && renderStep6()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
