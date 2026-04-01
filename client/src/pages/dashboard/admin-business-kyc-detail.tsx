import { useQuery, useMutation } from "@tanstack/react-query";
import { User, COUNTRIES } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileText, Check, CheckCircle, X, ChevronLeft, AlertCircle, Download, Loader2, User as UserIcon, Building2, MapPin, Scale, ZoomIn } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jsPDF } from "jspdf";
import { CountryFlag } from "@/components/country-flag";

function KycField({ label, value }: { label: string; value?: React.ReactNode | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
      <p className="text-sm font-medium">{value || <span className="italic text-muted-foreground">—</span>}</p>
    </div>
  );
}

function DocPreview({ label, src }: { label: string; src?: string | null }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!src) return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
      <div className="aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed">
        <p className="text-xs text-muted-foreground">Non fourni</p>
      </div>
    </div>
  );

  const isImage = src.startsWith("data:image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(src);
  const isPdf = src.startsWith("data:application/pdf") || /\.pdf$/i.test(src);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = label.toLowerCase().replace(/\s+/g, "_") + (isPdf ? ".pdf" : isImage ? ".jpg" : "");
    a.click();
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
      {isImage ? (
        <>
          <div
            className="relative group cursor-pointer"
            onClick={() => setLightboxOpen(true)}
          >
            <img src={src} alt={label} className="rounded-md border w-full max-h-64 object-contain bg-muted transition-all" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-md">
              <div className="flex items-center gap-2 bg-white/90 dark:bg-black/80 rounded-md px-3 py-1.5">
                <ZoomIn className="w-4 h-4" />
                <span className="text-xs font-medium">Agrandir</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-1" onClick={handleDownload}>
            <Download className="w-3 h-3 mr-1.5" />
            Télécharger
          </Button>
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-3xl p-2">
              <DialogTitle className="text-sm font-semibold px-2 pt-1">{label}</DialogTitle>
              <img src={src} alt={label} className="w-full max-h-[80vh] object-contain rounded-md" />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="rounded-md border bg-muted flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm flex-1">{isPdf ? "Document PDF" : "Document"}</span>
          </div>
          <div className="flex gap-2">
            <a href={src} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Ouvrir
              </Button>
            </a>
            <Button variant="default" size="sm" className="flex-1" onClick={handleDownload}>
              <Download className="w-3 h-3 mr-1.5" />
              Télécharger
            </Button>
          </div>
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
      if (status === "verified") {
        await apiRequest("POST", "/api/admin/approve-kyc", { userId });
      } else {
        await apiRequest("POST", "/api/admin/reject-kyc", { userId, reason });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-kyc-count"] });
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    const sectionTitle = (title: string) => {
      checkPage(18);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 80, 180);
      doc.text(title, margin, y);
      doc.setDrawColor(30, 80, 180);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;
      doc.setTextColor(0, 0, 0);
    };

    const field = (label: string, value?: string | null) => {
      const val = value || "—";
      checkPage(12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${label} :`, margin + 4, y);
      doc.setFont("helvetica", "normal");
      const labelWidth = doc.getTextWidth(`${label} : `);
      const wrapped = doc.splitTextToSize(val, contentWidth - labelWidth - 6);
      doc.text(wrapped, margin + 4 + labelWidth, y);
      y += wrapped.length > 1 ? wrapped.length * 5 + 3 : 7;
    };

    const addImage = (label: string, src?: string | null) => {
      if (!src || !src.startsWith("data:image")) {
        checkPage(10);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 150, 150);
        doc.text(`${label} : Non fourni`, margin + 4, y);
        doc.setTextColor(0, 0, 0);
        y += 7;
        return;
      }
      const imgMaxW = contentWidth;
      const imgMaxH = 70;
      checkPage(imgMaxH + 16);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${label} :`, margin + 4, y);
      y += 5;
      try {
        const format = src.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(src, format, margin + 4, y, imgMaxW - 8, imgMaxH);
        y += imgMaxH + 6;
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(180, 0, 0);
        doc.text("Impossible d'intégrer l'image", margin + 4, y + 4);
        doc.setTextColor(0, 0, 0);
        y += 10;
      }
    };

    // ─── HEADER ───
    doc.setFillColor(30, 80, 180);
    doc.rect(0, 0, pageWidth, 18, "F");
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("RAPPORT KYC ENTREPRISE", pageWidth / 2, 12, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y = 26;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le : ${new Date().toLocaleString("fr-FR")}`, margin, y);
    doc.text(`Statut : ${user.kycStatus === "verified" ? "Vérifié" : user.kycStatus === "submitted" ? "En examen" : user.kycStatus === "rejected" ? "Rejeté" : "En attente"}`, pageWidth - margin, y, { align: "right" });
    y += 10;

    // ─── SECTION 1 : Dirigeant ───
    sectionTitle("1. Informations du dirigeant");
    field("Prénom", user.firstName);
    field("Nom de famille", user.lastName);
    field("Email de connexion", user.email);
    field("Téléphone dirigeant", u?.businessPhone ? (() => {
      const c = COUNTRIES.find(c => c.code === u?.businessCountry);
      return c ? `${c.phoneCode} ${u.businessPhone}` : u.businessPhone;
    })() : null);
    field("Date de naissance", u?.kycDirectorDob);
    field("Pays de résidence", getCountryName(u?.kycDirectorCountry));
    field("N° pièce d'identité", u?.kycDirectorIdNumber);
    field("Date d'expiration pièce", u?.kycIdExpiryDate);
    y += 4;

    // ─── SECTION 2 : Entreprise ───
    sectionTitle("2. Informations de l'entreprise");
    field("Dénomination sociale", user.businessName);
    field("RCCM / N° Enregistrement", user.businessRegistrationNumber);
    field("NIF / Identifiant fiscal", u?.kycTaxId);
    field("N° compte entreprise", u?.kycBusinessAccountNumber);
    field("Pays du siège", getCountryName(u?.businessCountry));
    field("Téléphone entreprise", u?.businessEnterprisePhone);
    field("Email professionnel", u?.businessEmail);
    y += 4;

    // ─── SECTION 3 : Localisation ───
    sectionTitle("3. Localisation & Adresse");
    field("Adresse complète", u?.kycBusinessAddress);
    field("Ville", u?.kycBusinessCity);
    field("Département / État", u?.kycBusinessDepartment);
    y += 4;

    // ─── SECTION 4 : Activité ───
    sectionTitle("4. Description de l'activité");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(user.kycActivityDescription || "Non fournie", contentWidth - 8);
    checkPage(splitDesc.length * 5 + 10);
    doc.text(splitDesc, margin + 4, y);
    y += splitDesc.length * 5 + 8;

    // ─── SECTION 5 : Pièce d'identité ───
    sectionTitle("5. Pièce d'identité du dirigeant");
    addImage("Recto", user.kycIdFront);
    addImage("Verso", user.kycIdBack);

    // ─── SECTION 6 : Documents entreprise ───
    sectionTitle("6. Documents de l'entreprise");
    addImage("Identification fiscale", u?.kycTaxDocument);
    addImage("Justificatif d'adresse", u?.kycAddressDocument);

    if (businessDocs.length > 0) {
      businessDocs.forEach((doc2, i) => {
        addImage(`Document additionnel ${i + 1}`, doc2);
      });
    }

    // ─── FOOTER ───
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      doc.text("BKApay — Document confidentiel", margin, pageHeight - 8);
    }

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
    return c ? c.name : code;
  };
  const getCountryDisplay = (code?: string | null) => {
    if (!code) return <span className="text-muted-foreground">—</span>;
    const c = COUNTRIES.find(c => c.code === code);
    if (!c) return <span>{code}</span>;
    return <span className="flex items-center gap-1"><CountryFlag code={c.code} size="xs" /> {c.name}</span>;
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
          <Badge className="px-3 py-1 text-sm" variant={user.kycStatus === "verified" ? "default" : user.kycStatus === "rejected" ? "destructive" : "secondary"}>
            {user.kycStatus === "verified" ? "Vérifié" : user.kycStatus === "submitted" ? "En examen" : user.kycStatus === "rejected" ? "Rejeté" : "En attente"}
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
              <KycField label="Pays de résidence" value={getCountryDisplay(u?.kycDirectorCountry)} />
              <KycField label="N° pièce d'identité" value={u?.kycDirectorIdNumber} />
              <KycField label="Date d'expiration pièce" value={u?.kycIdExpiryDate} />
            </div>
          </Section>

          <Section title="Informations de l'entreprise" icon={Building2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <KycField label="Dénomination sociale" value={user.businessName} />
              <KycField label="RCCM / N° Enregistrement" value={user.businessRegistrationNumber} />
              <KycField label="NIF / Identifiant fiscal" value={u?.kycTaxId} />
              <KycField label="Pays du siège" value={getCountryDisplay(u?.businessCountry)} />
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
              {user.kycStatus === "rejected" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Ce dossier a été rejeté
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (confirm(`Réapprouver le dossier de ${user.businessName || user.email} ?`)) {
                        verifyMutation.mutate({ status: "verified" });
                      }
                    }}
                    disabled={verifyMutation.isPending}
                    data-testid="button-reapprove-kyc"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Réapprouver le dossier
                  </Button>
                </div>
              )}

              {user.kycStatus === "verified" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Ce dossier est vérifié
                  </div>
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
                </div>
              )}

              {user.kycStatus === "submitted" && !showRejectInput && (
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

              {showRejectInput && user.kycStatus !== "rejected" && (
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
