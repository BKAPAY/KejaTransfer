import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@shared/schema";
import { Copy, Mail, Phone, Wallet } from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransactionMetadata {
  payAddress?: string;
  cryptoCurrency?: string;
  cryptoAmount?: number;
  paymentId?: string;
  nowpaymentsId?: string;
  fedapayTransactionId?: number;
  wizallTransactionId?: string;
  operatorKey?: string;
  provider?: string;
  providerAmount?: number;
  providerCurrency?: string;
  balanceAmount?: number;
  balanceCurrency?: string;
  conversionRate?: number;
  [key: string]: any;
}

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  const { toast } = useToast();

  const metadata = useMemo<TransactionMetadata | null>(() => {
    if (!transaction?.metadata) return null;
    try {
      return JSON.parse(transaction.metadata as string);
    } catch {
      return null;
    }
  }, [transaction?.metadata]);

  if (!transaction) return null;

  const formatAmount = (amount: number, currency?: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || transaction.currency || "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      cancelled: "destructive",
    };
    return variants[status] || "secondary";
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      completed: "Complété",
      pending: "En attente",
      failed: "Échoué",
      cancelled: "Annulé",
    };
    return texts[status] || status;
  };

  const getTypeText = (type: string) => {
    const types: Record<string, string> = {
      deposit: "Dépôt",
      withdrawal: "Retrait",
      transfer: "Transfert",
      payment_link: "Lien de paiement",
      merchant_link: "Lien marchand",
      api_payment: "Paiement API",
    };
    return types[type] || type;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: `${label} copié dans le presse-papiers`,
    });
  };

  const isCryptoPayment = metadata?.payAddress || metadata?.cryptoCurrency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails de la transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted p-3 rounded-md border border-border">
            <label className="text-xs font-medium text-muted-foreground block mb-2">ID Transaction</label>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1">{transaction.id}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(transaction.id, "ID Transaction")}
                data-testid="button-copy-tx-id"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Informations de la transaction</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Montant</p>
                <p className="text-2xl font-bold">{formatAmount(transaction.amount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Statut</p>
                <Badge variant={getStatusBadge(transaction.status)}>
                  {getStatusText(transaction.status)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium">{getTypeText(transaction.type)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm">
                  {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {transaction.country && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pays</p>
                  <p className="text-sm font-medium">{transaction.country}</p>
                </div>
              )}

              {transaction.operator && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Opérateur</p>
                  <p className="text-sm font-medium capitalize">{transaction.operator}</p>
                </div>
              )}

              {transaction.description && (
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{transaction.description}</p>
                </div>
              )}

              {transaction.paydunyaToken && (
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-muted-foreground">Token de paiement</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono bg-muted p-2 rounded flex-1 truncate">
                      {transaction.paydunyaToken}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(transaction.paydunyaToken!, "Token")}
                      data-testid="button-copy-token"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isCryptoPayment && metadata && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {metadata.cryptoCurrency ? (
                  <CryptoIcon code={metadata.cryptoCurrency} size="md" />
                ) : (
                  <CryptoIcon code="btc" size="md" />
                )}
                Informations Cryptomonnaie
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {metadata.cryptoCurrency && (
                  <div className="space-y-1 flex items-center gap-2">
                    <CryptoIcon code={metadata.cryptoCurrency} size="sm" />
                    <div>
                      <p className="text-xs text-muted-foreground">Cryptomonnaie</p>
                      <p className="text-sm font-medium uppercase">{metadata.cryptoCurrency}</p>
                    </div>
                  </div>
                )}

                {metadata.cryptoAmount && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Montant en crypto</p>
                    <p className="text-sm font-medium">
                      {metadata.cryptoAmount} {metadata.cryptoCurrency?.toUpperCase()}
                    </p>
                  </div>
                )}

                {metadata.payAddress && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> Adresse de paiement
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted p-2 rounded flex-1 break-all">
                        {metadata.payAddress}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(metadata.payAddress!, "Adresse crypto")}
                        data-testid="button-copy-crypto-address"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {metadata.paymentId && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">ID Paiement NOWPayments</p>
                    <p className="text-xs font-mono bg-muted p-2 rounded">{metadata.paymentId}</p>
                  </div>
                )}
              </div>
            </div>
          )}


          {(transaction.customerName || transaction.customerEmail || transaction.customerPhone) && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg">Informations du client</h3>

              <div className="grid grid-cols-1 gap-3">
                {transaction.customerName && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Nom complet</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{transaction.customerName}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(transaction.customerName!, "Nom")}
                        data-testid="button-copy-name"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {transaction.customerEmail && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${transaction.customerEmail}`}
                        className="text-sm font-medium text-primary hover:underline"
                        data-testid="link-customer-email"
                      >
                        {transaction.customerEmail}
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(transaction.customerEmail!, "Email")}
                        data-testid="button-copy-email"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {transaction.customerPhone && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Téléphone
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${transaction.customerPhone}`}
                        className="text-sm font-medium text-primary hover:underline"
                        data-testid="link-customer-phone"
                      >
                        {transaction.customerPhone}
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(transaction.customerPhone!, "Téléphone")}
                        data-testid="button-copy-phone"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
