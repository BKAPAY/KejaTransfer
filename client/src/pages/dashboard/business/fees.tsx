import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CountryFlag, getCountryName } from "@/components/country-flag";
import { ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";

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
  return (val / 10).toFixed(1).replace(".0", "") + "%";
}

function OperatorRow({ rate, type }: { rate: FeeRate; type: "payin" | "payout" }) {
  const logo = OPERATOR_LOGOS[rate.operator.toLowerCase()];
  const name = OPERATOR_NAMES[rate.operator.toLowerCase()] || rate.operator.charAt(0).toUpperCase() + rate.operator.slice(1);
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
      <Badge variant="secondary" className="text-sm font-semibold flex-shrink-0" data-testid={`fee-badge-${type}-${rate.country}-${rate.operator}`}>
        {fmtFee(fee)}
      </Badge>
    </div>
  );
}

function CountryGroup({ country, rates, type }: { country: string; rates: FeeRate[]; type: "payin" | "payout" }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <CountryFlag code={country} size="sm" />
        <span className="text-sm font-semibold text-foreground">{getCountryName(country)}</span>
      </div>
      <div className="space-y-2 pl-1">
        {rates.map(rate => (
          <OperatorRow key={`${rate.country}-${rate.operator}`} rate={rate} type={type} />
        ))}
      </div>
    </div>
  );
}

export default function BusinessFees() {
  const { data: feeRates = [], isLoading } = useQuery<FeeRate[]>({
    queryKey: ["/api/business/fee-rates"],
  });

  const payinRates = feeRates.filter(r => r.incomingEnabled);
  const payoutRates = feeRates.filter(r => r.outgoingEnabled);

  function groupByCountry(rates: FeeRate[]): [string, FeeRate[]][] {
    const map = new Map<string, FeeRate[]>();
    for (const r of rates) {
      if (!map.has(r.country)) map.set(r.country, []);
      map.get(r.country)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="title-fees">Grille tarifaire</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Frais applicables sur vos transactions selon le canal de paiement
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Les frais indiqués sont prélevés sur chaque transaction. Pour un paiement entrant, le montant reçu est net des frais. Pour un paiement sortant, les frais sont ajoutés au montant envoyé.
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
              <CountryGroup key={country} country={country} rates={rates} type="payin" />
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
              <CountryGroup key={country} country={country} rates={rates} type="payout" />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
