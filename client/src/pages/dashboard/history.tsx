import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@shared/schema";
import { History as HistoryIcon, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailsDialog } from "@/components/transaction-details-dialog";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function History() {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    refetchInterval: 3000,
  });

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!searchQuery.trim()) return transactions;

    const query = searchQuery.toLowerCase().trim();
    
    return transactions.filter((transaction) => {
      const customerName = (transaction.customerName || "").toLowerCase();
      const customerEmail = (transaction.customerEmail || "").toLowerCase();
      const customerPhone = (transaction.customerPhone || "").toLowerCase();
      
      return (
        customerName.includes(query) ||
        customerEmail.includes(query) ||
        customerPhone.includes(query)
      );
    });
  }, [transactions, searchQuery]);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDialogOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
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
      completed: "Complete",
      pending: "En attente",
      failed: "Echoue",
      cancelled: "Annule",
    };
    return texts[status] || status;
  };

  const getTypeText = (type: string) => {
    const types: Record<string, string> = {
      deposit: "Depot",
      withdrawal: "Retrait",
      transfer: "Transfert",
      payment_link: "Lien de paiement",
      merchant_link: "Lien marchand",
      api_payment: "Paiement API",
    };
    return types[type] || type;
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
                placeholder="Rechercher par nom, email ou telephone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              {filteredTransactions.length} resultat(s) pour "{searchQuery}"
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
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-1">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 py-4 border-b last:border-0 hover-elevate rounded-md px-3 cursor-pointer"
                  data-testid={`transaction-${transaction.id}`}
                  onClick={() => handleTransactionClick(transaction)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm">
                        {transaction.description || getTypeText(transaction.type)}
                      </p>
                      <Badge variant={getStatusBadge(transaction.status)} className="text-xs">
                        {getStatusText(transaction.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {transaction.customerName && <span>{transaction.customerName}</span>}
                      {transaction.customerEmail && <span>{transaction.customerEmail}</span>}
                      {transaction.customerPhone && <span>{transaction.customerPhone}</span>}
                      {transaction.country && <span>{transaction.country}</span>}
                      {transaction.operator && (
                        <span className="capitalize">{transaction.operator}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatAmount(transaction.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{transaction.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucune transaction trouvee pour "{searchQuery}"</p>
              <Button variant="ghost" onClick={clearSearch} className="mt-2">
                Effacer la recherche
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
