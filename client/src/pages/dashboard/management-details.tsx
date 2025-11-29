import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Eye, EyeOff, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { User, Transaction, PaymentLink, MerchantLink, ApiKey } from "@shared/schema";

// History Dialog Component
export function HistoryDialog({ userId, onOpenChange }: { userId: string; onOpenChange: () => void }) {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/admin/user/${userId}/transactions`],
  });
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];
    if (!searchQuery.trim()) return transactions;

    const query = searchQuery.toLowerCase().trim();
    
    return transactions.filter((tx) => {
      const customerName = (tx.customerName || "").toLowerCase();
      const customerEmail = (tx.customerEmail || "").toLowerCase();
      const customerPhone = (tx.customerPhone || "").toLowerCase();
      const paydunyaToken = (tx.paydunyaToken || "").toLowerCase();
      const txId = tx.id.toLowerCase();
      
      return (
        customerName.includes(query) ||
        customerEmail.includes(query) ||
        customerPhone.includes(query) ||
        paydunyaToken.includes(query) ||
        txId.includes(query)
      );
    });
  }, [transactions, searchQuery]);

  if (selectedTx) {
    return <TransactionDetailDialog transaction={selectedTx} onOpenChange={() => setSelectedTx(null)} />;
  }

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historique des transactions</DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par token, nom, email, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 h-10 rounded-md border border-input bg-background text-sm"
            data-testid="input-search-admin-transactions"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {searchQuery && (
          <p className="text-xs text-muted-foreground mb-2">
            {filteredTransactions.length} résultat(s) pour "{searchQuery}"
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredTransactions.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 pr-4">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-4 border-b last:border-0 hover-elevate rounded-md px-3 cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                  data-testid={`transaction-card-${tx.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm">
                        {tx.description || getTypeText(tx.type)}
                      </p>
                      <Badge variant={getStatusBadge(tx.status)} className="text-xs">
                        {getStatusText(tx.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {tx.customerName && <span>{tx.customerName}</span>}
                      {tx.customerEmail && <span>{tx.customerEmail}</span>}
                      {tx.customerPhone && <span>{tx.customerPhone}</span>}
                      {tx.country && <span>{tx.country}</span>}
                      {tx.operator && (
                        <span className="capitalize">{tx.operator}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatAmount(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : searchQuery ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune transaction trouvée pour "{searchQuery}"</p>
            <Button variant="ghost" onClick={() => setSearchQuery("")} className="mt-2">
              Effacer la recherche
            </Button>
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Aucune transaction</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Transaction Detail Dialog Component
function TransactionDetailDialog({ transaction, onOpenChange }: { transaction: Transaction; onOpenChange: () => void }) {
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-transaction-detail">
        <DialogHeader>
          <DialogTitle>Détails de la transaction</DialogTitle>
        </DialogHeader>
        <ScrollArea className="pr-4">
          <div className="space-y-5">
            {/* ID Transaction - Highlighted */}
            <div className="bg-muted p-3 rounded-md border border-border">
              <label className="text-xs font-medium text-muted-foreground block mb-2">ID Transaction</label>
              <code className="text-xs font-mono break-all">{transaction.id}</code>
            </div>

            {/* Transaction Info Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Informations de la transaction</h3>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <div className="mt-1">
                  <Badge variant="outline">{getTypeText(transaction.type)}</Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Statut</label>
                <div className="mt-1">
                  <Badge variant={getStatusBadge(transaction.status)}>
                    {getStatusText(transaction.status)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Montant</label>
                <div className="p-2 bg-muted rounded-md text-lg font-semibold mt-1">
                  {formatAmount(transaction.amount)}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Date et heure</label>
                <div className="p-2 bg-muted rounded-md text-sm mt-1">
                  {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  à {new Date(transaction.createdAt).toLocaleTimeString("fr-FR")}
                </div>
              </div>

              {transaction.description && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <div className="p-2 bg-muted rounded-md text-sm mt-1">{transaction.description}</div>
                </div>
              )}
            </div>

            {/* Transaction Details */}
            <div className="space-y-3">
              {transaction.operator && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Opérateur</label>
                  <div className="p-2 bg-muted rounded-md text-sm mt-1 uppercase font-semibold">{transaction.operator}</div>
                </div>
              )}

              {transaction.country && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Pays</label>
                  <div className="p-2 bg-muted rounded-md text-sm mt-1 uppercase font-semibold">{transaction.country}</div>
                </div>
              )}
            </div>

            {/* Client Info Section */}
            {(transaction.customerEmail || transaction.customerPhone) && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Informations du client</h3>
                
                {transaction.customerEmail && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <div className="p-2 bg-muted rounded-md text-sm mt-1 break-all">{transaction.customerEmail}</div>
                  </div>
                )}

                {transaction.customerPhone && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
                    <div className="p-2 bg-muted rounded-md text-sm mt-1">{transaction.customerPhone}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Payment Links Dialog Component
export function PaymentLinksDialog({ userId, onOpenChange }: { userId: string; onOpenChange: () => void }) {
  const { data: links, isLoading } = useQuery<PaymentLink[]>({
    queryKey: [`/api/admin/user/${userId}/payment-links`],
  });
  const { toast } = useToast();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié", description: "Le lien a été copié" });
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Liens de paiement</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : links && links.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 pr-4">
              {links.map((link) => (
                <Card key={link.id} className="overflow-hidden">
                  <div className="md:flex">
                    {link.imageUrl && (
                      <img
                        src={link.imageUrl}
                        alt={link.productName}
                        className="w-full md:w-40 h-40 object-cover"
                      />
                    )}
                    <CardContent className="flex-1 pt-4">
                      <h4 className="font-semibold text-sm mb-1">{link.productName}</h4>
                      {link.description && <p className="text-sm text-muted-foreground mb-2">{link.description}</p>}
                      <p className="font-semibold text-lg mb-3">{formatAmount(link.amount)}</p>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center text-xs">
                          <code className="flex-1 bg-muted p-2 rounded overflow-x-auto">
                            {window.location.origin}/pay/{link.token}
                          </code>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`${window.location.origin}/pay/${link.token}`)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Aucun lien de paiement</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Merchant Links Dialog Component
export function MerchantLinksDialog({ userId, onOpenChange }: { userId: string; onOpenChange: () => void }) {
  const { data: links, isLoading } = useQuery<MerchantLink[]>({
    queryKey: [`/api/admin/user/${userId}/merchant-links`],
  });
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié", description: "Le lien a été copié" });
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Liens marchands</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : links && links.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {links.map((link) => (
                <Card key={link.id} className="p-4">
                  <h4 className="font-semibold mb-2">{link.merchantName}</h4>
                  <div className="flex gap-2 items-center text-xs">
                    <code className="flex-1 bg-muted p-2 rounded overflow-x-auto">
                      {window.location.origin}/merchant/{link.token}
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`${window.location.origin}/merchant/${link.token}`)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Aucun lien marchand</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// API Keys Dialog Component
export function ApiKeysDialog({ userId, onOpenChange }: { userId: string; onOpenChange: () => void }) {
  const { data: keys, isLoading } = useQuery<ApiKey[]>({
    queryKey: [`/api/admin/user/${userId}/api-keys`],
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const maskKey = (key: string) => key.slice(0, 10) + "..." + key.slice(-4);

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié", description: `${label} copié` });
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Clés API</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : keys && keys.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 pr-4">
              {keys.map((key) => (
                <Card key={key.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{key.name}</CardTitle>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>{new Date(key.createdAt).toLocaleDateString("fr-FR")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-2">Clé publique (Frontend)</label>
                      <div className="flex gap-2 items-center">
                        <code className="flex-1 bg-muted p-2 rounded text-xs font-mono truncate">
                          {visibleKeys[key.id + "-public"] ? key.publicKey : maskKey(key.publicKey)}
                        </code>
                        <Button size="sm" variant="ghost" onClick={() => toggleKeyVisibility(key.id + "-public")}>
                          {visibleKeys[key.id + "-public"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(key.publicKey, "Clé publique")}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-2">Clé privée (Backend)</label>
                      <div className="flex gap-2 items-center">
                        <code className="flex-1 bg-muted p-2 rounded text-xs font-mono truncate">
                          {visibleKeys[key.id + "-private"] ? key.privateKey : maskKey(key.privateKey)}
                        </code>
                        <Button size="sm" variant="ghost" onClick={() => toggleKeyVisibility(key.id + "-private")}>
                          {visibleKeys[key.id + "-private"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(key.privateKey, "Clé privée")}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Aucune clé API</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Profile Dialog Component
export function ProfileDialog({ userId, onOpenChange }: { userId: string; onOpenChange: () => void }) {
  const { data: user, isLoading, refetch } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
  });
  const { toast } = useToast();
  const [toggling, setToggling] = React.useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleToggleVerification = async () => {
    if (!user) return;
    try {
      setToggling(true);
      const response = await fetch("/api/admin/toggle-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la modification du statut de vérification");
      }
      
      toast({
        title: "Succès",
        description: user.verified ? "Compte dévérifiée" : "Compte vérifiée",
      });
      
      await refetch();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profil utilisateur</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prénom</label>
              <div className="p-2 bg-muted rounded-md text-sm mt-1">{user.firstName}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nom</label>
              <div className="p-2 bg-muted rounded-md text-sm mt-1">{user.lastName}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="p-2 bg-muted rounded-md text-sm mt-1 truncate">{user.email}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Solde</label>
              <div className="p-2 bg-muted rounded-md text-sm mt-1 font-semibold">
                {formatAmount(user.balance)}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Statut KYC</label>
              <div className="mt-2">
                <Badge variant={user.kycStatus === "verified" ? "default" : "secondary"}>
                  {user.kycStatus === "verified" ? "Vérifiée" : "Non vérifiée"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Administrateur</label>
              <div className="mt-2">
                <Badge variant={user.isAdmin ? "destructive" : "secondary"}>
                  {user.isAdmin ? "Admin" : "Utilisateur"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vérification de compte</label>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={user.verified ? "default" : "secondary"}>
                  {user.verified ? "Vérifié" : "Non vérifié"}
                </Badge>
                <Button 
                  size="sm" 
                  onClick={handleToggleVerification}
                  disabled={toggling}
                  data-testid="button-toggle-verification"
                >
                  {toggling ? "..." : user.verified ? "Dévérifier" : "Vérifier"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
