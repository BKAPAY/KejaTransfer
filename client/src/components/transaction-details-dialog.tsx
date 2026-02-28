import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@shared/schema";
import { Copy, Mail, Phone, Wallet, AlertTriangle, CheckCircle, XCircle, Lock, ShieldCheck, RotateCcw, Webhook } from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  [key: string]: any;
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

  const displayTransactionId = transaction.paydunyaToken
    || (metadata?.fedapayTransactionId ? String(metadata.fedapayTransactionId) : null)
    || metadata?.mbiyopayTransactionId
    || metadata?.afribaPayTransactionId
    || (metadata?.nowpaymentsId ? String(metadata.nowpaymentsId) : null)
    || (metadata?.orderId ? String(metadata.orderId) : null)
    || transaction.id;

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
              <code className="text-xs font-mono break-all flex-1">{displayTransactionId}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(displayTransactionId, "ID Transaction")}
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

              {metadata?.providerAmount && metadata?.providerCurrency && metadata.providerCurrency !== transaction.currency && (
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-muted-foreground">Montant envoyé</p>
                  <p className="text-sm font-medium">
                    {metadata.providerAmount.toLocaleString("fr-FR")} {metadata.providerCurrency}
                    {metadata.conversionRate && (
                      <span className="text-xs text-muted-foreground ml-2">(taux: {metadata.conversionRate})</span>
                    )}
                  </p>
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
                    <p className="text-xs text-muted-foreground">Référence de paiement</p>
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

          {!isAdmin && metadata?.apiKeyId && (transaction.status === "completed" || transaction.status === "failed") && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Webhook className="w-4 h-4 text-muted-foreground" />
                Webhook Payout API
              </h3>
              <p className="text-xs text-muted-foreground">
                Si votre serveur n'a pas reçu la notification de statut, vous pouvez la renvoyer manuellement.
              </p>
              <Button
                variant="outline"
                onClick={() => resendWebhookMutation.mutate(transaction.id)}
                disabled={resendWebhookMutation.isPending || webhookSent}
                data-testid="button-resend-payout-webhook"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${resendWebhookMutation.isPending ? "animate-spin" : ""}`} />
                {resendWebhookMutation.isPending
                  ? "Envoi en cours..."
                  : webhookSent
                  ? "Webhook envoyé !"
                  : "Renvoyer le webhook"}
              </Button>
            </div>
          )}

          {isAdmin && (transaction.status === "completed" || transaction.status === "failed" || transaction.status === "pending") && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Actions administrateur
              </h3>

              {adminStep === "idle" && (
                <div className="flex flex-wrap gap-2">
                  {transaction.status === "completed" && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setConfirmAction("failed");
                        setAdminStep("code");
                        setAdminCode("");
                        setAdminCodeError(false);
                      }}
                      data-testid="button-admin-mark-failed"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Marquer comme Echoué
                    </Button>
                  )}
                  {(transaction.status === "failed" || transaction.status === "pending") && (
                    <Button
                      variant="default"
                      onClick={() => {
                        setConfirmAction("completed");
                        setAdminStep("code");
                        setAdminCode("");
                        setAdminCodeError(false);
                      }}
                      data-testid="button-admin-mark-completed"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marquer comme Complété
                    </Button>
                  )}
                </div>
              )}

              {adminStep === "code" && (
                <div className="bg-muted/50 border border-border rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Entrez le code de sécurité pour continuer</p>
                  </div>
                  <Input
                    type="password"
                    placeholder="Code de sécurité"
                    value={adminCode}
                    onChange={(e) => {
                      setAdminCode(e.target.value);
                      setAdminCodeError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (adminCode === "19992025") {
                          setAdminStep("confirm");
                          setAdminCodeError(false);
                        } else {
                          setAdminCodeError(true);
                        }
                      }
                    }}
                    className={adminCodeError ? "border-destructive" : ""}
                    data-testid="input-admin-security-code"
                  />
                  {adminCodeError && (
                    <p className="text-xs text-destructive">Code de sécurité incorrect</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={() => {
                        if (adminCode === "19992025") {
                          setAdminStep("confirm");
                          setAdminCodeError(false);
                        } else {
                          setAdminCodeError(true);
                        }
                      }}
                      data-testid="button-admin-validate-code"
                    >
                      Valider le code
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAdminStep("idle");
                        setConfirmAction(null);
                        setAdminCode("");
                        setAdminCodeError(false);
                      }}
                      data-testid="button-admin-cancel-code"
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {adminStep === "confirm" && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Code vérifié</p>
                  </div>
                  <p className="text-sm font-medium">
                    {confirmAction === "failed" 
                      ? "Confirmer le passage en Echoué ? Le montant sera déduit du solde de l'utilisateur."
                      : "Confirmer le passage en Complété ? Le montant sera crédité au solde de l'utilisateur."
                    }
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={confirmAction === "failed" ? "destructive" : "default"}
                      onClick={() => changeStatusMutation.mutate({ 
                        transactionId: transaction.id, 
                        newStatus: confirmAction! 
                      })}
                      disabled={changeStatusMutation.isPending}
                      data-testid="button-admin-confirm-status"
                    >
                      {changeStatusMutation.isPending ? "En cours..." : "Confirmer le changement"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAdminStep("idle");
                        setConfirmAction(null);
                        setAdminCode("");
                      }}
                      disabled={changeStatusMutation.isPending}
                      data-testid="button-admin-cancel-status"
                    >
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
