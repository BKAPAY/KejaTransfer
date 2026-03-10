import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, ExternalLink, Webhook, Send, ShieldCheck, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Documentation() {
  const { toast } = useToast();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copie",
      description: "Le code a ete copie dans le presse-papiers",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-doc-title">
            Documentation API BKApay
          </h1>
          <Badge variant="default" className="text-xs">v2.0</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Integrez facilement les paiements mobile money dans votre application
        </p>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full grid grid-cols-2" data-testid="tabs-doc-type">
          <TabsTrigger value="personal" data-testid="tab-personal">
            <User className="w-4 h-4 mr-2" />
            Integration Compte Personnel
          </TabsTrigger>
          <TabsTrigger value="business" data-testid="tab-business">
            <Building2 className="w-4 h-4 mr-2" />
            Integration Compte Entreprise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6 mt-6">
          <PersonalDocumentation baseUrl={baseUrl} copyCode={copyCode} />
        </TabsContent>

        <TabsContent value="business" className="space-y-6 mt-6">
          <BusinessDocumentation baseUrl={baseUrl} copyCode={copyCode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PersonalDocumentation({ baseUrl, copyCode }: { baseUrl: string; copyCode: (code: string) => void }) {
  const redirectUrl = `${baseUrl}/api-pay/VOTRE_CLE_PUBLIQUE?amount=MONTANT&description=DESCRIPTION&callback=URL_RETOUR`;

  const htmlExample = `<!-- Bouton de paiement BKApay -->
<a href="${baseUrl}/api-pay/pk_live_VOTRE_CLE?amount=5000&description=Achat%20produit&callback=https://votresite.com/success">
  <button>Payer 5 000 XOF</button>
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
  const secret = process.env.BKAPAY_CALLBACK_SECRET; // Votre secret de callback
  
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
// Recevoir les notifications de paiement

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
    // Activer l'abonnement
    $userId = $data['customerEmail'];
    $transactionId = $data['transactionId'];
    activerAbonnement($userId, $transactionId);
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

  const payoutJsExample = `const response = await fetch("${baseUrl}/api/v1/payout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_live_VOTRE_CLE_PRIVEE"
  },
  body: JSON.stringify({
    phone: "+221771234567",   // Numero avec indicatif international
    operator: "orange",        // Nom de l'operateur
    country: "SN",             // Code ISO du pays
    amount: 10000,             // Montant brut
    currency: "XOF",           // Devise
    reference: "order_789"     // Reference interne (optionnel)
  })
});

const data = await response.json();
// data.success, data.transactionId, data.status`;

  const payoutPhpExample = `<?php
$response = file_get_contents("${baseUrl}/api/v1/payout", false,
  stream_context_create([
    "http" => [
      "method" => "POST",
      "header" => "Content-Type: application/json\\r\\nAuthorization: Bearer sk_live_VOTRE_CLE_PRIVEE",
      "content" => json_encode([
        "phone"     => "+221771234567",
        "operator"  => "orange",
        "country"   => "SN",
        "amount"    => 10000,
        "currency"  => "XOF",
        "reference" => "order_789"
      ])
    ]
  ])
);
$data = json_decode($response, true);
// $data["success"], $data["transactionId"], $data["status"]
?>`;

  const payoutPythonExample = `import requests

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
# data["success"], data["transactionId"], data["status"]`;

  const payoutSuccessExample = `{
  "success": true,
  "transactionId": "txn_abc123",
  "status": "pending",
  "message": "Payout initie avec succes"
}`;

  const payoutWebhookExample = `{
  "event": "payout.completed",
  "transactionId": "txn_abc123",
  "reference": "order_789",
  "amount": 10000,
  "fee": 600,
  "netAmount": 9400,
  "currency": "XOF",
  "status": "completed",
  "country": "SN",
  "operator": "orange",
  "recipientPhone": "+221771234567",
  "timestamp": "2024-01-15T10:30:00.000Z"
}`;

  return (
    <>
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
          <strong>Nouveau v1.6:</strong> Sessions de paiement securisees — Le montant est verrouille cote serveur, jamais expose dans l'URL.
        </AlertDescription>
      </Alert>
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Send className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
          <strong>v1.5:</strong> API Payout — Envoyez de l'argent sur des numeros mobile money directement depuis votre application via API
        </AlertDescription>
      </Alert>

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
              <div className="flex gap-2">
                <Badge variant="outline">amount</Badge>
                <span className="text-muted-foreground">Montant en XOF (minimum 100)</span>
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
          <CodeBlock label="HTML" description="Bouton de paiement simple" code={htmlExample} copyCode={copyCode} testId="button-copy-html" />
          <CodeBlock label="JavaScript" description="Fonction de redirection" code={jsExample} copyCode={copyCode} testId="button-copy-js" />
          <CodeBlock label="PHP" description="Redirection serveur" code={phpExample} copyCode={copyCode} testId="button-copy-php" />
          <CodeBlock label="Python (Flask)" description="Redirection serveur" code={pythonExample} copyCode={copyCode} testId="button-copy-python" />
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
              <span className="text-muted-foreground">Montant paye en XOF</span>
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

      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-green-600" />
            Webhooks - Activation automatique
            <Badge variant="default" className="text-xs">Nouveau v1.4</Badge>
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
              <p><span className="font-semibold">3.</span> Entrez l'URL de votre endpoint webhook</p>
              <p><span className="font-semibold">4.</span> Copiez le secret genere pour verifier les signatures</p>
            </div>
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

          <CodeBlock label="Node.js / Express" description="Verification et activation" code={webhookExample} copyCode={copyCode} testId="button-copy-webhook-js" />
          <CodeBlock label="PHP" description="Verification et activation" code={webhookPhpExample} copyCode={copyCode} testId="button-copy-webhook-php" />

          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Securite:</strong> Verifiez toujours la signature avant de traiter le webhook.
              Ne faites jamais confiance aux donnees sans verification.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            API Payout — Envoyer de l'argent via API
            <Badge variant="secondary" className="text-xs ml-1">v1.0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <Send className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
              L'API Payout vous permet d'envoyer de l'argent directement sur des numeros mobile money depuis votre application.
              Le paiement est prelevé sur votre solde. <strong>Activation requise — contactez le support.</strong>
            </AlertDescription>
          </Alert>

          <div>
            <h3 className="font-semibold mb-2">Endpoint</h3>
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">POST</Badge>
              <span className="break-all">{baseUrl}/api/v1/payout</span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Authentification</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Utilisez votre <strong>cle privee</strong> (sk_live_...) dans le header Authorization. Ne partagez jamais cette cle.
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-sm">
              Authorization: Bearer sk_live_VOTRE_CLE_PRIVEE
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Parametres de la requete (JSON)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-2 font-semibold border border-border rounded-tl">Parametre</th>
                    <th className="text-left p-2 font-semibold border border-border">Type</th>
                    <th className="text-left p-2 font-semibold border border-border">Requis</th>
                    <th className="text-left p-2 font-semibold border border-border rounded-tr">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["phone", "string", "Oui", "Numero avec indicatif international. Ex: +221771234567"],
                    ["operator", "string", "Oui", "Operateur mobile. Ex: orange, mtn, moov, wave, free"],
                    ["country", "string", "Oui", "Code ISO du pays (2 lettres). Ex: SN, CI, BF, BJ, TG, ML"],
                    ["amount", "number", "Oui", "Montant brut a envoyer (le destinataire reçoit montant - frais)"],
                    ["currency", "string", "Non", "Devise du montant. Ex: XOF, XAF, CDF. Defaut: devise du pays"],
                    ["reference", "string", "Non", "Votre reference interne (order_id, etc.)"],
                  ].map(([param, type, req, desc]) => (
                    <tr key={param} className="border-b border-border">
                      <td className="p-2 border border-border font-mono text-xs">{param}</td>
                      <td className="p-2 border border-border text-muted-foreground">{type}</td>
                      <td className="p-2 border border-border">
                        <Badge variant={req === "Oui" ? "default" : "secondary"} className="text-xs">{req}</Badge>
                      </td>
                      <td className="p-2 border border-border text-muted-foreground text-xs">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-4 text-sm space-y-1">
            <p className="font-semibold">Format du numero de telephone</p>
            <p className="text-muted-foreground">Envoyez toujours le numero complet avec indicatif.</p>
            <div className="font-mono text-xs mt-2 space-y-1">
              <div><span className="text-green-600">+221771234567</span> → Senegal, Orange (SN)</div>
              <div><span className="text-green-600">+22507000000</span> → Cote d'Ivoire, MTN (CI)</div>
              <div><span className="text-green-600">+22670000000</span> → Burkina Faso, Orange (BF)</div>
              <div><span className="text-green-600">+243812345678</span> → Congo RDC (CD)</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Exemples d'integration</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">JavaScript / Node.js</span>
                  <Button size="sm" variant="ghost" onClick={() => copyCode(payoutJsExample)} data-testid="button-copy-payout-js">
                    <Copy className="w-3 h-3 mr-1" /> Copier
                  </Button>
                </div>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">{payoutJsExample}</pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">PHP</span>
                  <Button size="sm" variant="ghost" onClick={() => copyCode(payoutPhpExample)} data-testid="button-copy-payout-php">
                    <Copy className="w-3 h-3 mr-1" /> Copier
                  </Button>
                </div>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">{payoutPhpExample}</pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">Python</span>
                  <Button size="sm" variant="ghost" onClick={() => copyCode(payoutPythonExample)} data-testid="button-copy-payout-python">
                    <Copy className="w-3 h-3 mr-1" /> Copier
                  </Button>
                </div>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">{payoutPythonExample}</pre>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Reponse en cas de succes</h3>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{payoutSuccessExample}</pre>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Codes d'erreur</h3>
            <div className="space-y-2">
              {[
                { code: "INVALID_API_KEY", http: "401", desc: "Cle API invalide ou manquante" },
                { code: "ACCOUNT_SUSPENDED", http: "403", desc: "Compte suspendu — contacter le support" },
                { code: "ACCOUNT_NOT_VERIFIED", http: "403", desc: "KYC non verifie — completez la verification d'identite" },
                { code: "PAYOUT_NOT_ACTIVATED", http: "403", desc: "Payout API non active — contactez le support pour l'activer" },
                { code: "INSUFFICIENT_FUNDS", http: "400", desc: "Solde insuffisant sur votre compte" },
                { code: "COUNTRY_UNAVAILABLE", http: "400", desc: "Pays non disponible pour le payout" },
                { code: "OPERATOR_UNAVAILABLE", http: "400", desc: "Operateur non supporte dans ce pays" },
                { code: "TRANSACTION_FAILED", http: "400", desc: "La transaction a echoue cote fournisseur" },
                { code: "INVALID_PHONE", http: "400", desc: "Numero de telephone invalide" },
                { code: "INVALID_PARAMETERS", http: "400", desc: "Parametres manquants ou incorrects" },
                { code: "INTERNAL_ERROR", http: "500", desc: "Erreur interne — reessayez plus tard" },
              ].map(({ code, http, desc }) => (
                <div key={code} className="flex items-start gap-3 text-sm border border-border rounded-md p-2">
                  <Badge variant="outline" className="font-mono text-xs shrink-0">{http}</Badge>
                  <code className="font-mono text-xs text-destructive shrink-0">{code}</code>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Les erreurs sont retournees dans le format: <code className="font-mono">{"{ \"success\": false, \"error\": { \"code\": \"...\", \"message\": \"...\" } }"}</code>
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Webhook de statut (optionnel)</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Si vous avez configure un webhook dans vos cles API, vous recevrez une notification automatique avec le statut final du payout.
              Les evenements possibles sont: <code className="font-mono text-xs">payout.completed</code>, <code className="font-mono text-xs">payout.failed</code>, <code className="font-mono text-xs">payout.pending</code>.
              Le header <code className="font-mono text-xs">X-BKApay-Signature</code> permet de verifier l'authenticite.
            </p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{payoutWebhookExample}</pre>
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Important:</strong> Les frais de transaction sont automatiquement deduits du montant envoye. La conversion de devise est effectuee automatiquement si la devise de votre compte differe de celle demandee.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 flex-wrap gap-y-1">
            <ShieldCheck className="w-5 h-5" />
            Sessions de paiement securisees
            <Badge variant="default" className="text-xs">Nouveau v1.6</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <p className="text-muted-foreground">
            Avec les sessions de paiement, le montant est verrouille cote serveur grace a votre cle privee payin (<code className="font-mono text-xs bg-muted px-1 rounded">sk_payin_live_...</code>).
            Vos clients recoivent une URL propre <code className="font-mono text-xs bg-muted px-1 rounded">/checkout/SESSION_ID</code> — le montant n'apparait jamais dans l'URL.
          </p>

          <div className="space-y-3">
            <h3 className="font-semibold">Flux de paiement</h3>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Votre serveur appelle <code className="font-mono text-xs bg-muted px-1 rounded">POST /api/v1/payment-sessions</code> avec votre cle privee payin <code className="font-mono text-xs bg-muted px-1 rounded">sk_payin_live_...</code></li>
              <li>BKApay retourne une <code className="font-mono text-xs bg-muted px-1 rounded">payment_url</code> unique avec un ID de session</li>
              <li>Vous redirigez votre client vers cette URL</li>
              <li>Le client choisit son pays/operateur et paie — le montant est fixe et securise</li>
              <li>Votre webhook (ou <code className="font-mono text-xs bg-muted px-1 rounded">success_url</code>) est notifie apres confirmation</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Endpoint</h3>
            <div className="flex items-center gap-2 bg-muted rounded-md p-3 flex-wrap">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="font-mono text-xs break-all">{baseUrl}/api/v1/payment-sessions</code>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => copyCode(`${baseUrl}/api/v1/payment-sessions`)} data-testid="button-copy-sessions-url">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Parametres</h3>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Parametre</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium">Requis</th>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="px-3 py-2 font-mono">amount</td><td className="px-3 py-2">number</td><td className="px-3 py-2 text-green-600">Oui</td><td className="px-3 py-2 text-muted-foreground">Montant a payer (minimum 200)</td></tr>
                  <tr><td className="px-3 py-2 font-mono">currency</td><td className="px-3 py-2">string</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">Devise (defaut: XOF)</td></tr>
                  <tr><td className="px-3 py-2 font-mono">description</td><td className="px-3 py-2">string</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">Description du paiement</td></tr>
                  <tr><td className="px-3 py-2 font-mono">success_url</td><td className="px-3 py-2">string</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">URL de redirection apres succes</td></tr>
                  <tr><td className="px-3 py-2 font-mono">cancel_url</td><td className="px-3 py-2">string</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">URL de redirection apres echec/annulation</td></tr>
                  <tr><td className="px-3 py-2 font-mono">callback_url</td><td className="px-3 py-2">string</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">Webhook de notification</td></tr>
                  <tr><td className="px-3 py-2 font-mono">order_id</td><td className="px-3 py-2">string</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">Identifiant de commande (votre systeme)</td></tr>
                  <tr><td className="px-3 py-2 font-mono">expires_in</td><td className="px-3 py-2">number</td><td className="px-3 py-2 text-muted-foreground">Non</td><td className="px-3 py-2 text-muted-foreground">Duree de validite en secondes (defaut: 3600, max: 86400)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Exemple JavaScript</h3>
              <Button size="sm" variant="ghost" onClick={() => copyCode(`const response = await fetch("${baseUrl}/api/v1/payment-sessions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_payin_live_VOTRE_CLE_PAYIN"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XOF",
    description: "Commande #1234",
    success_url: "https://votresite.com/success",
    cancel_url: "https://votresite.com/cancel",
    order_id: "cmd-1234"
  })
});
const data = await response.json();
// Rediriger le client vers data.payment_url
window.location.href = data.payment_url;`)} data-testid="button-copy-sessions-js">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copier
              </Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">{`const response = await fetch("${baseUrl}/api/v1/payment-sessions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_payin_live_VOTRE_CLE_PAYIN"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XOF",
    description: "Commande #1234",
    success_url: "https://votresite.com/success",
    cancel_url: "https://votresite.com/cancel",
    order_id: "cmd-1234"
  })
});
const data = await response.json();
// Rediriger le client vers data.payment_url
window.location.href = data.payment_url;`}</pre>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Reponse</h3>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{`{
  "success": true,
  "session_id": "a1b2c3d4-...",
  "payment_url": "${baseUrl}/checkout/a1b2c3d4-...",
  "expires_at": "2026-03-06T20:00:00.000Z",
  "amount": 5000,
  "currency": "XOF"
}`}</pre>
          </div>

          <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
              <strong>Securite:</strong> Utilisez toujours votre cle privee payin (<code className="font-mono text-xs">sk_payin_live_</code>) uniquement cote serveur.
              Ne l'exposez jamais dans votre code frontend ou dans une URL.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Pays et operateurs supportes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Senegal (SN)</p>
              <p className="text-xs text-muted-foreground">
                Orange, Free, Expresso, Wave, Wizall
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Cote d'Ivoire (CI)</p>
              <p className="text-xs text-muted-foreground">
                Orange, MTN, Moov, Wave
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Burkina Faso (BF)</p>
              <p className="text-xs text-muted-foreground">
                Orange, Moov
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Benin (BJ)</p>
              <p className="text-xs text-muted-foreground">
                Moov, MTN
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Togo (TG)</p>
              <p className="text-xs text-muted-foreground">
                T-Money, Moov
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Mali (ML)</p>
              <p className="text-xs text-muted-foreground">
                Orange, Moov
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function BusinessDocumentation({ baseUrl, copyCode }: { baseUrl: string; copyCode: (code: string) => void }) {
  const businessPayinJsExample = `const response = await fetch("${baseUrl}/api/v1/business/payin", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer bt_live_VOTRE_TOKEN_BUSINESS"
  },
  body: JSON.stringify({
    country: "BJ",
    operator: "mtn",
    phone: "+22961234567",
    amount: 5000,
    currency: "XOF",
    description: "Paiement commande #1234",
    orderId: "cmd-1234"
  })
});

