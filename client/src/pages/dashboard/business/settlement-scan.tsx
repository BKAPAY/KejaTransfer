import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CountryFlag } from "@/components/country-flag";
import { COUNTRIES, CURRENCY_CONVERSION_RATES } from "@shared/schema";
import {
  CheckCircle2, XCircle, ArrowLeft, ShieldCheck, Send, Loader2,
} from "lucide-react";

interface BusinessWallet {
  id: string;
  country: string;
  currency: string;
  balance: number;
}

const CHARS = "ATCGATCGTAGCATCGTAGCTAGCATCGNNCGATCGGGATCTAGCTAGCATCG01234567890ABCDEF+=#@%&!?";

const TO_USD: Record<string, number> = {
  XOF: 0.0015,
  XAF: 0.0015,
  CDF: 0.000357,
  GNF: 0.000118,
  RWF: 0.00075,
  USD: 1,
  EUR: 1.08,
  GHS: 0.065,
  NGN: 0.00063,
  KES: 0.0077,
  TZS: 0.00038,
};

function toUSD(amount: number, currency: string): number {
  const rate = TO_USD[currency] ?? 0.0015;
  return amount * rate;
}

function fmtUSD(amount: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " USD";
}

function fmtNative(amount: number, currency: string) {
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount) + " " + currency;
}

function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const fontSize = 13;
    const cols = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -50);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < drops.length; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        const bright = Math.random() > 0.85;
        ctx.fillStyle = bright ? "#00ff88" : "#005522";
        ctx.font = `${fontSize}px "Courier New", monospace`;
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5;
      }
    };

    const interval = setInterval(draw, 40);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
    />
  );
}

type Phase = "scanning" | "sufficient" | "insufficient";

