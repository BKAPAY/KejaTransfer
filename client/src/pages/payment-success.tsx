import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentSuccess() {
  const [location] = useLocation();
  const [status, setStatus] = useState<"success" | "pending" | "checking">("checking");
  const [redirecting, setRedirecting] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const successUrl = params.get("redirect");
  const transactionId = params.get("transactionId") || params.get("txId");

  useEffect(() => {
    if (successUrl) {
      setRedirecting(true);
      const redirectTarget = successUrl + (successUrl.includes("?") ? "&" : "?") +
        "status=success" + (transactionId ? `&transactionId=${transactionId}` : "");
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 2000);
      return;
    }

    if (transactionId) {
      let attempts = 0;
      const poll = async () => {
        try {
          const res = await fetch(`/api/inline-pay/status/${transactionId}`);
          const data = await res.json();
          if (data.status === "completed") {
            setStatus("success");
            return;
          }
        } catch {}
        attempts++;
        if (attempts < 12) setTimeout(poll, 3000);
        else setStatus("pending");
      };
      poll();
    } else {
      setStatus("success");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5 text-center">
          {redirecting ? (
            <>
              <Loader2 className="w-14 h-14 text-primary animate-spin" />
              <div>
                <h1 className="text-xl font-semibold">Paiement confirme</h1>
                <p className="text-sm text-muted-foreground mt-1">Redirection vers le site marchand...</p>
              </div>
            </>
          ) : status === "checking" ? (
            <>
              <Loader2 className="w-14 h-14 text-primary animate-spin" />
              <div>
                <h1 className="text-xl font-semibold">Verification du paiement</h1>
                <p className="text-sm text-muted-foreground mt-1">Veuillez patienter quelques instants...</p>
              </div>
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle className="w-14 h-14 text-green-500" />
              <div>
                <h1 className="text-xl font-semibold">Paiement reussi !</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Votre paiement a ete effectue avec succes.
                  Le marchand a ete notifie automatiquement.
                </p>
              </div>
              <Button variant="outline" onClick={() => window.history.back()}>
                Retour
              </Button>
            </>
          ) : (
            <>
              <Clock className="w-14 h-14 text-orange-400" />
              <div>
                <h1 className="text-xl font-semibold">Paiement en cours</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Votre paiement est en cours de traitement.
                  Vous recevrez une confirmation sous peu.
                </p>
              </div>
              <Button variant="outline" onClick={() => window.history.back()}>
                Retour
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
