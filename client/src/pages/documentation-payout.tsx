import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, ArrowLeft, Globe, Webhook, AlertTriangle, Copy, Code } from "lucide-react";
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

interface DocumentationPayoutProps {
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
          onClick={() => setLocation(`${basePath}/payout/${v.version}`)}
          data-testid={`button-version-${v.version}`}
        >
          {v.version}
          {v.isLatest && <Badge variant="secondary" className="ml-1 text-xs">Actuelle</Badge>}
        </Button>
      ))}
    </div>
  );
}

export default function DocumentationPayout({ version }: DocumentationPayoutProps) {
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

  const jsExample = `const response = await fetch("${baseUrl}/api/v1/payout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_live_VOTRE_CLE_PRIVEE"
  },
  body: JSON.stringify({
    phone: "+221771234567",   // Numero avec indicatif international
    operator: "orange",        // Nom de l'operateur
    country: "SN",             // Code ISO du pays (2 lettres)
    amount: 10000,             // Montant EXACT que le destinataire recoit
    currency: "XOF",           // Devise (optionnel, defaut: devise du pays)
    reference: "order_789"     // Votre reference interne (optionnel)
  })
});

const data = await response.json();

if (data.success) {
  // data.recipientAmount = 10000 (recoit exactement ce montant)
  console.log("Payout initie:", data.transactionId, data.status);
  console.log("Destinataire recoit: " + data.recipientAmount + " " + data.currency);
} else {
  console.error("Erreur:", data.error.code, data.error.message);
}`;

  const phpExample = `<?php
$ch = curl_init("${baseUrl}/api/v1/payout");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        "Content-Type: application/json",
        "Authorization: Bearer sk_live_VOTRE_CLE_PRIVEE"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "phone"     => "+221771234567",
        "operator"  => "orange",
        "country"   => "SN",
        "amount"    => 10000,
        "currency"  => "XOF",
        "reference" => "order_789"
    ])
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response["success"]) {
    $transactionId = $response["transactionId"];
    $status = $response["status"];
    // Sauvegarder $transactionId dans votre base de donnees
} else {
    $errorCode = $response["error"]["code"];
    $errorMsg  = $response["error"]["message"];
}
?>`;

  const pythonExample = `import requests

response = requests.post(
    "${baseUrl}/api/v1/payout",
    headers={
        "Authorization": "Bearer sk_live_VOTRE_CLE_PRIVEE",
        "Content-Type": "application/json"
    },
    json={
        "phone": "+221771234567",
        "operator": "orange",
        "country": "SN",
        "amount": 10000,
        "currency": "XOF",
        "reference": "order_789"
    }
)
data = response.json()

if data["success"]:
    transaction_id = data["transactionId"]
    status = data["status"]
else:
    error_code = data["error"]["code"]
    error_msg  = data["error"]["message"]`;

  const webhookHandlerExample = `// Webhook BKApay — Node.js / Express
// Cette meme URL gere a la fois les evenements payin (payment.X) et payout (payout.X)
const crypto = require('crypto');

// IMPORTANT : utilisez express.raw() pour lire le corps brut avant parsing
// La signature est calculee sur le corps JSON brut (pas le corps re-serialise)
app.post('/api/webhook/bkapay', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString('utf8');
  const payload = JSON.parse(rawBody);
  const signature = req.headers['x-bkapay-signature'];

  // Choisir le bon secret selon le type d'evenement
  const isPayin = payload.event.startsWith('payment.');
  const secret = isPayin
    ? process.env.BKAPAY_CALLBACK_SECRET        // Secret webhook payin
    : process.env.BKAPAY_PAYOUT_CALLBACK_SECRET; // Secret webhook payout

  if (!signature || !secret) {
    return res.status(401).json({ error: 'Signature manquante' });
  }

  // Verifier la signature HMAC-SHA256 sur le corps BRUT
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSig) {
    return res.status(401).json({ error: 'Signature invalide' });
  }

  const { event, transactionId, reference } = payload;

  // Traiter selon le type d'evenement
  if (event === 'payout.completed') {
    updatePayoutStatus(reference, 'paid');       // Payout reussi
  } else if (event === 'payout.failed') {
    notifyFailure(transactionId, reference);     // Payout echoue
  } else if (event === 'payment.completed') {
    activateOrder(reference);                    // Paiement entrant reussi
  } else if (event === 'payment.failed') {
    cancelOrder(reference);                      // Paiement entrant echoue
  }

  // Repondre 200 rapidement pour confirmer la reception
  // BKApay retente toutes les 5s pendant 10 min si pas de 2xx
  res.json({ received: true });
});`;

  const successResponseExample = `{
  "success": true,
  "transactionId": "txn_abc123def456",
  "status": "pending",
  "message": "Payout initie avec succes",
  "recipientAmount": 10000,
  "currency": "XOF"
}`;

  const errorResponseExample = `{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Solde insuffisant sur votre compte"
  }
}`;

  const webhookPayloadExample = `{
  "event": "payout.completed",
  "transactionId": "txn_abc123def456",
  "reference": "order_789",
  "recipientAmount": 10000,
  "currency": "XOF",
  "status": "completed",
  "country": "SN",
  "operator": "orange",
  "recipientPhone": "+221771234567",
  "timestamp": "2024-01-15T10:30:00.000Z"
}`;

  const codeExamples = { js: jsExample, php: phpExample, python: pythonExample };
  const tabLabels = { js: "JavaScript", php: "PHP", python: "Python" };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 mb-4"
          onClick={() => setLocation(`${basePath}/${docVersion.version}`)}
          data-testid="button-back-docs"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-doc-title">
              API Payout
            </h1>
            <Badge variant="secondary" className="text-sm">{docVersion.version}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Envoyez de l'argent directement depuis votre solde BKApay vers n'importe quel numero mobile money via une simple requete API.
        </p>
        <VersionSelector currentVersion={docVersion.version} basePath={basePath} />
      </div>

      {docVersion.isDeprecated && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Version obsolete</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            Cette version ({docVersion.version}) est obsolete. Nous recommandons d'utiliser la version {latestVersion.version} pour beneficier
            des dernieres fonctionnalites et corrections de securite.
          </AlertDescription>
        </Alert>
      )}

      {/* Prerequis */}
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
          <strong>Activation requise :</strong> L'API Payout doit etre activee sur votre compte par l'administrateur. Contactez le support BKApay pour en faire la demande. Vous devez egalement avoir un solde suffisant avant d'initier des payouts.
        </AlertDescription>
      </Alert>

      {/* Vue d'ensemble */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Comment ca marche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'API Payout vous permet d'envoyer de l'argent a n'importe quel numero mobile money sans passer par l'interface BKApay.
            C'est ideal pour les plateformes de remuneration, les marketplaces, ou tout systeme d'envoi automatise de fonds.
          </p>
          <div className="space-y-3">
            {[
              { step: "1", title: "Votre serveur envoie une requete", desc: "Vous appelez POST /api/v1/payout avec les details du destinataire, le montant, et votre cle privee." },
              { step: "2", title: "BKApay valide et debite", desc: "BKApay verifie votre cle, votre solde, et les informations du destinataire. Si tout est correct, le montant est debite de votre compte." },
              { step: "3", title: "Transfert vers le mobile money", desc: "BKApay envoie automatiquement les fonds vers le numero mobile money via le fournisseur disponible dans le pays." },
              { step: "4", title: "Confirmation par webhook", desc: "Une fois le transfert traite, BKApay envoie un webhook a votre URL de callback avec le statut final." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{step}</div>
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Authentification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="w-4 h-4" />
            Authentification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Utilisez votre <strong>cle privee</strong> (sk_live_...) dans le header <code className="font-mono bg-muted px-1 rounded">Authorization</code>.
            Retrouvez votre cle dans la section <strong>API</strong> de votre tableau de bord.
          </p>
          <div className="bg-muted rounded-md p-3 font-mono text-xs flex items-center justify-between gap-2">
            <span>Authorization: Bearer sk_live_VOTRE_CLE_PRIVEE</span>
            <Button size="sm" variant="ghost" onClick={() => copyCode("Authorization: Bearer sk_live_VOTRE_CLE_PRIVEE")} data-testid="button-copy-auth">
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Alert className="border-destructive/30 bg-destructive/5">
            <AlertDescription className="text-destructive text-xs">
              Ne partagez jamais votre cle privee. Conservez-la uniquement cote serveur. En cas de compromission, regenerez-la immediatement depuis votre tableau de bord.
            </AlertDescription>
          </Alert>
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

          <h4 className="font-semibold mt-4 mb-2">Parametres du body (JSON)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
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
                  ["phone", "string", true, "Numero du destinataire avec indicatif (+221771234567)"],
                  ["operator", "string", true, "Operateur mobile: orange, mtn, moov, wave, free, airtel..."],
                  ["country", "string", true, "Code ISO 2 lettres du pays: SN, CI, BF, BJ, TG, ML, GN..."],
                  ["amount", "number", true, "Montant exact que le destinataire recoit (minimum: 500)"],
                  ["currency", "string", false, "Devise: XOF, XAF, CDF, GNF. Defaut: devise du pays"],
                  ["reference", "string", false, "Votre reference interne (order_id, facture_123, etc.)"],
                ].map(([param, type, req, desc]) => (
                  <tr key={String(param)} className="border-b border-border">
                    <td className="p-2 border border-border font-mono text-xs">{param}</td>
                    <td className="p-2 border border-border text-muted-foreground text-xs">{type}</td>
                    <td className="p-2 border border-border">
                      <Badge variant={req ? "default" : "secondary"} className="text-xs">{req ? "Oui" : "Non"}</Badge>
                    </td>
                    <td className="p-2 border border-border text-muted-foreground text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/50 rounded-md p-3 text-xs space-y-2 mt-2">
            <p className="font-semibold text-foreground">Format du numero de telephone</p>
            <p className="text-muted-foreground">Envoyez toujours le numero complet avec indicatif international.</p>
            <div className="font-mono space-y-1 mt-1">
              <div><span className="text-green-600">+221771234567</span> <span className="text-muted-foreground">→ Senegal (SN), operateur Orange</span></div>
              <div><span className="text-green-600">+22507000000</span> <span className="text-muted-foreground">→ Cote d'Ivoire (CI), operateur MTN</span></div>
              <div><span className="text-green-600">+22670000000</span> <span className="text-muted-foreground">→ Burkina Faso (BF), operateur Orange</span></div>
              <div><span className="text-green-600">+22960000000</span> <span className="text-muted-foreground">→ Benin (BJ), operateur MTN</span></div>
              <div><span className="text-green-600">+243812345678</span> <span className="text-muted-foreground">→ Congo RDC (CD)</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemples de code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="w-4 h-4" />
            Exemples d'integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["js", "php", "python"] as const).map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => setActiveTab(tab)}
                data-testid={`button-tab-${tab}`}
              >
                {tabLabels[tab]}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 z-10 gap-1"
              onClick={() => copyCode(codeExamples[activeTab])}
              data-testid="button-copy-example"
            >
              <Copy className="w-3 h-3" /> Copier
            </Button>
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto whitespace-pre-wrap pt-8">
              {codeExamples[activeTab]}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Reponses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4" />
            Reponses de l'API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="text-xs">200</Badge>
              <span className="font-medium">Succes — Payout initie</span>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{successResponseExample}</pre>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="destructive" className="text-xs">4xx / 5xx</Badge>
              <span className="font-medium">Erreur</span>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{errorResponseExample}</pre>
          </div>

          <h4 className="font-semibold mt-2">Codes d'erreur</h4>
          <div className="space-y-2">
            {[
              { code: "INVALID_API_KEY", http: "401", desc: "Cle API invalide ou manquante" },
              { code: "ACCOUNT_SUSPENDED", http: "403", desc: "Compte suspendu — contacter le support" },
              { code: "ACCOUNT_NOT_VERIFIED", http: "403", desc: "KYC non verifie — completez la verification" },
              { code: "PAYOUT_NOT_ACTIVATED", http: "403", desc: "API Payout non activee — contacter le support" },
              { code: "INSUFFICIENT_FUNDS", http: "400", desc: "Solde insuffisant sur votre compte" },
              { code: "COUNTRY_UNAVAILABLE", http: "400", desc: "Pays non supporte pour le payout" },
              { code: "OPERATOR_UNAVAILABLE", http: "400", desc: "Operateur non disponible dans ce pays" },
              { code: "INVALID_PHONE", http: "400", desc: "Numero de telephone invalide ou manquant" },
              { code: "INVALID_PARAMETERS", http: "400", desc: "Parametres manquants ou incorrects" },
              { code: "AMOUNT_TOO_LOW", http: "400", desc: "Montant inferieur au minimum requis (500 dans la devise demandee)" },
              { code: "TRANSACTION_FAILED", http: "400", desc: "Echec cote fournisseur — reessayer" },
              { code: "INTERNAL_ERROR", http: "500", desc: "Erreur interne — reessayer plus tard" },
            ].map(({ code, http, desc }) => (
              <div key={code} className="flex items-start gap-3 text-xs border border-border rounded-md p-2">
                <Badge variant="outline" className="font-mono shrink-0">{http}</Badge>
                <code className="font-mono text-destructive shrink-0 mt-0.5">{code}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="w-4 h-4" />
            Webhooks de statut
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Configurez une URL de callback dans la section API de votre tableau de bord. BKApay vous enverra automatiquement le statut final du payout via un webhook signe.
          </p>

          <div className="space-y-2">
            <h4 className="font-semibold">Evenements disponibles</h4>
            {[
              { event: "payout.completed", desc: "Le payout a ete execute avec succes" },
              { event: "payout.failed", desc: "Le payout a echoue — verifiez le solde et les details" },
              { event: "payout.pending", desc: "Le payout est en cours de traitement" },
            ].map(({ event, desc }) => (
              <div key={event} className="flex items-start gap-3 text-xs border border-border rounded-md p-2">
                <code className="font-mono text-primary shrink-0 mt-0.5">{event}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm">Payload du webhook</h4>
              <Button size="sm" variant="ghost" onClick={() => copyCode(webhookPayloadExample)} data-testid="button-copy-webhook-payload">
                <Copy className="w-3 h-3 mr-1" /> Copier
              </Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{webhookPayloadExample}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm">Gestion du webhook (Node.js)</h4>
              <Button size="sm" variant="ghost" onClick={() => copyCode(webhookHandlerExample)} data-testid="button-copy-webhook-handler">
                <Copy className="w-3 h-3 mr-1" /> Copier
              </Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">{webhookHandlerExample}</pre>
          </div>

          <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <AlertDescription className="text-green-800 dark:text-green-200 text-xs space-y-1">
              <p>
                <strong>Une seule URL pour tout :</strong> vous pouvez utiliser la meme URL webhook (<code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">https://votre-site.com/api/webhook/bkapay</code>) pour les paiements entrants (payin) ET les virements sortants (payout). Distinguez-les par le champ <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">event</code> : <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">payment.X</code> pour le payin, <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">payout.X</code> pour le payout. Choisissez le bon secret HMAC selon l'evenement recu.
              </p>
            </AlertDescription>
          </Alert>
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs space-y-1">
              <p>
                Chaque webhook est signe via HMAC-SHA256. Les webhooks payout utilisent <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">BKAPAY_PAYOUT_CALLBACK_SECRET</code>, les webhooks payin utilisent <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">BKAPAY_CALLBACK_SECRET</code>. Les deux secrets sont visibles dans votre tableau de bord.
                Verifiez toujours la signature dans le header <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">X-BKApay-Signature</code> avant de traiter le webhook.
              </p>
              <p>
                <strong>Retry automatique :</strong> BKApay renvoie le webhook toutes les <strong>5 secondes pendant 10 minutes</strong> si votre serveur ne repond pas avec un code HTTP 2xx (200, 201...).
                Repondez <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{ received: true }"}</code> avec un statut 200 rapidement pour stopper les retentatives.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Bonnes pratiques */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Bonnes pratiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2 text-muted-foreground">
            {[
              "Stockez toujours le transactionId retourne par l'API pour suivre le statut du payout.",
              "Verifiez la signature HMAC-SHA256 sur le corps brut (raw body) de la requete — pas sur le corps re-serialise — pour garantir la correspondance exacte.",
              "Verifiez votre solde avant d'initier de nombreux payouts en serie pour eviter les erreurs INSUFFICIENT_FUNDS.",
              "Gardez votre cle privee uniquement cote serveur — ne l'exposez jamais dans votre frontend.",
              "Implementez un systeme de file d'attente pour les volumes importants afin d'eviter les erreurs de rate limiting.",
              "Implementez l'idempotence en utilisant le champ reference pour eviter les doubles envois.",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-8 border-t">
        <p className="text-sm text-muted-foreground">
          Documentation API BKApay - API Payout - Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour: {docVersion.releaseDate}
        </p>
      </div>
    </div>
  );
}
