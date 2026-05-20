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

// Palette de couleurs BKApay
const QR_COLORS = {
  dark: "#1e3a5f",
  light: "#ffffff",
  accent: "#2563eb",
  gold: "#f59e0b",
};

// Charge une image depuis une URL
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossible de charger : ${src}`));
    img.src = src;
  });
}

// Opérateurs mobile money — logos réels (PNG téléchargés) + SVG pour Wave et Free
const OPERATORS = [
  { name: "MTN",      file: "/operator-logos/mtn.png"      },
  { name: "Orange",   file: "/operator-logos/orange.png"   },
  { name: "Wave",     file: "/operator-logos/wave.svg"     },
  { name: "Airtel",   file: "/operator-logos/airtel.png"   },
  { name: "Moov",     file: "/operator-logos/moov.png"     },
  { name: "M-Pesa",   file: "/operator-logos/mpesa.png"    },
  { name: "Free",     file: "/operator-logos/free.svg"     },
  { name: "Expresso", file: "/operator-logos/expresso.png" },
];

// Génère le poster professionnel haute résolution (2400×3540 px ≈ A4 300dpi)
async function generatePosterCanvas(url: string, merchantName: string): Promise<HTMLCanvasElement> {
  // Dimensions logiques (coordonnées de dessin)
  const LW = 800;
  const LH = 1180;
  // Facteur d'échelle pour haute résolution
  const SCALE = 3;
  const W = LW * SCALE;
  const H = LH * SCALE;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Appliquer le zoom global : toutes les coordonnées restent en unités logiques
  ctx.scale(SCALE, SCALE);

  // ── Fond bleu marine dégradé ──────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, LH);
  bgGrad.addColorStop(0,   "#18304f");
  bgGrad.addColorStop(0.5, "#0e2039");
  bgGrad.addColorStop(1,   "#091528");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, LW, LH);

  // ── Logos opérateurs en filigrane dans le fond ───────────────────────────
  const logoImgs = await Promise.allSettled(
    OPERATORS.map(op => loadImage(op.file))
  );

  // Positions des logos en filigrane (côtés gauche et droit)
  const wmPositions = [
    { x: 30,       y: 260,  w: 110, h: 55  },
    { x: LW - 140, y: 260,  w: 110, h: 55  },
    { x: 30,       y: 460,  w: 110, h: 55  },
    { x: LW - 140, y: 460,  w: 110, h: 55  },
    { x: 30,       y: 660,  w: 110, h: 55  },
    { x: LW - 140, y: 660,  w: 110, h: 55  },
    { x: 30,       y: 860,  w: 110, h: 55  },
    { x: LW - 140, y: 860,  w: 110, h: 55  },
  ];

  logoImgs.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const pos = wmPositions[i % wmPositions.length];
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.drawImage(result.value, pos.x, pos.y, pos.w, pos.h);
    ctx.restore();
  });

  // ── Halos décoratifs ─────────────────────────────────────────────────────
  const halo = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  halo(LW * 0.85, 220, 200, "rgba(37,99,235,0.15)");
  halo(LW * 0.15, LH - 220, 180, "rgba(245,158,11,0.10)");

  // ── En-tête blanc ─────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LW, 160);

  // Logo BKApay
  try {
    const logo = await loadImage("/bkapay-logo-full.png");
    const logoH = 96;
    const logoW = Math.round((logo.width / logo.height) * logoH);
    ctx.drawImage(logo, (LW - logoW) / 2, 16, logoW, logoH);
  } catch {
    ctx.fillStyle = QR_COLORS.accent;
    ctx.font = "bold 52px Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BKAPAY", LW / 2, 80);
  }

  // Tagline
  ctx.fillStyle = "#64748b";
  ctx.font = "600 13px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("MOBILE MONNAIE POUR L'AFRIQUE", LW / 2, 122);

  // ── Barre or ──────────────────────────────────────────────────────────────
  const barGrad = ctx.createLinearGradient(0, 0, LW, 0);
  barGrad.addColorStop(0,   "#b45309");
  barGrad.addColorStop(0.5, "#f59e0b");
  barGrad.addColorStop(1,   "#b45309");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 160, LW, 8);

  // ── Section message ───────────────────────────────────────────────────────
  const msgTop = 200;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#94a3b8";
  ctx.font = "300 20px Arial, sans-serif";
  ctx.fillText("Scannez pour payer au marchand", LW / 2, msgTop);

  // Nom du marchand — grand, gras, doré, avec glow
  ctx.shadowColor = "rgba(245,158,11,0.45)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#f59e0b";
  ctx.font = "900 64px Arial Black, Arial, sans-serif";
  ctx.fillText(merchantName, LW / 2, msgTop + 36);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "400 18px Arial, sans-serif";
  ctx.fillText("via lien marchand BKAPAY", LW / 2, msgTop + 118);

  // ── Card QR code ──────────────────────────────────────────────────────────
  const qrLogicSize = 470;
  const qrPad = 28;
  const cardW = qrLogicSize + qrPad * 2;
  const cardH = qrLogicSize + qrPad * 2;
  const cardX = (LW - cardW) / 2;
  const cardY = msgTop + 162;

  // Ombre portée
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Bordure or subtile
  ctx.strokeStyle = "rgba(245,158,11,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24);
  ctx.stroke();

  // QR code généré à haute résolution (qrLogicSize × SCALE pixels)
  const qrRealSize = qrLogicSize * SCALE;
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: qrRealSize,
    margin: 2,
    color: { dark: QR_COLORS.dark, light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
  drawCenterLabel(qrCanvas, Math.round(qrRealSize * 0.072));

  // Dessiner dans l'espace logique (ctx.scale s'applique)
  ctx.drawImage(qrCanvas, cardX + qrPad, cardY + qrPad, qrLogicSize, qrLogicSize);

  // ── Pied de page ──────────────────────────────────────────────────────────
  const footerY = cardY + cardH + 30;

  // Séparateur or
  const sepG = ctx.createLinearGradient(0, 0, LW, 0);
  sepG.addColorStop(0,   "transparent");
  sepG.addColorStop(0.2, "rgba(245,158,11,0.55)");
  sepG.addColorStop(0.8, "rgba(245,158,11,0.55)");
  sepG.addColorStop(1,   "transparent");
  ctx.fillStyle = sepG;
  ctx.fillRect(0, footerY, LW, 1.5);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Paiement sécurisé par BKAPAY", LW / 2, footerY + 14);

  ctx.fillStyle = "#64748b";
  ctx.font = "400 12px Arial, sans-serif";
  ctx.fillText("Paiements acceptés via", LW / 2, footerY + 36);

  // ── Rangée logos opérateurs (vraies images SVG) ───────────────────────────
  const logoW = 86;
  const logoH2 = 43;
  const logoGap = 12;
  const totalLogoW = OPERATORS.length * logoW + (OPERATORS.length - 1) * logoGap;
  const logoStartX = (LW - totalLogoW) / 2;
  const logoY = footerY + 58;

  logoImgs.forEach((result, i) => {
    const lx = logoStartX + i * (logoW + logoGap);
    if (result.status === "fulfilled") {
      // Logo réel SVG
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(lx, logoY, logoW, logoH2, 8);
      ctx.clip();
      ctx.drawImage(result.value, lx, logoY, logoW, logoH2);
      ctx.restore();
    }
  });

  return canvas;
}

// Dessine "BKAPAY" au centre d'un canvas QR déjà généré
function drawCenterLabel(canvas: HTMLCanvasElement, fontSize = 13) {
  const ctx = canvas.getContext("2d")!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const label = "BKAPAY";

  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  const textW = ctx.measureText(label).width;
  const padX = 8;
  const padY = 5;
  const boxW = textW + padX * 2;
  const boxH = fontSize + padY * 2;

  // Fond blanc avec bordure bleue
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 5);
  ctx.fill();
  ctx.strokeStyle = QR_COLORS.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 5);
  ctx.stroke();

  // Texte
  ctx.fillStyle = QR_COLORS.dark;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);
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
    }).then(() => {
      drawCenterLabel(canvasRef.current!, 13);
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
      const poster = await generatePosterCanvas(url, link.merchantName);
      const dataUrl = poster.toDataURL("image/png", 1.0);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `affiche-${link.merchantName.toLowerCase()}-bkapay.png`;
      a.click();
      toast({ title: "Téléchargé", description: "Affiche exportée en PNG haute résolution" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer l'affiche", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  }, [url, link.merchantName, toast]);

  const downloadPDF = useCallback(async () => {
    setDownloading("pdf");
    try {
      // Générer le poster haute résolution (800×1130)
      const poster = await generatePosterCanvas(url, link.merchantName);
      const imgData = poster.toDataURL("image/png", 1.0);

      // PDF A4 portrait — le poster rempli toute la page
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();   // 210 mm
      const pageH = pdf.internal.pageSize.getHeight();  // 297 mm

      // Calcul des proportions pour conserver le ratio du poster
      const posterRatio = poster.height / poster.width;  // ≈ 1130/800
      const imgH = pageW * posterRatio;
      const imgY = Math.max(0, (pageH - imgH) / 2);

      pdf.addImage(imgData, "PNG", 0, imgY, pageW, imgH);

      pdf.save(`affiche-${link.merchantName.toLowerCase()}-bkapay.pdf`);
      toast({ title: "Téléchargé", description: "Affiche exportée en PDF A4 prêt à imprimer" });
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

        {/* Message d'instruction avant les boutons */}
        <p className="text-sm text-center text-muted-foreground leading-snug">
          Téléchargez le code QR et collez-le dans votre boutique pour collecter les paiements
        </p>

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
