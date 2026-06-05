import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Transaction, User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { History as HistoryIcon, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailsDialog } from "@/components/transaction-details-dialog";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

type StatusFilter = "all" | "completed" | "pending" | "failed";

export default function History() {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("completed");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const userCurrency = user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const statusCounts = useMemo(() => {
    if (!transactions) return { all: 0, completed: 0, pending: 0, failed: 0 };
    return {
      all: transactions.length,
      completed: transactions.filter(t => t.status === "completed").length,
      pending: transactions.filter(t => t.status === "pending").length,
      failed: transactions.filter(t => t.status === "failed" || t.status === "cancelled").length,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    let result = transactions;

    if (statusFilter !== "all") {
      result = result.filter(t =>
        statusFilter === "failed"
          ? t.status === "failed" || t.status === "cancelled"
          : t.status === statusFilter
      );
    }

    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase().trim();
    return result.filter((transaction) => {
      const customerName = (transaction.customerName || "").toLowerCase();
      const customerEmail = (transaction.customerEmail || "").toLowerCase();
      const customerPhone = (transaction.customerPhone || "").toLowerCase();
      const paydunyaToken = (transaction.paydunyaToken || "").toLowerCase();
      const txId = transaction.id.toLowerCase();
      const description = (transaction.description || "").toLowerCase();
      const metadata = (transaction.metadata || "").toLowerCase();
      return (
        customerName.includes(query) ||
        customerEmail.includes(query) ||
        customerPhone.includes(query) ||
        paydunyaToken.includes(query) ||
        txId.includes(query) ||
        description.includes(query) ||
        metadata.includes(query)
      );
    });
  }, [transactions, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDialogOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: userCurrency,
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
      completed: "Complète",
      pending: "En attente",
      failed: "Échouée",
      cancelled: "Annulée",
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

  const getTransactionLabel = (transaction: any) => {
    try {
      const meta = transaction.metadata ? JSON.parse(transaction.metadata as string) : null;
      const isApiPayout = transaction.type === "withdrawal" && (
        meta?.netMode === true ||
        String(meta?.orderId || "").startsWith("BKAPAY-API-") ||
        !!meta?.apiKeyId
      );
      if (isApiPayout) {
        return `Payout API ${Number(transaction.amount).toLocaleString("fr-FR")} ${transaction.currency}`;
      }
    } catch {}
    return transaction.description || getTypeText(transaction.type);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Historique</h1>
        <p className="text-sm text-muted-foreground">
          Toutes vos transactions
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Transactions</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par ID, token, nom, email ou téléphone..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-9"
                data-testid="input-search-transactions"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={clearSearch}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-1">
            <Button
              size="sm"
              onClick={() => handleStatusFilter("completed")}
              data-testid="button-filter-completed"
              className={statusFilter === "completed"
                ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                : "border-green-500 text-green-600 bg-transparent hover:bg-green-50 dark:hover:bg-green-950 border"}
            >
              Complétées
              <span className="ml-2 bg-white/20 text-inherit rounded px-1.5 py-0.5 text-xs font-semibold">{statusCounts.completed}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleStatusFilter("failed")}
              data-testid="button-filter-failed"
              className={statusFilter === "failed"
                ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                : "border-red-500 text-red-600 bg-transparent hover:bg-red-50 dark:hover:bg-red-950 border"}
            >
              Échouées
              <span className="ml-2 bg-white/20 text-inherit rounded px-1.5 py-0.5 text-xs font-semibold">{statusCounts.failed}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleStatusFilter("pending")}
              data-testid="button-filter-pending"
              className={statusFilter === "pending"
                ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                : "border-amber-500 text-amber-600 bg-transparent hover:bg-amber-50 dark:hover:bg-amber-950 border"}
            >
              En attente
              <span className="ml-2 bg-white/20 text-inherit rounded px-1.5 py-0.5 text-xs font-semibold">{statusCounts.pending}</span>
            </Button>
          </div>

          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              {filteredTransactions.length} résultat(s) pour "{searchQuery}"
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : paginatedTransactions.length > 0 ? (
            <>
              <div className="divide-y">
                {paginatedTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px] gap-3 py-4 hover-elevate rounded-md px-3 cursor-pointer items-start"
                    data-testid={`transaction-${transaction.id}`}
                    onClick={() => handleTransactionClick(transaction)}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-sm truncate">
                        {getTransactionLabel(transaction)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getStatusBadge(transaction.status)} className="text-xs shrink-0">
                          {getStatusText(transaction.status)}
                        </Badge>
                        {transaction.country && (
                          <span className="text-xs text-muted-foreground">{transaction.country}</span>
                        )}
                        {transaction.operator && (
                          <span className="text-xs text-muted-foreground capitalize">{transaction.operator}</span>
                        )}
                        {(() => {
                          try {
                            const meta = transaction.metadata ? JSON.parse(transaction.metadata as string) : null;
                            if (meta?.customerPaysFee) {
                              return (
                                <Badge variant="outline" className="text-xs shrink-0 border-blue-400 text-blue-600 dark:text-blue-400">
                                  Frais client
                                </Badge>
                              );
                            }
                            return null;
                          } catch { return null; }
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {(transaction.customerName || transaction.customerPhone || transaction.customerEmail) && (
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {transaction.customerName && (
                            <p><span className="font-medium">Client:</span> {transaction.customerName}</p>
                          )}
                          {transaction.customerPhone && (
                            <p><span className="font-medium">Tél:</span> {transaction.customerPhone}</p>
                          )}
                          {transaction.customerEmail && (
                            <p><span className="font-medium">Email:</span> {transaction.customerEmail}</p>
                          )}
                        </div>
                      )}
                      {(() => {
                        try {
                          const meta = transaction.metadata ? JSON.parse(transaction.metadata as string) : null;
                          const refId = transaction.paydunyaToken || meta?.fedapayTransactionId || meta?.mbiyopayTransactionId || meta?.afribaPayTransactionId || meta?.pawaPayDepositId || meta?.pawaPayPayoutId || meta?.nowpaymentsId || meta?.orderId;
                          return (
                            <>
                              {refId && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">Réf:</span> {refId}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                                <span className="font-sans font-medium not-italic">ID:</span> {transaction.id}
                              </p>
                            </>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-base tabular-nums">
                        {formatAmount(transaction.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{transaction.currency}</p>
                      {(() => {
                        try {
                          const meta = transaction.metadata ? JSON.parse(transaction.metadata as string) : null;
                          if (meta?.providerAmount && meta?.providerCurrency && meta.providerCurrency !== transaction.currency) {
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
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                      data-testid="button-first-page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm font-medium">
                        Page {currentPage} sur {totalPages}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({filteredTransactions.length} transactions)
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      data-testid="button-last-page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {totalPages <= 1 && filteredTransactions.length > 0 && (
                <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                  {filteredTransactions.length} transaction(s) au total
                </div>
              )}
            </>
          ) : searchQuery ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucune transaction trouvée pour "{searchQuery}"</p>
              <Button variant="ghost" onClick={clearSearch} className="mt-2">
                Effacer la recherche
              </Button>
            </div>
          ) : statusFilter !== "all" ? (
            <div className="text-center py-12">
              <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {statusFilter === "completed" && "Aucune transaction complétée"}
                {statusFilter === "pending" && "Aucune transaction en attente"}
                {statusFilter === "failed" && "Aucune transaction échouée"}
              </p>
              <Button variant="ghost" onClick={() => handleStatusFilter("completed")} className="mt-2">
                Voir les transactions complétées
              </Button>
            </div>
          ) : (
            <div className="text-center py-12">
              <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucune transaction pour le moment</p>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailsDialog
        transaction={selectedTransaction}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