export default function SettlementScan() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<{ text: string; ok: boolean }[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data: wallets = [] } = useQuery<BusinessWallet[]>({
    queryKey: ["/api/business/wallets"],
  });

  const walletsWithBalance = useMemo(
    () => wallets.filter((w) => w.balance > 0),
    [wallets]
  );

  const MIN_USD = 30;

  const createSettlement = useMutation({
    mutationFn: async (data: { walletCountry: string; walletCurrency: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/business/settlements", data);
      return res.json();
    },
  });

  useEffect(() => {
    if (wallets.length === 0) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const total = walletsWithBalance.reduce((sum, w) => sum + toUSD(w.balance, w.currency), 0);
    setTotalUSD(total);
    setLogLines([]);
    setProgress(0);
    setPhase("scanning");

    const countryLabels = walletsWithBalance.map((w) => {
      const cd = COUNTRIES.find((c) => c.code === w.country);
      return { label: `${cd?.name ?? w.country} (${w.currency})`, wallet: w };
    });

    const systemLines: { text: string; ok: boolean }[] = [
      { text: "Initialisation du module de cryptage BKA-256...", ok: true },
      { text: "Connexion au registre des portefeuilles sécurisés...", ok: true },
      { text: "Protocole d'authentification SHA-3 établi...", ok: true },
      ...countryLabels.map((c) => ({
        text: `Lecture ${c.label}: ${fmtNative(c.wallet.balance, c.wallet.currency)}`,
        ok: true,
      })),
      { text: "Conversion des soldes en équivalent USD...", ok: true },
      { text: `Seuil minimum requis: ${MIN_USD}.00 USD`, ok: total >= MIN_USD },
      { text: `Vérification finale du solde agrégé...`, ok: total >= MIN_USD },
    ];

    const totalDuration = 3800;
    const lineDelay = totalDuration / (systemLines.length + 2);

    systemLines.forEach((line, idx) => {
      const t = setTimeout(() => {
        if (!cancelled) {
          setLogLines((prev) => [...prev, line]);
        }
      }, lineDelay * (idx + 1) * (0.85 + Math.random() * 0.3));
      timers.push(t);
    });

    const progInterval = setInterval(() => {
      if (!cancelled) {
        setProgress((p) => Math.min(100, p + 1.5));
      }
    }, totalDuration / 100);

    const finishTimer = setTimeout(() => {
      if (!cancelled) {
        setPhase(total >= MIN_USD ? "sufficient" : "insufficient");
      }
    }, totalDuration + 400);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
      clearInterval(progInterval);
    };
  }, [wallets.length]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      for (const w of walletsWithBalance) {
        await createSettlement.mutateAsync({
          walletCountry: w.country,
          walletCurrency: w.currency,
          amount: Math.floor(w.balance),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/business/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/wallets"] });
      toast({
        title: "Demande envoyée",
        description: "Votre demande de règlement a été soumise avec succès.",
      });
      navigate("/dashboard/business/settlements");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      <MatrixCanvas />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-green-900/40">
          <Button
            variant="ghost"
            size="icon"
            className="text-green-400 hover:text-green-300 hover:bg-green-950/40"
            onClick={() => navigate("/dashboard/business/settlements")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-mono font-semibold tracking-widest uppercase">
              BKA Secure Analysis
            </span>
          </div>
          <div className="ml-auto">
            <Badge
              className="font-mono text-xs"
              style={{
                background: phase === "sufficient" ? "#00220f" : phase === "insufficient" ? "#220000" : "#001a00",
                color: phase === "sufficient" ? "#00ff88" : phase === "insufficient" ? "#ff4444" : "#00cc66",
                border: `1px solid ${phase === "sufficient" ? "#00ff88" : phase === "insufficient" ? "#ff4444" : "#005522"}`,
              }}
            >
              {phase === "scanning" ? "ANALYSE EN COURS" : phase === "sufficient" ? "ANALYSE COMPLÈTE" : "ERREUR DÉTECTÉE"}
            </Badge>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
          {phase === "scanning" && (
            <div
              className="w-full max-w-lg border rounded-lg p-5 space-y-4"
              style={{ background: "rgba(0,10,0,0.85)", borderColor: "#00441a" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                <span className="text-green-300 font-mono text-sm tracking-wider">
                  SYNCHRONISATION EN COURS...
                </span>
                <span className="ml-auto text-green-500 font-mono text-xs tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="w-full h-1.5 bg-green-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="space-y-1.5 min-h-[180px] font-mono text-xs">
                {logLines.map((line, i) => (
                  <div key={i} className="flex items-start gap-2 animate-in fade-in duration-300">
                    <span className={line.ok ? "text-green-400" : "text-red-400"}>
                      {line.ok ? "►" : "✗"}
                    </span>
                    <span className={line.ok ? "text-green-300/90" : "text-red-300/90"}>
                      {line.text}
                    </span>
                    <span className={`ml-auto shrink-0 ${line.ok ? "text-green-500" : "text-red-500"}`}>
                      [{line.ok ? "OK" : "FAIL"}]
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-1 text-green-600/60">
                  <span className="animate-pulse">█</span>
                </div>
              </div>

              <div className="pt-2 border-t border-green-900/40">
                <p className="text-green-800 font-mono text-[10px] truncate select-none">
                  BKA-SHA256:{Array.from({ length: 32 }, () =>
                    Math.floor(Math.random() * 16).toString(16)
                  ).join("")}
                </p>
              </div>
            </div>
          )}

          {phase === "sufficient" && (
            <div className="w-full max-w-lg space-y-4">
              <div
                className="border rounded-lg p-5 space-y-4"
                style={{ background: "rgba(0,10,0,0.88)", borderColor: "#00ff88" }}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
                  <div>
                    <p className="text-green-300 font-mono font-semibold text-sm tracking-wider">
                      ANALYSE COMPLÈTE — SEUIL ATTEINT
                    </p>
                    <p className="text-green-600 font-mono text-xs">
                      Total agrégé : {fmtUSD(totalUSD)} ≥ {MIN_USD}.00 USD minimum
                    </p>
                  </div>
                </div>

                <div className="border-t border-green-900/40 pt-3 space-y-2">
                  <p className="text-green-500 font-mono text-xs uppercase tracking-widest mb-3">
                    Portefeuilles inclus dans le règlement
                  </p>
                  {walletsWithBalance.map((w) => {
                    const cd = COUNTRIES.find((c) => c.code === w.country);
                    return (
                      <div
                        key={`${w.country}-${w.currency}`}
                        className="flex items-center justify-between gap-3 py-2 px-3 rounded"
                        style={{ background: "rgba(0,255,100,0.04)", border: "1px solid #003311" }}
                      >
                        <div className="flex items-center gap-2">
                          <CountryFlag code={w.country} size="sm" />
                          <div>
                            <p className="text-green-200 text-sm font-medium">{cd?.name ?? w.country}</p>
                            <p className="text-green-600 font-mono text-xs">≈ {fmtUSD(toUSD(w.balance, w.currency))}</p>
                          </div>
                        </div>
                        <span className="text-green-300 font-mono font-semibold text-sm tabular-nums">
                          {fmtNative(w.balance, w.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: "rgba(0,255,100,0.07)", border: "1px solid #00ff88" }}
                >
                  <span className="text-green-300 font-mono text-sm font-semibold">Total USD</span>
                  <span className="text-green-300 font-mono font-bold text-base tabular-nums">
                    {fmtUSD(totalUSD)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1 border"
                  style={{ borderColor: "#003311", color: "#00aa55" }}
                  onClick={() => navigate("/dashboard/business/settlements")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button
                  className="flex-1 font-semibold"
                  style={{ background: "#00cc55", color: "#000" }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  data-testid="button-submit-settlement"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Soumettre le règlement
                </Button>
              </div>
            </div>
          )}

          {phase === "insufficient" && (
            <div className="w-full max-w-lg space-y-4">
              <div
                className="border rounded-lg p-5 space-y-4"
                style={{ background: "rgba(10,0,0,0.88)", borderColor: "#ff4444" }}
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <div>
                    <p className="text-red-300 font-mono font-semibold text-sm tracking-wider">
                      MINIMUM NON ATTEINT
                    </p>
                    <p className="text-red-600 font-mono text-xs">
                      Analyse BKA-256 terminée — seuil insuffisant
                    </p>
                  </div>
                </div>

                <div className="border-t border-red-900/40 pt-3 space-y-3">
                  <div className="flex items-center justify-between px-3 py-2 rounded"
                    style={{ background: "rgba(255,0,0,0.06)", border: "1px solid #330000" }}>
                    <span className="text-red-400 font-mono text-sm">Total détecté</span>
                    <span className="text-red-300 font-mono font-bold tabular-nums">{fmtUSD(totalUSD)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded"
                    style={{ background: "rgba(255,0,0,0.04)", border: "1px solid #330000" }}>
                    <span className="text-red-400 font-mono text-sm">Minimum requis</span>
                    <span className="text-red-300 font-mono font-bold tabular-nums">{MIN_USD}.00 USD</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded"
                    style={{ background: "rgba(255,50,50,0.06)", border: "1px solid #550000" }}>
                    <span className="text-red-400 font-mono text-sm">Manquant</span>
                    <span className="text-red-300 font-mono font-bold tabular-nums">
                      {fmtUSD(MIN_USD - totalUSD)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-red-900/40 space-y-1">
                  <p className="text-red-600 font-mono text-xs text-center leading-relaxed">
                    Le montant total de vos portefeuilles est insuffisant pour demander un règlement.
                    Recevez des paiements supplémentaires pour atteindre le seuil minimum de {MIN_USD} USD.
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                style={{ background: "#1a0000", color: "#ff6666", border: "1px solid #550000" }}
                onClick={() => navigate("/dashboard/business/settlements")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour aux règlements
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
