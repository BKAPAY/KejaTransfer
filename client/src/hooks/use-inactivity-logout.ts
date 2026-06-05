import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const INACTIVE_TIMEOUT = 2 * 60 * 60 * 1000; // 2 heures d'inactivité
const WARNING_BEFORE = 5 * 60 * 1000;         // Avertissement 5 min avant déconnexion
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useInactivityLogout(isAuthenticated: boolean) {
  const { toast } = useToast();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const doLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    queryClient.clear();
    window.location.href = "/login";
  }, []);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    warningTimerRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        toast({
          title: "Session inactive",
          description: "Vous serez déconnecté dans 5 minutes en raison d'inactivité.",
          variant: "destructive",
          duration: 10000,
        });
      }
    }, INACTIVE_TIMEOUT - WARNING_BEFORE);

    timerRef.current = setTimeout(() => {
      doLogout();
    }, INACTIVE_TIMEOUT);
  }, [doLogout, toast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    resetTimers();

    const handleActivity = () => resetTimers();
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= INACTIVE_TIMEOUT) {
          doLogout();
          return;
        }
        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          if (res.status === 401) {
            queryClient.clear();
            window.location.href = "/login";
          }
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, resetTimers, doLogout]);
}
