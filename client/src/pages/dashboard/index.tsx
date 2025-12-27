import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Send, Link2, Store, Code2, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User, Transaction } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    refetchInterval: 5000, // Rafraîchir toutes les 5 secondes
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalBalance: number;
    totalDeposits: number;
    totalTransfers: number;
    recentTransactions: Transaction[];
  }>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 3000, // Rafraîchir toutes les 3 secondes pour le solde en temps réel
  });

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
      completed: "Complété",
      pending: "En attente",
      failed: "Échoué",
      cancelled: "Annulé",
    };
    return texts[status] || status;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Tableau de bord</h1>
      </div>

      {/* Stats Cards */}
      <div className="space-y-3">
        {/* Quick Access Buttons */}
        <div className="grid grid-cols-4 gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/payment-links")}
            data-testid="button-quick-payment-link"
          >
            <Link2 className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">Paiement</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/merchant-links")}
            data-testid="button-quick-merchant-link"
          >
            <Store className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">Marchand</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/api")}
            data-testid="button-quick-api"
          >
            <Code2 className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">API</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/support")}
            data-testid="button-quick-support"
          >
            <HeadphonesIcon className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">Support</span>
          </Button>
        </div>

        {/* Action Buttons - Order: Dépôt, Transfert, Retrait */}
        <div className="flex gap-2">
          <Button 
            data-testid="button-deposit"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => setLocation("/dashboard/deposit")}
          >
            <ArrowDownToLine className="h-4 w-4" />
            Dépôt
          </Button>
          <Button 
            data-testid="button-transfer"
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setLocation("/dashboard/transfer")}
          >
            <Send className="h-4 w-4" />
            Transfert
          </Button>
          <Button 
            data-testid="button-withdrawal"
            variant="accent"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => setLocation("/dashboard/withdrawal")}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Retrait
          </Button>
        </div>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Transactions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
            <div className="space-y-4">
              {stats.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
                  data-testid={`transaction-${transaction.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {transaction.description || transaction.type}
                      </p>
                      <Badge variant={getStatusBadge(transaction.status)} className="text-xs">
                        {getStatusText(transaction.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {transaction.country && ` • ${transaction.country}`}
                      {transaction.operator && ` • ${transaction.operator}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatAmount(transaction.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{transaction.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucune transaction récente</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
