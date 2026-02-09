import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, ExternalLink, AlertTriangle, ArrowLeft, ArrowRight, Clock, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { 
  DOC_VERSIONS, 
  getDocVersion, 
  getLatestVersion,
  type DocVersion 
} from "@/lib/doc-versions";

interface Props {
  version: string;
}

function VersionSelector({ currentVersion, basePath }: { currentVersion: string; basePath: string }) {
  const [, setLocation] = useLocation();
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Version:</span>
      {DOC_VERSIONS.map(v => (
        <Badge 
          key={v.version}
          variant={v.version === currentVersion ? "default" : "outline"}
          className={`cursor-pointer ${v.isDeprecated ? "opacity-60" : ""}`}
          onClick={() => setLocation(`${basePath}/redirect/${v.version}`)}
          data-testid={`select-version-${v.version}`}
        >
          {v.version}
          {v.isLatest && " (Actuelle)"}
          {v.isDeprecated && " (Obsolete)"}
        </Badge>
      ))}
    </div>
  );
}

export default function DocumentationRedirect({ version }: Props) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";
  const basePath = location.startsWith("/dashboard") ? "/dashboard/documentation" : "/documentation";
  
  const docVersion = getDocVersion(version);
  const latestVersion = getLatestVersion();
  
  if (!docVersion) {
    setLocation(`${basePath}/${latestVersion.version}`);
    return null;
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copie",
      description: "Le code a ete copie dans le presse-papiers",
    });
  };

  const redirectUrl = `${baseUrl}/api-pay/VOTRE_CLE_PUBLIQUE?amount=MONTANT&description=DESCRIPTION&callback=URL_RETOUR`;

  const htmlExample = `<!-- Bouton de paiement BKApay -->
<a href="${baseUrl}/api-pay/pk_live_VOTRE_CLE?amount=5000&description=Achat%20produit&callback=https://votresite.com/success">
  <button>Payer 5 000</button>
</a>`;

  const jsExample = `// Rediriger vers la page de paiement BKApay
function payerAvecBKApay(montant, description) {
  const clePublique = "pk_live_VOTRE_CLE_PUBLIQUE";
  const callbackUrl = encodeURIComponent("https://votresite.com/success");
  const desc = encodeURIComponent(description);
  
  const url = "${baseUrl}/api-pay/" + clePublique + 
    "?amount=" + montant + 
    "&description=" + desc + 
    "&callback=" + callbackUrl;
  
  window.location.href = url;
}

// Utilisation
payerAvecBKApay(5000, "Achat produit");`;

  const phpExample = `<?php
// Redirection vers la page de paiement BKApay

$clePublique = "pk_live_VOTRE_CLE_PUBLIQUE";
$montant = 5000;
$description = urlencode("Achat produit");
$callbackUrl = urlencode("https://votresite.com/success");

$url = "${baseUrl}/api-pay/{$clePublique}?amount={$montant}&description={$description}&callback={$callbackUrl}";

header("Location: {$url}");
exit;
?>`;

  const pythonExample = `# Redirection vers la page de paiement BKApay
from flask import redirect
from urllib.parse import urlencode

CLE_PUBLIQUE = "pk_live_VOTRE_CLE_PUBLIQUE"

@app.route("/payer")
def payer():
    params = {
        "amount": 5000,
        "description": "Achat produit",
        "callback": "https://votresite.com/success"
    }
    url = f"${baseUrl}/api-pay/{CLE_PUBLIQUE}?" + urlencode(params)
    return redirect(url)`;

  const callbackExample = `// Gestion du retour apres paiement
// URL de retour: https://votresite.com/success?status=success&transactionId=xxx&amount=5000

// JavaScript
const urlParams = new URLSearchParams(window.location.search);
const status = urlParams.get("status");
const transactionId = urlParams.get("transactionId");
const amount = urlParams.get("amount");

if (status === "success") {
  console.log("Paiement reussi:", transactionId, amount);
} else {
  console.log("Paiement echoue");
}`;

  const webhookExample = `// Webhook BKApay - Activation automatique d'abonnement
// Ce code recoit les notifications de paiement reussi

// Node.js / Express
const crypto = require('crypto');

app.post('/api/webhook/bkapay', express.json(), (req, res) => {
  const signature = req.headers['x-bkapay-signature'];
  const secret = process.env.BKAPAY_CALLBACK_SECRET;
  
  // Verifier la signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Signature invalide' });
  }
  
  const { event, transactionId, amount, status, customerEmail } = req.body;
  
  if (event === 'payment.completed' && status === 'completed') {
    // Activer l'abonnement de l'utilisateur
    activerAbonnement(customerEmail, transactionId);
    console.log('Abonnement active pour:', customerEmail);
  }
  
  res.json({ received: true });
});`;

  const webhookPhpExample = `<?php
// Webhook BKApay - PHP

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$secret = getenv('BKAPAY_CALLBACK_SECRET');

// Verifier la signature
$expectedSignature = hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Signature invalide']);
    exit;
}

$data = json_decode($payload, true);

if ($data['event'] === 'payment.completed' && $data['status'] === 'completed') {
    activerAbonnement($data['customerEmail'], $data['transactionId']);
}

echo json_encode(['received' => true]);
?>`;

  const webhookPayloadExample = `{
  "event": "payment.completed",
  "transactionId": "abc123-def456",
  "externalReference": "order_12345",
  "amount": 5000,
  "fee": 300,
  "netAmount": 4700,
  "currency": "XOF",
  "status": "completed",
  "customerName": "Jean Dupont",
  "customerEmail": "jean@example.com",
  "customerPhone": "771234567",
  "country": "SN",
  "operator": "orange",
  "description": "Abonnement Premium",
  "timestamp": "2024-01-15T10:30:00.000Z"
}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
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
              Redirect Checkout / HPP
            </h1>
            <Badge variant="secondary" className="text-sm">
              {docVersion.version}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Integration par redirection vers la page de paiement securisee BKApay
        </p>
        <VersionSelector currentVersion={docVersion.version} basePath={basePath} />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Comment ca marche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'API BKApay utilise un systeme de redirection simple. Vos clients sont rediriges vers
            une page de paiement securisee BKApay ou ils peuvent payer via mobile money.
          </p>
          
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">1.</span> Creez une cle API dans votre tableau de bord</p>
            <p><span className="font-semibold">2.</span> Redirigez vos clients vers l'URL de paiement BKApay</p>
            <p><span className="font-semibold">3.</span> Le client remplit ses informations et paie</p>
            <p><span className="font-semibold">4.</span> Le client est redirige vers votre site avec le statut du paiement</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            URL de redirection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary">
              {redirectUrl}
            </code>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold">Parametres</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">amount</Badge>
                  <span className="text-muted-foreground">Montant minimum 200</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-primary/30">
                  Utilisez la devise affichee sur votre tableau de bord apres inscription (XOF, XAF ou CDF selon votre pays)
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">description</Badge>
                <span className="text-muted-foreground">Description du paiement (optionnel)</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">callback</Badge>
                <span className="text-muted-foreground">URL de retour apres paiement (optionnel)</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => copyCode(redirectUrl)} 
            variant="outline" 
            size="sm" 
            className="w-full"
            data-testid="button-copy-url"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier l'URL
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Exemples d'integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>HTML</Badge>
              <span className="text-sm text-muted-foreground">Bouton de paiement simple</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{htmlExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(htmlExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-html"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>JavaScript</Badge>
              <span className="text-sm text-muted-foreground">Fonction de redirection</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{jsExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(jsExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-js"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>PHP</Badge>
              <span className="text-sm text-muted-foreground">Redirection serveur</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{phpExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(phpExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-php"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>Python (Flask)</Badge>
              <span className="text-sm text-muted-foreground">Redirection serveur</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{pythonExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(pythonExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-python"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Gestion du retour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apres le paiement, le client est redirige vers votre URL de callback avec les parametres suivants:
          </p>
          
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono">
              https://votresite.com/success?status=success&transactionId=xxx&amount=5000
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Badge variant="outline">status</Badge>
              <span className="text-muted-foreground">"success" ou "failed"</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">transactionId</Badge>
              <span className="text-muted-foreground">Identifiant unique de la transaction</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">amount</Badge>
              <span className="text-muted-foreground">Montant paye</span>
            </div>
          </div>

          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
            <pre>{callbackExample}</pre>
          </div>
          <Button 
            onClick={() => copyCode(callbackExample)} 
            variant="outline" 
            size="sm" 
            className="w-full"
            data-testid="button-copy-callback"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier
          </Button>
        </CardContent>
      </Card>

      {docVersion.version === "v1.3" && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-green-600" />
              Webhooks - Activation automatique
              <Badge variant="default" className="text-xs">Nouveau v1.3</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configurez un webhook pour recevoir une notification automatique quand un paiement est complete.
              Ideal pour activer automatiquement les abonnements ou comptes utilisateurs.
            </p>

            <div className="space-y-4">
              <h4 className="font-semibold">Configuration</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">1.</span> Allez dans "Cles API" de votre tableau de bord</p>
                <p><span className="font-semibold">2.</span> Cliquez sur "Configurer un callback" sur votre cle API</p>
                <p><span className="font-semibold">3.</span> Entrez l'URL de votre endpoint webhook (HTTPS requis)</p>
                <p><span className="font-semibold">4.</span> Copiez le secret genere pour verifier les signatures</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Exemple d'URL de Webhook</h4>
              <p className="text-sm text-muted-foreground">
                Voici des exemples d'URLs que vous pouvez configurer dans l'interface "Cles API":
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <code className="block text-sm font-mono text-primary">
                  https://votresite.com/api/webhook/bkapay
                </code>
                <code className="block text-sm font-mono text-primary">
                  https://monapp.com/webhooks/paiement
                </code>
                <code className="block text-sm font-mono text-primary">
                  https://api.monservice.com/callbacks/bkapay
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                L'URL doit etre en HTTPS et accessible publiquement. BKApay enverra une requete POST a cette URL a chaque paiement.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Payload du webhook</h4>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{webhookPayloadExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(webhookPayloadExample)} 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-copy-webhook-payload"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Headers envoyes</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex gap-2">
                  <Badge variant="outline">X-BKApay-Signature</Badge>
                  <span className="text-muted-foreground">Signature HMAC-SHA256 du payload</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">X-BKApay-Event</Badge>
                  <span className="text-muted-foreground">"payment.completed" ou "payment.failed"</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">X-BKApay-Timestamp</Badge>
                  <span className="text-muted-foreground">Horodatage ISO de l'envoi</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge>Node.js / Express</Badge>
                <span className="text-sm text-muted-foreground">Verification et activation</span>
              </div>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{webhookExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(webhookExample)} 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-copy-webhook-js"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge>PHP</Badge>
                <span className="text-sm text-muted-foreground">Verification et activation</span>
              </div>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{webhookPhpExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(webhookPhpExample)} 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-copy-webhook-php"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>

            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Securite:</strong> Verifiez toujours la signature avant de traiter le webhook.
                Ne faites jamais confiance aux donnees sans verification.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <div className="text-center py-8 border-t">
        <p className="text-sm text-muted-foreground">
          Documentation API BKApay - Redirect Checkout - Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour: {docVersion.releaseDate}
        </p>
      </div>
    </div>
  );
}
