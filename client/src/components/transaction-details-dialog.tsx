import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@shared/schema";
import { Copy, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  const { toast } = useToast();

  if (!transaction) return null;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: transaction.currency || "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
      description: `${label} copié à presse-papiers`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails de la transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Details */}
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
                  <p className="text-xs text-muted-foreground">Token Paydunya</p>
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

          {/* Customer Details */}
          {(transaction.customerName || transaction.customerEmail || transaction.customerPhone) && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg">Informations du client</h3>

              <div className="space-y-3">
                {transaction.customerName && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Nom du client</p>
                    <p className="text-sm font-medium">{transaction.customerName}</p>
                  </div>
                )}

                {transaction.customerEmail && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Email</p>
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
                    <p className="text-xs text-muted-foreground">Téléphone</p>
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

          {/* Receipt Link */}
          {transaction.paydunyaReceiptUrl && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg">Reçu</h3>
              <a
                href={transaction.paydunyaReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
                data-testid="link-receipt"
              >
                <Button variant="outline" className="gap-2">
                  Voir le reçu Paydunya
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
