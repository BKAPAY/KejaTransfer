import { useRef, useState, forwardRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Transaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Download, FileImage } from "lucide-react";

interface TransactionMetadata {
  payAddress?: string;
  cryptoCurrency?: string;
  cryptoAmount?: number;
  paymentId?: string;
  nowpaymentsId?: string;
  fedapayTransactionId?: number;
  fedapayReference?: string;
  mbiyopayTransactionId?: string;
  afribaPayTransactionId?: string;
  afribaPayOrderId?: string;
  pawaPayProviderTxId?: string;
  moneyfusionRef?: string;
  wizallTransactionId?: string;
  pawaPayDepositId?: string;
  pawaPayPayoutId?: string;
  operatorKey?: string;
  provider?: string;
  providerAmount?: number;
  providerCurrency?: string;
  balanceAmount?: number;
  balanceCurrency?: string;
  conversionRate?: number;
  exchangeFee?: number;
  exchangeFeePercentage?: number;
  netAmountForUser?: number;
  scope?: string;
  businessTokenId?: string;
  apiKeyId?: string;
  orderId?: string;
  netMode?: boolean;
  customerPaysFee?: boolean;
  customerServiceFee?: number;
  customFieldResponses?: Record<string, unknown>;
  [key: string]: any;
}

const RECEIPT_WIDTH = 360;
const TORN_H = 18;
const TOOTH_COUNT = 18;
const OUTER_BG = "#e8edf2";
const WHITE = "#ffffff";

const OUTGOING_TYPES = ["withdrawal", "transfer", "api_payout"];
const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];

function fmtAmt(amount: number, currency: string) {
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : (currency === "USD" || currency === "EUR" ? 2 : 0),
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
  api_payout: "Payout API",
};

function ReceiptRow({ label, value, color = "#1e293b", bold = false, sublabel }: {
  label: string; value: string; color?: string; bold?: boolean; sublabel?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0" }}>
      <div>
        <span style={{ fontSize: 12, color: "#64748b", fontFamily: "inherit" }}>{label}</span>
        {sublabel && <span style={{ fontSize: 10, color: "#94a3b8", display: "block" }}>{sublabel}</span>}
      </div>
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

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 10 }}>
      {title}
    </div>
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

