import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Transaction } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";

const COUNTDOWN_DURATION = 5 * 60; // 5 minutes in seconds

function getStorageKey(transactionId: string): string {
  return `payment_countdown_tx_${transactionId}`;
}

function getStartTime(key: string): number | null {
  const stored = localStorage.getItem(key);
  if (stored) {
    return parseInt(stored, 10);
  }
  return null;
}

function setStartTime(key: string, time: number): void {
  localStorage.setItem(key, time.toString());
}

function clearStartTime(key: string): void {
  localStorage.removeItem(key);
}

function calculateRemainingTime(startTime: number): number {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  return Math.max(0, COUNTDOWN_DURATION - elapsed);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function PaymentStatus() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, setLocation] = useLocation();
  const [remainingTime, setRemainingTime] = useState(COUNTDOWN_DURATION);
  const [isExpired, setIsExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const storageKey = transactionId ? getStorageKey(transactionId) : "";

  // Initialize countdown from localStorage or start new
  useEffect(() => {
    if (!transactionId) return;

    let startTime = getStartTime(storageKey);
    if (!startTime) {
      startTime = Date.now();
      setStartTime(storageKey, startTime);
    }

    const remaining = calculateRemainingTime(startTime);
    setRemainingTime(remaining);
    setIsExpired(remaining <= 0);
  }, [transactionId, storageKey]);

  // Query with polling every second
  const { data: transaction, isLoading } = useQuery<Transaction>({
    queryKey: [`/api/transactions/${transactionId}`],
    enabled: !!transactionId && !isExpired,
    refetchInterval: (query) => {
      if (query.state.data?.status === "completed" || query.state.data?.status === "failed") {
        return false;
      }
      return 1000; // Poll every 1 second
    },
  });

  // Countdown timer effect
  useEffect(() => {
    if (!transactionId || transaction?.status === "completed" || transaction?.status === "failed") {
      return;
    }

    timerRef.current = setInterval(() => {
      const storedStartTime = getStartTime(storageKey);
      if (!storedStartTime) return;

      const remaining = calculateRemainingTime(storedStartTime);
      setRemainingTime(remaining);

      if (remaining <= 0) {
        setIsExpired(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [transactionId, storageKey, transaction?.status]);

  // Clear countdown when payment completed or failed
  useEffect(() => {
    if (transaction?.status === "completed" || transaction?.status === "failed") {
      clearStartTime(storageKey);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [transaction?.status, storageKey]);

  // Redirect to callback URL when payment is completed or failed
  useEffect(() => {
    if (!transaction) return;

    const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};
    const callbackUrl = metadata?.callbackUrl;

    if (transaction.status === "completed" && callbackUrl) {
      const url = new URL(callbackUrl);
      url.searchParams.append("status", "success");
      url.searchParams.append("transactionId", transaction.id);
      url.searchParams.append("amount", String(transaction.amount));
      window.location.href = url.toString();
    } else if (transaction.status === "failed" && callbackUrl) {
      const url = new URL(callbackUrl);
      url.searchParams.append("status", "failed");
      url.searchParams.append("transactionId", transaction.id);
      url.searchParams.append("amount", String(transaction.amount));
      window.location.href = url.toString();
    }
  }, [transaction]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (isLoading && !transaction) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Chargement...</h2>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transaction not found
  if (!transaction) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            <p className="text-muted-foreground">Transaction non trouvée</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment completed - Show success logo only (no buttons)
  if (transaction.status === "completed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />

            <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400" data-testid="icon-success" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Paiement Réussi</h2>
              <p className="text-sm text-muted-foreground">Votre transaction a été confirmée avec succès</p>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment failed or expired - Show error logo only (no buttons)
  if (transaction.status === "failed" || isExpired) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />

            <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" data-testid="icon-failed" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Paiement Échoué</h2>
              <p className="text-sm text-muted-foreground">
                {isExpired ? "Le délai de validation a expiré" : "La transaction n'a pas pu être complétée"}
              </p>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment pending - Show countdown timer
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
          <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
          
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" data-testid="icon-polling" />
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Paiement en cours</h2>
              <p className="text-sm text-muted-foreground">
                Veuillez confirmer la transaction sur votre téléphone
              </p>
            </div>

            {/* Countdown Timer */}
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Temps restant</p>
              <p className="text-3xl font-mono font-bold text-primary" data-testid="text-countdown">
                {formatTime(remainingTime)}
              </p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(transaction.amount)}</span>
              </div>
              {transaction.description && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Détail</span>
                  <span className="text-sm text-foreground truncate max-w-[150px]">{transaction.description}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Ne fermez pas cette page
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
