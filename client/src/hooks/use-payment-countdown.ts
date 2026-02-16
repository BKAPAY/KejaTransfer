import { useState, useEffect, useCallback, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export const DEFAULT_COUNTDOWN_DURATION = 10 * 60;
export const CRYPTO_COUNTDOWN_DURATION = 30 * 60;
const POLL_INTERVAL = 1000;

interface PaymentCountdownState {
  remainingTime: number;
  isExpired: boolean;
  status: "pending" | "completed" | "failed" | "expired";
  formattedTime: string;
}

interface UsePaymentCountdownOptions {
  invoiceToken: string | null;
  transactionId: string | null;
  enabled: boolean;
  onCompleted?: () => void;
  onFailed?: () => void;
  onExpired?: () => void;
  durationSeconds?: number;
}

function getStorageKey(invoiceToken: string | null, transactionId: string | null): string {
  if (invoiceToken) return `payment_countdown_${invoiceToken}`;
  if (transactionId) return `payment_countdown_tx_${transactionId}`;
  return "";
}

function getStartTime(key: string): number | null {
  if (!key) return null;
  const stored = localStorage.getItem(key);
  if (stored) {
    return parseInt(stored, 10);
  }
  return null;
}

function setStartTime(key: string, time: number): void {
  if (key) {
    localStorage.setItem(key, time.toString());
  }
}

function clearStartTime(key: string): void {
  if (key) {
    localStorage.removeItem(key);
  }
}

function calculateRemainingTime(startTime: number, duration: number): number {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  return Math.max(0, duration - elapsed);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function usePaymentCountdown({
  invoiceToken,
  transactionId,
  enabled,
  onCompleted,
  onFailed,
  onExpired,
  durationSeconds = DEFAULT_COUNTDOWN_DURATION,
}: UsePaymentCountdownOptions): PaymentCountdownState & {
  startCountdown: () => void;
  resetCountdown: () => void;
} {
  const [remainingTime, setRemainingTime] = useState(durationSeconds);
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | "expired">("pending");
  const [counting, setCounting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const inMemoryStartRef = useRef<number | null>(null);

  const storageKey = getStorageKey(invoiceToken, transactionId);

  useEffect(() => {
    if (!storageKey) return;

    const existingStartTime = getStartTime(storageKey);
    if (existingStartTime) {
      const remaining = calculateRemainingTime(existingStartTime, durationSeconds);
      setRemainingTime(remaining);
      if (remaining <= 0) {
        setStatus("expired");
      }
    }
  }, [storageKey, durationSeconds]);

  useEffect(() => {
    if (storageKey && inMemoryStartRef.current && !getStartTime(storageKey)) {
      setStartTime(storageKey, inMemoryStartRef.current);
    }
  }, [storageKey]);

  const startCountdown = useCallback(() => {
    const now = Date.now();
    inMemoryStartRef.current = now;

    if (storageKey) {
      let startTime = getStartTime(storageKey);
      if (!startTime) {
        startTime = now;
        setStartTime(storageKey, startTime);
      }
      inMemoryStartRef.current = startTime;
    }

    setRemainingTime(durationSeconds);
    setStatus("pending");
    setCounting(true);
  }, [storageKey, durationSeconds]);

  const resetCountdown = useCallback(() => {
    if (storageKey) {
      clearStartTime(storageKey);
    }
    inMemoryStartRef.current = null;
    setRemainingTime(durationSeconds);
    setStatus("pending");
    setCounting(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [storageKey, durationSeconds]);

  useEffect(() => {
    if (!counting && !enabled) return;
    if (counting) {
      setCounting(false);
    }

    const getEffectiveStartTime = (): number | null => {
      if (storageKey) {
        const stored = getStartTime(storageKey);
        if (stored) return stored;
      }
      return inMemoryStartRef.current;
    };

    const effectiveStart = getEffectiveStartTime();
    if (!effectiveStart) {
      const now = Date.now();
      inMemoryStartRef.current = now;
      if (storageKey) {
        setStartTime(storageKey, now);
      }
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      const startTime = getEffectiveStartTime() || inMemoryStartRef.current;
      if (!startTime) return;

      const remaining = calculateRemainingTime(startTime, durationSeconds);
      setRemainingTime(remaining);

      if (remaining <= 0 && status === "pending") {
        setStatus("expired");
        onExpired?.();
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
  }, [enabled, counting, storageKey, status, onExpired, durationSeconds]);

  useEffect(() => {
    if (!enabled || (!invoiceToken && !transactionId) || status !== "pending") return;

    const pollPaymentStatus = async () => {
      try {
        const res = await fetch("/api/softpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceToken, transactionId }),
        });
        const data = await res.json();

        if (data.status === "completed" || data.response_code === "00") {
          setStatus("completed");
          clearStartTime(storageKey);
          inMemoryStartRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          onCompleted?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
        } else if (data.status === "failed") {
          setStatus("failed");
          clearStartTime(storageKey);
          inMemoryStartRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          onFailed?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
        }
      } catch (error) {
        console.error("Payment polling error:", error);
      }
    };

    pollPaymentStatus();
    pollRef.current = setInterval(pollPaymentStatus, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [enabled, invoiceToken, transactionId, storageKey, status, onCompleted, onFailed]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return {
    remainingTime,
    isExpired: remainingTime <= 0,
    status,
    formattedTime: formatTime(remainingTime),
    startCountdown,
    resetCountdown,
  };
}
