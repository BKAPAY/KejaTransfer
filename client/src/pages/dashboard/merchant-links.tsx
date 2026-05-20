import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, ExternalLink, Trash2, Store, Download, FileText, QrCode } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MerchantLink } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const merchantLinkSchema = z.object({
  merchantName: z.string()
    .min(3, "Le nom marchand doit contenir au minimum 3 caractères")
    .max(10, "Le nom marchand doit contenir au maximum 10 caractères")
    .regex(/^[A-Z]+$/, "Le nom marchand doit contenir uniquement des lettres majuscules"),
});

type MerchantLinkFormData = z.infer<typeof merchantLinkSchema>;

// Palette de couleurs BKApay pour le QR code
const QR_COLORS = {
  dark: "#1e3a5f",
  light: "#ffffff",
  accent: "#2563eb",
  gold: "#f59e0b",
};

// Génère un QR code coloré dans un canvas hors écran et retourne le dataURL PNG
async function generateBrandedQRCanvas(url: string, merchantName: string, size = 400): Promise<string> {
  // 1. Générer le QR code brut dans un canvas temporaire
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: size,
    margin: 2,
    color: {
      dark: QR_COLORS.dark,
      light: QR_COLORS.light,
    },
    errorCorrectionLevel: "H",
  });

  // 2. Créer le canvas final avec branding
  const padding = 32;
  const headerH = 64;
  const footerH = 72;
  const totalW = size + padding * 2;
  const totalH = size + padding * 2 + headerH + footerH;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = totalW;
  finalCanvas.height = totalH;
  const ctx = finalCanvas.getContext("2d")!;

  // Fond blanc
  ctx.fillStyle = "#ffffff";
  ctx.roundRect(0, 0, totalW, totalH, 16);
  ctx.fill();

  // Bande supérieure bleue
  ctx.fillStyle = QR_COLORS.accent;
  ctx.roundRect(0, 0, totalW, headerH, [16, 16, 0, 0]);
  ctx.fill();

  // Nom marchand dans l'en-tête
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(merchantName, totalW / 2, headerH / 2);

  // QR code centré
  ctx.drawImage(qrCanvas, padding, headerH + padding, size, size);

  // Bande inférieure dorée
  ctx.fillStyle = QR_COLORS.gold;
  ctx.fillRect(0, totalH - footerH, totalW, footerH);

  // Texte bas
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Scanner pour payer · ${merchantName}`, totalW / 2, totalH - footerH + 22);

  ctx.fillStyle = QR_COLORS.dark;
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillText("par BKAPAY", totalW / 2, totalH - footerH + 46);

  return finalCanvas.toDataURL("image/png", 1.0);
}

// Composant QR affiché dans la page — taille responsive
function MerchantQRCode({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 180,
      margin: 2,
      color: { dark: QR_COLORS.dark, light: QR_COLORS.light },
      errorCorrectionLevel: "H",
    }).catch(console.error);
  }, [url]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="qr-code-canvas"
      style={{ display: "block", maxWidth: "100%" }}
    />
  );
}

// Aperçu branded du QR — entièrement responsive
function BrandedQRPreview({ url, merchantName }: { url: string; merchantName: string }) {
  return (
    <div className="w-full max-w-[260px] mx-auto rounded-xl overflow-hidden border shadow-sm select-none">
      <div className="bg-blue-600 py-3 px-4 text-center">
        <p className="text-white font-bold text-sm tracking-wider truncate">{merchantName}</p>
      </div>
      <div className="bg-white p-4 flex justify-center">
        <MerchantQRCode url={url} />
      </div>
      <div className="bg-amber-400 py-2 px-3 text-center">
        <p className="text-gray-800 text-[11px] font-semibold leading-tight">Scanner pour payer · {merchantName}</p>
        <p className="text-blue-900 text-xs font-bold mt-0.5">par BKAPAY</p>
      </div>
    </div>
  );
}

function MerchantLinkCard({ link }: { link: MerchantLink }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null);
  const url = `${window.location.origin}/merchant/${link.token}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    toast({ title: "Copié", description: "Le lien a été copié dans le presse-papiers" });
  };

  const downloadPNG = useCallback(async () => {
    setDownloading("png");
    try {
      const dataUrl = await generateBrandedQRCanvas(url, link.merchantName, 400);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${link.merchantName.toLowerCase()}-bkapay.png`;
      a.click();
      toast({ title: "Téléchargé", description: "Code QR exporté en PNG" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer l'image", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  }, [url, link.merchantName, toast]);

  const downloadPDF = useCallback(async () => {
    setDownloading("pdf");
    try {
      const imgData = await generateBrandedQRCanvas(url, link.merchantName, 500);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageW, pageH, "F");

      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pageW, 30, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("BKAPAY", pageW / 2, 18, { align: "center" });
      pdf.setFontSize(12);
      pdf.text("Code QR de paiement marchand", pageW / 2, 26, { align: "center" });

      const cardX = 30;
      const cardW = pageW - 60;
      const cardY = 45;
      const cardH = 185;

      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(cardX, cardY, cardW, cardH, 4, 4, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(cardX, cardY, cardW, cardH, 4, 4, "S");

      pdf.setFillColor(37, 99, 235);
      pdf.roundedRect(cardX, cardY, cardW, 18, 4, 4, "F");
      pdf.rect(cardX, cardY + 10, cardW, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(link.merchantName, pageW / 2, cardY + 12, { align: "center" });

      const qrSize = 100;
      const qrX = (pageW - qrSize) / 2;
      const qrY = cardY + 25;
      pdf.addImage(imgData, "PNG", qrX, qrY, qrSize, qrSize);

      pdf.setTextColor(30, 58, 95);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("Scanner pour payer", pageW / 2, qrY + qrSize + 10, { align: "center" });
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(37, 99, 235);
      pdf.text(link.merchantName, pageW / 2, qrY + qrSize + 18, { align: "center" });
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      pdf.text(url, pageW / 2, qrY + qrSize + 28, { align: "center" });

      pdf.setFillColor(245, 158, 11);
      pdf.rect(cardX, cardY + cardH - 18, cardW, 18, "F");
      pdf.roundedRect(cardX, cardY + cardH - 18, cardW, 18, 4, 4, "F");
      pdf.rect(cardX, cardY + cardH - 28, cardW, 10, "F");
      pdf.setTextColor(26, 26, 46);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("par BKAPAY", pageW / 2, cardY + cardH - 7, { align: "center" });

      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const instrY = cardY + cardH + 15;
      pdf.text("Comment payer :", cardX, instrY);
      pdf.setFontSize(9);
      [
        "1. Ouvrez l'appareil photo de votre smartphone",
        "2. Pointez vers le code QR ci-dessus",
        "3. Appuyez sur le lien qui apparaît",
        "4. Choisissez votre montant et payez",
      ].forEach((s, i) => pdf.text(s, cardX, instrY + 8 + i * 7));

      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, pageH - 20, pageW, 20, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Généré le ${new Date().toLocaleDateString("fr-FR")} · BKAPAY - Plateforme de paiement mobile money`,
        pageW / 2, pageH - 8, { align: "center" }
      );

      pdf.save(`qr-${link.merchantName.toLowerCase()}-bkapay.pdf`);
      toast({ title: "Téléchargé", description: "Code QR exporté en PDF" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  }, [url, link.merchantName, toast]);

  return (
    <Card data-testid={`merchant-link-${link.id}`} className="overflow-hidden">
      {/* En-tête */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-white font-bold text-lg tracking-wide truncate">{link.merchantName}</h2>
          <p className="text-blue-100 text-xs mt-0.5">
            Créé le {new Date(link.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={link.isActive ? "default" : "secondary"} className="bg-white/20 text-white border-white/30">
            {link.isActive ? "Actif" : "Inactif"}
          </Badge>
          <Store className="w-6 h-6 text-blue-100" />
        </div>
      </div>

      <CardContent className="p-4 space-y-5">
        {/* Aperçu QR — centré, largeur max contrainte */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
            <QrCode className="w-3.5 h-3.5" />
            Code QR de paiement
          </p>
          <BrandedQRPreview url={url} merchantName={link.merchantName} />
        </div>

        {/* Boutons de téléchargement — pleine largeur sur mobile */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={downloadPNG}
            disabled={downloading !== null}
            data-testid={`button-download-png-${link.id}`}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {downloading === "png" ? "Export..." : "PNG"}
          </Button>
          <Button
            variant="outline"
            onClick={downloadPDF}
            disabled={downloading !== null}
            data-testid={`button-download-pdf-${link.id}`}
            className="w-full"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            {downloading === "pdf" ? "Export..." : "PDF"}
          </Button>
        </div>

        {/* Lien de paiement */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lien de paiement</p>
          <div className="flex items-center gap-1 p-2.5 bg-muted rounded-md min-w-0">
            <code className="flex-1 text-xs truncate min-w-0">{url}</code>
            <Button variant="ghost" size="icon" onClick={copyToClipboard} data-testid={`button-copy-${link.id}`} className="shrink-0">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild data-testid={`button-open-${link.id}`} className="shrink-0">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Conseils de partage */}
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1.5">Comment partager</p>
          <ol className="text-xs text-amber-700 dark:text-amber-500 space-y-1 list-decimal list-inside">
            <li>Téléchargez le QR code (PNG ou PDF)</li>
            <li>Imprimez-le ou envoyez-le par WhatsApp</li>
            <li>Le client scanne et choisit le montant</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MerchantLinks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: merchantLinks, isLoading } = useQuery<MerchantLink[]>({
    queryKey: ["/api/merchant-links"],
  });

  const form = useForm<MerchantLinkFormData>({
    resolver: zodResolver(merchantLinkSchema),
    defaultValues: { merchantName: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MerchantLinkFormData) => {
      return await apiRequest("POST", "/api/merchant-links", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-links"] });
      toast({
        title: "Lien marchand créé",
        description: "Votre lien marchand a été créé avec succès",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création du lien",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lien marchand</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acceptez des paiements mobiles — montant libre choisi par vos clients
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-create-merchant-link"
              disabled={merchantLinks && merchantLinks.length > 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              {merchantLinks && merchantLinks.length > 0 ? "Lien déjà créé" : "Créer mon lien"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un lien marchand</DialogTitle>
              <DialogDescription>
                Vos clients pourront choisir librement le montant à payer. Le lien est permanent et ne peut être créé qu'une seule fois.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 pb-4">
                <FormField
                  control={form.control}
                  name="merchantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du marchand</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: BOUTIQUE (3-10 majuscules)"
                          data-testid="input-merchant-name"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          maxLength={10}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-1">
                        3 à 10 lettres majuscules uniquement. Identifiant permanent et unique.
                      </p>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? "Création..." : "Créer le lien"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contenu principal */}
      <div className="grid gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Chargement...
            </CardContent>
          </Card>
        ) : merchantLinks && merchantLinks.length > 0 ? (
          merchantLinks.map((link) => <MerchantLinkCard key={link.id} link={link} />)
        ) : (
          <Card>
            <CardContent className="py-16">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Store className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Aucun lien marchand</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créez votre lien pour recevoir des paiements et générer votre code QR
                  </p>
                </div>
                <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer mon lien marchand
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
