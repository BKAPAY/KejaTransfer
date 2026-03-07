import { useState, useEffect, useCallback, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export const DEFAULT_COUNTDOWN_DURATION = 10 * 60;
export const CRYPTO_COUNTDOWN_DURATION = 30 * 60;
const POLL_INTERVAL = 3000;

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
  const [active, setActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const statusRef = useRef(status);

  statusRef.current = status;

  const storageKey = getStorageKey(invoiceToken, transactionId);
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);
  const onExpiredRef = useRef(onExpired);
  onCompletedRef.current = onCompleted;
  onFailedRef.current = onFailed;
  onExpiredRef.current = onExpired;

  const durationRef = useRef(durationSeconds);
  durationRef.current = durationSeconds;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Auto-resume: when enabled becomes true and a saved startTime exists in localStorage, restart the countdown
  useEffect(() => {
    if (!enabled) return;
    const key = storageKeyRef.current;
    if (!key) return;
    const existing = getStartTime(key);
    if (existing && !active) {
      startTimeRef.current = existing;
      const elapsed = Math.floor((Date.now() - existing) / 1000);
      const remaining = Math.max(0, durationRef.current - elapsed);
      if (remaining > 0) {
        setRemainingTime(remaining);
        setStatus("pending");
        setActive(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey]);

  const startCountdown = useCallback(() => {
    const key = storageKeyRef.current;
    const duration = durationRef.current;
    let startTime: number;

    if (key) {
      const existing = getStartTime(key);
      if (existing) {
        startTime = existing;
      } else {
        startTime = Date.now();
        setStartTime(key, startTime);
      }
    } else {
      startTime = Date.now();
    }

    startTimeRef.current = startTime;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    setRemainingTime(remaining);
    setStatus("pending");
    setActive(true);
  }, []);

  const resetCountdown = useCallback(() => {
    cleanup();
    const key = storageKeyRef.current;
    if (key) {
      clearStartTime(key);
    }
    startTimeRef.current = null;
    setRemainingTime(durationRef.current);
    setStatus("pending");
    setActive(false);
  }, [cleanup]);

  useEffect(() => {
    if (!active && !enabled) return;
    if (!active) return;

    cleanup();

    timerRef.current = setInterval(() => {
      const startTime = startTimeRef.current;
      if (!startTime) return;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, durationRef.current - elapsed);
      setRemainingTime(remaining);

      if (remaining <= 0 && statusRef.current === "pending") {
        setStatus("expired");
        setActive(false);
        onExpiredRef.current?.();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, enabled, cleanup]);

  useEffect(() => {
    if (!enabled || !active || (!invoiceToken && !transactionId) || statusRef.current !== "pending") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const pollPaymentStatus = async () => {
      if (statusRef.current !== "pending") return;
      try {
        const res = await fetch("/api/softpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceToken, transactionId }),
        });
        const data = await res.json();

        if (data.status === "completed" || data.response_code === "00") {
          setStatus("completed");
          setActive(false);
          if (storageKey) clearStartTime(storageKey);
          startTimeRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          onCompletedRef.current?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (data.status === "failed") {
          setStatus("failed");
          setActive(false);
          if (storageKey) clearStartTime(storageKey);
          startTimeRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          onFailedRef.current?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
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
        pollRef.current = null;
      }
    };
  }, [enabled, active, invoiceToken, transactionId, storageKey]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    remainingTime,
    isExpired: remainingTime <= 0,
    status,
    formattedTime: formatTime(remainingTime),
    startCountdown,
    resetCountdown,
  };
}
