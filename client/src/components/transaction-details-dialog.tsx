import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@shared/schema";
import {
  Copy, Mail, Phone, Wallet, AlertTriangle, CheckCircle, XCircle,
  Lock, ShieldCheck, RotateCcw, Webhook, ArrowDownLeft, ArrowUpRight,
  ArrowLeftRight, TrendingUp, Receipt, Clock, Download,
} from "lucide-react";
import { DownloadReceiptButtons } from "@/components/transaction-receipt-export";
import { CryptoIcon } from "@/components/crypto-icon";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
  onStatusChanged?: () => void;
}

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
  moneyfusionRef?: string;
  wizallTransactionId?: string;
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
  [key: string]: any;
}

const OUTGOING_TYPES = ["withdrawal", "transfer"];
const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "USD" || currency === "EUR" ? 2 : 0,
  }).format(amount) + " " + currency;
}

function fmtPct(pct: number) {
  const val = pct / 10;
  return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + "%";
}

function FinancialRow({
  label,
  value,
  sublabel,
  color = "default",
  bold = false,
  size = "md",
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: "default" | "red" | "orange" | "green" | "muted";
  bold?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const textColors = {
    default: "text-foreground",
    red: "text-red-500 dark:text-red-400",
    orange: "text-orange-500 dark:text-orange-400",
    green: "text-emerald-600 dark:text-emerald-400",
    muted: "text-muted-foreground",
  };
  const sizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <span className={`${sizes[size]} ${color === "muted" ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
        {sublabel && <span className="text-xs text-muted-foreground ml-1">({sublabel})</span>}
      </div>
      <span className={`${sizes[size]} ${bold ? "font-bold" : "font-medium"} ${textColors[color]} tabular-nums`}>
        {value}
      </span>
    </div>
  );
}

function FinancialBreakdown({
  transaction,
  metadata,
}: {
  transaction: Transaction;
  metadata: TransactionMetadata | null;
}) {
  const currency = transaction.currency || "XOF";
  // Pour les transactions SORTANTES : transaction.fee = frais de service seuls,
  //   metadata.exchangeFee = frais d'échange séparés → totalFee = service + échange OK
  // Pour les transactions ENTRANTES cross-devise : transaction.fee = service + échange combinés,
  //   metadata.exchangeFee = échange encore une fois → il faut soustraire pour éviter le double-comptage.
  const serviceFee = transaction.fee || 0;
  const exchangeFee = metadata?.exchangeFee || 0;
  const isOutgoing = OUTGOING_TYPES.includes(transaction.type);
  const isIncoming = INCOMING_TYPES.includes(transaction.type);
  // Pour entrantes : trueServiceFee = max(0, tx.fee - exchangeFee) → isole les frais de service réels
  // Pour sortantes : tx.fee est déjà service seul, pas de soustraction
  const trueServiceFee = isIncoming ? Math.max(0, serviceFee - exchangeFee) : serviceFee;
  const totalFee = trueServiceFee + exchangeFee;

  // Modèle "frais par-dessus" : destinataire reçoit transaction.amount exactement,
  // l'expéditeur paie transaction.amount + frais.
  // S'applique à : tous les TRANSFERTS, les retraits cross-devises (exchangeFee > 0),
  // et les API payouts (netMode).
  const isNetMode = !!(metadata?.netMode) || !!(metadata?.apiKeyId && !metadata?.businessTokenId);
  const isFeeOnTop = transaction.type === "transfer"
    || (transaction.type === "withdrawal" && exchangeFee > 0)
    || isNetMode;

  if (totalFee === 0) return null;

  if (isOutgoing) {
    if (isFeeOnTop) {
      // Destinataire reçoit transaction.amount exactement ; solde débité = amount + frais
      const net = transaction.amount;
      const balanceDeducted = net + totalFee;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif financier</h3>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <div className="p-4 space-y-3 bg-card">
              <FinancialRow label="Montant envoyé au destinataire" value={fmtAmount(net, currency)} />
              {serviceFee > 0 && (
                <FinancialRow label="Frais de service" value={`+${fmtAmount(serviceFee, currency)}`} color="red" />
              )}
              {exchangeFee > 0 && (
                <FinancialRow label="Frais d'échange de devise" value={`+${fmtAmount(exchangeFee, currency)}`} color="orange" />
              )}
            </div>
            <div className="border-t px-4 py-3 bg-amber-50 dark:bg-amber-950/20 space-y-1">
              <FinancialRow label="Débité de votre solde" value={fmtAmount(balanceDeducted, currency)} color="red" bold size="md" />
            </div>
          </div>
        </div>
      );
    }

    // Retrait standard (même devise) : frais déduits du montant brut
    // transaction.amount = montant brut saisi ; destinataire = montant - frais de service
    const gross = transaction.amount;
    const netReceived = Math.max(0, gross - serviceFee);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif financier</h3>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <div className="p-4 space-y-3 bg-card">
            <FinancialRow label="Montant saisi" value={fmtAmount(gross, currency)} />
            {serviceFee > 0 && (
              <FinancialRow label="Frais de service" value={`-${fmtAmount(serviceFee, currency)}`} color="red" />
            )}
          </div>
          <div className="border-t px-4 py-3 bg-muted/20 space-y-1">
            <FinancialRow label="Reçu par le destinataire" value={fmtAmount(netReceived, currency)} color="green" bold size="md" />
          </div>
        </div>
      </div>
    );
  }

  if (isIncoming) {
    const customerPaysFee = !!(metadata?.customerPaysFee);
    const gross = transaction.amount;

    if (customerPaysFee) {
      // Le client a payé les frais de service EN PLUS du montant de base.
      // transaction.amount = montant BASE (ce que le marchand reçoit)
      // Quand cross-devise + PawaPay : transaction.fee = exchangeFee (pas de service fee dans tx.fee)
      // Quand même devise : transaction.fee = service fee payé par le client
      // Pour éviter le double-comptage : displayServiceFee = max(0, tx.fee - exchangeFee)
      const displayServiceFee = Math.max(0, serviceFee - exchangeFee);
      const grossFromClient = gross + displayServiceFee;
      const creditedToOwner = Math.max(0, gross - exchangeFee);

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif financier</h3>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <div className="p-4 space-y-3 bg-card">
              <FinancialRow label="Total payé par le client" value={fmtAmount(grossFromClient, currency)} />
              {displayServiceFee > 0 && (
                <FinancialRow
                  label="Frais réglés par le client"
                  value={`+${fmtAmount(displayServiceFee, currency)}`}
                  sublabel="pris en charge par le payeur"
                  color="muted"
                />
              )}
              {exchangeFee > 0 && (
                <FinancialRow label="Frais d'échange de devise" value={`-${fmtAmount(exchangeFee, currency)}`} color="orange" />
              )}
            </div>
            <div className="border-t px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 space-y-1">
              <FinancialRow label="Crédité sur votre compte" value={fmtAmount(creditedToOwner, currency)} color="green" bold size="md" />
            </div>
          </div>
        </div>
      );
    }

    // Cas standard : frais à la charge du propriétaire
    // totalFee = trueServiceFee + exchangeFee (double-comptage déjà corrigé via trueServiceFee)
    const netCredited = Math.max(0, gross - totalFee);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif financier</h3>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <div className="p-4 space-y-3 bg-card">
            <FinancialRow label="Montant reçu du payeur" value={fmtAmount(gross, currency)} />
            {trueServiceFee > 0 && (
              <FinancialRow label="Frais de service" value={`-${fmtAmount(trueServiceFee, currency)}`} color="red" />
            )}
            {exchangeFee > 0 && (
              <FinancialRow label="Frais d'échange de devise" value={`-${fmtAmount(exchangeFee, currency)}`} color="orange" />
            )}
          </div>
          <div className="border-t px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 space-y-1">
            <FinancialRow label="Crédité sur votre compte" value={fmtAmount(netCredited, currency)} color="green" bold size="md" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
  isAdmin = false,
  onStatusChanged,
}: TransactionDetailsDialogProps) {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [adminStep, setAdminStep] = useState<"idle" | "code" | "confirm">("idle");
  const [adminCode, setAdminCode] = useState("");
  const [adminCodeError, setAdminCodeError] = useState(false);
  const [webhookSent, setWebhookSent] = useState(false);
  const [businessWebhookSent, setBusinessWebhookSent] = useState(false);

  const metadata = useMemo<TransactionMetadata | null>(() => {
    if (!transaction?.metadata) return null;
    try {
      return JSON.parse(transaction.metadata as string);
    } catch {
      return null;
    }
  }, [transaction?.metadata]);

  const changeStatusMutation = useMutation({
    mutationFn: async ({ transactionId, newStatus }: { transactionId: string; newStatus: string }) => {
      const res = await apiRequest("POST", `/api/admin/transaction/${transactionId}/change-status`, { newStatus });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Statut modifié", description: data.message });
      setConfirmAction(null);
      setAdminStep("idle");
      setAdminCode("");
      setAdminCodeError(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user`] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0] as string;
        return typeof key === "string" && (key.includes("/transactions") || key.includes("/admin/user"));
      }});
      onStatusChanged?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de changer le statut", variant: "destructive" });
      setConfirmAction(null);
      setAdminStep("idle");
      setAdminCode("");
      setAdminCodeError(false);
    },
  });

  const resendWebhookMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/payout-transactions/${txId}/resend-webhook`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setWebhookSent(true);
        toast({ title: "Webhook renvoyé", description: "Le statut a été renvoyé à votre URL de callback." });
        setTimeout(() => setWebhookSent(false), 3000);
      } else {
        toast({ title: "Erreur", description: data.error || "Echec du renvoi", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Echec du renvoi du webhook", variant: "destructive" });
    },
  });

  const resendBusinessWebhookMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/business-transactions/${txId}/resend-webhook`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setBusinessWebhookSent(true);
        toast({ title: "Webhook renvoyé", description: "La notification a été renvoyée à votre URL de callback." });
        setTimeout(() => setBusinessWebhookSent(false), 3000);
      } else {
        toast({ title: "Erreur", description: data.error || "Echec du renvoi", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Echec du renvoi du webhook", variant: "destructive" });
    },
  });

  if (!transaction) return null;

  const currency = transaction.currency || "XOF";
  const isOutgoing = OUTGOING_TYPES.includes(transaction.type);
  const serviceFeeHeader = transaction.fee || 0;
  const exchangeFeeHeader = metadata?.exchangeFee || 0;
  // Pour les entrantes, transaction.fee inclut déjà exchangeFee → soustraire pour éviter le double-comptage
  const trueServiceFeeHeader = !isOutgoing ? Math.max(0, serviceFeeHeader - exchangeFeeHeader) : serviceFeeHeader;
  const totalFee = trueServiceFeeHeader + exchangeFeeHeader;
  const isFeeOnTopHeader = transaction.type === "transfer"
    || (transaction.type === "withdrawal" && exchangeFeeHeader > 0)
    || !!(metadata?.netMode)
    || !!(metadata?.apiKeyId && !metadata?.businessTokenId);
  const customerPaysFeeHeader = !!(metadata?.customerPaysFee);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: typeof CheckCircle; bg: string; text: string; border: string }> = {
      completed: { label: "Complété", icon: CheckCircle, bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
      pending: { label: "En attente", icon: Clock, bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
      failed: { label: "Échoué", icon: XCircle, bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
      cancelled: { label: "Annulé", icon: XCircle, bg: "bg-slate-50 dark:bg-slate-900/30", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
    };
    return configs[status] || configs.pending;
  };

  const getTypeConfig = (type: string) => {
    const configs: Record<string, { label: string; icon: typeof ArrowDownLeft }> = {
      deposit: { label: "Dépôt", icon: ArrowDownLeft },
      withdrawal: { label: "Retrait", icon: ArrowUpRight },
      transfer: { label: "Transfert", icon: ArrowLeftRight },
      payment_link: { label: "Lien de paiement", icon: TrendingUp },
      merchant_link: { label: "Lien marchand", icon: TrendingUp },
      api_payment: { label: "Paiement API", icon: TrendingUp },
    };
    return configs[type] || { label: type, icon: ArrowLeftRight };
  };

  const isCryptoPayment = metadata?.payAddress || metadata?.cryptoCurrency;

  const displayTransactionId = transaction.paydunyaToken
    || (metadata?.fedapayTransactionId ? String(metadata.fedapayTransactionId) : null)
    || metadata?.mbiyopayTransactionId
    || metadata?.afribaPayTransactionId
    || metadata?.pawaPayDepositId
    || metadata?.pawaPayPayoutId
    || (metadata?.nowpaymentsId ? String(metadata.nowpaymentsId) : null)
    || (metadata?.orderId ? String(metadata.orderId) : null)
    || transaction.id;

  const statusConfig = getStatusConfig(transaction.status);
  const typeConfig = getTypeConfig(
    transaction.type === "withdrawal" && (metadata?.netMode === true || String(metadata?.orderId || "").startsWith("BKAPAY-API-") || !!metadata?.apiKeyId)
      ? "api_payment"
      : transaction.type
  );
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié", description: `${label} copié dans le presse-papiers` });
  };

  const displayAmount = isOutgoing
    ? fmtAmount(transaction.amount, currency)
    : fmtAmount(transaction.amount, currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Détails de la transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* Status + Type + Amount Hero */}
          <div className={`rounded-lg border p-4 ${statusConfig.bg} ${statusConfig.border}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <TypeIcon className={`w-5 h-5 ${statusConfig.text}`} />
                <div>
                  <p className={`text-sm font-semibold ${statusConfig.text}`}>{typeConfig.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon className={`w-4 h-4 ${statusConfig.text}`} />
                <span className={`text-sm font-semibold ${statusConfig.text}`}>{statusConfig.label}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-current/10">
              <p className="text-xs text-muted-foreground mb-1">
                {isOutgoing
                  ? (isFeeOnTopHeader ? "Montant envoyé au destinataire" : "Montant saisi")
                  : customerPaysFeeHeader
                    ? "Montant"
                    : totalFee > 0 ? "Montant brut reçu" : "Montant"}
              </p>
              <p className={`text-3xl font-bold tabular-nums ${statusConfig.text}`}>{displayAmount}</p>
              {isOutgoing && totalFee > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isFeeOnTopHeader
                    ? `Débité de votre solde : ${fmtAmount(transaction.amount + totalFee, currency)}`
                    : `Net destinataire : ${fmtAmount(Math.max(0, transaction.amount - serviceFeeHeader), currency)}`}
                </p>
              )}
              {!isOutgoing && !customerPaysFeeHeader && totalFee > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Net crédité : {fmtAmount(Math.max(0, transaction.amount - totalFee), currency)}
                </p>
              )}
              {!isOutgoing && customerPaysFeeHeader && exchangeFeeHeader > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Net crédité : {fmtAmount(Math.max(0, transaction.amount - exchangeFeeHeader), currency)}
                </p>
              )}
            </div>
          </div>

          {/* Transaction ID */}
          <div className="bg-muted/50 p-3 rounded-md border">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">ID Transaction</label>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1 text-foreground">{displayTransactionId}</code>
              <Button size="icon" variant="ghost" onClick={() => copyToClipboard(displayTransactionId, "ID Transaction")} data-testid="button-copy-tx-id">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Download Receipt */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Télécharger le reçu</h3>
            </div>
            <DownloadReceiptButtons transaction={transaction} metadata={metadata} />
          </div>

          {/* Financial Breakdown */}
          <FinancialBreakdown transaction={transaction} metadata={metadata} />

          {/* Details Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informations</h3>
            <div className="grid grid-cols-2 gap-3">
              {transaction.country && (
                <div className="bg-muted/30 rounded-md p-3 border">
                  <p className="text-xs text-muted-foreground mb-1">Pays</p>
                  <p className="text-sm font-semibold">{transaction.country}</p>
                </div>
              )}
              {transaction.operator && (
                <div className="bg-muted/30 rounded-md p-3 border">
                  <p className="text-xs text-muted-foreground mb-1">Opérateur</p>
                  <p className="text-sm font-semibold capitalize">{transaction.operator}</p>
                </div>
              )}
              {metadata?.provider && (
                <div className="bg-muted/30 rounded-md p-3 border">
                  <p className="text-xs text-muted-foreground mb-1">Fournisseur</p>
                  <p className="text-sm font-semibold capitalize">{metadata.provider}</p>
                </div>
              )}
            </div>

            {transaction.description && (
              <div className="bg-muted/30 rounded-md p-3 border">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{transaction.description}</p>
              </div>
            )}

            {/* Cross-currency info */}
            {metadata?.providerAmount && metadata?.providerCurrency && metadata.providerCurrency !== currency && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">Conversion de devises</p>
                <div className="space-y-1.5">
                  <FinancialRow
                    label="Montant envoyé au réseau"
                    value={`${metadata.providerAmount.toLocaleString("fr-FR")} ${metadata.providerCurrency}`}
                    size="sm"
                  />
                  {metadata.conversionRate && (
                    <FinancialRow
                      label="Taux de conversion"
                      value={`1 ${metadata.providerCurrency} = ${metadata.conversionRate} ${currency}`}
                      size="sm"
                      color="muted"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Crypto */}
          {isCryptoPayment && metadata && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                {metadata.cryptoCurrency && <CryptoIcon code={metadata.cryptoCurrency} size="sm" />}
                Cryptomonnaie
              </h3>
              <div className="space-y-2">
                {metadata.cryptoCurrency && (
                  <div className="bg-muted/30 rounded-md p-3 border">
                    <p className="text-xs text-muted-foreground mb-1">Devise crypto</p>
                    <p className="text-sm font-semibold uppercase">{metadata.cryptoCurrency}</p>
                  </div>
                )}
                {metadata.cryptoAmount && (
                  <div className="bg-muted/30 rounded-md p-3 border">
                    <p className="text-xs text-muted-foreground mb-1">Montant crypto</p>
                    <p className="text-sm font-semibold">{metadata.cryptoAmount} {metadata.cryptoCurrency?.toUpperCase()}</p>
                  </div>
                )}
                {metadata.payAddress && (
                  <div className="bg-muted/30 rounded-md p-3 border">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Adresse</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono flex-1 break-all">{metadata.payAddress}</code>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(metadata.payAddress!, "Adresse")} data-testid="button-copy-crypto-address">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer info */}
          {(transaction.customerName || transaction.customerEmail || transaction.customerPhone) && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client</h3>
              <div className="space-y-2">
                {transaction.customerName && (
                  <div className="flex items-center justify-between gap-2 bg-muted/30 rounded-md p-3 border">
                    <div>
                      <p className="text-xs text-muted-foreground">Nom</p>
                      <p className="text-sm font-medium">{transaction.customerName}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(transaction.customerName!, "Nom")} data-testid="button-copy-name">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                {transaction.customerEmail && (
                  <div className="flex items-center justify-between gap-2 bg-muted/30 rounded-md p-3 border">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                      <a href={`mailto:${transaction.customerEmail}`} className="text-sm font-medium text-primary hover:underline" data-testid="link-customer-email">
                        {transaction.customerEmail}
                      </a>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(transaction.customerEmail!, "Email")} data-testid="button-copy-email">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                {transaction.customerPhone && (
                  <div className="flex items-center justify-between gap-2 bg-muted/30 rounded-md p-3 border">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</p>
                      <a href={`tel:${transaction.customerPhone}`} className="text-sm font-medium text-primary hover:underline" data-testid="link-customer-phone">
                        {transaction.customerPhone}
                      </a>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(transaction.customerPhone!, "Téléphone")} data-testid="button-copy-phone">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom fields */}
          {metadata?.customFieldResponses && Object.keys(metadata.customFieldResponses).length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Champs personnalisés</h3>
              <div className="space-y-2">
                {Object.entries(metadata.customFieldResponses).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md p-3 border">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{String(value)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(String(value), label)} data-testid={`button-copy-custom-${label}`}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Webhook Payout API */}
          {!isAdmin && metadata?.apiKeyId && !metadata?.businessTokenId && (transaction.status === "completed" || transaction.status === "failed") && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                <Webhook className="w-4 h-4" />
                Webhook Payout API
              </h3>
              <p className="text-xs text-muted-foreground">Si votre serveur n'a pas reçu la notification, renvoyez-la manuellement.</p>
              <Button variant="outline" onClick={() => resendWebhookMutation.mutate(transaction.id)} disabled={resendWebhookMutation.isPending || webhookSent} data-testid="button-resend-payout-webhook">
                <RotateCcw className={`w-4 h-4 mr-2 ${resendWebhookMutation.isPending ? "animate-spin" : ""}`} />
                {resendWebhookMutation.isPending ? "Envoi..." : webhookSent ? "Webhook envoyé !" : "Renvoyer le webhook"}
              </Button>
            </div>
          )}

          {/* Webhook Business */}
          {!isAdmin && metadata?.scope === "business" && metadata?.businessTokenId && (transaction.status === "completed" || transaction.status === "failed") && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                <Webhook className="w-4 h-4" />
                {["deposit", "payment_link", "merchant_link", "api_payment"].includes(transaction.type) ? "Webhook Payin" : "Webhook Payout"}
              </h3>
              <p className="text-xs text-muted-foreground">Si votre serveur n'a pas reçu la notification, renvoyez-la manuellement.</p>
              <Button variant="outline" onClick={() => resendBusinessWebhookMutation.mutate(transaction.id)} disabled={resendBusinessWebhookMutation.isPending || businessWebhookSent} data-testid="button-resend-business-webhook">
                <RotateCcw className={`w-4 h-4 mr-2 ${resendBusinessWebhookMutation.isPending ? "animate-spin" : ""}`} />
                {resendBusinessWebhookMutation.isPending ? "Envoi..." : businessWebhookSent ? "Webhook envoyé !" : "Renvoyer le webhook"}
              </Button>
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && (transaction.status === "completed" || transaction.status === "failed" || transaction.status === "pending") && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Actions administrateur
              </h3>

              {adminStep === "idle" && (
                <div className="flex flex-wrap gap-2">
                  {transaction.status === "completed" && (
                    <Button variant="destructive" onClick={() => { setConfirmAction("failed"); setAdminStep("code"); setAdminCode(""); setAdminCodeError(false); }} data-testid="button-admin-mark-failed">
                      <XCircle className="w-4 h-4 mr-2" />Marquer comme Échoué
                    </Button>
                  )}
                  {(transaction.status === "failed" || transaction.status === "pending") && (
                    <Button variant="default" onClick={() => { setConfirmAction("completed"); setAdminStep("code"); setAdminCode(""); setAdminCodeError(false); }} data-testid="button-admin-mark-completed">
                      <CheckCircle className="w-4 h-4 mr-2" />Marquer comme Complété
                    </Button>
                  )}
                </div>
              )}

              {adminStep === "code" && (
                <div className="bg-muted/50 border rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Code de sécurité requis</p>
                  </div>
                  <PasswordInput
                    placeholder="Code de sécurité"
                    value={adminCode}
                    onChange={(e) => { setAdminCode(e.target.value); setAdminCodeError(false); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (adminCode === "19992025") { setAdminStep("confirm"); setAdminCodeError(false); }
                        else { setAdminCodeError(true); }
                      }
                    }}
                    className={adminCodeError ? "border-destructive" : ""}
                    data-testid="input-admin-security-code"
                  />
                  {adminCodeError && <p className="text-xs text-destructive">Code de sécurité incorrect</p>}
                  <div className="flex gap-2">
                    <Button variant="default" onClick={() => {
                      if (adminCode === "19992025") { setAdminStep("confirm"); setAdminCodeError(false); }
                      else { setAdminCodeError(true); }
                    }} data-testid="button-admin-validate-code">Valider</Button>
                    <Button variant="outline" onClick={() => { setAdminStep("idle"); setConfirmAction(null); setAdminCode(""); setAdminCodeError(false); }} data-testid="button-admin-cancel-code">Annuler</Button>
                  </div>
                </div>
              )}

              {adminStep === "confirm" && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Code vérifié</p>
                  </div>
                  <p className="text-sm font-medium">
                    {confirmAction === "failed"
                      ? "Confirmer le passage en Échoué ? Le montant sera déduit du solde."
                      : "Confirmer le passage en Complété ? Le montant sera crédité au solde."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={confirmAction === "failed" ? "destructive" : "default"}
                      onClick={() => changeStatusMutation.mutate({ transactionId: transaction.id, newStatus: confirmAction! })}
                      disabled={changeStatusMutation.isPending}
                      data-testid="button-admin-confirm-status"
                    >
                      {changeStatusMutation.isPending ? "En cours..." : "Confirmer"}
                    </Button>
                    <Button variant="outline" onClick={() => { setAdminStep("idle"); setConfirmAction(null); setAdminCode(""); }} disabled={changeStatusMutation.isPending} data-testid="button-admin-cancel-status">
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
