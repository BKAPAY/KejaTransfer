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
};

function fmtFee(val: number): string {
  const pct = val / 10;
  return (Number.isInteger(pct) ? pct.toString() : pct.toFixed(1)) + "%";
}

function getOperatorName(op: string) {
  return OPERATOR_NAMES[op.toLowerCase()] || op.charAt(0).toUpperCase() + op.slice(1);
}

function OperatorRow({ rate, type }: { rate: FeeRate; type: "payin" | "payout" }) {
  const logo = OPERATOR_LOGOS[rate.operator.toLowerCase()];
  const name = getOperatorName(rate.operator);
  const fee = type === "payin" ? rate.incomingFeePercentage : rate.outgoingFeePercentage;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md border bg-card"
      data-testid={`fee-row-${type}-${rate.country}-${rate.operator}`}
    >
      <CountryFlag code={rate.country} size="md" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {logo ? (
          <img
            src={logo}
            alt={name}
            className="w-8 h-8 object-contain rounded-sm flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {rate.operator.slice(0, 2)}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{getCountryName(rate.country)}</p>
        </div>
      </div>
      <Badge variant="secondary" className="text-sm font-semibold flex-shrink-0">
        {fmtFee(fee)}
      </Badge>
    </div>
  );
}

function groupByCountry(rates: FeeRate[]): [string, FeeRate[]][] {
  const map = new Map<string, FeeRate[]>();
  for (const r of rates) {
    if (!map.has(r.country)) map.set(r.country, []);
    map.get(r.country)!.push(r);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

async function generatePDF(
  payinRates: FeeRate[],
  payoutRates: FeeRate[],
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void
) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = 210;
    const margin = 15;
    const colW = pageW - margin * 2;
    const date = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

    let y = 20;

    const drawHeader = () => {
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageW, 16, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("BKApay — Grille tarifaire", margin, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(date, pageW - margin, 10, { align: "right" });
      doc.setTextColor(0, 0, 0);
    };

    const checkPage = (needed: number) => {
      if (y + needed > 280) {
        doc.addPage();
        drawHeader();
        y = 24;
      }
    };

    drawHeader();
    y = 24;

    const drawSectionTitle = (title: string, iconChar: string) => {
      checkPage(14);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, colW, 9, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`${iconChar}  ${title}`, margin + 3, y + 6);
      doc.setTextColor(0, 0, 0);
      y += 12;
    };

    const drawTableRow = (
      country: string,
      operator: string,
      fee: string,
      isHeader: boolean,
      isAlt: boolean
    ) => {
      checkPage(8);
      if (isHeader) {
        doc.setFillColor(226, 232, 240);
        doc.rect(margin, y, colW, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(country, margin + 3, y + 5);
        doc.text(operator, margin + 65, y + 5);
        doc.text(fee, pageW - margin - 3, y + 5, { align: "right" });
        doc.setTextColor(0, 0, 0);
      } else {
        if (isAlt) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, colW, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(country, margin + 3, y + 5);
        doc.setTextColor(30, 41, 59);
        doc.text(operator, margin + 65, y + 5);
        doc.setFillColor(99, 102, 241);
        doc.roundedRect(pageW - margin - 20, y + 1, 17, 5, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(fee, pageW - margin - 3, y + 5, { align: "right" });
        doc.setTextColor(0, 0, 0);
      }
      y += 7;
    };

    const drawBorderLine = () => {
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, margin + colW, y);
      y += 4;
    };

    const renderSection = (rates: FeeRate[], type: "payin" | "payout", title: string, icon: string) => {
      if (rates.length === 0) return;
      drawSectionTitle(title, icon);
      drawTableRow("Pays", "Opérateur", "Frais", true, false);
      drawBorderLine();

      let rowIndex = 0;
      for (const [, countryRates] of groupByCountry(rates)) {
        for (const rate of countryRates) {
          const fee = type === "payin" ? rate.incomingFeePercentage : rate.outgoingFeePercentage;
          drawTableRow(getCountryName(rate.country), getOperatorName(rate.operator), fmtFee(fee), false, rowIndex % 2 === 1);
          rowIndex++;
        }
      }
      y += 6;
    };

    renderSection(payinRates, "payin", "Payin — Paiements entrants", "↓");
    renderSection(payoutRates, "payout", "Payout — Paiements sortants", "↑");

    checkPage(14);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Les frais sont susceptibles d'être modifiés. Consultez la plateforme pour les tarifs en vigueur.",
      margin,
      y + 4
    );

    doc.save(`BKApay_frais_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error("PDF generation error:", err);
    toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
  }
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
          <p className="text-sm text-muted-foreground mt-1">
            Frais applicables sur vos transactions selon le canal de paiement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-fees"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={handleDownloadPDF}
            disabled={isLoading || isGenerating || feeRates.length === 0}
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? "Génération..." : "Télécharger PDF"}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Les frais sont calculés sur chaque transaction. Pour un paiement entrant (Payin), le montant reçu est net de frais. Pour un paiement sortant (Payout), les frais sont ajoutés au montant envoyé.
        </p>
      </div>

      <Tabs defaultValue="payin">
        <TabsList className="w-full" data-testid="tabs-fees">
          <TabsTrigger value="payin" className="flex-1 gap-2" data-testid="tab-payin">
            <ArrowDownToLine className="w-4 h-4" />
            Payin
          </TabsTrigger>
          <TabsTrigger value="payout" className="flex-1 gap-2" data-testid="tab-payout">
            <ArrowUpFromLine className="w-4 h-4" />
            Payout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payin" className="mt-4 space-y-5" data-testid="content-payin">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))
          ) : payinRates.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Aucun canal Payin disponible
              </CardContent>
            </Card>
          ) : (
            groupByCountry(payinRates).map(([country, rates]) => (
              <div key={country} className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <CountryFlag code={country} size="sm" />
                  <span className="text-sm font-semibold text-foreground">{getCountryName(country)}</span>
                </div>
                <div className="space-y-2 pl-1">
                  {rates.map(rate => (
                    <OperatorRow key={`${rate.country}-${rate.operator}`} rate={rate} type="payin" />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="payout" className="mt-4 space-y-5" data-testid="content-payout">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))
          ) : payoutRates.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Aucun canal Payout disponible
              </CardContent>
            </Card>
          ) : (
            groupByCountry(payoutRates).map(([country, rates]) => (
              <div key={country} className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <CountryFlag code={country} size="sm" />
                  <span className="text-sm font-semibold text-foreground">{getCountryName(country)}</span>
                </div>
                <div className="space-y-2 pl-1">
                  {rates.map(rate => (
                    <OperatorRow key={`${rate.country}-${rate.operator}`} rate={rate} type="payout" />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
