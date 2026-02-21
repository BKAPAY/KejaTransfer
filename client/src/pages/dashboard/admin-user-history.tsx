import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, History } from "lucide-react";
import type { Transaction, User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { useState } from "react";
import { TransactionDetailsDialog } from "@/components/transaction-details-dialog";

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function AdminUserHistory() {
  const params = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const userId = params.userId;

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/admin/user/${userId}/transactions`],
    enabled: !!userId,
  });

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

  // Get user's currency based on their country
  const userCurrency = user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const formatAmount = (amount: number, currency?: string) => {
    const currencyCode = currency || userCurrency;
    return `${amount.toLocaleString("fr-FR")} ${currencyCode}`;
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

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleTransactionClick = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button variant="ghost" onClick={() => setLocation("/dashboard/management")} className="mb-6" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la gestion
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique de {user?.firstName} {user?.lastName} ({filteredTransactions.length} transactions)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par token, nom, email, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 h-10 rounded-md border border-input bg-background text-sm"
              data-testid="input-search-transactions"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
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

          {paginatedTransactions.length > 0 ? (
            <>
              <div className="divide-y">
                {paginatedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px] gap-3 py-4 hover-elevate rounded-md px-3 cursor-pointer items-start"
                    onClick={() => handleTransactionClick(tx)}
                    data-testid={`transaction-card-${tx.id}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-sm truncate">
                        {tx.description || getTypeText(tx.type)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getStatusBadge(tx.status)} className="text-xs shrink-0">
                          {getStatusText(tx.status)}
                        </Badge>
                        {tx.country && (
                          <span className="text-xs text-muted-foreground">{tx.country}</span>
                        )}
                        {tx.operator && (
                          <span className="text-xs text-muted-foreground capitalize">{tx.operator}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {(tx.customerName || tx.customerPhone || tx.customerEmail) && (
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {tx.customerName && (
                            <p><span className="font-medium">Client:</span> {tx.customerName}</p>
                          )}
                          {tx.customerPhone && (
                            <p><span className="font-medium">Tél:</span> {tx.customerPhone}</p>
                          )}
                          {tx.customerEmail && (
                            <p><span className="font-medium">Email:</span> {tx.customerEmail}</p>
                          )}
                        </div>
                      )}
                      {tx.paydunyaToken && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Token:</span> {tx.paydunyaToken}
                        </p>
                      )}
                      {(() => {
                        try {
                          const meta = tx.metadata ? JSON.parse(tx.metadata as string) : null;
                          const providerId = meta?.fedapayTransactionId || meta?.mbiyopayTransactionId || meta?.afribaPayTransactionId || (meta?.provider === "moneyfusion" && meta?.orderId);
                          if (providerId && !tx.paydunyaToken) {
                            return (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Réf:</span> {providerId}
                              </p>
                            );
                          }
                          return null;
                        } catch { return null; }
                      })()}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-base tabular-nums">
                        {formatAmount(tx.amount, tx.currency || userCurrency)}
                      </p>
                      {(() => {
                        try {
                          const meta = tx.metadata ? JSON.parse(tx.metadata as string) : null;
                          if (meta?.providerAmount && meta?.providerCurrency && meta.providerCurrency !== tx.currency) {
                            return (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                (envoyé: {meta.providerAmount.toLocaleString("fr-FR")} {meta.providerCurrency})
                              </p>
                            );
                          }
                          return null;
                        } catch { return null; }
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Afficher</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-20 h-8" data-testid="select-items-per-page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option.toString()}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>par page</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      data-testid="button-first-page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      data-testid="button-last-page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
        </CardContent>
      </Card>

      <TransactionDetailsDialog
        transaction={selectedTransaction}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isAdmin={true}
        onStatusChanged={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/transactions`] });
          queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/profile`] });
        }}
      />
    </div>
  );
}
