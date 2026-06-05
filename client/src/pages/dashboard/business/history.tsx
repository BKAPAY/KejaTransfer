import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownCircle, ArrowUpCircle, Loader2, Inbox, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { TransactionDetailsDialog } from "@/components/transaction-details-dialog";
import type { Transaction } from "@shared/schema";

const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];
const OUTGOING_TYPES = ["transfer", "withdrawal", "api_payout"];

const ITEMS_PER_PAGE = 20;

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "pending") return "secondary";
  if (status === "failed" || status === "cancelled") return "destructive";
  return "outline";
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    completed: "Complété",
    pending: "En attente",
    failed: "Échoué",
    cancelled: "Annulé",
  };
  return map[status] || status;
}

function getTypeText(type: string): string {
  const map: Record<string, string> = {
    deposit: "Dépôt",
    withdrawal: "Retrait",
    transfer: "Transfert",
    payment_link: "Lien de paiement",
    merchant_link: "Lien marchand",
    api_payment: "Paiement API",
    api_payout: "Payout API",
  };
  return map[type] || type;
}

function getTransactionLabel(tx: Transaction): string {
  try {
    const meta = tx.metadata ? JSON.parse(tx.metadata as string) : null;
    const isApiPayout = tx.type === "withdrawal" && (
      meta?.netMode === true ||
      String(meta?.orderId || "").startsWith("BKAPAY-API-") ||
      !!meta?.apiKeyId
    );
    if (isApiPayout) return `Payout API ${Number(tx.amount).toLocaleString("fr-FR")} ${tx.currency}`;
  } catch {}
  return tx.description || getTypeText(tx.type);
}

type StatusFilter = "all" | "completed" | "pending" | "failed";

function TransactionList({ direction }: { direction: "incoming" | "outgoing" }) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("completed");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const statusCounts = useMemo(() => {
    if (!transactions) return { completed: 0, pending: 0, failed: 0 };
    const byType = transactions.filter(tx =>
      direction === "incoming" ? INCOMING_TYPES.includes(tx.type) : OUTGOING_TYPES.includes(tx.type)
    );
    return {
      completed: byType.filter(t => t.status === "completed").length,
      pending: byType.filter(t => t.status === "pending").length,
      failed: byType.filter(t => t.status === "failed" || t.status === "cancelled").length,
    };
  }, [transactions, direction]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    let byType = transactions.filter(tx =>
      direction === "incoming"
        ? INCOMING_TYPES.includes(tx.type)
        : OUTGOING_TYPES.includes(tx.type)
    );
    if (statusFilter !== "all") {
      byType = byType.filter(tx =>
        statusFilter === "failed"
          ? tx.status === "failed" || tx.status === "cancelled"
          : tx.status === statusFilter
      );
    }
    if (!searchQuery.trim()) return byType;
    const q = searchQuery.toLowerCase().trim();
    return byType.filter(tx =>
      (tx.customerName || "").toLowerCase().includes(q) ||
      (tx.customerEmail || "").toLowerCase().includes(q) ||
      (tx.customerPhone || "").toLowerCase().includes(q) ||
      (tx.paydunyaToken || "").toLowerCase().includes(q) ||
      tx.id.toLowerCase().includes(q) ||
      (tx.description || "").toLowerCase().includes(q)
    );
  }, [transactions, direction, searchQuery, statusFilter]);

  const handleStatusFilter = (f: StatusFilter) => {
    setStatusFilter(f);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setDialogOpen(true);
  };

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email, téléphone, ID..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="pl-9 pr-9"
          data-testid="input-search-business-tx"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => handleSearch("")}
            data-testid="button-clear-search-business"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
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
        <p className="text-xs text-muted-foreground">
          {filtered.length} résultat(s) pour "{searchQuery}"
        </p>
      )}

      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Aucune transaction</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map(tx => (
            <Card
              key={tx.id}
              className="cursor-pointer hover-elevate"
              data-testid={`tx-row-${tx.id}`}
              onClick={() => handleClick(tx)}
            >
              <CardContent className="flex items-center justify-between gap-4 py-3 px-4">
                <div className="flex items-center gap-3 min-w-0">
                  {direction === "incoming"
                    ? <ArrowDownCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    : <ArrowUpCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{getTransactionLabel(tx)}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge variant={getStatusVariant(tx.status)} className="text-xs shrink-0">
                        {getStatusText(tx.status)}
                      </Badge>
                      {tx.country && <span className="text-xs text-muted-foreground">{tx.country}</span>}
                      {tx.operator && <span className="text-xs text-muted-foreground capitalize">{tx.operator}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                        year: "numeric", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    {(tx.customerName || tx.customerPhone || tx.customerEmail) && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {tx.customerName && <p>Client: {tx.customerName}</p>}
                        {tx.customerPhone && <p>Tél: {tx.customerPhone}</p>}
                      </div>
                    )}
                    {(() => {
                      try {
                        const meta = tx.metadata ? JSON.parse(tx.metadata as string) : null;
                        const refId = (tx as any).paydunyaToken || meta?.fedapayTransactionId || meta?.mbiyopayTransactionId || meta?.afribaPayTransactionId || meta?.pawaPayDepositId || meta?.pawaPayPayoutId || meta?.nowpaymentsId || meta?.orderId;
                        return (
                          <>
                            {refId && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                <span className="font-medium">Réf:</span> {refId}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                              <span className="font-sans font-medium not-italic">ID:</span> {tx.id}
                            </p>
                          </>
                        );
                      } catch { return null; }
                    })()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold tabular-nums ${direction === "incoming" ? "text-green-600" : "text-red-500"}`}>
                    {direction === "incoming" ? "+" : "-"}{Number(tx.amount).toLocaleString("fr-FR")} {tx.currency}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <TransactionDetailsDialog
        transaction={selectedTx}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

function IncomingHistory() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ArrowDownCircle className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold tracking-tight">Paiements entrants</h1>
      </div>
      <TransactionList direction="incoming" />
    </div>
  );
}

function OutgoingHistory() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="h-6 w-6 text-red-500" />
        <h1 className="text-2xl font-bold tracking-tight">Paiements sortants</h1>
      </div>
      <TransactionList direction="outgoing" />
    </div>
  );
}

export default function BusinessHistory() {
  const [location] = useLocation();
  const isIncoming = location === "/dashboard/business/history/incoming";
  const isOutgoing = location === "/dashboard/business/history/outgoing";

  if (isIncoming) return <IncomingHistory />;
  if (isOutgoing) return <OutgoingHistory />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Historique</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover-elevate"
          data-testid="card-incoming-history"
          onClick={() => window.location.href = "/dashboard/business/history/incoming"}
        >
          <CardContent className="flex items-center gap-4 py-6 px-5">
            <ArrowDownCircle className="h-8 w-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Paiements entrants</p>
              <p className="text-sm text-muted-foreground">Dépôts et paiements reçus</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover-elevate"
          data-testid="card-outgoing-history"
          onClick={() => window.location.href = "/dashboard/business/history/outgoing"}
        >
          <CardContent className="flex items-center gap-4 py-6 px-5">
            <ArrowUpCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold">Paiements sortants</p>
              <p className="text-sm text-muted-foreground">Transferts et retraits</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
