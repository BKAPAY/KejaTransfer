import { useState, useEffect, useCallback, useRef } from "react";

const COUNTDOWN_DURATION = 5 * 60; // 5 minutes in seconds
const POLL_INTERVAL = 1000; // 1 second

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

function calculateRemainingTime(startTime: number): number {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  return Math.max(0, COUNTDOWN_DURATION - elapsed);
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
}: UsePaymentCountdownOptions): PaymentCountdownState & {
  startCountdown: () => void;
  resetCountdown: () => void;
} {
  const [remainingTime, setRemainingTime] = useState(COUNTDOWN_DURATION);
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | "expired">("pending");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const storageKey = getStorageKey(invoiceToken, transactionId);

  const startCountdown = useCallback(() => {
    if (!storageKey) return;

    let startTime = getStartTime(storageKey);
    if (!startTime) {
      startTime = Date.now();
      setStartTime(storageKey, startTime);
    }

    const remaining = calculateRemainingTime(startTime);
    setRemainingTime(remaining);

    if (remaining <= 0) {
      setStatus("expired");
      onExpired?.();
    }
  }, [storageKey, onExpired]);

  const resetCountdown = useCallback(() => {
    if (storageKey) {
      clearStartTime(storageKey);
    }
    setRemainingTime(COUNTDOWN_DURATION);
    setStatus("pending");
  }, [storageKey]);

  // Countdown timer
  useEffect(() => {
    if (!enabled || !storageKey) return;

    const startTime = getStartTime(storageKey);
    if (!startTime) {
      setStartTime(storageKey, Date.now());
    }

    timerRef.current = setInterval(() => {
      const storedStartTime = getStartTime(storageKey);
      if (!storedStartTime) return;

      const remaining = calculateRemainingTime(storedStartTime);
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
  }, [enabled, storageKey, status, onExpired]);

  // Payment status polling
  useEffect(() => {
    if (!enabled || !invoiceToken || status !== "pending") return;

    const pollPaymentStatus = async () => {
      try {
        const res = await fetch("/api/softpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceToken }),
        });
        const data = await res.json();

        if (data.status === "completed" || data.response_code === "00") {
          setStatus("completed");
          clearStartTime(storageKey);
          onCompleted?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
        } else if (data.status === "failed") {
          setStatus("failed");
          clearStartTime(storageKey);
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
  }, [enabled, invoiceToken, storageKey, status, onCompleted, onFailed]);

  // Cleanup on unmount when not in polling mode
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