function SummaryBox({ children, color = "#f8fafc" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      borderTop: "1px solid #e2e8f0",
      background: color,
      margin: "8px -0px 0 -0px",
      padding: "8px 0 0 0",
    }}>
      {children}
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
    const isOutgoing = OUTGOING_TYPES.includes(transaction.type);
    const isIncoming = INCOMING_TYPES.includes(transaction.type);

    // Même logique que le dialog
    const trueServiceFee = isIncoming ? Math.max(0, serviceFee - exchangeFee) : serviceFee;
    const totalFee = trueServiceFee + exchangeFee;

    const isNetMode = !!(metadata?.netMode) || !!(metadata?.apiKeyId && !metadata?.businessTokenId);
    const isFeeOnTop = transaction.type === "transfer"
      || (transaction.type === "withdrawal" && exchangeFee > 0)
      || isNetMode;

    const isCustomerPaysFee = !!(metadata?.customerPaysFee);
    const storedCustomerServiceFee = metadata?.customerServiceFee || 0;
    const inferredCustomerServiceFee = (isCustomerPaysFee && storedCustomerServiceFee === 0 && metadata?.providerAmount && metadata.providerAmount > transaction.amount && (metadata.providerCurrency === (transaction.currency || "XOF")))
      ? (metadata.providerAmount - transaction.amount)
      : 0;
    const effectiveCustomerServiceFee = storedCustomerServiceFee || inferredCustomerServiceFee;

    const status = STATUS_CONF[transaction.status] || STATUS_CONF.pending;

    // Même logique displayTransactionId que le dialog
    const displayTransactionId = transaction.paydunyaToken
      || (metadata?.fedapayTransactionId ? String(metadata.fedapayTransactionId) : null)
      || metadata?.mbiyopayTransactionId
      || metadata?.afribaPayTransactionId
      || metadata?.pawaPayDepositId
      || metadata?.pawaPayPayoutId
      || (metadata?.nowpaymentsId ? String(metadata.nowpaymentsId) : null)
      || (metadata?.orderId ? String(metadata.orderId) : null)
      || transaction.id;

    const typeLabel = TYPE_LABELS[transaction.type] || transaction.type;

    const dateStr = new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    // Libellé du montant principal — identique au dialog
    let amountLabel: string;
    if (isOutgoing) {
      amountLabel = isFeeOnTop ? "MONTANT ENVOYÉ AU DESTINATAIRE" : "MONTANT SAISI";
    } else if (isCustomerPaysFee) {
      amountLabel = "MONTANT";
    } else if (totalFee > 0) {
      amountLabel = "MONTANT BRUT REÇU";
    } else {
      amountLabel = "MONTANT";
    }

    // Sous-titre du montant — identique au dialog
    let subtitleAmount: string | null = null;
    if (isOutgoing && totalFee > 0) {
      if (isFeeOnTop) {
        subtitleAmount = `Débité de votre solde : ${fmtAmt(transaction.amount + totalFee, currency)}`;
      } else {
        subtitleAmount = `Net destinataire : ${fmtAmt(Math.max(0, transaction.amount - serviceFee), currency)}`;
      }
    } else if (!isOutgoing && !isCustomerPaysFee && totalFee > 0) {
      subtitleAmount = `Net crédité : ${fmtAmt(Math.max(0, transaction.amount - totalFee), currency)}`;
    } else if (!isOutgoing && isCustomerPaysFee && exchangeFee > 0) {
      subtitleAmount = `Net crédité : ${fmtAmt(Math.max(0, transaction.amount - exchangeFee), currency)}`;
    }

    const isCryptoPayment = !!(metadata?.payAddress || metadata?.cryptoCurrency);
    const hasCrossCurrency = !!(metadata?.providerAmount && metadata?.providerCurrency && metadata.providerCurrency !== currency);

    // Afficher le récapitulatif financier ?
    const hasFinancialBreakdown = (totalFee > 0 || (isCustomerPaysFee && effectiveCustomerServiceFee > 0));

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
            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
              {amountLabel}
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: status.text, letterSpacing: -1 }}>
              {fmtAmt(transaction.amount, currency)}
            </div>
            {subtitleAmount && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{subtitleAmount}</div>
            )}
          </div>

          {/* Récapitulatif financier — même logique que FinancialBreakdown du dialog */}
          {hasFinancialBreakdown && (
            <>
              <DashedLine />
              <div style={{ marginBottom: 4 }}>
                <SectionTitle title="Récapitulatif financier" />

                {isOutgoing && isFeeOnTop && (
                  <>
                    <ReceiptRow label="Montant envoyé au destinataire" value={fmtAmt(transaction.amount, currency)} />
                    {serviceFee > 0 && <ReceiptRow label="Frais de service" value={`+${fmtAmt(serviceFee, currency)}`} color="#ef4444" />}
                    {exchangeFee > 0 && <ReceiptRow label="Frais d'échange de devise" value={`+${fmtAmt(exchangeFee, currency)}`} color="#f97316" />}
                    <SummaryBox color="#fff7ed">
                      <ReceiptRow label="Débité de votre solde" value={fmtAmt(transaction.amount + totalFee, currency)} color="#b91c1c" bold />
                    </SummaryBox>
                  </>
                )}

                {isOutgoing && !isFeeOnTop && (
                  <>
                    <ReceiptRow label="Montant saisi" value={fmtAmt(transaction.amount, currency)} />
                    {serviceFee > 0 && <ReceiptRow label="Frais de service" value={`-${fmtAmt(serviceFee, currency)}`} color="#ef4444" />}
                    <SummaryBox color="#f0fdf4">
                      <ReceiptRow label="Reçu par le destinataire" value={fmtAmt(Math.max(0, transaction.amount - serviceFee), currency)} color="#15803d" bold />
                    </SummaryBox>
                  </>
                )}

                {isIncoming && isCustomerPaysFee && (() => {
                  const isCrossCcy = !!(metadata?.providerCurrency && metadata.providerCurrency !== currency);
                  const displayServiceFee = effectiveCustomerServiceFee || Math.max(0, serviceFee - exchangeFee);

                  // Tous les montants affichés en devise de l'utilisateur (currency)
                  // Cas 1 (effectiveCustomerServiceFee > 0) : frais en devise fournisseur → conversion proportionnelle
                  // Cas 2 (effectiveCustomerServiceFee = 0) : frais dérivés de transaction.fee → déjà en devise utilisateur
                  let grossFromClientAmount: number;
                  let displayServiceFeeUser: number;
                  if (isCrossCcy && effectiveCustomerServiceFee > 0 && metadata?.providerAmount && displayServiceFee > 0) {
                    const providerBase = (metadata.providerAmount as number) - displayServiceFee;
                    const ratio = providerBase > 0 ? transaction.amount / providerBase : 1;
                    displayServiceFeeUser = Math.round(displayServiceFee * ratio);
                    grossFromClientAmount = transaction.amount + displayServiceFeeUser;
                  } else if (isCrossCcy) {
                    // Frais déjà en devise utilisateur (pas de conversion nécessaire)
                    displayServiceFeeUser = displayServiceFee;
                    grossFromClientAmount = transaction.amount + displayServiceFeeUser;
                  } else {
                    displayServiceFeeUser = displayServiceFee;
                    grossFromClientAmount = transaction.amount + displayServiceFee;
                  }

                  const creditedToOwner = Math.max(0, transaction.amount - exchangeFee);
                  return (
                    <>
                      <ReceiptRow label="Total payé par le client" value={fmtAmt(grossFromClientAmount, currency)} />
                      {displayServiceFeeUser > 0 && (
                        <ReceiptRow
                          label="Frais réglés par le client"
                          value={`+${fmtAmt(displayServiceFeeUser, currency)}`}
                          sublabel="pris en charge par le payeur"
                          color="#64748b"
                        />
                      )}
                      {exchangeFee > 0 && (
                        <ReceiptRow label="Frais d'échange de devise" value={`-${fmtAmt(exchangeFee, currency)}`} color="#f97316" />
                      )}
                      <SummaryBox color="#f0fdf4">
                        <ReceiptRow label="Crédité sur votre compte" value={fmtAmt(creditedToOwner, currency)} color="#15803d" bold />
                      </SummaryBox>
                    </>
                  );
                })()}

                {isIncoming && !isCustomerPaysFee && (
                  <>
                    <ReceiptRow label="Montant reçu du payeur" value={fmtAmt(transaction.amount, currency)} />
                    {trueServiceFee > 0 && <ReceiptRow label="Frais de service" value={`-${fmtAmt(trueServiceFee, currency)}`} color="#ef4444" />}
                    {exchangeFee > 0 && <ReceiptRow label="Frais d'échange de devise" value={`-${fmtAmt(exchangeFee, currency)}`} color="#f97316" />}
                    <SummaryBox color="#f0fdf4">
                      <ReceiptRow label="Crédité sur votre compte" value={fmtAmt(Math.max(0, transaction.amount - totalFee), currency)} color="#15803d" bold />
                    </SummaryBox>
                  </>
                )}
              </div>
            </>
          )}

          {/* Informations générales */}
          {(transaction.country || transaction.operator || metadata?.provider || transaction.description) && (
            <>
              <DashedLine />
              <div>
                <SectionTitle title="Informations" />
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

          {/* Conversion de devises — identique au dialog */}
          {hasCrossCurrency && (
            <>
              <DashedLine />
              <div style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                padding: "10px 12px",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", marginBottom: 8 }}>Conversion de devises</div>
                <ReceiptRow
                  label="Montant envoyé au réseau"
                  value={`${metadata!.providerAmount!.toLocaleString("fr-FR")} ${metadata!.providerCurrency}`}
                />
                {metadata?.conversionRate && (
                  <ReceiptRow
                    label="Taux de conversion"
                    value={`1 ${metadata.providerCurrency} = ${metadata.conversionRate} ${currency}`}
                    color="#64748b"
                  />
                )}
              </div>
            </>
          )}

          {/* Crypto — identique au dialog */}
          {isCryptoPayment && (
            <>
              <DashedLine />
              <div>
                <SectionTitle title="Cryptomonnaie" />
                {metadata?.cryptoCurrency && <ReceiptRow label="Devise crypto" value={metadata.cryptoCurrency.toUpperCase()} />}
                {metadata?.cryptoAmount && (
                  <ReceiptRow label="Montant crypto" value={`${metadata.cryptoAmount} ${metadata.cryptoCurrency?.toUpperCase() || ""}`} />
                )}
                {metadata?.payAddress && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Adresse</div>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: "#475569", wordBreak: "break-all", lineHeight: 1.5 }}>
                      {metadata.payAddress}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Client */}
          {(transaction.customerName || transaction.customerEmail || transaction.customerPhone) && (
            <>
              <DashedLine />
              <div>
                <SectionTitle title="Client" />
                {transaction.customerName && transaction.type !== "deposit" && <ReceiptRow label="Nom" value={transaction.customerName} />}
                {transaction.customerEmail && <ReceiptRow label="Email" value={transaction.customerEmail} />}
                {transaction.customerPhone && <ReceiptRow label="Téléphone" value={transaction.customerPhone} />}
              </div>
            </>
          )}

          {/* Champs personnalisés */}
          {metadata?.customFieldResponses && Object.keys(metadata.customFieldResponses).length > 0 && (
            <>
              <DashedLine />
              <div>
                <SectionTitle title="Champs personnalisés" />
                {Object.entries(metadata.customFieldResponses).map(([label, value]) => (
                  <ReceiptRow key={label} label={label} value={String(value)} />
                ))}
              </div>
            </>
          )}

          {/* Perforation + Transaction IDs */}
          <PerforationLine />

          <div>
            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>
              Identifiants
            </div>
            <div style={{
              fontSize: 9, fontFamily: "monospace", color: "#475569",
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 4, padding: "6px 8px", wordBreak: "break-all",
              lineHeight: 1.8,
            }}>
              <div>{displayTransactionId}</div>
              {displayTransactionId !== transaction.id && (
                <div style={{ color: "#94a3b8", borderTop: "1px dashed #e2e8f0", marginTop: 4, paddingTop: 4 }}>
                  {transaction.id}
                </div>
              )}
              {metadata?.pawaPayProviderTxId && (
                <div style={{ color: "#64748b", borderTop: "1px dashed #e2e8f0", marginTop: 4, paddingTop: 4 }}>
                  <div style={{ fontSize: 8, color: "#94a3b8", fontFamily: "system-ui, sans-serif", marginBottom: 2 }}>ID réseau opérateur</div>
                  {metadata.pawaPayProviderTxId}
                </div>
              )}
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

      {/* Reçu rendu hors-écran pour la capture */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        <ReceiptTemplate ref={receiptRef} transaction={transaction} metadata={metadata} />
      </div>
    </>
  );
}
