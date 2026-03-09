import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Loader2, Inbox } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  currency: string;
  status: string;
  country: string;
  operator: string;
  customerName: string;
  customerPhone: string;
  description: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Complété</Badge>;
  if (status === "pending") return <Badge variant="secondary">En attente</Badge>;
  if (status === "failed") return <Badge variant="destructive">Échoué</Badge>;
  if (status === "cancelled") return <Badge variant="outline">Annulé</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function TransactionList({ direction }: { direction: "incoming" | "outgoing" }) {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];
  const OUTGOING_TYPES = ["transfer", "withdrawal", "api_payout"];

  const filtered = transactions?.filter(tx => {
    if (direction === "incoming") return INCOMING_TYPES.includes(tx.type);
    return OUTGOING_TYPES.includes(tx.type);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!filtered?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Aucune transaction</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map(tx => (
        <Card key={tx.id} data-testid={`tx-row-${tx.id}`}>
          <CardContent className="flex items-center justify-between gap-4 py-3 px-4">
            <div className="flex items-center gap-3 min-w-0">
              {direction === "incoming"
                ? <ArrowDownCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                : <ArrowUpCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              }
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {tx.description || tx.type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tx.country} {tx.operator && `• ${tx.operator}`} •{" "}
                  {new Date(tx.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 space-y-1">
              <p className={`font-bold tabular-nums ${direction === "incoming" ? "text-green-600" : "text-red-500"}`}>
                {direction === "incoming" ? "+" : "-"}
                {tx.amount.toLocaleString("fr-FR")} {tx.currency}
              </p>
              <StatusBadge status={tx.status} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IncomingHistory() {
  return (
    <div className="space-y-6">
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
    <div className="space-y-6">
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
