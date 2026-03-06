import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft, Copy, Code, Globe, AlertTriangle, CheckCircle, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  DOC_VERSIONS,
  getDocVersion,
  getLatestVersion,
  type DocVersion
} from "@/lib/doc-versions";

interface DocumentationSessionsProps {
  version: string;
}

function VersionSelector({ currentVersion, basePath }: { currentVersion: string; basePath: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Version :</span>
      {DOC_VERSIONS.map((v) => (
        <Button
          key={v.version}
          size="sm"
          variant={v.version === currentVersion ? "default" : "outline"}
          onClick={() => setLocation(`${basePath}/sessions/${v.version}`)}
          data-testid={`button-version-${v.version}`}
        >
          {v.version}
          {v.isLatest && <Badge variant="secondary" className="ml-1 text-xs">Actuelle</Badge>}
        </Button>
      ))}
    </div>
  );
}

export default function DocumentationSessions({ version }: DocumentationSessionsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"js" | "php" | "python">("js");

  const location = typeof window !== "undefined" ? window.location.pathname : "";
  const basePath = location.startsWith("/dashboard") ? "/dashboard/documentation" : "/documentation";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";

  const docVersion = getDocVersion(version);
  const latestVersion = getLatestVersion();

  if (!docVersion) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
        <Alert className="border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Version introuvable</AlertTitle>
          <AlertDescription>La version {version} n'existe pas.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copie !", description: "Le code a ete copie dans le presse-papier." });
  };

  const createSessionJs = `// 1. Creer la session depuis votre serveur
const response = await fetch("${baseUrl}/api/v1/payment-sessions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_live_VOTRE_CLE_SECRETE"
  },
  body: JSON.stringify({
    amount: 5000,                                    // Montant en XOF (verrouille)
    currency: "XOF",                                 // Devise (optionnel)
    description: "Commande #1042 - T-shirt XL",     // Description affichee au client
    success_url: "https://votresite.com/merci",      // Redirection apres succes
    cancel_url: "https://votresite.com/annule",      // Redirection si annulation
    callback_url: "https://votresite.com/webhook",   // Notification POST (optionnel)
    order_id: "CMD-1042",                            // Votre reference interne (optionnel)
    expires_in: 30                                   // Expiration en minutes (optionnel)
  })
});

const data = await response.json();
// data.payment_url = "/checkout/sess_abc123..."
// Redirigez votre client vers cette URL
window.location.href = data.payment_url;`;

  const createSessionPhp = `<?php
// 1. Creer la session depuis votre serveur
$ch = curl_init("${baseUrl}/api/v1/payment-sessions");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "Authorization: Bearer sk_live_VOTRE_CLE_SECRETE"
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "amount" => 5000,
    "currency" => "XOF",
    "description" => "Commande #1042 - T-shirt XL",
    "success_url" => "https://votresite.com/merci",
    "cancel_url" => "https://votresite.com/annule",
    "callback_url" => "https://votresite.com/webhook",
    "order_id" => "CMD-1042",
    "expires_in" => 30
  ])
]);

$data = json_decode(curl_exec($ch), true);
// Redirigez le client
header("Location: " . $data["payment_url"]);
exit;`;

  const createSessionPython = `import requests

# 1. Creer la session depuis votre serveur
response = requests.post(
    "${baseUrl}/api/v1/payment-sessions",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer sk_live_VOTRE_CLE_SECRETE"
    },
    json={
        "amount": 5000,
        "currency": "XOF",
        "description": "Commande #1042 - T-shirt XL",
        "success_url": "https://votresite.com/merci",
        "cancel_url": "https://votresite.com/annule",
        "callback_url": "https://votresite.com/webhook",
        "order_id": "CMD-1042",
        "expires_in": 30
    }
)

data = response.json()
# Redirigez le client vers data["payment_url"]
print("URL de paiement:", data["payment_url"])`;

  const statusCheckJs = `// 2. Verifier le statut d'une session (depuis votre serveur)
const response = await fetch(
  "${baseUrl}/api/v1/payment-sessions/VOTRE_SESSION_ID/status",
  {
    headers: {
      "Authorization": "Bearer sk_live_VOTRE_CLE_SECRETE"
    }
  }
);

const data = await response.json();
// data.status = "pending" | "completed" | "failed" | "expired"
// data.transactionId = identifiant de la transaction (si payee)
console.log("Statut :", data.status);`;

  const webhookExample = `// Webhook BKApay Sessions — Node.js / Express
const crypto = require("crypto");

app.post("/webhook/bkapay", express.raw({ type: "application/json" }), (req, res) => {
  // Verifier la signature HMAC-SHA256
  const signature = req.headers["x-bkapay-signature"];
  const secret = process.env.BKAPAY_WEBHOOK_SECRET;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  if (hash !== signature) {
    return res.status(401).send("Signature invalide");
  }

  const event = JSON.parse(req.body);
  // event.type = "payment.completed" | "payment.failed"
  // event.data.order_id = votre reference interne
  // event.data.amount = montant paye
  // event.data.transactionId = identifiant BKApay

  if (event.type === "payment.completed") {
    activerCommande(event.data.order_id);
  }

  res.json({ received: true });
});`;

  const codeMap = {
    js: createSessionJs,
    php: createSessionPhp,
    python: createSessionPython
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`${basePath}/${docVersion.version}`)}
          className="gap-2"
          data-testid="button-back-to-docs"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      </div>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-doc-title">
              Sessions de Paiement Securisees
            </h1>
          </div>
          <Badge variant="secondary" className="w-fit" data-testid="badge-current-version">
            {docVersion.version}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Creez des sessions de paiement depuis votre serveur. Le montant est verrouille cote serveur — 
          le client ne peut pas le modifier. Methode la plus securisee pour les paiements e-commerce.
        </p>
        <VersionSelector currentVersion={docVersion.version} basePath={basePath} />
      </div>

      {docVersion.isDeprecated && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">Version obsolete</AlertTitle>
          <AlertDescription>
            Cette version est obsolete. Consultez la{" "}
            <button
              className="underline font-medium"
              onClick={() => setLocation(`${basePath}/sessions/${latestVersion.version}`)}
            >
              version {latestVersion.version}
            </button>.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-emerald-500/50 bg-emerald-500/10">
        <Lock className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-700 dark:text-emerald-400">Pourquoi les sessions ?</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p>Avec le lien redirect classique, le montant est dans l'URL et un utilisateur peut le modifier.</p>
          <p className="font-medium">Avec les sessions, le montant est cree sur votre serveur et verrouille. Impossible a falsifier.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-md p-3 font-mono text-sm space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-600 text-white text-xs">POST</Badge>
              <span className="break-all">{baseUrl}/api/v1/payment-sessions</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">GET</Badge>
              <span className="break-all">{baseUrl}/api/v1/payment-sessions/:id/status</span>
            </div>
          </div>
          <div className="bg-muted/50 rounded-md p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Authentification</p>
            <p className="text-sm font-mono">Authorization: Bearer sk_live_VOTRE_CLE_SECRETE</p>
            <p className="text-xs text-muted-foreground mt-1">
              Recuperez votre cle secrete dans le tableau de bord sous "Cles API".
              Ne partagez jamais cette cle — elle est reservee a votre serveur.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Flux d'integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {[
              {
                step: "1",
                title: "Votre serveur cree la session",
                desc: "Appelez POST /api/v1/payment-sessions avec le montant, la description et les URLs de retour. Vous recevez un payment_url."
              },
              {
                step: "2",
                title: "Redirigez le client vers payment_url",
                desc: "Redirigez votre client vers l'URL recue. Il arrive sur la page de paiement BKApay avec le montant deja fixe."
              },
              {
                step: "3",
                title: "Le client paie via mobile money",
                desc: "Il entre son numero, choisit son operateur et confirme l'OTP sur son telephone."
              },
              {
                step: "4",
                title: "Redirection automatique",
                desc: "Apres paiement, BKApay redirige le client vers votre success_url. En cas d'annulation, vers cancel_url."
              },
              {
                step: "5",
                title: "Confirmation par webhook (recommande)",
                desc: "Votre callback_url recoit une notification POST signee confirment le paiement — ne comptez pas uniquement sur la redirection."
              }
            ].map((item) => (
              <li key={item.step} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-emerald-600">{item.step}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Creer une session — Exemples de code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["js", "php", "python"] as const).map((lang) => (
              <Button
                key={lang}
                size="sm"
                variant={activeTab === lang ? "default" : "outline"}
                onClick={() => setActiveTab(lang)}
                data-testid={`button-tab-${lang}`}
              >
                {lang === "js" ? "JavaScript" : lang === "php" ? "PHP" : "Python"}
              </Button>
            ))}
          </div>
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words">
              {codeMap[activeTab]}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={() => copyCode(codeMap[activeTab])}
              data-testid="button-copy-create-session"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Parametres de la requete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { param: "amount", type: "number", required: true, desc: "Montant en XOF. Sera verrouille — le client ne peut pas le changer." },
              { param: "description", type: "string", required: true, desc: "Description affichee sur la page de paiement (ex: Commande #1042)." },
              { param: "success_url", type: "string", required: true, desc: "URL de redirection apres paiement reussi." },
              { param: "cancel_url", type: "string", required: false, desc: "URL de redirection si le client abandonne." },
              { param: "callback_url", type: "string", required: false, desc: "URL de notification webhook POST (fortement recommande)." },
              { param: "order_id", type: "string", required: false, desc: "Votre reference de commande interne, incluse dans le webhook." },
              { param: "currency", type: "string", required: false, desc: "Devise. Defaut : XOF." },
              { param: "expires_in", type: "number", required: false, desc: "Duree de validite de la session en minutes. Defaut : 60." },
            ].map(({ param, type, required, desc }) => (
              <div key={param} className="flex gap-3 items-start py-2 border-b last:border-0">
                <div className="min-w-[140px]">
                  <span className="font-mono text-sm font-semibold">{param}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-xs">{type}</Badge>
                    {required && <Badge className="text-xs bg-rose-600 text-white">requis</Badge>}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Reponse de creation de session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto">{`{
  "success": true,
  "session_id": "sess_abc123def456",
  "payment_url": "${baseUrl}/checkout/sess_abc123def456",
  "expires_at": "2026-03-06T15:30:00.000Z",
  "amount": 5000,
  "currency": "XOF"
}`}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Verifier le statut d'une session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous pouvez interroger le statut d'une session a tout moment depuis votre serveur, avec votre cle secrete.
          </p>
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words">
              {statusCheckJs}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={() => copyCode(statusCheckJs)}
              data-testid="button-copy-status"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="bg-muted/50 rounded-md p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valeurs de statut</p>
            {[
              { val: "pending", color: "bg-amber-500", desc: "En attente — le client n'a pas encore paye." },
              { val: "completed", color: "bg-emerald-600", desc: "Paiement reussi et confirme." },
              { val: "failed", color: "bg-rose-600", desc: "Paiement echoue." },
              { val: "expired", color: "bg-muted-foreground", desc: "Session expiree (delai depasse)." },
            ].map(({ val, color, desc }) => (
              <div key={val} className="flex items-center gap-2 text-sm">
                <Badge className={`text-white text-xs ${color}`}>{val}</Badge>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Webhook de confirmation (recommande)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Important</AlertTitle>
            <AlertDescription className="text-sm">
              Ne comptez pas uniquement sur la redirection success_url pour confirmer un paiement.
              L'utilisateur peut fermer la page avant d'etre redirige. Utilisez toujours le webhook.
            </AlertDescription>
          </Alert>
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words">
              {webhookExample}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={() => copyCode(webhookExample)}
              data-testid="button-copy-webhook"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center py-8 border-t">
        <p className="text-sm text-muted-foreground">
          Documentation Sessions BKApay — Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour : {docVersion.releaseDate}
        </p>
      </div>
    </div>
  );
}
