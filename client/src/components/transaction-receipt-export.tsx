import { useRef, useState, forwardRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Transaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Download, FileImage } from "lucide-react";

interface TransactionMetadata {
  provider?: string;
  exchangeFee?: number;
  exchangeFeePercentage?: number;
  netAmountForUser?: number;
  netMode?: boolean;
  apiKeyId?: string;
  businessTokenId?: string;
  [key: string]: any;
}

const RECEIPT_WIDTH = 360;
const TORN_H = 18;
const TOOTH_COUNT = 18;
const OUTER_BG = "#e8edf2";
const WHITE = "#ffffff";

const OUTGOING_TYPES = ["withdrawal", "transfer"];
const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];

function fmtAmt(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "USD" || currency === "EUR" ? 2 : 0,
  }).format(amount) + " " + currency;
}

function TornEdge({ position }: { position: "top" | "bottom" }) {
  const w = RECEIPT_WIDTH;
  const h = TORN_H;
  const tw = w / TOOTH_COUNT;
  let d = "";

  if (position === "top") {
    d = `M0,${h}`;
    for (let i = 0; i <= TOOTH_COUNT; i++) {
      d += ` L${(i * tw).toFixed(1)},${h}`;
      if (i < TOOTH_COUNT) d += ` L${((i + 0.5) * tw).toFixed(1)},0`;
    }
    d += " Z";
  } else {
    d = `M0,0`;
    for (let i = 0; i <= TOOTH_COUNT; i++) {
      d += ` L${(i * tw).toFixed(1)},0`;
      if (i < TOOTH_COUNT) d += ` L${((i + 0.5) * tw).toFixed(1)},${h}`;
    }
    d += " Z";
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={OUTER_BG} />
      <path d={d} fill={WHITE} />
    </svg>
  );
}

const STATUS_CONF: Record<string, { bg: string; border: string; text: string; label: string }> = {
  completed: { bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "Complété" },
  pending: { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", label: "En attente" },
  failed: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", label: "Échoué" },
  cancelled: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", label: "Annulé" },
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
  transfer: "Transfert",
  payment_link: "Lien de paiement",
  merchant_link: "Lien marchand",
  api_payment: "Paiement API",
};

function ReceiptRow({ label, value, color = "#1e293b", bold = false }: {
  label: string; value: string; color?: string; bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 12, color: "#64748b", fontFamily: "inherit" }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: bold ? 700 : 500, fontFamily: "inherit" }}>{value}</span>
    </div>
  );
}

function DashedLine() {
  return (
    <div style={{
      borderTop: "2px dashed #e2e8f0",
      margin: "12px 0",
    }} />
  );
}

function PerforationLine() {
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "14px 0" }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: OUTER_BG, marginRight: 4, flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

interface ReceiptTemplateProps {
  transaction: Transaction;
  metadata: TransactionMetadata | null;
}

