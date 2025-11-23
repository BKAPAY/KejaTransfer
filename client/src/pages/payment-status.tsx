import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Transaction } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";

export default function PaymentStatus() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, setLocation] = useLocation();

  const { data: transaction, isLoading } = useQuery<Transaction>({
    queryKey: [`/api/transactions/${transactionId}`],
    enabled: !!transactionId,
    refetchInterval: (query) => {
      if (query.state.data?.status === "completed" || query.state.data?.status === "failed") {
        return false;
      }
      return 2000;
    },
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            
            <div className="space-y-2">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
              <h2 className="text-xl font-bold text-foreground">Paiement en cours</h2>
              <p className="text-sm text-muted-foreground">
                Veuillez confirmer la transaction sur votre téléphone
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Ne fermez pas cette page
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            <p className="text-muted-foreground">Transaction non trouvée</p>
            <Button className="w-full" onClick={() => setLocation("/")}> Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (transaction.status === "completed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />

            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Paiement Réussi !</h2>
              <p className="text-sm text-muted-foreground">Merci pour votre paiement.</p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(transaction.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Référence</span>
                <span className="font-mono text-sm text-foreground">{transaction.id.substring(0, 8)}</span>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={() => setLocation("/")}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (transaction.status === "failed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />

            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Paiement Échoué</h2>
              <p className="text-sm text-muted-foreground">Une erreur s'est produite lors du traitement.</p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(transaction.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Référence</span>
                <span className="font-mono text-sm text-foreground">{transaction.id.substring(0, 8)}</span>
              </div>
            </div>

            <div className="space-y-2 w-full">
              <Button className="w-full" size="lg" onClick={() => setLocation("/")}>
                Retour à l'accueil
              </Button>
              <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
