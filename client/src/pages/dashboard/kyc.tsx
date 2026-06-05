import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, AlertCircle, X, Camera, Shield, ArrowRight, ArrowLeft, User, FileText, PenTool, Trash2, Loader2, MapPin, Briefcase, Navigation, Globe, Check, Pencil, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_SECTORS, getSubSectorsForSector } from "@shared/activity-sectors";
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube, SiWhatsapp } from "react-icons/si";
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
  const [kycUrlYoutube, setKycUrlYoutube] = useState("");
  const [kycUrlWhatsappGroup, setKycUrlWhatsappGroup] = useState("");
  const [kycUrlWhatsappChannel, setKycUrlWhatsappChannel] = useState("");
  const [kycSector, setKycSector] = useState("");
  const [kycSubSector, setKycSubSector] = useState("");
  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  // OCR - lecture automatique de la pièce d'identité recto
  const lastScannedFrontRef = useRef<string | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [ocrExtracted, setOcrExtracted] = useState<{ firstName: string; lastName: string } | null>(null);

  // Déclenchement OCR direct (appelé dans capturePhoto, pas via useEffect)
  const triggerOcrScan = async (imageData: string) => {
    if (!imageData || imageData === lastScannedFrontRef.current) return;
    lastScannedFrontRef.current = imageData;
    const normalize = (s: string) =>
      s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    setOcrScanning(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/scan-id", { imageData });
      const result: any = await res.json();
      const { firstName: extFirst, lastName: extLast } = result;
      if (extFirst && extLast) {
        const uFirst = normalize(user?.firstName || "");
        const uLast = normalize(user?.lastName || "");
        if (normalize(extFirst) !== uFirst || normalize(extLast) !== uLast) {
          setOcrExtracted({ firstName: extFirst, lastName: extLast });
          setOcrDialogOpen(true);
        }
      }
    } catch {
      // Silently fail — OCR est un service complémentaire
    } finally {
      setOcrScanning(false);
    }
  };

  const handleOcrConfirmName = async () => {
    if (!ocrExtracted) return;
    try {
      await apiRequest("PATCH", "/api/user/update-name", { firstName: ocrExtracted.firstName, lastName: ocrExtracted.lastName });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Nom mis à jour", description: `Votre nom a été corrigé en ${ocrExtracted.firstName} ${ocrExtracted.lastName}.` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOcrDialogOpen(false);
      setOcrExtracted(null);
    }
  };
  const [kycDocumentType, setKycDocumentType] = useState("");
  const [kycDocumentNumber, setKycDocumentNumber] = useState("");
  const [kycDocumentExpiryDate, setKycDocumentExpiryDate] = useState("");
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
        if (current < 85) {
          return { ...prev, [type]: { ...prev[type], progress: current + 3 } };
        }
        return prev;
      });
    }, 400);

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        try {
          const res = await fetch("/api/kyc/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, data }),
            credentials: "include",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            let msg = "Erreur lors du telechargement";
            try { const j = JSON.parse(text); if (j.error) msg = j.error; } catch {}
            throw new Error(msg);
          }
        } finally {
          clearTimeout(timeoutId);
        }

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
      } catch (error: any) {
        const isAbort = error?.name === "AbortError";
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 3000 * attempt));
          continue;
        }
        clearInterval(interval);
        setUploadState(prev => ({
          ...prev,
          [type]: { status: "error", progress: 0 }
        }));

        toast({
          title: "Telechargement echoue",
          description: isAbort
            ? "Le telechargement a pris trop de temps. Verifiez votre connexion et reessayez."
            : "Erreur lors du telechargement. Verifiez votre connexion internet et reessayez.",
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
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
      }

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
      const video = videoRef.current;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().catch(console.error);
      };
      video.onloadeddata = () => {
        video.play().catch(console.error);
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

    const maxWidth = 1280;
    const maxHeight = 960;
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

    const imageData = canvas.toDataURL("image/jpeg", 0.80);
    const currentMode = cameraMode;

    if (currentMode === "front") {
      setIdFrontData(imageData);
      // Déclencher OCR immédiatement après capture (sans passer par useEffect)
      triggerOcrScan(imageData);
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
      if (!kycSector) {
        throw new Error("Le secteur d'activité est requis");
      }
      if (getSubSectorsForSector(kycSector).length > 0 && !kycSubSector) {
        throw new Error("Le sous-secteur d'activité est requis");
      }

      const acceptedTerms = [
        "Je certifie que les informations personnelles fournies sont exactes et correspondent a mes documents officiels.",
        "Je declare exercer l'activite decrite de maniere legale et m'engage a utiliser BKApay conformement aux lois en vigueur.",
        "Je confirme etre le titulaire des documents d'identite soumis et autorise BKApay a les utiliser pour la verification de mon identite.",
        "J'autorise BKApay a collecter et utiliser ma position geographique dans le cadre de la verification de mon compte.",
        "En signant, je certifie l'exactitude de toutes les informations fournies et j'accepte les conditions generales d'utilisation de BKApay. Toute fausse declaration pourra entrainer la suspension de mon compte.",
      ];

      await apiRequest("POST", "/api/kyc/submit", {
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
        kycUrlYoutube: kycUrlYoutube,
        kycUrlWhatsappGroup: kycUrlWhatsappGroup,
        kycUrlWhatsappChannel: kycUrlWhatsappChannel,
        kycDocumentType: kycDocumentType,
        kycDocumentNumber: kycDocumentNumber,
        kycDocumentExpiryDate: kycDocumentExpiryDate,
        kycSector: kycSector,
        kycSubSector: kycSubSector,
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
      setKycDocumentType("");
      setKycDocumentNumber("");
      setKycDocumentExpiryDate("");
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
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground block">
                Secteur d'activité <span className="text-destructive">*</span>
              </label>
              <Select value={kycSector} onValueChange={(v) => { setKycSector(v); setKycSubSector(""); }}>
                <SelectTrigger data-testid="select-kyc-sector">
                  <SelectValue placeholder="Sélectionnez votre secteur..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_SECTORS.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {kycSector && getSubSectorsForSector(kycSector).length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">
                  Sous-secteur <span className="text-destructive">*</span>
                </label>
                <Select value={kycSubSector} onValueChange={setKycSubSector}>
                  <SelectTrigger data-testid="select-kyc-subsector">
                    <SelectValue placeholder="Sélectionnez votre sous-secteur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubSectorsForSector(kycSector).map((ss) => (
                      <SelectItem key={ss.code} value={ss.code}>{ss.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
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

  const platformConfigs = [
    {
      key: "website",
      label: "Site web",
      icon: Globe,
      iconClass: "text-blue-600",
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      placeholder: "https://www.monsite.com",
      value: kycUrlWebsite,
      setValue: setKycUrlWebsite,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: SiFacebook,
      iconClass: "text-[#1877F2]",
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      placeholder: "https://facebook.com/votre-page",
      value: kycUrlFacebook,
      setValue: setKycUrlFacebook,
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: SiInstagram,
      iconClass: "text-[#E4405F]",
      bgClass: "bg-pink-50 dark:bg-pink-950/30",
      placeholder: "https://instagram.com/votre-compte",
      value: kycUrlInstagram,
      setValue: setKycUrlInstagram,
    },
    {
      key: "tiktok",
      label: "TikTok",
      icon: SiTiktok,
      iconClass: "text-foreground",
      bgClass: "bg-muted",
      placeholder: "https://tiktok.com/@votre-compte",
      value: kycUrlTiktok,
      setValue: setKycUrlTiktok,
    },
    {
      key: "youtube",
      label: "YouTube",
      icon: SiYoutube,
      iconClass: "text-[#FF0000]",
      bgClass: "bg-red-50 dark:bg-red-950/30",
      placeholder: "https://youtube.com/@votre-chaine",
      value: kycUrlYoutube,
      setValue: setKycUrlYoutube,
    },
    {
      key: "whatsappGroup",
      label: "Groupe WhatsApp",
      icon: SiWhatsapp,
      iconClass: "text-[#25D366]",
      bgClass: "bg-green-50 dark:bg-green-950/30",
      placeholder: "https://chat.whatsapp.com/...",
      value: kycUrlWhatsappGroup,
      setValue: setKycUrlWhatsappGroup,
    },
    {
      key: "whatsappChannel",
      label: "Chaîne WhatsApp",
      icon: SiWhatsapp,
      iconClass: "text-[#25D366]",
      bgClass: "bg-green-50 dark:bg-green-950/30",
      placeholder: "https://whatsapp.com/channel/...",
      value: kycUrlWhatsappChannel,
      setValue: setKycUrlWhatsappChannel,
    },
  ];

  const URL_VALIDATORS: Record<string, { test: (url: string) => boolean; error: string }> = {
    website: {
      test: (url) => /^https?:\/\/.{3,}/i.test(url),
      error: "Entrez une URL valide commencant par https:// ou http://",
    },
    facebook: {
      test: (url) => /^https?:\/\/(www\.)?(facebook\.com|fb\.com|fb\.me)\//i.test(url),
      error: "L'URL doit etre un lien Facebook (facebook.com)",
    },
    instagram: {
      test: (url) => /^https?:\/\/(www\.)?instagram\.com\//i.test(url),
      error: "L'URL doit etre un lien Instagram (instagram.com)",
    },
    tiktok: {
      test: (url) => /^https?:\/\/(www\.)?tiktok\.com\//i.test(url),
      error: "L'URL doit etre un lien TikTok (tiktok.com)",
    },
    youtube: {
      test: (url) => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url),
      error: "L'URL doit etre un lien YouTube (youtube.com ou youtu.be)",
    },
    whatsappGroup: {
      test: (url) => /^https?:\/\/chat\.whatsapp\.com\//i.test(url),
      error: "Le lien groupe WhatsApp doit commencer par https://chat.whatsapp.com/",
    },
    whatsappChannel: {
      test: (url) => /^https?:\/\/(www\.)?whatsapp\.com\/channel\//i.test(url),
      error: "Le lien chaine WhatsApp doit commencer par https://whatsapp.com/channel/",
    },
  };

  const validateUrl = (key: string, url: string): string | null => {
    if (!url.trim()) return null;
    const validator = URL_VALIDATORS[key];
    if (!validator) return null;
    return validator.test(url) ? null : validator.error;
  };

  const filledUrlCount = platformConfigs.filter(p => {
    const trimmed = p.value.trim();
    if (!trimmed) return false;
    return validateUrl(p.key, trimmed) === null;
  }).length;

  const isWhatsappPersonalLink = (url: string) => /wa\.me\//i.test(url);

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <Globe className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 3 : Liens de votre activité</h3>
        <p className="text-sm text-muted-foreground">Cliquez sur une plateforme pour ajouter votre lien</p>
      </div>

      <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Informations importantes :</p>
          <ul className="text-xs text-orange-700 dark:text-orange-400 space-y-1 list-disc pl-4">
            <li>Fournissez <strong>au moins un lien</strong> parmi : site web, Facebook, Instagram, TikTok, YouTube, groupe WhatsApp, chaîne WhatsApp.</li>
            <li>Le lien doit correspondre à une page ou chaîne <strong>active</strong> qui présente clairement votre activité. Une page vide, nouvelle ou sans rapport avec votre activité entraînera un <strong>rejet de votre vérification</strong>.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-sm font-medium">{filledUrlCount} lien{filledUrlCount > 1 ? "s" : ""} renseigné{filledUrlCount > 1 ? "s" : ""} (minimum 1)</p>
            <Badge variant={filledUrlCount >= 1 ? "default" : "destructive"}>
              {filledUrlCount >= 1 ? "OK" : "Insuffisant"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {platformConfigs.map((p) => {
              const Icon = p.icon;
              const filled = !!p.value.trim();
              const isActive = activePlatform === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setActivePlatform(isActive ? null : p.key)}
                  className={`flex items-center gap-3 p-3 rounded-md border text-left hover-elevate active-elevate-2 ${
                    isActive ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                  data-testid={`button-platform-${p.key}`}
                >
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center ${p.bgClass} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${p.iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.label}</p>
                    {filled ? (
                      <p className="text-xs text-muted-foreground truncate">{p.value}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Ajouter un lien</p>
                    )}
                  </div>
                  {filled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Pencil className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {activePlatform && (() => {
            const p = platformConfigs.find(c => c.key === activePlatform);
            if (!p) return null;
            const Icon = p.icon;
            const urlError = validateUrl(p.key, p.value);
            const canConfirm = !p.value.trim() || urlError === null;
            return (
              <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${p.iconClass}`} />
                  <label className="text-sm font-medium">Lien {p.label}</label>
                </div>
                <div className="space-y-1">
                  <Input
                    type="url"
                    value={p.value}
                    onChange={(e) => p.setValue(e.target.value)}
                    placeholder={p.placeholder}
                    autoFocus
                    data-testid={`input-url-${p.key}`}
                    className={urlError ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {urlError && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {urlError}
                    </p>
                  )}
                  {!urlError && p.value.trim() && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                      Lien valide
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  {p.value.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { p.setValue(""); }}
                      data-testid={`button-clear-url-${p.key}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Effacer
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActivePlatform(null)}
                    disabled={!canConfirm}
                    data-testid={`button-confirm-url-${p.key}`}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Valider
                  </Button>
                </div>
              </div>
            );
          })()}
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
          disabled={filledUrlCount < 1}
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

      {(() => {
        const DOCUMENT_TYPES = [
          { value: "cni", label: "Carte Nationale d'Identite (CNI)", hasExpiry: true },
          { value: "passport", label: "Passeport", hasExpiry: true },
          { value: "driving_license", label: "Permis de conduire", hasExpiry: true },
          { value: "residence_card", label: "Carte de sejour / Titre de sejour", hasExpiry: true },
          { value: "voter_card", label: "Carte electorale", hasExpiry: false },
        ];
        const selectedDoc = DOCUMENT_TYPES.find(d => d.value === kycDocumentType);
        const hasExpiry = selectedDoc?.hasExpiry ?? false;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Informations sur la piece d'identite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Type de piece d'identite <span className="text-destructive">*</span>
                </label>
                <Select value={kycDocumentType} onValueChange={setKycDocumentType}>
                  <SelectTrigger data-testid="select-document-type">
                    <SelectValue placeholder="Choisir le type de piece" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {kycDocumentType && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Numero de la piece <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={kycDocumentNumber}
                    onChange={e => setKycDocumentNumber(e.target.value)}
                    placeholder="Entrez le numero de la piece"
                    data-testid="input-document-number"
                  />
                </div>
              )}
              {kycDocumentType && hasExpiry && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Date d'expiration <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={kycDocumentExpiryDate}
                    onChange={e => setKycDocumentExpiryDate(e.target.value)}
                    data-testid="input-document-expiry"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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
          disabled={(() => {
            if (!kycDocumentType || !kycDocumentNumber.trim()) return true;
            const DOCUMENT_TYPES = [
              { value: "cni", hasExpiry: true },
              { value: "passport", hasExpiry: true },
              { value: "driving_license", hasExpiry: true },
              { value: "residence_card", hasExpiry: true },
              { value: "voter_card", hasExpiry: false },
            ];
            const selectedDoc = DOCUMENT_TYPES.find(d => d.value === kycDocumentType);
            if (selectedDoc?.hasExpiry && !kycDocumentExpiryDate) return true;
            return uploadState.front.status !== "done" || uploadState.back.status !== "done" || uploadState.selfie.status !== "done";
          })()}
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
    setKycUrlYoutube("");
    setKycUrlWhatsappGroup("");
    setKycUrlWhatsappChannel("");
    setActivePlatform(null);
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

      {/* Dialog OCR : correction automatique du nom via pièce d'identité */}
      <AlertDialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nom différent de la pièce d'identité</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>La lecture automatique de votre pièce d'identité a détecté un nom différent de celui enregistré sur votre compte :</p>
                <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-md p-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nom sur la pièce d'identité</p>
                    <p className="font-semibold">{ocrExtracted?.firstName} {ocrExtracted?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nom sur le compte</p>
                    <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                  </div>
                </div>
                <p>Souhaitez-vous mettre à jour votre nom pour qu'il corresponde à votre pièce d'identité ?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setOcrDialogOpen(false); setOcrExtracted(null); }}>
              Conserver mon nom actuel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOcrConfirmName}>
              Mettre à jour le nom
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ocrScanning && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-card border rounded-md px-4 py-2 shadow-md z-50 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Lecture de la pièce d'identité en cours…
        </div>
      )}
    </div>
  );
}
