import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, Webhook, Send, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

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

export default function DocumentationBusiness() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const isDashboard = location.startsWith("/dashboard");
  const backUrl = isDashboard ? "/dashboard/docs" : "/docs";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copie",
      description: "Le code a ete copie dans le presse-papiers",
    });
  };

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
  "currency": "XOF",
  "status": "completed",
  "country": "CI",
  "operator": "orange",
  "recipientPhone": "+2250700000000",
  "description": "Paiement fournisseur",
  "timestamp": "2026-03-10T11:00:00.000Z"
}`;

  const webhookVerificationExample = `const crypto = require('crypto');

app.post('/api/webhook/bkapay', express.json(), (req, res) => {
  const signature = req.headers['x-bkapay-signature'];
  const secret = process.env.BKAPAY_WEBHOOK_SECRET;
  
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
// Route: /api/webhook/bkapay
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$secret = getenv('BKAPAY_WEBHOOK_SECRET');

$expectedSignature = hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Signature invalide']);
    exit;
}

$data = json_decode($payload, true);

switch ($data['event']) {
    case 'business.payin.completed':
        traiterPaiementRecu($data['transactionId'], $data['amount']);
        break;
    case 'business.payout.completed':
        confirmerEnvoi($data['transactionId']);
        break;
    case 'business.payin.failed':
    case 'business.payout.failed':
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
    <div className="space-y-6 max-w-4xl">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => setLocation(backUrl)}
          data-testid="button-back-doc-landing-biz"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-doc-business-title">
            Documentation Compte Entreprise
          </h1>
          <Badge variant="default" className="text-xs">v2.0</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          API directe pour les paiements Mobile Money — sans redirection
        </p>
      </div>

      <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
        <ShieldCheck className="h-4 w-4 text-purple-600" />
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
            <p><span className="font-semibold">2.</span> Configurez votre URL de webhook</p>
            <p><span className="font-semibold">3.</span> Initiez des paiements ou envois via l'API</p>
            <p><span className="font-semibold">4.</span> Recevez les notifications de statut via webhook</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            Wallets par pays et gestion des frais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="space-y-3">
            <h4 className="font-semibold">Wallets par pays</h4>
            <p className="text-muted-foreground">
              Chaque paiement entrant est credite dans le wallet du pays correspondant.
              Par exemple, un paiement depuis le Benin est credite dans votre wallet Benin (XOF),
              un paiement depuis le Cameroun dans votre wallet Cameroun (XAF), etc.
              Le Congo (CD) dispose de deux wallets : un en CDF et un en USD.
            </p>
            <p className="text-muted-foreground">
              Les paiements sortants (payout) sont debites du wallet du pays concerne.
              Vous devez avoir un solde suffisant dans le wallet du pays vers lequel vous envoyez.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Frais de transaction — toujours a votre charge</h4>
            <p className="text-muted-foreground">
              Les frais sont configures par l'administrateur de la plateforme et lus automatiquement a chaque appel API.
              Ils sont toujours a la charge du proprietaire du compte entreprise, jamais du client final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-md p-4 space-y-2">
              <Badge variant="default" className="text-xs">Payin (collecte)</Badge>
              <p className="text-muted-foreground text-xs">
                Votre client paie le montant exact demande.
                Les frais sont deduits du montant avant credit dans votre wallet.
              </p>
              <div className="bg-muted rounded p-2 text-xs font-mono space-y-1">
                <p>Client paie : <span className="text-foreground font-semibold">1 000 XOF</span></p>
                <p>Frais (ex: 10%) : <span className="text-destructive">-100 XOF</span></p>
                <p>Credit wallet : <span className="text-green-600 dark:text-green-400 font-semibold">900 XOF</span></p>
              </div>
            </div>

            <div className="border border-border rounded-md p-4 space-y-2">
              <Badge variant="secondary" className="text-xs">Payout (envoi)</Badge>
              <p className="text-muted-foreground text-xs">
                Le destinataire recoit le montant exact demande.
                Les frais sont ajoutes par-dessus et preleves de votre wallet.
              </p>
              <div className="bg-muted rounded p-2 text-xs font-mono space-y-1">
                <p>Destinataire recoit : <span className="text-foreground font-semibold">1 000 XOF</span></p>
                <p>Frais (ex: 10%) : <span className="text-destructive">+100 XOF</span></p>
                <p>Debit wallet : <span className="text-destructive font-semibold">1 100 XOF</span></p>
              </div>
            </div>
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
                    ["amount", "number", "Oui", "Montant que le client paiera. Les frais seront deduits avant credit dans votre wallet"],
                    ["currency", "string", "Oui", "Devise: XOF, XAF, CDF, ZMW, UGX"],
                    ["description", "string", "Non", "Description du paiement"],
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

          <div>
            <h3 className="font-semibold mb-3">Erreurs Payin</h3>
            <div className="space-y-2">
              {[
                { code: "INVALID_TOKEN", http: "401", desc: "Token business invalide ou manquant" },
                { code: "TOKEN_INACTIVE", http: "403", desc: "Token desactive" },
                { code: "ACCOUNT_SUSPENDED", http: "403", desc: "Compte entreprise suspendu" },
                { code: "ACCOUNT_NOT_VERIFIED", http: "403", desc: "KYC entreprise non verifie" },
                { code: "COUNTRY_UNAVAILABLE", http: "400", desc: "Pays non disponible pour le payin" },
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
                    ["amount", "number", "Oui", "Montant exact que le destinataire recevra. Les frais sont preleves separement sur votre solde"],
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

          <div>
            <h3 className="font-semibold mb-3">Erreurs Payout</h3>
            <div className="space-y-2">
              {[
                { code: "INVALID_TOKEN", http: "401", desc: "Token business invalide ou manquant" },
                { code: "TOKEN_INACTIVE", http: "403", desc: "Token desactive" },
                { code: "ACCOUNT_SUSPENDED", http: "403", desc: "Compte entreprise suspendu" },
                { code: "ACCOUNT_NOT_VERIFIED", http: "403", desc: "KYC entreprise non verifie" },
                { code: "INSUFFICIENT_FUNDS", http: "400", desc: "Solde insuffisant dans le wallet du pays" },
                { code: "COUNTRY_UNAVAILABLE", http: "400", desc: "Pays non disponible pour le payout" },
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
            Configurez votre URL de webhook dans le tableau de bord pour recevoir des notifications
            automatiques lorsque les transactions changent de statut.
            Une seule URL recoit tous les evenements (payin et payout). Exemple : <code className="font-mono bg-muted px-1 rounded text-xs">https://votre-site.com/api/webhook/bkapay</code>
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
            <p className="text-xs text-muted-foreground">
              <strong>amount</strong> = montant paye par le client. <strong>fee</strong> = frais deduits de votre wallet.
              Votre wallet est credite de (amount - fee).
            </p>
            <Button onClick={() => copyCode(webhookPayinPayload)} variant="outline" size="sm" className="w-full" data-testid="button-copy-biz-webhook-payin">
              <Copy className="w-4 h-4 mr-2" /> Copier
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Payload Payout</h4>
            <pre className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">{webhookPayoutPayload}</pre>
            <p className="text-xs text-muted-foreground">
              <strong>amount</strong> = montant recu par le destinataire. <strong>fee</strong> = frais supplementaires.
              Votre wallet est debite de (amount + fee).
            </p>
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

      <p className="text-xs text-muted-foreground mt-2">
        Les erreurs sont retournees dans le format: <code className="font-mono">{"{ \"success\": false, \"error\": { \"code\": \"...\", \"message\": \"...\" } }"}</code>
      </p>
    </div>
  );
}
