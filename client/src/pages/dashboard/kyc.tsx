import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle, X, Image, Shield, ArrowRight, ArrowLeft, User, FileText, PenTool, Trash2 } from "lucide-react";

const COUNTRY_DATA: Record<string, { name: string; flag: string }> = {
  BJ: { name: "Benin", flag: "🇧🇯" },
  TG: { name: "Togo", flag: "🇹🇬" },
  CI: { name: "Cote d'Ivoire", flag: "🇨🇮" },
  SN: { name: "Senegal", flag: "🇸🇳" },
  BF: { name: "Burkina Faso", flag: "🇧🇫" },
  GN: { name: "Guinee", flag: "🇬🇳" },
  NE: { name: "Niger", flag: "🇳🇪" },
  ML: { name: "Mali", flag: "🇲🇱" },
  CM: { name: "Cameroun", flag: "🇨🇲" },
  TD: { name: "Tchad", flag: "🇹🇩" },
  CG: { name: "Congo-Brazzaville", flag: "🇨🇬" },
  CF: { name: "Centrafrique", flag: "🇨🇫" },
  GA: { name: "Gabon", flag: "🇬🇦" },
  CD: { name: "RD Congo", flag: "🇨🇩" },
};

export default function KYC() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [idFrontData, setIdFrontData] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (currentStep === 3 && canvasRef.current) {
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

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      const pos = getMousePos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      const pos = getMousePos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const data = canvas.toDataURL("image/png");
      setSignatureData(data);
      toast({
        title: "Signature enregistree",
        description: "Votre signature a ete enregistree avec succes",
      });
    }
  };

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      if (!idFrontData || !idBackData || !selfieData || !signatureData) {
        throw new Error("Tous les documents sont requis");
      }

      await apiRequest("POST", "/api/kyc/submit", {
        kycIdFront: idFrontData,
        kycIdBack: idBackData,
        kycSelfie: selfieData,
        kycSignature: signatureData,
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
      setCurrentStep(1);
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
    return COUNTRY_DATA[code] || { name: code, flag: "" };
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
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
          {step < 3 && (
            <div className={`w-12 h-1 mx-1 rounded ${currentStep > step ? "bg-green-500" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <User className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 1: Vos informations</h3>
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
                {user?.country && <span>{getCountryInfo(user.country).flag}</span>}
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

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
        <p className="text-xs text-blue-900 dark:text-blue-200">
          Ces informations seront utilisees pour verifier votre identite. Assurez-vous qu'elles correspondent a vos documents officiels.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={() => setCurrentStep(2)}
        data-testid="button-next-step-1"
      >
        Etape suivante
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <FileText className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 2: Documents d'identite</h3>
        <p className="text-sm text-muted-foreground">Fournissez vos pieces d'identite</p>
      </div>

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
            Photo de vous avec la piece d'identite en main
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
          Documents acceptes: Passeport, Permis de conduire ou Piece d'identite nationale. La photo avec piece en main doit montrer clairement votre visage et le document.
        </p>
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
          disabled={!idFrontData || !idBackData || !selfieData}
          data-testid="button-next-step-2"
        >
          Etape suivante
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <PenTool className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-semibold">Etape 3: Signature</h3>
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
            data-testid="button-save-signature"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Enregistrer
          </Button>
        </div>
      </div>

      {signatureData && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">Signature enregistree</span>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
        <p className="text-xs text-blue-900 dark:text-blue-200">
          En signant, vous certifiez que les informations fournies sont exactes et que vous etes le titulaire des documents d'identite soumis.
        </p>
      </div>

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
          onClick={() => submitKycMutation.mutate()}
          disabled={!signatureData || submitKycMutation.isPending}
          data-testid="button-submit-kyc"
        >
          {submitKycMutation.isPending ? "Envoi en cours..." : "Soumettre"}
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
  };

  return (
    <div className="space-y-6">
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
              <p className="text-sm text-muted-foreground">Veuillez soumettre a nouveau avec des documents conformes</p>
              <Button 
                onClick={startKycProcess}
                className="w-full"
                data-testid="button-resubmit-kyc"
              >
                <Upload className="w-4 h-4 mr-2" />
                Soumettre a nouveau
              </Button>
            </div>
          ) : user?.kycStatus === "pending" && !isResubmitting ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Shield className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Verification d'identite requise</p>
                <p className="text-xs text-muted-foreground mt-1">Completez la verification en 3 etapes simples</p>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
