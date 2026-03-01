import { useEffect } from "react";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentFailed() {
  const params = new URLSearchParams(window.location.search);
  const cancelUrl = params.get("redirect");
  const transactionId = params.get("transactionId") || params.get("txId");

  useEffect(() => {
    if (cancelUrl) {
      const redirectTarget = cancelUrl + (cancelUrl.includes("?") ? "&" : "?") +
        "status=failed" + (transactionId ? `&transactionId=${transactionId}` : "");
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 2000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5 text-center">
          {cancelUrl ? (
            <>
              <Loader2 className="w-14 h-14 text-primary animate-spin" />
              <div>
                <h1 className="text-xl font-semibold">Paiement annule</h1>
                <p className="text-sm text-muted-foreground mt-1">Redirection vers le site marchand...</p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-14 h-14 text-destructive" />
              <div>
                <h1 className="text-xl font-semibold">Paiement echoue</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Votre paiement n'a pas pu etre traite.
                  Veuillez reessayer ou contacter le marchand.
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