const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ transaction, metadata }, ref) => {
    const currency = transaction.currency || "XOF";
    const serviceFee = transaction.fee || 0;
    const exchangeFee = metadata?.exchangeFee || 0;
    const totalFee = serviceFee + exchangeFee;
    const isOutgoing = OUTGOING_TYPES.includes(transaction.type);
    const isIncoming = INCOMING_TYPES.includes(transaction.type);
    const isNetMode = !!(metadata?.netMode) || !!(metadata?.apiKeyId && !metadata?.businessTokenId);
    const status = STATUS_CONF[transaction.status] || STATUS_CONF.pending;
    const typeLabel = TYPE_LABELS[transaction.type] || transaction.type;

    const dateStr = new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const amountLabel = isOutgoing ? "MONTANT SAISI" : totalFee > 0 ? "MONTANT BRUT REÇU" : "MONTANT";
    const mainAmount = fmtAmt(transaction.amount, currency);
    const subtitleAmount = totalFee > 0
      ? (isOutgoing && !isNetMode
          ? `Net destinataire : ${fmtAmt(Math.max(0, transaction.amount - totalFee), currency)}`
          : isOutgoing && isNetMode
          ? `Débité du solde : ${fmtAmt(transaction.amount + totalFee, currency)}`
          : `Net crédité : ${fmtAmt(Math.max(0, transaction.amount - totalFee), currency)}`)
      : null;

    const hasBreakdown = totalFee > 0;

    return (
      <div
        ref={ref}
        style={{
          width: RECEIPT_WIDTH + 40,
          background: OUTER_BG,
          padding: "20px 20px 20px 20px",
          fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <TornEdge position="top" />

        {/* Receipt body */}
        <div style={{ background: WHITE, padding: "20px 24px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{
              fontSize: 22, fontWeight: 800, letterSpacing: 1,
              color: "#0f172a", marginBottom: 2,
            }}>BKApay</div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase" }}>
              Reçu de transaction
            </div>
          </div>

          <DashedLine />

          {/* Status + Type banner */}
          <div style={{
            background: status.bg,
            border: `1px solid ${status.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: status.text }}>{typeLabel}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{dateStr}</div>
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: status.text,
              background: WHITE + "99", borderRadius: 4, padding: "3px 8px",
            }}>
              {status.label}
            </div>
          </div>

          {/* Main amount */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
              {amountLabel}
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: status.text, letterSpacing: -1 }}>
              {mainAmount}
            </div>
            {subtitleAmount && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{subtitleAmount}</div>
            )}
          </div>

          {/* Financial breakdown */}
          {hasBreakdown && (
            <>
              <DashedLine />
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                  Récapitulatif financier
                </div>
                {isOutgoing && !isNetMode && (
                  <>
                    <ReceiptRow label="Montant saisi" value={fmtAmt(transaction.amount, currency)} />
                    {serviceFee > 0 && <ReceiptRow label="Frais de service" value={`-${fmtAmt(serviceFee, currency)}`} color="#ef4444" />}
                    {exchangeFee > 0 && <ReceiptRow label="Frais d'échange" value={`-${fmtAmt(exchangeFee, currency)}`} color="#f97316" />}
                    <div style={{ borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
                    <ReceiptRow label="Reçu par le destinataire" value={fmtAmt(Math.max(0, transaction.amount - totalFee), currency)} color="#15803d" bold />
                  </>
                )}
                {isOutgoing && isNetMode && (
                  <>
                    <ReceiptRow label="Montant envoyé" value={fmtAmt(transaction.amount, currency)} />
                    {serviceFee > 0 && <ReceiptRow label="Frais de service" value={`+${fmtAmt(serviceFee, currency)}`} color="#ef4444" />}
                    {exchangeFee > 0 && <ReceiptRow label="Frais d'échange" value={`+${fmtAmt(exchangeFee, currency)}`} color="#f97316" />}
                    <div style={{ borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
                    <ReceiptRow label="Débité de votre solde" value={fmtAmt(transaction.amount + totalFee, currency)} color="#b91c1c" bold />
                  </>
                )}
                {isIncoming && (() => {
                  const cpf = !!(metadata?.customerPaysFee);
                  const gross = transaction.amount;
                  const baseForOwner = Math.max(0, gross - serviceFee);
                  const netAfterExchange = Math.max(0, baseForOwner - exchangeFee);
                  const netStandard = Math.max(0, gross - totalFee);
                  return (
                    <>
                      <ReceiptRow label="Montant reçu du payeur" value={fmtAmt(gross, currency)} />
                      {cpf ? (
                        serviceFee > 0 && <ReceiptRow label="Frais réglés par le client" value={fmtAmt(serviceFee, currency)} color="#64748b" />
                      ) : (
                        serviceFee > 0 && <ReceiptRow label="Frais de service" value={`-${fmtAmt(serviceFee, currency)}`} color="#ef4444" />
                      )}
                      {exchangeFee > 0 && <ReceiptRow label="Frais d'échange" value={`-${fmtAmt(exchangeFee, currency)}`} color="#f97316" />}
                      <div style={{ borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
                      <ReceiptRow label="Crédité sur votre compte" value={fmtAmt(cpf ? netAfterExchange : netStandard, currency)} color="#15803d" bold />
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {/* Info */}
          {(transaction.country || transaction.operator || metadata?.provider) && (
            <>
              <DashedLine />
              <div>
                {transaction.country && <ReceiptRow label="Pays" value={transaction.country} />}
                {transaction.operator && <ReceiptRow label="Opérateur" value={transaction.operator} />}
                {metadata?.provider && <ReceiptRow label="Fournisseur" value={metadata.provider} />}
                {transaction.description && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Description</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{transaction.description}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Customer */}
          {(transaction.customerName || transaction.customerEmail || transaction.customerPhone) && (
            <>
              <DashedLine />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                  Client
                </div>
                {transaction.customerName && <ReceiptRow label="Nom" value={transaction.customerName} />}
                {transaction.customerEmail && <ReceiptRow label="Email" value={transaction.customerEmail} />}
                {transaction.customerPhone && <ReceiptRow label="Téléphone" value={transaction.customerPhone} />}
              </div>
            </>
          )}

          {/* Custom fields */}
          {metadata?.customFieldResponses && Object.keys(metadata.customFieldResponses).length > 0 && (
            <>
              <DashedLine />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                  Informations supplémentaires
                </div>
                {Object.entries(metadata.customFieldResponses).map(([label, value]) => (
                  <ReceiptRow key={label} label={label} value={String(value)} />
                ))}
              </div>
            </>
          )}

          {/* Perforation + Transaction ID */}
          <PerforationLine />

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              ID Transaction
            </div>
            <div style={{
              fontSize: 9, fontFamily: "monospace", color: "#475569",
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 4, padding: "4px 8px", wordBreak: "break-all",
              lineHeight: 1.6,
            }}>
              {transaction.id}
            </div>
          </div>

          <DashedLine />

          {/* Footer */}
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>
              Généré par BKApay — {new Date().toLocaleDateString("fr-FR")}
            </div>
            <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 2 }}>
              Conservez ce reçu comme justificatif
            </div>
          </div>

        </div>
        <TornEdge position="bottom" />
      </div>
    );
  }
);
ReceiptTemplate.displayName = "ReceiptTemplate";

interface DownloadReceiptButtonsProps {
  transaction: Transaction;
  metadata: TransactionMetadata | null;
}

export function DownloadReceiptButtons({ transaction, metadata }: DownloadReceiptButtonsProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<"pdf" | "image" | null>(null);

  const capture = async () => {
    if (!receiptRef.current) return null;
    return html2canvas(receiptRef.current, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: OUTER_BG,
      logging: false,
    });
  };

  const downloadImage = async () => {
    setLoading("image");
    try {
      const canvas = await capture();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `recu-bkapay-${transaction.id.slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setLoading(null);
    }
  };

  const downloadPdf = async () => {
    setLoading("pdf");
    try {
      const canvas = await capture();
      if (!canvas) return;
      const imgData = canvas.toDataURL("image/png");
      const pxW = canvas.width;
      const pxH = canvas.height;
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [pxW, pxH] });
      pdf.addImage(imgData, "PNG", 0, 0, pxW, pxH);
      pdf.save(`recu-bkapay-${transaction.id.slice(0, 8)}.pdf`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="default"
          onClick={downloadImage}
          disabled={!!loading}
          data-testid="button-download-receipt-image"
        >
          <FileImage className={`w-4 h-4 mr-2 ${loading === "image" ? "animate-pulse" : ""}`} />
          {loading === "image" ? "Export..." : "Image"}
        </Button>
        <Button
          variant="destructive"
          onClick={downloadPdf}
          disabled={!!loading}
          data-testid="button-download-receipt-pdf"
        >
          <Download className={`w-4 h-4 mr-2 ${loading === "pdf" ? "animate-pulse" : ""}`} />
          {loading === "pdf" ? "Export..." : "PDF"}
        </Button>
      </div>

      {/* Hidden receipt rendered off-screen for capture */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        <ReceiptTemplate ref={receiptRef} transaction={transaction} metadata={metadata} />
      </div>
    </>
  );
}
