import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CountryFlag } from "@/components/country-flag";
import {
  CheckCircle, ChevronRight, ChevronLeft, Building2, FileText, Upload,
  Trash2, Loader2, AlertCircle, User, MapPin, Hash, Calendar, CreditCard,
  Check, Shield, FileCheck, FileBadge, Image as ImageIcon
} from "lucide-react";
import { COUNTRIES } from "@shared/schema";
import { ACTIVITY_SECTORS, getSubSectorsForSector } from "@shared/activity-sectors";
import { PhoneInputWithPrefix } from "@/components/phone-input-with-prefix";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { User as UserType } from "@shared/schema";

const TOTAL_STEPS = 4;

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Profil", "Informations légales", "Documents", "Description"];
  return (
    <div className="space-y-3 mb-8">
      <Progress value={(current / total) * 100} className="h-2" />
      <div className="flex justify-between">
        {labels.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          return (
            <div key={step} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                done ? "bg-primary border-primary text-primary-foreground" :
                active ? "border-primary text-primary bg-background" :
                "border-muted-foreground/30 text-muted-foreground"
              }`}>
                {done ? <Check className="w-4 h-4" /> : step}
              </div>
              <span className={`text-xs hidden sm:block ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocUploadSlot({
  label, hint, value, onUpload, onRemove, multiple, additionalFiles, onAddMore, loading, required
}: {
  label: string;
  hint?: string;
  value?: string | null;
  onUpload: (base64: string, isImage: boolean) => void;
  onRemove?: () => void;
  multiple?: boolean;
  additionalFiles?: string[];
  onAddMore?: (base64: string, isImage: boolean) => void;
  loading?: boolean;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File, callback: (base64: string, isImage: boolean) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      callback(result, file.type.startsWith("image/"));
    };
    reader.readAsDataURL(file);
  };

  const isImage = (data: string) => data.startsWith("data:image");
  const isPdf = (data: string) => data.startsWith("data:application/pdf");
  const isUrl = (data: string) => data.startsWith("http");

  const allFiles = multiple ? (additionalFiles || []) : (value ? [value] : []);
  const hasFile = allFiles.length > 0;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file, onUpload);
          e.target.value = "";
        }}
      />
      {multiple && (
        <input
          ref={addMoreRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onAddMore) handleFile(file, onAddMore);
            e.target.value = "";
          }}
        />
      )}

      {!hasFile ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 text-muted-foreground hover-elevate transition-colors cursor-pointer bg-muted/30"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          <span className="text-sm">Cliquer pour sélectionner un fichier</span>
          <span className="text-xs">Photo ou document PDF</span>
        </button>
      ) : (
        <div className="space-y-2">
          {allFiles.map((f, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
              {(isImage(f) || isUrl(f)) ? (
                <img src={f} alt="Document" className="w-12 h-12 object-cover rounded-md border flex-shrink-0" />
              ) : isPdf(f) ? (
                <div className="w-12 h-12 flex items-center justify-center bg-red-50 dark:bg-red-950 rounded-md border flex-shrink-0">
                  <FileText className="w-6 h-6 text-red-500" />
                </div>
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-muted rounded-md border flex-shrink-0">
                  <FileCheck className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {isImage(f) || isUrl(f) ? "Image" : isPdf(f) ? "Document PDF" : "Fichier"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {multiple ? `Document ${idx + 1}` : "Chargé"}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => onRemove && onRemove()}
                data-testid={`button-remove-doc-${idx}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}

          {multiple && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => addMoreRef.current?.click()}
              disabled={loading}
              data-testid="button-add-more-docs"
            >
              <Upload className="w-4 h-4 mr-2" />
              Ajouter un autre document
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BusinessKyc() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
  });
  const u = user as any;

  // Documents KYC (images lourdes) — endpoint séparé de /api/auth/me
  const { data: kycDocs } = useQuery<{
    kycIdFront: string | null;
    kycIdBack: string | null;
    kycSelfie: string | null;
    kycSignature: string | null;
    kycBusinessDocuments: string | null;
    kycTaxDocument: string | null;
    kycAddressDocument: string | null;
  }>({
    queryKey: ["/api/kyc/my-documents"],
  });

  // Step 1 inline edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    businessRegistrationNumber: "",
    businessCountry: "",
    businessPhone: "",
    businessEnterprisePhone: "",
    businessEmail: "",
  });

  // Step 2 form
  const [step2, setStep2] = useState({
    kycBusinessAccountNumber: "",
    kycTaxId: "",
    kycBusinessAddress: "",
    kycBusinessCity: "",
    kycBusinessDepartment: "",
    kycDirectorIdNumber: "",
    kycDirectorCountry: "",
    kycDirectorDob: "",
    kycIdIssueDate: "",
    kycIdExpiryDate: "",
  });

  // Step 3 docs (local state for UI; actually stored on server)
  const [docs, setDocs] = useState<{
    businessDocuments: string[];
    taxDocument: string | null;
    addressDocument: string | null;
    idFront: string | null;
    idBack: string | null;
  }>({
    businessDocuments: [],
    taxDocument: null,
    addressDocument: null,
    idFront: null,
    idBack: null,
  });

  // Synchroniser les previews de documents quand la query kycDocs est chargée
  useEffect(() => {
    if (!kycDocs) return;
    setDocs(prev => ({
      businessDocuments: kycDocs.kycBusinessDocuments ? (() => { try { return JSON.parse(kycDocs.kycBusinessDocuments!); } catch { return []; } })() : prev.businessDocuments,
      taxDocument: kycDocs.kycTaxDocument ?? prev.taxDocument,
      addressDocument: kycDocs.kycAddressDocument ?? prev.addressDocument,
      idFront: kycDocs.kycIdFront ?? prev.idFront,
      idBack: kycDocs.kycIdBack ?? prev.idBack,
    }));
  }, [kycDocs]);

  // Step 4
  const [description, setDescription] = useState(u?.kycActivityDescription || "");
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // ---- Mutations ----
  const saveProfileMutation = useMutation({
    mutationFn: (data: typeof profileForm) => apiRequest("PUT", "/api/business/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profil mis à jour" });
      setEditingProfile(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const saveStep2Mutation = useMutation({
    mutationFn: (data: typeof step2) => apiRequest("POST", "/api/kyc/business/save-step2", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setStep(3);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: ({ type, data }: { type: string; data: string }) =>
      apiRequest("POST", "/api/kyc/business/upload", { type, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/my-documents"] });
    },
    onError: (e: any) => toast({ title: "Erreur upload", description: e.message, variant: "destructive" }),
  });

  const removeDocMutation = useMutation({
    mutationFn: ({ type, index }: { type: string; index: number }) =>
      apiRequest("DELETE", `/api/kyc/business/document/${type}/${index}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/my-documents"] });
    },
  });

  const [bizSector, setBizSector] = useState("");
  const [bizSubSector, setBizSubSector] = useState("");

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/kyc/business/submit", { description, kycSector: bizSector || undefined, kycSubSector: bizSubSector || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Dossier soumis", description: "Votre dossier KYC est en cours d'examen." });
      setLocation("/dashboard/business/profile");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ---- Helpers ----
  const getCountryDisplay = (code: string) => {
    const c = COUNTRIES.find(c => c.code === code);
    if (!c) return <span>{code}</span>;
    return <span className="flex items-center gap-1"><CountryFlag code={c.code} size="xs" /> {c.name}</span>;
  };

  const step1Complete = () => {
    return !!(u?.firstName && u?.lastName && u?.businessName && u?.businessCountry &&
      u?.businessPhone && u?.businessRegistrationNumber);
  };

  const step2Complete = () => {
    return !!(step2.kycBusinessAccountNumber && step2.kycTaxId && step2.kycBusinessAddress &&
      step2.kycBusinessCity && step2.kycDirectorIdNumber && step2.kycDirectorCountry &&
      step2.kycDirectorDob && step2.kycIdIssueDate && step2.kycIdExpiryDate);
  };

  const step3Complete = () => {
    return !!(docs.taxDocument && docs.addressDocument && docs.idFront && docs.idBack);
  };

  const handleUploadDoc = async (type: string, base64: string) => {
    setUploadingType(type);
    try {
      await uploadDocMutation.mutateAsync({ type, data: base64 });
      if (type === "businessDocuments") {
        setDocs(prev => ({ ...prev, businessDocuments: [...prev.businessDocuments, base64] }));
      } else {
        setDocs(prev => ({ ...prev, [type === "idFront" ? "idFront" : type === "idBack" ? "idBack" : type === "taxDocument" ? "taxDocument" : "addressDocument"]: base64 }));
      }
    } finally {
      setUploadingType(null);
    }
  };

  const handleRemoveDoc = async (type: string, index = 0) => {
    await removeDocMutation.mutateAsync({ type, index });
    if (type === "businessDocuments") {
      setDocs(prev => {
        const arr = [...prev.businessDocuments];
        arr.splice(index, 1);
        return { ...prev, businessDocuments: arr };
      });
    } else {
      setDocs(prev => ({ ...prev, [type === "idFront" ? "idFront" : type === "idBack" ? "idBack" : type === "taxDocument" ? "taxDocument" : "addressDocument"]: null }));
    }
  };

  const startEditProfile = () => {
    setProfileForm({
      businessRegistrationNumber: u?.businessRegistrationNumber || "",
      businessCountry: u?.businessCountry || "",
      businessPhone: u?.businessPhone || "",
      businessEnterprisePhone: u?.businessEnterprisePhone || "",
      businessEmail: u?.businessEmail || "",
    });
    setEditingProfile(true);
  };

  const loadStep2FromUser = () => {
    setStep2({
      kycBusinessAccountNumber: u?.kycBusinessAccountNumber || "",
      kycTaxId: u?.kycTaxId || "",
      kycBusinessAddress: u?.kycBusinessAddress || "",
      kycBusinessCity: u?.kycBusinessCity || "",
      kycBusinessDepartment: u?.kycBusinessDepartment || "",
      kycDirectorIdNumber: u?.kycDirectorIdNumber || "",
      kycDirectorCountry: u?.kycDirectorCountry || "",
      kycDirectorDob: u?.kycDirectorDob || "",
      kycIdIssueDate: u?.kycIdIssueDate || "",
      kycIdExpiryDate: u?.kycIdExpiryDate || "",
    });
    setDocs({
      businessDocuments: kycDocs?.kycBusinessDocuments ? (() => { try { return JSON.parse(kycDocs.kycBusinessDocuments!); } catch { return []; } })() : [],
      taxDocument: kycDocs?.kycTaxDocument || null,
      addressDocument: kycDocs?.kycAddressDocument || null,
      idFront: kycDocs?.kycIdFront || null,
      idBack: kycDocs?.kycIdBack || null,
    });
    setDescription(u?.kycActivityDescription || "");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already submitted/verified
  if (u?.kycStatus === "submitted") {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Vérification KYC</h1>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center py-12">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">Dossier en cours d'examen</h2>
            <p className="text-muted-foreground max-w-md">
              Votre dossier KYC a été soumis et est actuellement en cours d'examen par notre équipe.
              Vous serez notifié dès que la vérification sera effectuée.
            </p>
            <Button variant="outline" onClick={() => setLocation("/dashboard/business/profile")}>
              Retour au profil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (u?.kycStatus === "verified") {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Vérification KYC</h1>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center py-12">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Compte vérifié</h2>
            <p className="text-muted-foreground">Votre compte entreprise est vérifié et pleinement opérationnel.</p>
            <Button variant="outline" onClick={() => setLocation("/dashboard/business")}>
              Tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard/business/profile")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Vérification KYC Entreprise</h1>
      </div>

      <StepIndicator current={step} total={TOTAL_STEPS} />

      {/* ===== STEP 1 : INFORMATIONS DU COMPTE ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations du compte
              </CardTitle>
              <CardDescription>
                Vérifiez et complétez vos informations avant de continuer. Tous les champs sont obligatoires.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editingProfile ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Prénom" value={u?.firstName} />
                    <InfoRow label="Nom" value={u?.lastName} />
                    <InfoRow label="Nom de l'entreprise" value={u?.businessName} className="col-span-2" />
                    <InfoRow label="Email d'inscription" value={u?.email} className="col-span-2" />
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Informations de l'entreprise</h4>
                      <Button size="sm" variant="outline" onClick={startEditProfile} data-testid="button-edit-step1-profile">
                        Modifier
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow label="Pays" value={u?.businessCountry ? getCountryDisplay(u.businessCountry) : null} />
                      <InfoRow label="RCCM / Registre" value={u?.businessRegistrationNumber} />
                      <InfoRow label="Tél. dirigeant" value={u?.businessPhone ? (() => {
                        const c = COUNTRIES.find(c => c.code === u?.businessCountry);
                        return c ? `${c.phoneCode} ${u.businessPhone}` : u.businessPhone;
                      })() : null} />
                      <InfoRow label="Tél. entreprise" value={u?.businessEnterprisePhone ? (() => {
                        const c = COUNTRIES.find(c => c.code === u?.businessCountry);
                        return c ? `${c.phoneCode} ${u.businessEnterprisePhone}` : u.businessEnterprisePhone;
                      })() : null} />
                      <InfoRow label="Email pro" value={u?.businessEmail} className="col-span-2" />
                    </div>
                  </div>

                  {!step1Complete() && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Certains champs obligatoires sont manquants. Cliquez sur "Modifier" pour les compléter.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => { loadStep2FromUser(); setStep(2); }}
                      disabled={!step1Complete()}
                      data-testid="button-step1-next"
                    >
                      Continuer
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pays de l'entreprise <span className="text-destructive">*</span></Label>
                    <Select
                      value={profileForm.businessCountry}
                      onValueChange={(v) => setProfileForm(prev => ({ ...prev, businessCountry: v, businessPhone: "", businessEnterprisePhone: "" }))}
                    >
                      <SelectTrigger data-testid="select-country-step1">
                        <SelectValue placeholder="Sélectionnez un pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code}><span className="flex items-center gap-1"><CountryFlag code={c.code} size="xs" /> {c.name} ({c.phoneCode})</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>RCCM / Numéro d'entreprise <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Ex: RB/COT/BJ/01/2024/B12345"
                      value={profileForm.businessRegistrationNumber}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, businessRegistrationNumber: e.target.value }))}
                      data-testid="input-rccm-step1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Téléphone dirigeant <span className="text-destructive">*</span></Label>
                    <PhoneInputWithPrefix
                      country={profileForm.businessCountry}
                      value={profileForm.businessPhone}
                      onChange={(v) => setProfileForm(prev => ({ ...prev, businessPhone: v }))}
                      data-testid="input-phone-director-step1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Téléphone entreprise <span className="text-destructive">*</span></Label>
                    <PhoneInputWithPrefix
                      country={profileForm.businessCountry}
                      value={profileForm.businessEnterprisePhone}
                      onChange={(v) => setProfileForm(prev => ({ ...prev, businessEnterprisePhone: v }))}
                      data-testid="input-phone-enterprise-step1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email professionnel <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      placeholder="contact@entreprise.com"
                      value={profileForm.businessEmail}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, businessEmail: e.target.value }))}
                      data-testid="input-email-step1"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingProfile(false)}>Annuler</Button>
                    <Button
                      size="sm"
                      onClick={() => saveProfileMutation.mutate(profileForm)}
                      disabled={saveProfileMutation.isPending}
                      data-testid="button-save-step1-profile"
                    >
                      {saveProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP 2 : INFORMATIONS LÉGALES ===== */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informations légales de l'entreprise
            </CardTitle>
            <CardDescription>
              Renseignez les informations légales et les coordonnées du dirigeant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Business section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Entreprise</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Numéro de compte entreprise"
                  required icon={<CreditCard className="w-4 h-4" />}
                  value={step2.kycBusinessAccountNumber}
                  onChange={(v) => setStep2(p => ({ ...p, kycBusinessAccountNumber: v }))}
                  placeholder="IBAN ou numéro de compte"
                  testId="input-business-account"
                />
                <FormField
                  label="Numéro d'identification fiscale"
                  required icon={<FileBadge className="w-4 h-4" />}
                  value={step2.kycTaxId}
                  onChange={(v) => setStep2(p => ({ ...p, kycTaxId: v }))}
                  placeholder="NIF / TIN"
                  testId="input-tax-id"
                />
              </div>

              <FormField
                label="Adresse de l'entreprise"
                required icon={<MapPin className="w-4 h-4" />}
                value={step2.kycBusinessAddress}
                onChange={(v) => setStep2(p => ({ ...p, kycBusinessAddress: v }))}
                placeholder="Rue, quartier, numéro"
                testId="input-business-address"
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Ville"
                  required
                  value={step2.kycBusinessCity}
                  onChange={(v) => setStep2(p => ({ ...p, kycBusinessCity: v }))}
                  placeholder="Cotonou"
                  testId="input-business-city"
                />
                <FormField
                  label="Département / Région"
                  required
                  value={step2.kycBusinessDepartment}
                  onChange={(v) => setStep2(p => ({ ...p, kycBusinessDepartment: v }))}
                  placeholder="Littoral"
                  testId="input-business-department"
                />
              </div>
            </div>

            {/* Director section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dirigeant</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Prénom <span className="text-destructive">*</span></Label>
                  <Input value={u?.firstName || ""} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Nom <span className="text-destructive">*</span></Label>
                  <Input value={u?.lastName || ""} disabled className="bg-muted/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Numéro de pièce d'identité"
                  required icon={<Hash className="w-4 h-4" />}
                  value={step2.kycDirectorIdNumber}
                  onChange={(v) => setStep2(p => ({ ...p, kycDirectorIdNumber: v }))}
                  placeholder="Numéro CNI / Passeport"
                  testId="input-director-id-number"
                />
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Pays du dirigeant <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={step2.kycDirectorCountry}
                    onValueChange={(v) => setStep2(p => ({ ...p, kycDirectorCountry: v }))}
                  >
                    <SelectTrigger data-testid="select-director-country">
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.code}><span className="flex items-center gap-1"><CountryFlag code={c.code} size="xs" /> {c.name}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  label="Date de naissance"
                  required type="date" icon={<Calendar className="w-4 h-4" />}
                  value={step2.kycDirectorDob}
                  onChange={(v) => setStep2(p => ({ ...p, kycDirectorDob: v }))}
                  testId="input-director-dob"
                />
                <FormField
                  label="Date d'émission"
                  required type="date"
                  value={step2.kycIdIssueDate}
                  onChange={(v) => setStep2(p => ({ ...p, kycIdIssueDate: v }))}
                  testId="input-id-issue-date"
                />
                <FormField
                  label="Date d'expiration"
                  required type="date"
                  value={step2.kycIdExpiryDate}
                  onChange={(v) => setStep2(p => ({ ...p, kycIdExpiryDate: v }))}
                  testId="input-id-expiry-date"
                />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-step2-back">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={() => saveStep2Mutation.mutate(step2)}
                disabled={!step2Complete() || saveStep2Mutation.isPending}
                data-testid="button-step2-next"
              >
                {saveStep2Mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continuer
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 3 : DOCUMENTS ===== */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
            </CardTitle>
            <CardDescription>
              Soumettez vos documents sous forme de photo ou de fichier PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <DocUploadSlot
              label="Documents de l'entreprise"
              hint="Registre de commerce, statuts, ou tout document officiel (plusieurs autorisés)"
              required
              multiple
              additionalFiles={docs.businessDocuments}
              onUpload={(b64) => handleUploadDoc("businessDocuments", b64)}
              onAddMore={(b64) => handleUploadDoc("businessDocuments", b64)}
              onRemove={() => handleRemoveDoc("businessDocuments", docs.businessDocuments.length - 1)}
              loading={uploadingType === "businessDocuments"}
            />

            <DocUploadSlot
              label="Identification fiscale"
              hint="Document officiel d'identification fiscale (NIF/TIN)"
              required
              value={docs.taxDocument}
              onUpload={(b64) => handleUploadDoc("taxDocument", b64)}
              onRemove={() => handleRemoveDoc("taxDocument")}
              loading={uploadingType === "taxDocument"}
            />

            <DocUploadSlot
              label="Justificatif d'adresse"
              hint="Facture d'électricité, relevé bancaire ou certificat de résidence"
              required
              value={docs.addressDocument}
              onUpload={(b64) => handleUploadDoc("addressDocument", b64)}
              onRemove={() => handleRemoveDoc("addressDocument")}
              loading={uploadingType === "addressDocument"}
            />

            <div className="grid grid-cols-2 gap-4">
              <DocUploadSlot
                label="Pièce d'identité — Recto"
                required
                value={docs.idFront}
                onUpload={(b64) => handleUploadDoc("idFront", b64)}
                onRemove={() => handleRemoveDoc("idFront")}
                loading={uploadingType === "idFront"}
              />
              <DocUploadSlot
                label="Pièce d'identité — Verso"
                required
                value={docs.idBack}
                onUpload={(b64) => handleUploadDoc("idBack", b64)}
                onRemove={() => handleRemoveDoc("idBack")}
                loading={uploadingType === "idBack"}
              />
            </div>

            {!step3Complete() && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Les documents obligatoires sont : identification fiscale, justificatif d'adresse, pièce d'identité recto et verso.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-step3-back">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!step3Complete()}
                data-testid="button-step3-next"
              >
                Continuer
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 4 : DESCRIPTION ===== */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Description de l'entreprise
            </CardTitle>
            <CardDescription>
              Décrivez précisément les activités de votre entreprise, vos services, vos clients cibles et votre modèle économique.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Secteur d'activité <span className="text-destructive">*</span>
              </Label>
              <Select value={bizSector} onValueChange={(v) => { setBizSector(v); setBizSubSector(""); }}>
                <SelectTrigger data-testid="select-biz-sector">
                  <SelectValue placeholder="Sélectionnez le secteur d'activité..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_SECTORS.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bizSector && getSubSectorsForSector(bizSector).length > 0 && (
              <div className="space-y-2">
                <Label>
                  Sous-secteur <span className="text-destructive">*</span>
                </Label>
                <Select value={bizSubSector} onValueChange={setBizSubSector}>
                  <SelectTrigger data-testid="select-biz-subsector">
                    <SelectValue placeholder="Sélectionnez le sous-secteur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubSectorsForSector(bizSector).map((ss) => (
                      <SelectItem key={ss.code} value={ss.code}>{ss.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Description <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-2">(minimum 20 caractères)</span>
              </Label>
              <Textarea
                rows={8}
                placeholder="Décrivez en détail les activités de votre entreprise : produits ou services offerts, clientèle cible, zones géographiques couvertes, chiffre d'affaires estimé, volume de transactions mensuel attendu, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="textarea-description"
                className="resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{description.length} caractère{description.length !== 1 ? "s" : ""}</span>
                <span className={description.length >= 20 ? "text-green-600" : "text-amber-600"}>
                  {description.length >= 20 ? "Minimum atteint" : `${20 - description.length} caractères manquants`}
                </span>
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-md space-y-2">
              <p className="text-sm font-medium">Récapitulatif du dossier</p>
              <div className="space-y-1">
                <StatusRow label="Profil entreprise" done={step1Complete()} />
                <StatusRow label="Informations légales" done={!!(u?.kycBusinessAccountNumber || step2.kycBusinessAccountNumber)} />
                <StatusRow label="Documents" done={step3Complete()} />
                <StatusRow label="Secteur d'activité" done={!!bizSector} />
                <StatusRow label="Description" done={description.trim().length >= 20} />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)} data-testid="button-step4-back">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={description.trim().length < 20 || !bizSector || submitMutation.isPending}
                data-testid="button-submit-kyc"
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                Soumettre le dossier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value, className = "" }: { label: string; value?: React.ReactNode | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">
        {value || <span className="text-amber-600 italic">Non renseigné</span>}
      </p>
    </div>
  );
}

function FormField({ label, required, icon, value, onChange, placeholder, testId, type = "text" }: {
  label: string; required?: boolean; icon?: React.ReactNode;
  value: string; onChange: (v: string) => void;
  placeholder?: string; testId?: string; type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
      />
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