const data = await response.json();
console.log(data.transactionId, data.status);`;

  const businessPayinPhpExample = `<?php
$ch = curl_init("${baseUrl}/api/v1/business/payin");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "Authorization: Bearer bt_live_VOTRE_TOKEN_BUSINESS"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "country"     => "BJ",
        "operator"    => "mtn",
        "phone"       => "+22961234567",
        "amount"      => 5000,
        "currency"    => "XOF",
        "description" => "Paiement commande #1234",
        "orderId"     => "cmd-1234"
    ])
]);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
// $data["success"], $data["transactionId"], $data["status"]
?>`;

  const businessPayinPythonExample = `import requests

response = requests.post(
    "${baseUrl}/api/v1/business/payin",
    headers={
        "Authorization": "Bearer bt_live_VOTRE_TOKEN_BUSINESS",
        "Content-Type": "application/json"
    },
    json={
        "country": "BJ",
        "operator": "mtn",
        "phone": "+22961234567",
        "amount": 5000,
        "currency": "XOF",
        "description": "Paiement commande #1234",
        "orderId": "cmd-1234"
    }
)
data = response.json()
# data["success"], data["transactionId"], data["status"]`;

  const businessPayinCurlExample = `curl -X POST ${baseUrl}/api/v1/business/payin \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bt_live_VOTRE_TOKEN_BUSINESS" \\
  -d '{
    "country": "BJ",
    "operator": "mtn",
    "phone": "+22961234567",
    "amount": 5000,
    "currency": "XOF",
    "description": "Paiement commande #1234",
    "orderId": "cmd-1234"
  }'`;

  const businessPayoutJsExample = `const response = await fetch("${baseUrl}/api/v1/business/payout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer bt_live_VOTRE_TOKEN_BUSINESS"
  },
  body: JSON.stringify({
    country: "CI",
    operator: "orange",
    phone: "+2250700000000",
    amount: 10000,
    currency: "XOF",
    description: "Paiement fournisseur"
  })
});

const data = await response.json();
console.log(data.transactionId, data.status);`;

  const businessPayoutPhpExample = `<?php
$ch = curl_init("${baseUrl}/api/v1/business/payout");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "Authorization: Bearer bt_live_VOTRE_TOKEN_BUSINESS"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "country"     => "CI",
        "operator"    => "orange",
        "phone"       => "+2250700000000",
        "amount"      => 10000,
        "currency"    => "XOF",
        "description" => "Paiement fournisseur"
    ])
]);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
// $data["success"], $data["transactionId"], $data["status"]
?>`;

  const businessPayoutPythonExample = `import requests

response = requests.post(
    "${baseUrl}/api/v1/business/payout",
    headers={
        "Authorization": "Bearer bt_live_VOTRE_TOKEN_BUSINESS",
        "Content-Type": "application/json"
    },
    json={
        "country": "CI",
        "operator": "orange",
        "phone": "+2250700000000",
        "amount": 10000,
        "currency": "XOF",
        "description": "Paiement fournisseur"
    }
)
data = response.json()
# data["success"], data["transactionId"], data["status"]`;

  const businessPayoutCurlExample = `curl -X POST ${baseUrl}/api/v1/business/payout \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bt_live_VOTRE_TOKEN_BUSINESS" \\
  -d '{
    "country": "CI",
    "operator": "orange",
    "phone": "+2250700000000",
    "amount": 10000,
    "currency": "XOF",
    "description": "Paiement fournisseur"
  }'`;

  const payinSuccessResponse = `{
  "success": true,
  "transactionId": "txn_abc123-def456",
  "status": "pending",
  "message": "Payin initie avec succes"
}`;

  const payoutSuccessResponse = `{
  "success": true,
  "transactionId": "txn_xyz789-ghi012",
  "status": "pending",
  "message": "Payout initie avec succes"
}`;

  const statusCheckExample = `// Verifier le statut d'un payin
const payinStatus = await fetch(
  "${baseUrl}/api/v1/business/payin/txn_abc123-def456/status",
  {
    headers: {
      "Authorization": "Bearer bt_live_VOTRE_TOKEN_BUSINESS"
    }
  }
);
const payinData = await payinStatus.json();
// payinData.status: "pending", "completed", "failed"

// Verifier le statut d'un payout
const payoutStatus = await fetch(
  "${baseUrl}/api/v1/business/payout/txn_xyz789-ghi012/status",
  {
    headers: {
      "Authorization": "Bearer bt_live_VOTRE_TOKEN_BUSINESS"
    }
  }
);
const payoutData = await payoutStatus.json();`;

  const webhookPayinPayload = `{
  "event": "business.payin.completed",
  "transactionId": "txn_abc123-def456",
  "orderId": "cmd-1234",
  "amount": 5000,
  "fee": 300,
  "netAmount": 4700,
  "currency": "XOF",
  "status": "completed",
  "country": "BJ",
  "operator": "mtn",
  "customerPhone": "+22961234567",
  "description": "Paiement commande #1234",
  "timestamp": "2026-03-10T10:30:00.000Z"
}`;

  const webhookPayoutPayload = `{
  "event": "business.payout.completed",
  "transactionId": "txn_xyz789-ghi012",
  "amount": 10000,
  "fee": 600,
  "netAmount": 9400,
  "currency": "XOF",
  "status": "completed",
  "country": "CI",
  "operator": "orange",
  "recipientPhone": "+2250700000000",
  "description": "Paiement fournisseur",
  "timestamp": "2026-03-10T11:00:00.000Z"
}`;

  const webhookVerificationExample = `const crypto = require('crypto');

app.post('/api/webhook/bkapay-business', express.json(), (req, res) => {
  const signature = req.headers['x-bkapay-signature'];
  const secret = process.env.BKAPAY_BUSINESS_CALLBACK_SECRET;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Signature invalide' });
  }
  
  const { event, transactionId, status, amount } = req.body;
  
  switch (event) {
    case 'business.payin.completed':
      console.log('Payin reussi:', transactionId, amount);
      break;
    case 'business.payin.failed':
      console.log('Payin echoue:', transactionId);
      break;
    case 'business.payout.completed':
      console.log('Payout reussi:', transactionId, amount);
      break;
    case 'business.payout.failed':
      console.log('Payout echoue:', transactionId);
      break;
  }
  
  res.json({ received: true });
});`;

  const webhookVerificationPhpExample = `<?php
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$secret = getenv('BKAPAY_BUSINESS_CALLBACK_SECRET');

$expectedSignature = hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Signature invalide']);
    exit;
}

$data = json_decode($payload, true);

switch ($data['event']) {
    case 'business.payin.completed':
        // Payin reussi
        traiterPaiementRecu($data['transactionId'], $data['amount']);
        break;
    case 'business.payout.completed':
        // Payout reussi
        confirmerEnvoi($data['transactionId']);
        break;
    case 'business.payin.failed':
    case 'business.payout.failed':
        // Transaction echouee
        marquerEchec($data['transactionId']);
        break;
}

echo json_encode(['received' => true]);
?>`;

  const businessCountries = [
    { code: "BJ", name: "Benin", currency: "XOF", operators: "MTN, Moov" },
    { code: "TG", name: "Togo", currency: "XOF", operators: "Moov, T-Money" },
    { code: "BF", name: "Burkina Faso", currency: "XOF", operators: "Moov, Orange" },
    { code: "CI", name: "Cote d'Ivoire", currency: "XOF", operators: "MTN, Orange" },
    { code: "CM", name: "Cameroun", currency: "XAF", operators: "MTN, Orange" },
    { code: "CD", name: "RD Congo", currency: "CDF", operators: "Airtel, Orange, Vodacom" },
    { code: "GA", name: "Gabon", currency: "XAF", operators: "Airtel" },
    { code: "CG", name: "Congo Brazzaville", currency: "XAF", operators: "MTN, Airtel" },
    { code: "SN", name: "Senegal", currency: "XOF", operators: "Free, Orange" },
    { code: "ZM", name: "Zambie", currency: "ZMW", operators: "MTN" },
    { code: "UG", name: "Ouganda", currency: "UGX", operators: "MTN" },
  ];

  return (
    <>
      <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
        <Building2 className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-purple-800 dark:text-purple-200 text-sm">
          <strong>API Entreprise:</strong> Un seul token (<code className="font-mono text-xs">bt_live_...</code>) pour collecter et envoyer de l'argent directement via API — sans redirection.
          Gerez votre token dans l'onglet "API" de votre tableau de bord entreprise.
        </AlertDescription>
      </Alert>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Comment ca marche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'API Business BKApay permet aux comptes entreprise de collecter (payin) et envoyer (payout) de l'argent
            directement via des appels API, sans redirection vers une page de paiement. Tout est gere avec un seul token.
          </p>

          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">1.</span> Generez votre token API dans le tableau de bord entreprise</p>
            <p><span className="font-semibold">2.</span> Configurez vos URL de callback (payin + payout)</p>
            <p><span className="font-semibold">3.</span> Initiez des paiements ou envois via l'API</p>
            <p><span className="font-semibold">4.</span> Recevez les notifications de statut via webhook</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Authentification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Toutes les requetes doivent inclure votre token business dans le header <code className="font-mono bg-muted px-1 rounded">Authorization</code>.
          </p>
          <div className="bg-muted rounded-md p-3 font-mono text-sm">
            Authorization: Bearer bt_live_VOTRE_TOKEN_BUSINESS
          </div>
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Securite:</strong> Ne partagez jamais votre token. Utilisez-le uniquement cote serveur.
              En cas de compromission, regenerez-le immediatement depuis votre tableau de bord.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-green-600" />
            POST /api/v1/business/payin — Collecter un paiement
            <Badge variant="default" className="text-xs">Payin</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Endpoint</h3>
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">POST</Badge>
              <span className="break-all">{baseUrl}/api/v1/business/payin</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => copyCode(`${baseUrl}/api/v1/business/payin`)} data-testid="button-copy-biz-payin-url">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Parametres (JSON)</h3>
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
                    ["country", "string", "Oui", "Code ISO du pays (2 lettres). Ex: BJ, CI, CM, CD"],
                    ["operator", "string", "Oui", "Operateur mobile. Ex: mtn, orange, moov, airtel, tmoney"],
                    ["phone", "string", "Oui", "Numero avec indicatif international. Ex: +22961234567"],
                    ["amount", "number", "Oui", "Montant a collecter (minimum selon le pays)"],
                    ["currency", "string", "Oui", "Devise: XOF, XAF, CDF, ZMW, UGX"],
                    ["description", "string", "Non", "Description du paiement"],
                    ["callbackUrl", "string", "Non", "URL de notification (remplace celle par defaut)"],
                    ["orderId", "string", "Non", "Votre reference interne"],
                  ].map(([param, type, req, desc]) => (
                    <tr key={param} className="border-b border-border">
                      <td className="p-2 border border-border font-mono text-xs">{param}</td>
                      <td className="p-2 border border-border text-muted-foreground">{type}</td>
                      <td className="p-2 border border-border">
                        <Badge variant={req === "Oui" ? "default" : "secondary"} className="text-xs">{req}</Badge>
                      </td>
                      <td className="p-2 border border-border text-muted-foreground text-xs">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Reponse</h3>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{payinSuccessResponse}</pre>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Exemples d'integration</h3>
            <div className="space-y-4">
              <CodeBlock label="JavaScript / Node.js" description="Collecter un paiement" code={businessPayinJsExample} copyCode={copyCode} testId="button-copy-biz-payin-js" />
              <CodeBlock label="PHP" description="Collecter un paiement" code={businessPayinPhpExample} copyCode={copyCode} testId="button-copy-biz-payin-php" />
              <CodeBlock label="Python" description="Collecter un paiement" code={businessPayinPythonExample} copyCode={copyCode} testId="button-copy-biz-payin-python" />
              <CodeBlock label="cURL" description="Collecter un paiement" code={businessPayinCurlExample} copyCode={copyCode} testId="button-copy-biz-payin-curl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            POST /api/v1/business/payout — Envoyer de l'argent
            <Badge variant="secondary" className="text-xs">Payout</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Endpoint</h3>
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">POST</Badge>
              <span className="break-all">{baseUrl}/api/v1/business/payout</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => copyCode(`${baseUrl}/api/v1/business/payout`)} data-testid="button-copy-biz-payout-url">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Parametres (JSON)</h3>
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
                    ["country", "string", "Oui", "Code ISO du pays (2 lettres). Ex: CI, BJ, CM"],
                    ["operator", "string", "Oui", "Operateur mobile. Ex: orange, mtn, moov, airtel"],
                    ["phone", "string", "Oui", "Numero du destinataire avec indicatif. Ex: +2250700000000"],
                    ["amount", "number", "Oui", "Montant brut a envoyer (frais deduits automatiquement)"],
                    ["currency", "string", "Oui", "Devise: XOF, XAF, CDF, ZMW, UGX"],
                    ["description", "string", "Non", "Description de l'envoi"],
                  ].map(([param, type, req, desc]) => (
                    <tr key={param} className="border-b border-border">
                      <td className="p-2 border border-border font-mono text-xs">{param}</td>
                      <td className="p-2 border border-border text-muted-foreground">{type}</td>
                      <td className="p-2 border border-border">
                        <Badge variant={req === "Oui" ? "default" : "secondary"} className="text-xs">{req}</Badge>
                      </td>
                      <td className="p-2 border border-border text-muted-foreground text-xs">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Reponse</h3>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{payoutSuccessResponse}</pre>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Exemples d'integration</h3>
            <div className="space-y-4">
              <CodeBlock label="JavaScript / Node.js" description="Envoyer de l'argent" code={businessPayoutJsExample} copyCode={copyCode} testId="button-copy-biz-payout-js" />
              <CodeBlock label="PHP" description="Envoyer de l'argent" code={businessPayoutPhpExample} copyCode={copyCode} testId="button-copy-biz-payout-php" />
              <CodeBlock label="Python" description="Envoyer de l'argent" code={businessPayoutPythonExample} copyCode={copyCode} testId="button-copy-biz-payout-python" />
              <CodeBlock label="cURL" description="Envoyer de l'argent" code={businessPayoutCurlExample} copyCode={copyCode} testId="button-copy-biz-payout-curl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Verification de statut
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous pouvez verifier le statut d'une transaction a tout moment via les endpoints suivants:
          </p>

          <div className="space-y-3">
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">GET</Badge>
              <span className="break-all">{baseUrl}/api/v1/business/payin/:transactionId/status</span>
            </div>
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">GET</Badge>
              <span className="break-all">{baseUrl}/api/v1/business/payout/:transactionId/status</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Statuts possibles</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <Badge variant="outline">pending</Badge>
                <span className="text-muted-foreground">Transaction en cours de traitement</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">completed</Badge>
                <span className="text-muted-foreground">Transaction reussie</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">failed</Badge>
                <span className="text-muted-foreground">Transaction echouee</span>
              </div>
            </div>
          </div>

          <CodeBlock label="JavaScript" description="Verification de statut" code={statusCheckExample} copyCode={copyCode} testId="button-copy-biz-status-js" />
        </CardContent>
      </Card>

      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-green-600" />
            Webhooks — Notifications automatiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configurez vos URL de callback dans le tableau de bord pour recevoir des notifications
            automatiques lorsque les transactions changent de statut.
            Vous pouvez configurer des URL separees pour les payin et les payout.
          </p>

          <div className="space-y-4">
            <h4 className="font-semibold">Evenements</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono text-xs">business.payin.completed</Badge>
                <span className="text-muted-foreground">Paiement recu avec succes</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono text-xs">business.payin.failed</Badge>
                <span className="text-muted-foreground">Echec de la collecte</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono text-xs">business.payout.completed</Badge>
                <span className="text-muted-foreground">Envoi reussi</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono text-xs">business.payout.failed</Badge>
                <span className="text-muted-foreground">Echec de l'envoi</span>
              </div>
            </div>
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
                <span className="text-muted-foreground">Type d'evenement (business.payin.completed, etc.)</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">X-BKApay-Timestamp</Badge>
                <span className="text-muted-foreground">Horodatage ISO de l'envoi</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Payload Payin</h4>
            <pre className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">{webhookPayinPayload}</pre>
            <Button onClick={() => copyCode(webhookPayinPayload)} variant="outline" size="sm" className="w-full" data-testid="button-copy-biz-webhook-payin">
              <Copy className="w-4 h-4 mr-2" /> Copier
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Payload Payout</h4>
            <pre className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">{webhookPayoutPayload}</pre>
            <Button onClick={() => copyCode(webhookPayoutPayload)} variant="outline" size="sm" className="w-full" data-testid="button-copy-biz-webhook-payout">
              <Copy className="w-4 h-4 mr-2" /> Copier
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Verification HMAC et traitement</h4>
            <CodeBlock label="Node.js / Express" description="Verification HMAC" code={webhookVerificationExample} copyCode={copyCode} testId="button-copy-biz-webhook-js" />
            <CodeBlock label="PHP" description="Verification HMAC" code={webhookVerificationPhpExample} copyCode={copyCode} testId="button-copy-biz-webhook-php" />
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Securite:</strong> Verifiez toujours la signature HMAC-SHA256 avant de traiter un webhook.
              Utilisez le secret de callback genere dans votre tableau de bord.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Pays supportes — Compte Entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Voici les pays, devises et operateurs disponibles pour les comptes entreprise.
            Utilisez les codes ci-dessous dans vos requetes API.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-testid="table-business-countries">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 font-semibold border border-border">Pays</th>
                  <th className="text-left p-2 font-semibold border border-border">Code</th>
                  <th className="text-left p-2 font-semibold border border-border">Devise</th>
                  <th className="text-left p-2 font-semibold border border-border">Operateurs</th>
                </tr>
              </thead>
              <tbody>
                {businessCountries.map((c) => (
                  <tr key={c.code} className="border-b border-border" data-testid={`row-country-${c.code}`}>
                    <td className="p-2 border border-border">{c.name}</td>
                    <td className="p-2 border border-border font-mono text-xs">
                      <Badge variant="outline" className="text-xs">{c.code}</Badge>
                    </td>
                    <td className="p-2 border border-border font-mono text-xs">{c.currency}</td>
                    <td className="p-2 border border-border text-muted-foreground text-xs">{c.operators}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/50 rounded-md p-4 text-sm space-y-2">
            <p className="font-semibold">Comment utiliser les codes dans vos requetes</p>
            <div className="font-mono text-xs space-y-1 text-muted-foreground">
              <p><span className="text-foreground">country:</span> Code ISO a 2 lettres (ex: "BJ", "CI", "CM")</p>
              <p><span className="text-foreground">currency:</span> Code devise du pays (ex: "XOF", "XAF", "CDF")</p>
              <p><span className="text-foreground">operator:</span> Nom en minuscules (ex: "mtn", "orange", "moov", "airtel", "tmoney", "vodacom", "free")</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Codes d'erreur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {[
              { code: "INVALID_TOKEN", http: "401", desc: "Token business invalide ou manquant" },
              { code: "TOKEN_INACTIVE", http: "403", desc: "Token desactive — reactivez-le dans votre tableau de bord" },
              { code: "ACCOUNT_SUSPENDED", http: "403", desc: "Compte entreprise suspendu" },
              { code: "ACCOUNT_NOT_VERIFIED", http: "403", desc: "KYC entreprise non verifie" },
              { code: "COUNTRY_NOT_ALLOWED", http: "403", desc: "Pays non autorise pour ce token" },
              { code: "INSUFFICIENT_FUNDS", http: "400", desc: "Solde insuffisant dans le wallet du pays" },
              { code: "COUNTRY_UNAVAILABLE", http: "400", desc: "Pays non disponible pour cette operation" },
              { code: "OPERATOR_UNAVAILABLE", http: "400", desc: "Operateur non supporte dans ce pays" },
              { code: "INVALID_PHONE", http: "400", desc: "Numero de telephone invalide" },
              { code: "INVALID_PARAMETERS", http: "400", desc: "Parametres manquants ou incorrects" },
              { code: "TRANSACTION_FAILED", http: "400", desc: "Transaction echouee cote fournisseur" },
              { code: "INTERNAL_ERROR", http: "500", desc: "Erreur interne — reessayez plus tard" },
            ].map(({ code, http, desc }) => (
              <div key={code} className="flex items-start gap-3 text-sm border border-border rounded-md p-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">{http}</Badge>
                <code className="font-mono text-xs text-destructive shrink-0">{code}</code>
                <span className="text-muted-foreground text-xs">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Les erreurs sont retournees dans le format: <code className="font-mono">{"{ \"success\": false, \"error\": { \"code\": \"...\", \"message\": \"...\" } }"}</code>
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function CodeBlock({ label, description, code, copyCode, testId }: {
  label: string;
  description: string;
  code: string;
  copyCode: (code: string) => void;
  testId: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge>{label}</Badge>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
        <pre>{code}</pre>
      </div>
      <Button
        onClick={() => copyCode(code)}
        variant="outline"
        size="sm"
        className="w-full mt-3"
        data-testid={testId}
      >
        <Copy className="w-4 h-4 mr-2" />
        Copier
      </Button>
    </div>
  );
}
