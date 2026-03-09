import { useQuery, useMutation } from "@tanstack/react-query";
import { User, COUNTRIES } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, X, ChevronLeft, AlertCircle, Download, Loader2, User as UserIcon, Building2, MapPin, Scale } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jsPDF } from "jspdf";

function KycField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
      <p className="text-sm font-medium">{value || <span className="italic text-muted-foreground">—</span>}</p>
    </div>
  );
}

function DocPreview({ label, src }: { label: string; src?: string | null }) {
  if (!src) return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
      <div className="aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed">
        <p className="text-xs text-muted-foreground">Non fourni</p>
      </div>
    </div>
  );
  const isImage = src.startsWith("data:image") || src.startsWith("http");
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
      {isImage ? (
        <div className="relative group">
          <img src={src} alt={label} className="rounded-md border w-full max-h-64 object-contain bg-muted transition-all" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-md">
            <Button size="sm" variant="secondary" onClick={() => window.open(src, '_blank')}>
              Agrandir
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border p-4 bg-muted flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm">Document PDF</span>
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline ml-auto">Ouvrir</a>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden border-none shadow-sm bg-card/50">
      <CardHeader className="flex flex-row items-center gap-2 pb-2 bg-muted/30">
        <Icon className="w-4 h-4 text-primary" />
        <CardTitle className="text-sm font-bold uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export default function AdminBusinessKycDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/kyc`, { status, rejectionReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
      setShowRejectInput(false);
      setRejectReason("");
      toast({ title: "Succès", description: "Statut KYC mis à jour" });
      setLocation("/dashboard/admin/business/kyc");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const downloadPdf = () => {
    if (!user) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text("RAPPORT KYC ENTREPRISE", pageWidth / 2, y, { align: "center" });
    y += 15;

    doc.setFontSize(12);
    doc.text(`Entreprise: ${user.businessName}`, 20, y);
    y += 10;
    doc.text(`Dirigeant: ${user.firstName} ${user.lastName}`, 20, y);
    y += 10;
    doc.text(`Email: ${user.email}`, 20, y);
    y += 15;

    doc.setFontSize(14);
    doc.text("Informations Légales", 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`RCCM: ${user.businessRegistrationNumber || "N/A"}`, 25, y); y += 7;
    doc.text(`NIF: ${user.kycTaxId || "N/A"}`, 25, y); y += 7;
    doc.text(`Adresse: ${user.kycBusinessAddress || "N/A"}`, 25, y); y += 7;
    doc.text(`Ville: ${user.kycBusinessCity || "N/A"}`, 25, y); y += 15;

    doc.setFontSize(14);
    doc.text("Description de l'activité", 20, y);
    y += 10;
    doc.setFontSize(10);
    const splitDescription = doc.splitTextToSize(user.kycActivityDescription || "Non fournie", pageWidth - 40);
    doc.text(splitDescription, 20, y);
    
    doc.save(`KYC_Business_${user.businessName}_${userId.substring(0, 8)}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <div>Utilisateur non trouvé</div>;

  const u = user as any;
  const getCountryName = (code?: string | null) => {
    if (!code) return "—";
    const c = COUNTRIES.find(c => c.code === code);
    return c ? `${c.flag} ${c.name}` : code;
  };

  const businessDocs: string[] = u?.kycBusinessDocuments ? (() => {
    try { return JSON.parse(u.kycBusinessDocuments); } catch { return []; }
  })() : [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business/kyc")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Examen KYC Entreprise</h1>
            <p className="text-muted-foreground">{user.businessName} • {user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={downloadPdf}>
            <Download className="w-4 h-4 mr-2" />
            Rapport PDF
          </Button>
          <Badge className="px-3 py-1 text-sm" variant={user.kycStatus === "verified" ? "default" : "secondary"}>
            {user.kycStatus === "verified" ? "Vérifié" : user.kycStatus === "submitted" ? "En examen" : "En attente"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Informations du dirigeant & compte" icon={UserIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <KycField label="Prénom" value={user.firstName} />
              <KycField label="Nom" value={user.lastName} />
              <KycField label="Email de connexion" value={user.email} />
              <KycField label="Tél. dirigeant" value={u?.businessPhone ? (() => {
                const c = COUNTRIES.find(c => c.code === u?.businessCountry);
                return c ? `${c.phoneCode} ${u.businessPhone}` : u.businessPhone;
              })() : null} />
              <KycField label="Date de naissance" value={u?.kycDirectorDob} />
              <KycField label="Pays de résidence" value={getCountryName(u?.kycDirectorCountry)} />
              <KycField label="N° pièce d'identité" value={u?.kycDirectorIdNumber} />
              <KycField label="Date d'expiration pièce" value={u?.kycIdExpiryDate} />
            </div>
          </Section>

          <Section title="Informations de l'entreprise" icon={Building2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <KycField label="Dénomination sociale" value={user.businessName} />
              <KycField label="RCCM / N° Enregistrement" value={user.businessRegistrationNumber} />
              <KycField label="NIF / Identifiant fiscal" value={u?.kycTaxId} />
              <KycField label="Pays du siège" value={getCountryName(u?.businessCountry)} />
              <KycField label="Tél. entreprise" value={u?.businessEnterprisePhone} />
              <KycField label="Email pro" value={u?.businessEmail} />
              <KycField label="N° compte entreprise" value={u?.kycBusinessAccountNumber} />
            </div>
          </Section>

          <Section title="Localisation & Adresse" icon={MapPin}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div className="sm:col-span-2">
                <KycField label="Adresse complète" value={u?.kycBusinessAddress} />
              </div>
              <KycField label="Ville" value={u?.kycBusinessCity} />
              <KycField label="Département / État" value={u?.kycBusinessDepartment} />
            </div>
          </Section>

          <Section title="Activité déclarée" icon={Scale}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {user.kycActivityDescription || <span className="text-muted-foreground italic">Non fournie</span>}
            </p>
          </Section>

          <Section title="Documents d'entreprise" icon={FileText}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <DocPreview label="Identification fiscale" src={u?.kycTaxDocument} />
              <DocPreview label="Justificatif d'adresse" src={u?.kycAddressDocument} />
            </div>
            {businessDocs.length > 0 && (
              <div className="mt-8 space-y-4">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Autres documents fournis ({businessDocs.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {businessDocs.map((doc, i) => (
                    <DocPreview key={i} label={`Document additionnel ${i + 1}`} src={doc} />
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Pièce d'identité" icon={UserIcon}>
            <div className="space-y-6">
              <DocPreview label="Recto" src={user.kycIdFront} />
              <DocPreview label="Verso" src={user.kycIdBack} />
            </div>
          </Section>

          <Card className="sticky top-6">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Décision administrative</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {showRejectInput && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    Motif du rejet
                  </Label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex: Document expiré, flou..."
                    className="border-destructive/50 focus-visible:ring-destructive"
                    data-testid="input-rejection-reason"
                  />
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1" 
                      variant="destructive"
                      disabled={!rejectReason.trim() || verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate({ status: "rejected", reason: rejectReason })}
                      data-testid="button-confirm-reject-kyc"
                    >
                      Confirmer
                    </Button>
                    <Button className="flex-1" variant="ghost" onClick={() => setShowRejectInput(false)}>Annuler</Button>
                  </div>
                </div>
              )}

              {!showRejectInput && (
                <div className="flex flex-col gap-3">
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => setShowRejectInput(true)}
                    disabled={verifyMutation.isPending}
                    data-testid="button-reject-kyc"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Rejeter le dossier
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (confirm(`Approuver le dossier de ${user.businessName} ?`)) {
                        verifyMutation.mutate({ status: "verified" });
                      }
                    }}
                    disabled={verifyMutation.isPending}
                    data-testid="button-approve-kyc"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approuver
                  </Button>
                </div>
              )}

              <div className="pt-4 border-t text-[10px] text-muted-foreground text-center">
                Date de soumission : {new Date(user.createdAt).toLocaleDateString()} {new Date(user.createdAt).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
