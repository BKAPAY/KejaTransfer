import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CountryFlag, getCountryName } from "@/components/country-flag";
import { ArrowDownToLine, ArrowUpFromLine, Info, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";
import airtelImage from "@assets/image_search_1771486869310_1771487355059.png";
import mpesaImage from "@assets/image_search_1771486907537_1771487355101.png";
import celtiisImage from "@assets/image_search_1771486943445_1771487355123.jpg";
import expressoImage from "@assets/image_search_1771487048520_1771487355151.png";
import corisImage from "@assets/image_search_1771487069905_1771487355176.png";
import afrimoneyImage from "@assets/image_search_1771487089985_1771487355198.png";
import qmoneyImage from "@assets/image_search_1771487154605_1771487355255.jpg";
import telecelImage from "@assets/image_search_1771487186999_1771487355289.jpg";

const OPERATOR_LOGOS: Record<string, string> = {
  orange: omImage,
  mtn: mtnImage,
  moov: moovImage,
  wave: waveImage,
  free: freeImage,
  airtel: airtelImage,
  mpesa: mpesaImage,
  celtiis: celtiisImage,
  tmoney: tmonyImage,
  togocom: tmonyImage,
  expresso: expressoImage,
  coris: corisImage,
  afrimoney: afrimoneyImage,
  africell: airtelImage,
  qmoney: qmoneyImage,
  telecel: telecelImage,
  wizall: wizallImage,
};

const OPERATOR_NAMES: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN Mobile Money",
  moov: "Moov Money",
  wave: "Wave",
  free: "Mixx by Yas",
  airtel: "Airtel Money",
  mpesa: "M-Pesa",
  celtiis: "Celtiis",
  tmoney: "T-Money",
  togocom: "Togocom",
  expresso: "Expresso",
  coris: "Coris Money",
  afrimoney: "Afrimoney",
  africell: "Africell",
  qmoney: "QMoney",
  telecel: "Telecel",
  wizall: "Wizall",
};

type FeeRate = {
  country: string;
  operator: string;
  provider: string;
  incomingEnabled: boolean;
  outgoingEnabled: boolean;
  incomingFeePercentage: number;
  outgoingFeePercentage: number;
  isCustom?: boolean;
};

function fmtFee(val: number): string {
  const pct = val / 10;
  return (Number.isInteger(pct) ? pct.toString() : pct.toFixed(1)) + "%";
}

function getOperatorName(op: string) {
  return OPERATOR_NAMES[op.toLowerCase()] || op.charAt(0).toUpperCase() + op.slice(1);
}

