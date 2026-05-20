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

// Opérateurs mobile money avec leurs couleurs officielles
const OPERATORS = [
  { name: "MTN",    short: "MTN",   bg: "#FFC107", fg: "#1a1a1a" },
  { name: "Orange", short: "OR",    bg: "#FF6600", fg: "#ffffff" },
  { name: "Wave",   short: "WV",    bg: "#0099FF", fg: "#ffffff" },
  { name: "Airtel", short: "AT",    bg: "#E30613", fg: "#ffffff" },
  { name: "Moov",   short: "MV",    bg: "#00A651", fg: "#ffffff" },
  { name: "M-Pesa", short: "MP",    bg: "#00A651", fg: "#ffffff" },
  { name: "Free",   short: "FR",    bg: "#CC0000", fg: "#ffffff" },
  { name: "Expresso",short: "EX",   bg: "#003087", fg: "#ffffff" },
];

// Dessine les logos opérateurs en filigrane dans le fond
function drawOperatorWatermarks(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const r = 38;
  const positions = [
    { x: 68,     y: 310 },
    { x: 68,     y: 560 },
    { x: 68,     y: 810 },
    { x: W - 68, y: 310 },
    { x: W - 68, y: 560 },
    { x: W - 68, y: 810 },
    { x: 120,    y: 435 },
    { x: W - 120, y: 435 },
    { x: 120,    y: 685 },
    { x: W - 120, y: 685 },
  ];

  positions.forEach((pos, i) => {
    const op = OPERATORS[i % OPERATORS.length];
    ctx.save();
    ctx.globalAlpha = 0.12;

    // Cercle coloré
    ctx.fillStyle = op.bg;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Texte court
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${r * 0.65}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(op.short, pos.x, pos.y);

    ctx.restore();
  });
}

// Dessine la rangée d'opérateurs en bas du poster
function drawOperatorRow(ctx: CanvasRenderingContext2D, W: number, y: number) {
  const r = 22;
  const gap = 58;
  const totalW = OPERATORS.length * gap;
  const startX = (W - totalW) / 2 + r;

  OPERATORS.forEach((op, i) => {
    const cx = startX + i * gap;

    // Cercle
    ctx.fillStyle = op.bg;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Initiale
    ctx.fillStyle = op.fg;
    ctx.font = `bold ${r * 0.7}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(op.short, cx, y);

    // Nom en dessous
    ctx.fillStyle = "#94a3b8";
    ctx.font = `400 9px system-ui, sans-serif`;
    ctx.fillText(op.name, cx, y + r + 10);
  });
}

// Génère le poster professionnel complet (800×1180 px)
async function generatePosterCanvas(url: string, merchantName: string): Promise<HTMLCanvasElement> {
  const W = 800;
  const H = 1180;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Fond global bleu marine dégradé ──────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#162847");
  bgGrad.addColorStop(0.6, "#0d1f35");
  bgGrad.addColorStop(1, "#091526");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Filigranes opérateurs en arrière-plan ────────────────────────────────
  drawOperatorWatermarks(ctx, W, H);

  // ── Halos lumineux décoratifs ────────────────────────────────────────────
  const halo = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  halo(W * 0.85, 200, 220, "rgba(37,99,235,0.14)");
  halo(W * 0.15, H - 200, 200, "rgba(245,158,11,0.10)");

  // ── En-tête blanc arrondi ─────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, W, 150, [0, 0, 0, 0]);
  ctx.fill();

  // Logo BKApay (grand et centré)
  try {
    const logo = await loadImage("/bkapay-logo-full.png");
    const logoH = 82;
    const logoW = Math.round((logo.width / logo.height) * logoH);
    ctx.drawImage(logo, (W - logoW) / 2, 18, logoW, logoH);
  } catch {
    ctx.fillStyle = QR_COLORS.accent;
    ctx.font = "bold 44px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BKAPAY", W / 2, 72);
  }

  // Tagline
  ctx.fillStyle = "#64748b";
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.letterSpacing = "2px";
  ctx.fillText("MOBILE MONNAIE POUR L'AFRIQUE", W / 2, 112);
  ctx.letterSpacing = "0px";

  // ── Barre or épaisse ──────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 150, W, 150);
  grad.addColorStop(0, "#d97706");
  grad.addColorStop(0.5, "#f59e0b");
  grad.addColorStop(1, "#d97706");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 150, W, 6);

  // ── Section message ───────────────────────────────────────────────────────
  const msgTop = 186;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#94a3b8";
  ctx.font = "300 19px system-ui, sans-serif";
  ctx.fillText("Scannez pour payer au marchand", W / 2, msgTop);

  // Nom du marchand avec glow
  ctx.shadowColor = "rgba(245,158,11,0.35)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = QR_COLORS.gold;
  ctx.font = "bold 58px system-ui, sans-serif";
  ctx.fillText(merchantName, W / 2, msgTop + 32);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "400 17px system-ui, sans-serif";
  ctx.fillText("via lien marchand BKAPAY", W / 2, msgTop + 108);

  // ── Card QR code ──────────────────────────────────────────────────────────
  const qrSize = 450;
  const qrCardPad = 26;
  const qrCardW = qrSize + qrCardPad * 2;
  const qrCardH = qrSize + qrCardPad * 2;
  const qrCardX = (W - qrCardW) / 2;
  const qrCardY = msgTop + 148;

  // Ombre portée profonde
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(qrCardX, qrCardY, qrCardW, qrCardH, 22);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Bordure fine or sur la card
  ctx.strokeStyle = "rgba(245,158,11,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(qrCardX, qrCardY, qrCardW, qrCardH, 22);
  ctx.stroke();

  // QR code
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: qrSize,
    margin: 2,
    color: { dark: QR_COLORS.dark, light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
  drawCenterLabel(qrCanvas, Math.round(qrSize * 0.072));
  ctx.drawImage(qrCanvas, qrCardX + qrCardPad, qrCardY + qrCardPad, qrSize, qrSize);

  // ── Section pied de page ──────────────────────────────────────────────────
  const footerTop = qrCardY + qrCardH + 28;

  // Ligne séparatrice or
  const sepGrad = ctx.createLinearGradient(0, 0, W, 0);
  sepGrad.addColorStop(0, "transparent");
  sepGrad.addColorStop(0.3, "rgba(245,158,11,0.6)");
  sepGrad.addColorStop(0.7, "rgba(245,158,11,0.6)");
  sepGrad.addColorStop(1, "transparent");
  ctx.fillStyle = sepGrad;
  ctx.fillRect(0, footerTop, W, 1);

  // "Paiement sécurisé par BKAPAY" avec bouclier
  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Paiement sécurisé par BKAPAY", W / 2, footerTop + 14);

  // ── Rangée opérateurs ─────────────────────────────────────────────────────
  drawOperatorRow(ctx, W, footerTop + 64);

  // "Accepté par" au-dessus des opérateurs
  ctx.fillStyle = "#64748b";
  ctx.font = "400 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Paiements acceptés via", W / 2, footerTop + 34);

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
