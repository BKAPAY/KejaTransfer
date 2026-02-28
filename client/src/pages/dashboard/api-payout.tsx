import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Eye, EyeOff, Send, Lock, ExternalLink, AlertTriangle, CheckCircle, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ApiKey, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { CURRENT_VERSION } from "@/lib/doc-versions";

export default function ApiPayoutPage() {
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";

  const firstKey = apiKeys && apiKeys.length > 0 ? apiKeys[0] : null;
  const secretKey = firstKey?.secretKey ?? null;
  const maskedKey = secretKey
    ? secretKey.slice(0, 10) + "••••••••••••••••••••••••" + secretKey.slice(-4)
    : null;

  const copyKey = () => {
    if (secretKey) {
      navigator.clipboard.writeText(secretKey);
      toast({ title: "Cle privee copiee !", description: "Ne partagez jamais cette cle." });
    }
  };

  const codeExample = secretKey
    ? `fetch("${baseUrl}/api/v1/payout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${secretKey}"
  },
  body: JSON.stringify({
    phone: "+221771234567",
    operator: "orange",
    country: "SN",
    amount: 10000,
    currency: "XOF"
  })
})`
    : `fetch("${baseUrl}/api/v1/payout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_live_VOTRE_CLE_PRIVEE"
  },
  body: JSON.stringify({
    phone: "+221771234567",
    operator: "orange",
    country: "SN",
    amount: 10000,
    currency: "XOF"
  })
})`;

  const isActivated = user?.payoutApiEnabled === true;
  const hasApiKey = !isLoading && firstKey !== null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-payout-api-title">
            API Payout
          </h1>
          {isActivated ? (
            <Badge variant="default" className="text-xs gap-1">
              <CheckCircle className="w-3 h-3" /> Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs gap-1">
              <Lock className="w-3 h-3" /> Non activee
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Envoyez de l'argent directement sur des numeros mobile money via API depuis votre serveur.
        </p>
      </div>

      {/* Statut d'activation */}
      {!isActivated ? (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            <strong>Activation requise.</strong> L'API Payout n'est pas encore activee sur votre compte.
            Contactez le support BKApay pour en faire la demande. Une fois activee, vous pourrez utiliser
            votre cle privee pour initier des paiements sortants.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
            <strong>API Payout activee.</strong> Vous pouvez utiliser votre cle privee pour envoyer des paiements
            mobiles money directement depuis votre application.
          </AlertDescription>
        </Alert>
      )}

      {/* Pas de cle API */}
      {!isLoading && !hasApiKey && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive text-sm">
            Vous n'avez pas encore de cle API. Rendez-vous dans{" "}
            <Link href="/dashboard/api" className="underline font-medium">API Payin</Link>{" "}
            pour creer votre premiere cle.
          </AlertDescription>
        </Alert>
      )}

      {/* Cle privee */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Votre cle privee (secret key)
          </CardTitle>
          <CardDescription>
            Utilisez cette cle dans le header <code className="font-mono text-xs bg-muted px-1 rounded">Authorization: Bearer ...</code> de vos requetes API Payout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          ) : hasApiKey ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-sm break-all">
                  {showKey ? secretKey : maskedKey}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowKey(!showKey)}
                  data-testid="button-toggle-key-visibility"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={copyKey}
                  data-testid="button-copy-payout-key"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertDescription className="text-destructive text-xs">
                  Ne partagez jamais votre cle privee. Ne la mettez pas dans votre code frontend.
                  En cas de compromission, regenerez-la depuis la page <Link href="/dashboard/api" className="underline">API Payin</Link>.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune cle API disponible.</p>
          )}
        </CardContent>
      </Card>

      {/* Endpoint */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="w-4 h-4" />
            Endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center gap-3 flex-wrap">
            <Badge variant="default" className="text-xs shrink-0">POST</Badge>
            <span className="break-all">{baseUrl}/api/v1/payout</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 font-semibold border border-border">Parametre</th>
                  <th className="text-left p-2 font-semibold border border-border">Type</th>
                  <th className="text-left p-2 font-semibold border border-border">Requis</th>
                  <th className="text-left p-2 font-semibold border border-border">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["phone", "string", true, "Numero destinataire avec indicatif (+221771234567)"],
                  ["operator", "string", true, "Operateur: orange, mtn, moov, wave, free, airtel..."],
                  ["country", "string", true, "Code ISO du pays: SN, CI, BF, BJ, TG, ML, GN, CD..."],
                  ["amount", "number", true, "Montant brut a envoyer"],
                  ["currency", "string", false, "Devise: XOF, XAF, CDF, GNF. Defaut: devise du pays"],
                  ["reference", "string", false, "Votre reference interne (optionnel)"],
                ].map(([param, type, req, desc]) => (
                  <tr key={String(param)} className="border-b border-border">
                    <td className="p-2 border border-border font-mono">{param}</td>
                    <td className="p-2 border border-border text-muted-foreground">{type}</td>
                    <td className="p-2 border border-border">
                      <Badge variant={req ? "default" : "secondary"} className="text-xs">{req ? "Oui" : "Non"}</Badge>
                    </td>
                    <td className="p-2 border border-border text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Exemple de code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exemple d'appel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 z-10 gap-1"
              onClick={() => {
                navigator.clipboard.writeText(codeExample);
                toast({ title: "Code copie !" });
              }}
              data-testid="button-copy-code-example"
            >
              <Copy className="w-3 h-3" /> Copier
            </Button>
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto whitespace-pre-wrap pt-8">{codeExample}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            En cas de succes, vous recevez <code className="font-mono bg-muted px-1 rounded">{"{ success: true, transactionId: \"...\", status: \"pending\" }"}</code>
          </p>
        </CardContent>
      </Card>

      {/* Lien documentation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-medium text-foreground">Documentation complete</p>
            <p className="text-sm text-muted-foreground">
              Codes d'erreur, webhooks, exemples PHP et Python, bonnes pratiques.
            </p>
          </div>
          <Link href={`/dashboard/documentation/payout/${CURRENT_VERSION}`}>
            <Button className="gap-2" data-testid="button-go-payout-docs">
              <ExternalLink className="w-4 h-4" />
              Voir la documentation
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
