import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, X, Download, FileText, ArrowLeft, Search, BadgeCheck, Loader2, MapPin, Shield } from "lucide-react";
import type { User } from "@shared/schema";
import { jsPDF } from "jspdf";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type PartialUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'kycStatus' | 'kycRejectionReason' | 'createdAt' | 'balance' | 'isAdmin' | 'suspended'>;

export default function KycVerificationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  const { data: submissions, isLoading, refetch } = useQuery<PartialUser[]>({
    queryKey: ["/api/admin/kyc-submissions"],
  });

  const { data: selectedUserDetails, isLoading: isLoadingDetails } = useQuery<User>({
    queryKey: ["/api/admin/user", selectedUserId, "profile"],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const response = await fetch(`/api/admin/user/${selectedUserId}/profile`);
      if (!response.ok) throw new Error("Failed to fetch user details");
      return response.json();
    },
  });

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (!searchQuery.trim()) return submissions;
    
    const query = searchQuery.toLowerCase().trim();
    return submissions.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [submissions, searchQuery]);

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/approve-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to approve KYC");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succes", description: "KYC approuvee" });
      setSelectedUserId(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'approuver la KYC", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/reject-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: rejectionReason }),
      });
      if (!response.ok) throw new Error("Failed to reject KYC");
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data?.autoSuspended) {
        toast({ title: "Compte suspendu", description: `Le compte a ete automatiquement suspendu apres ${data.kycRejectionCount} rejets KYC consecutifs`, variant: "destructive" });
      } else {
        toast({ title: "Succes", description: "KYC rejetee" });
      }
      setSelectedUserId(null);
      setRejectionReason("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/search"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de rejeter la KYC", variant: "destructive" });
    },
  });

  const downloadPdf = async (user: User) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxTextWidth = pageWidth - margin * 2;
    let y = 20;

    const KYC_STEP_LABELS = [
      "Etape 1 - Informations personnelles",
      "Etape 2 - Description de l'activite",
      "Etape 3 - Documents d'identite",
      "Etape 4 - Localisation geographique",
      "Etape 5 - Signature et validation finale",
    ];
    
    const getStatusText = (status: string) => {
      switch (status) {
        case "verified": return "Verifie";
        case "rejected": return "Rejete";
        case "submitted": return "En attente de verification";
        default: return status;
      }
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    const addSectionTitle = (title: string) => {
      checkPageBreak(20);
      y += 8;
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text(title, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    };

    const addField = (label: string, value: string) => {
      checkPageBreak(14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(label, margin + 2, y);
      y += 5;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const splitLines = doc.splitTextToSize(value, maxTextWidth - 4);
      splitLines.forEach((line: string) => {
        checkPageBreak(7);
        doc.text(line, margin + 2, y);
        y += 6;
      });
      y += 2;
    };

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text("RAPPORT DE VERIFICATION KYC", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("BKApay - Plateforme de paiement", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Document genere le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} a ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 5;

    addSectionTitle("1. Informations personnelles");
    addField("Prenom", user.firstName);
    addField("Nom", user.lastName);
    addField("Adresse email", user.email);
    addField("Pays", user.country || "Non defini");
    addField("Statut KYC", getStatusText(user.kycStatus));
    addField("Date d'inscription", new Date(user.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }));

    if (user.kycRejectionReason) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("Raison du rejet", margin + 2, y);
      y += 5;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const splitLines = doc.splitTextToSize(user.kycRejectionReason, maxTextWidth - 4);
      splitLines.forEach((line: string) => {
        checkPageBreak(7);
        doc.text(line, margin + 2, y);
        y += 6;
      });
      doc.setTextColor(0, 0, 0);
      y += 2;
    }

    if ((user as any).kycActivityDescription) {
      addSectionTitle("2. Description de l'activite");
      addField("Activite declaree", (user as any).kycActivityDescription);
    }

    if ((user as any).kycLatitude && (user as any).kycLongitude) {
      addSectionTitle("3. Localisation geographique");
      if ((user as any).kycAddress) {
        addField("Adresse", (user as any).kycAddress);
      }
      addField("Latitude", (user as any).kycLatitude);
      addField("Longitude", (user as any).kycLongitude);
      addField("Coordonnees GPS", `${(user as any).kycLatitude}, ${(user as any).kycLongitude}`);
    }

    if ((user as any).kycAcceptedTerms) {
      addSectionTitle("4. Engagements acceptes par l'utilisateur");
      try {
        const terms = JSON.parse((user as any).kycAcceptedTerms) as string[];
        terms.forEach((term: string, i: number) => {
          const stepLabel = KYC_STEP_LABELS[i] || `Etape ${i + 1}`;
          checkPageBreak(20);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(59, 130, 246);
          doc.text(stepLabel, margin + 2, y);
          doc.setTextColor(0, 0, 0);
          y += 5;
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          const splitLines = doc.splitTextToSize(`[Accepte] ${term}`, maxTextWidth - 10);
          splitLines.forEach((line: string) => {
            checkPageBreak(6);
            doc.text(line, margin + 6, y);
            y += 5;
          });
          y += 3;
        });
      } catch {}
    }

    addSectionTitle("5. Documents fournis");

    const addImageToPdf = async (imageUrl: string, label: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!imageUrl) {
          resolve();
          return;
        }
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          checkPageBreak(110);
          
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin, y);
          y += 6;
          
          const maxWidth = 160;
          const maxHeight = 95;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          try {
            doc.addImage(img, "JPEG", margin, y, width, height);
            y += height + 10;
          } catch (e) {
            doc.setFont("helvetica", "normal");
            doc.text("Image non disponible", margin, y);
            y += 10;
          }
          resolve();
        };
        img.onerror = () => {
          checkPageBreak(15);
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          doc.text(`${label}: Image non disponible`, margin, y);
          y += 10;
          resolve();
        };
        img.src = imageUrl;
      });
    };
    
    try {
      if (user.kycIdFront) {
        await addImageToPdf(user.kycIdFront, "Piece d'identite (Recto)");
      }
      if (user.kycIdBack) {
        await addImageToPdf(user.kycIdBack, "Piece d'identite (Verso)");
      }
      if (user.kycSelfie) {
        await addImageToPdf(user.kycSelfie, "Photo avec piece en main");
      }
      if (user.kycSignature) {
        await addImageToPdf(user.kycSignature, "Signature manuscrite");
      }
    } catch (e) {
      console.error("Erreur lors de l'ajout des images:", e);
    }

    checkPageBreak(30);
    y += 5;
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Ce document est un rapport officiel de verification KYC genere par BKApay.", margin, y);
    y += 5;
    doc.text("Il contient les informations fournies par l'utilisateur lors de sa demande de verification.", margin, y);
    y += 5;
    doc.text(`Reference: KYC-${user.id.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`, margin, y);
    doc.setTextColor(0, 0, 0);
    
    doc.save(`KYC_${user.firstName}_${user.lastName}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verifie</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejete</Badge>;
      case "submitted":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">En attente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectedUserId ? setSelectedUserId(null) : navigate("/dashboard/management")}
          data-testid="button-back-to-management"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verification KYC</h1>
          <p className="text-sm text-muted-foreground">Gerer les demandes de verification d'identite</p>
        </div>
      </div>

      {!selectedUserId ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email ou nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-kyc-verification"
            />
          </div>
          
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Chargement...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery ? `Aucune demande trouvee pour "${searchQuery}"` : "Aucune demande KYC"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSubmissions.map((user) => (
                <Card
                  key={user.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedUserId(user.id)}
                  data-testid={`kyc-card-${user.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {user.firstName} {user.lastName}
                          </CardTitle>
                          {getStatusBadge(user.kycStatus)}
                        </div>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Soumis le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : isLoadingDetails ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Chargement des documents...</p>
        </div>
      ) : selectedUserDetails ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>
                      {selectedUserDetails.firstName} {selectedUserDetails.lastName}
                    </CardTitle>
                    {getStatusBadge(selectedUserDetails.kycStatus)}
                  </div>
                  <CardDescription>{selectedUserDetails.email}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPdf(selectedUserDetails)}
                  data-testid="button-download-user-pdf"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Telecharger PDF
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Prenom</p>
                  <p className="text-sm font-medium">{selectedUserDetails.firstName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Nom</p>
                  <p className="text-sm font-medium">{selectedUserDetails.lastName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{selectedUserDetails.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pays</p>
                  <p className="text-sm font-medium">{selectedUserDetails.country || "Non defini"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Statut KYC</p>
                  <div className="mt-1">{getStatusBadge(selectedUserDetails.kycStatus)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Date d'inscription</p>
                  <p className="text-sm font-medium">{new Date(selectedUserDetails.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
                {selectedUserDetails.kycRejectionReason && (
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Raison du rejet KYC</p>
                    <p className="text-sm text-red-600 dark:text-red-400">{selectedUserDetails.kycRejectionReason}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {(selectedUserDetails as any).kycActivityDescription && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description de l'activite</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{(selectedUserDetails as any).kycActivityDescription}</p>
              </CardContent>
            </Card>
          )}

          {(selectedUserDetails as any).kycLatitude && (selectedUserDetails as any).kycLongitude && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Emplacement de l'utilisateur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg overflow-hidden border" style={{ height: "300px" }}>
                  <MapContainer
                    center={[parseFloat((selectedUserDetails as any).kycLatitude), parseFloat((selectedUserDetails as any).kycLongitude)]}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                    dragging={true}
                    zoomControl={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[parseFloat((selectedUserDetails as any).kycLatitude), parseFloat((selectedUserDetails as any).kycLongitude)]} />
                  </MapContainer>
                </div>
                {(selectedUserDetails as any).kycAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{(selectedUserDetails as any).kycAddress}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Coordonnees GPS: {(selectedUserDetails as any).kycLatitude}, {(selectedUserDetails as any).kycLongitude}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Documents fournis</h3>
              <p className="text-xs text-muted-foreground mb-3">Cliquez sur une image pour la voir en taille reelle</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedUserDetails.kycIdFront && (
                  <div
                    className="border rounded-lg p-4 cursor-pointer hover-elevate"
                    onClick={() => setLightboxImage({ src: selectedUserDetails.kycIdFront!, alt: "Piece d'identite (Recto)" })}
                    data-testid="button-view-id-front"
                  >
                    <p className="text-sm font-medium mb-3">Piece d'identite (Recto)</p>
                    <img
                      src={selectedUserDetails.kycIdFront}
                      alt="ID Front"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUserDetails.kycIdBack && (
                  <div
                    className="border rounded-lg p-4 cursor-pointer hover-elevate"
                    onClick={() => setLightboxImage({ src: selectedUserDetails.kycIdBack!, alt: "Piece d'identite (Verso)" })}
                    data-testid="button-view-id-back"
                  >
                    <p className="text-sm font-medium mb-3">Piece d'identite (Verso)</p>
                    <img
                      src={selectedUserDetails.kycIdBack}
                      alt="ID Back"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUserDetails.kycSelfie && (
                  <div
                    className="border rounded-lg p-4 cursor-pointer hover-elevate"
                    onClick={() => setLightboxImage({ src: selectedUserDetails.kycSelfie!, alt: "Photo avec piece en main" })}
                    data-testid="button-view-selfie"
                  >
                    <p className="text-sm font-medium mb-3">Photo avec piece en main</p>
                    <img
                      src={selectedUserDetails.kycSelfie}
                      alt="Selfie"
                      className="w-full h-64 object-contain rounded"
                    />
                  </div>
                )}
                {selectedUserDetails.kycSignature && (
                  <div
                    className="border rounded-lg p-4 cursor-pointer hover-elevate"
                    onClick={() => setLightboxImage({ src: selectedUserDetails.kycSignature!, alt: "Signature" })}
                    data-testid="button-view-signature"
                  >
                    <p className="text-sm font-medium mb-3">Signature</p>
                    <img
                      src={selectedUserDetails.kycSignature}
                      alt="Signature"
                      className="w-full h-32 object-contain rounded bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {(selectedUserDetails as any).kycAcceptedTerms && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Engagements acceptes par l'utilisateur
                  </CardTitle>
                  <CardDescription>Chaque engagement correspond a une etape de la verification KYC</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const KYC_STEPS = [
                      { step: 1, label: "Informations personnelles", icon: "1" },
                      { step: 2, label: "Description de l'activite", icon: "2" },
                      { step: 3, label: "Documents d'identite", icon: "3" },
                      { step: 4, label: "Localisation geographique", icon: "4" },
                      { step: 5, label: "Signature et validation finale", icon: "5" },
                    ];
                    try {
                      const terms = JSON.parse((selectedUserDetails as any).kycAcceptedTerms) as string[];
                      return (
                        <div className="space-y-4">
                          {terms.map((term: string, i: number) => {
                            const stepInfo = KYC_STEPS[i] || { step: i + 1, label: `Etape ${i + 1}`, icon: `${i + 1}` };
                            return (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                  {stepInfo.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                    Etape {stepInfo.step} - {stepInfo.label}
                                  </p>
                                  <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm">{term}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } catch {
                      return <p className="text-sm text-muted-foreground">Donnees non disponibles</p>;
                    }
                  })()}
                </CardContent>
              </Card>
            )}

            {selectedUserDetails.kycStatus === "submitted" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Raison de rejet (optionnel)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Indiquez la raison du rejet si necessaire..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    data-testid="textarea-rejection-reason"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => approveMutation.mutate(selectedUserDetails.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="button-approve-kyc"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Approuver
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate(selectedUserDetails.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1"
                      data-testid="button-reject-kyc"
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Rejeter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedUserDetails.kycRejectionReason && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-base text-red-600 dark:text-red-400">Raison du rejet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selectedUserDetails.kycRejectionReason}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">Utilisateur non trouve</p>
          </CardContent>
        </Card>
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
          data-testid="lightbox-overlay"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              data-testid="button-close-lightbox"
            >
              <X className="w-6 h-6" />
            </Button>
            <p className="text-white text-sm font-medium mb-2 text-center">{lightboxImage.alt}</p>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