function groupByCountry(rates: FeeRate[]): [string, FeeRate[]][] {
  const map = new Map<string, FeeRate[]>();
  for (const r of rates) {
    if (!map.has(r.country)) map.set(r.country, []);
    map.get(r.country)!.push(r);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function detectFormat(base64: string): string {
  if (base64.includes("data:image/jpeg") || base64.includes("data:image/jpg")) return "JPEG";
  if (base64.includes("data:image/png")) return "PNG";
  return "PNG";
}

async function generatePDF(
  payinRates: FeeRate[],
  payoutRates: FeeRate[],
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void
) {
  try {
    const { default: jsPDF } = await import("jspdf");

    const allCountries = Array.from(new Set([...payinRates, ...payoutRates].map(r => r.country)));
    const allOperators = Array.from(new Set([...payinRates, ...payoutRates].map(r => r.operator.toLowerCase())));

    const flagB64: Record<string, string | null> = {};
    const opLogoB64: Record<string, string | null> = {};

    await Promise.all([
      ...allCountries.map(async (code) => {
        flagB64[code] = await urlToBase64(`https://flagcdn.com/w40/${code.toLowerCase()}.png`);
      }),
      ...allOperators.map(async (op) => {
        const src = OPERATOR_LOGOS[op];
        opLogoB64[op] = src ? await urlToBase64(src) : null;
      }),
    ]);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = 210;
    const pageH = 297;
    const mx = 14;
    const colW = pageW - mx * 2;
    const date = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

    let y = 0;

    const NAVY = [15, 23, 42] as const;
    const INDIGO = [79, 70, 229] as const;
    const GREEN = [22, 163, 74] as const;
    const SLATE_LIGHT = [241, 245, 249] as const;
    const SLATE_MID = [226, 232, 240] as const;
    const SLATE_TEXT = [51, 65, 85] as const;
    const WHITE = [255, 255, 255] as const;

    const drawPageHeader = () => {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 20, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("BKApay", mx, 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Grille tarifaire officielle", mx + 30, 13);
      doc.setFontSize(8);
      doc.text(date, pageW - mx, 13, { align: "right" });

      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.8);
      doc.line(0, 20, pageW, 20);

      doc.setTextColor(0, 0, 0);
      y = 26;
    };

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 12) {
        doc.addPage();
        drawPageHeader();
      }
    };

    const drawSectionBanner = (title: string, type: "payin" | "payout") => {
      checkPage(16);
      const color = type === "payin" ? INDIGO : GREEN;
      doc.setFillColor(...color);
      doc.roundedRect(mx, y, colW, 10, 2, 2, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const icon = type === "payin" ? "\u2193" : "\u2191";
      doc.text(`${icon}  ${title}`, mx + 5, y + 7);
      doc.setTextColor(0, 0, 0);
      y += 14;
    };

    const drawColHeader = () => {
      checkPage(8);
      doc.setFillColor(...SLATE_MID);
      doc.rect(mx, y, colW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...SLATE_TEXT);
      doc.text("Opérateur", mx + 20, y + 5);
      doc.text("Frais", pageW - mx - 4, y + 5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 8;
    };

    const drawCountryRow = (country: string) => {
      checkPage(10);
      doc.setFillColor(...SLATE_LIGHT);
      doc.rect(mx, y, colW, 9, "F");
      doc.setDrawColor(...SLATE_MID);
      doc.setLineWidth(0.3);
      doc.rect(mx, y, colW, 9);

      const flag = flagB64[country];
      if (flag) {
        try {
          doc.addImage(flag, "PNG", mx + 3, y + 1.5, 9, 6);
        } catch {
          // skip if image fails
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      doc.text(getCountryName(country).toUpperCase(), mx + 15, y + 6.2);
      doc.setTextColor(0, 0, 0);
      y += 9;
    };

    const drawOperatorRow = (rate: FeeRate, type: "payin" | "payout", isAlt: boolean) => {
      checkPage(9);
      const rowH = 9;

      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(mx, y, colW, rowH, "F");
      }

      const logo = opLogoB64[rate.operator.toLowerCase()];
      if (logo) {
        try {
          const fmt = detectFormat(logo);
          doc.addImage(logo, fmt, mx + 3, y + 1.2, 7, 7);
        } catch {
          // skip
        }
      }

      const name = getOperatorName(rate.operator);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SLATE_TEXT);
      doc.text(name, mx + 13, y + 6.2);

      const fee = type === "payin" ? rate.incomingFeePercentage : rate.outgoingFeePercentage;
      const feeText = fmtFee(fee);
      const pillW = 14;
      const pillX = pageW - mx - pillW - 2;
      const color = type === "payin" ? INDIGO : GREEN;
      doc.setFillColor(...color);
      doc.roundedRect(pillX, y + 1.8, pillW, 5.5, 1.5, 1.5, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(feeText, pillX + pillW / 2, y + 5.8, { align: "center" });
      doc.setTextColor(0, 0, 0);

      y += rowH;
    };

    const drawCountrySeparator = () => {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.line(mx + 2, y + 1, mx + colW - 2, y + 1);
      y += 4;
    };

    const renderSection = (rates: FeeRate[], type: "payin" | "payout", title: string) => {
      if (rates.length === 0) return;
      drawSectionBanner(title, type);
      drawColHeader();

      const groups = groupByCountry(rates);
      groups.forEach(([country, countryRates], groupIdx) => {
        drawCountryRow(country);
        countryRates.forEach((rate, i) => {
          drawOperatorRow(rate, type, i % 2 === 1);
        });
        if (groupIdx < groups.length - 1) drawCountrySeparator();
      });

      y += 8;
    };

    drawPageHeader();
    renderSection(payinRates, "payin", "Payin — Paiements entrants");
    renderSection(payoutRates, "payout", "Payout — Paiements sortants");

    checkPage(10);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Les frais sont susceptibles d'être modifiés. Consultez la plateforme pour les tarifs en vigueur.",
      mx, y + 5
    );

    doc.save(`BKApay_frais_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error("PDF generation error:", err);
    toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
  }
}

function OperatorRow({ rate, type }: { rate: FeeRate; type: "payin" | "payout" }) {
  const logo = OPERATOR_LOGOS[rate.operator.toLowerCase()];
  const name = getOperatorName(rate.operator);
  const fee = type === "payin" ? rate.incomingFeePercentage : rate.outgoingFeePercentage;

  return (
    <div className="flex items-center gap-3 p-3 rounded-md border bg-card" data-testid={`fee-row-${type}-${rate.country}-${rate.operator}`}>
      <CountryFlag code={rate.country} size="md" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {logo ? (
          <img src={logo} alt={name} className="w-8 h-8 object-contain rounded-sm flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{rate.operator.slice(0, 2)}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{getCountryName(rate.country)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {rate.isCustom && (
          <Badge className="text-xs bg-amber-500 text-white">Personnalise</Badge>
        )}
        <Badge variant="secondary" className="text-sm font-semibold">{fmtFee(fee)}</Badge>
      </div>
    </div>
  );
}

export default function BusinessFees() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: feeRates = [], isLoading, refetch } = useQuery<FeeRate[]>({
    queryKey: ["/api/business/fee-rates"],
    staleTime: 0,
  });

  const payinRates = feeRates.filter(r => r.incomingEnabled);
  const payoutRates = feeRates.filter(r => r.outgoingEnabled);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    await generatePDF(payinRates, payoutRates, toast);
    setIsGenerating(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="title-fees">Grille tarifaire</h1>
          <p className="text-sm text-muted-foreground mt-1">Frais applicables sur vos transactions selon le canal de paiement</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="default" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-fees">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button variant="default" size="default" onClick={handleDownloadPDF} disabled={isLoading || isGenerating || feeRates.length === 0} data-testid="button-download-pdf">
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? "Génération..." : "Télécharger PDF"}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pour un paiement entrant (Payin), le montant reçu est net de frais. Pour un paiement sortant (Payout), les frais sont ajoutés au montant envoyé.
        </p>
      </div>

      <Tabs defaultValue="payin">
        <TabsList className="w-full" data-testid="tabs-fees">
          <TabsTrigger value="payin" className="flex-1 gap-2" data-testid="tab-payin">
            <ArrowDownToLine className="w-4 h-4" />Payin
          </TabsTrigger>
          <TabsTrigger value="payout" className="flex-1 gap-2" data-testid="tab-payout">
            <ArrowUpFromLine className="w-4 h-4" />Payout
          </TabsTrigger>
        </TabsList>

        {(["payin", "payout"] as const).map(type => {
          const rates = type === "payin" ? payinRates : payoutRates;
          return (
            <TabsContent key={type} value={type} className="mt-4 space-y-5" data-testid={`content-${type}`}>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)
              ) : rates.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Aucun canal {type === "payin" ? "Payin" : "Payout"} disponible</CardContent></Card>
              ) : (
                groupByCountry(rates).map(([country, cRates]) => (
                  <div key={country} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <CountryFlag code={country} size="sm" />
                      <span className="text-sm font-semibold text-foreground">{getCountryName(country)}</span>
                    </div>
                    <div className="space-y-2 pl-1">
                      {cRates.map(rate => <OperatorRow key={`${rate.country}-${rate.operator}`} rate={rate} type={type} />)}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
