import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, AlertTriangle, ArrowLeft, ArrowRight, Clock, Webhook, Layers, Monitor } from "lucide-react";
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
          onClick={() => setLocation(`${basePath}/inline/${v.version}`)}
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

export default function DocumentationInline({ version }: Props) {
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

  const inlineJsExample = `<!-- 1. Ajoutez le script BKApay sur votre page -->
<script src="${baseUrl}/bkapay-inline.js"><\/script>

<!-- 2. Bouton de paiement -->
<button id="btn-payer" onclick="payerBKApay()">Payer 5 000 XOF</button>

<script>
function payerBKApay() {
  BKApay.checkout({
    key: "pk_live_VOTRE_CLE_PUBLIQUE",
    amount: 5000,
    description: "Achat produit",
    // Informations client (optionnelles - si non fournies, le formulaire les demandera)
    customer: {
      name: "Jean Dupont",
      email: "jean@example.com",
      phone: "22961000000"
    },
    onSuccess: function(response) {
      console.log("Paiement reussi !");
      console.log("Transaction ID:", response.transactionId);
      console.log("Montant:", response.amount);
      console.log("Statut:", response.status); // "completed"
      // La fenetre se ferme automatiquement apres 3 secondes
    },
    onError: function(error) {
      console.log("Paiement echoue:", error.message);
      console.log("Statut:", error.status); // "failed" ou "expired"
      // La fenetre se ferme automatiquement apres 3 secondes
    },
    onClose: function(data) {
      console.log("Paiement annule par le client");
      console.log("Statut:", data.status); // "cancelled"
    }
  });
}
<\/script>`;

  const inlineReactExample = `import { useEffect, useRef } from "react";

// Charger le script BKApay
function useBKApayScript() {
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    const script = document.createElement("script");
    script.src = "${baseUrl}/bkapay-inline.js";
    script.async = true;
    document.body.appendChild(script);
    loaded.current = true;
  }, []);
}

function BoutonPaiement({ montant, description }) {
  useBKApayScript();

  const handlePayer = () => {
    window.BKApay.checkout({
      key: "pk_live_VOTRE_CLE_PUBLIQUE",
      amount: montant,
      description: description,
      onSuccess: (response) => {
        console.log("Paiement reussi:", response.transactionId);
        // La fenetre se ferme automatiquement
      },
      onError: (error) => {
        console.error("Erreur:", error.message, error.status);
        // La fenetre se ferme automatiquement
      },
      onClose: (data) => {
        console.log("Annule:", data.status); // "cancelled"
      }
    });
  };

  return <button onClick={handlePayer}>Payer {montant} XOF</button>;
}`;

  const inlinePhpExample = `<!-- Dans votre template PHP -->
<!DOCTYPE html>
<html>
<head>
  <title>Paiement</title>
  <script src="${baseUrl}/bkapay-inline.js"><\/script>
</head>
<body>
  <?php
    $montant = 5000;
    $description = "Commande #" . $orderId;
    $clePublique = "pk_live_VOTRE_CLE_PUBLIQUE";
  ?>

  <button onclick="payerBKApay()">Payer <?= number_format($montant) ?> XOF</button>

  <script>
    function payerBKApay() {
      BKApay.checkout({
        key: "<?= $clePublique ?>",
        amount: <?= $montant ?>,
        description: "<?= addslashes($description) ?>",
        onSuccess: function(response) {
          // Envoyer le transactionId a votre serveur pour verification
          fetch("/verifier-paiement.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: response.transactionId })
          }).then(function() {
            window.location.href = "/commande-confirmee.php";
          });
        },
        onError: function(error) {
          alert("Erreur de paiement: " + error.message);
          // La fenetre se ferme automatiquement
        },
        onClose: function(data) {
          console.log("Paiement annule:", data.status);
        }
      });
    }
  <\/script>
</body>
</html>`;

  const inlineMobileExample = `// React Native / Expo - Utilisation avec WebView
import { WebView } from "react-native-webview";
import { Modal, View } from "react-native";

function BKApayModal({ visible, onClose, amount, publicKey, onSuccess, onError }) {
  const paymentUrl = "${baseUrl}/api-pay/" + publicKey 
    + "?amount=" + amount 
    + "&mode=inline";

  const handleMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === "bkapay_payment_success") {
      // La fenetre se ferme automatiquement apres 3 secondes
      onSuccess({ transactionId: data.transactionId, amount: data.amount, status: "completed" });
      onClose();
    } else if (data.type === "bkapay_payment_error") {
      // Echec ou expiration - fermeture automatique
      if (onError) onError({ message: data.message, status: data.status });
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose({ status: "cancelled" })}>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: paymentUrl }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
        />
      </View>
    </Modal>
  );
}

// Flutter - Utilisation avec url_launcher ou webview_flutter
// Ouvrir l'URL de paiement dans un WebView integre:
// "${baseUrl}/api-pay/VOTRE_CLE?amount=5000&mode=inline"`;

  const statusCheckExample = `// Verification du statut de paiement (cote serveur)
// Apres que onSuccess est appele, verifiez toujours cote serveur

// Node.js
const verifierPaiement = async (transactionId) => {
  const response = await fetch(
    "${baseUrl}/api/inline-pay/status/" + transactionId
  );
  const data = await response.json();
  
  if (data.status === "completed") {
    console.log("Paiement confirme !");
    console.log("Montant:", data.amount, data.currency);
    // Activer le service / livrer la commande
  } else if (data.status === "pending") {
    console.log("Paiement en attente de confirmation...");
    // Re-verifier dans quelques secondes
  } else {
    console.log("Paiement echoue ou annule");
  }
};

// PHP
$transactionId = $_POST['transactionId'];
$response = file_get_contents(
  "${baseUrl}/api/inline-pay/status/" . $transactionId
);
$data = json_decode($response, true);

if ($data['status'] === 'completed') {
    // Paiement confirme - activer le service
    activerCommande($transactionId);
}`;

  const configOptionsExample = `BKApay.checkout({
  // === REQUIS ===
  key: "pk_live_VOTRE_CLE_PUBLIQUE",   // Votre cle API publique
  amount: 5000,                          // Montant a payer

  // === OPTIONNELS ===
  description: "Achat produit",          // Description du paiement
  orderId: "CMD-12345",                  // Reference de votre commande

  // Informations client pre-remplies (optionnel)
  customer: {
    name: "Jean Dupont",                 // Nom du client
    email: "jean@example.com",           // Email du client
    phone: "22961000000"                 // Telephone avec indicatif pays
  },

  // === CALLBACKS ===
  onSuccess: function(response) {
    // response.transactionId  - ID unique de la transaction
    // response.amount         - Montant paye
    // response.status         - "completed"
    // La fenetre se ferme automatiquement apres 3 secondes
  },
  onError: function(error) {
    // error.message           - Description de l'erreur
    // error.transactionId     - ID de la transaction echouee
    // error.status            - "failed" ou "expired"
    // La fenetre se ferme automatiquement apres 3 secondes
  },
  onClose: function(data) {
    // data.status             - "cancelled"
    // Appele uniquement si le client ferme la fenetre sans payer
  }
});`;

  const webhookExample = `// Webhook BKApay - Activation automatique d'abonnement
const crypto = require('crypto');

app.post('/api/webhook/bkapay', express.json(), (req, res) => {
  const signature = req.headers['x-bkapay-signature'];
  const secret = process.env.BKAPAY_CALLBACK_SECRET;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Signature invalide' });
  }
  
  const { event, transactionId, amount, status, customerEmail } = req.body;
  
  if (event === 'payment.completed' && status === 'completed') {
    activerAbonnement(customerEmail, transactionId);
  }
  
  res.json({ received: true });
});`;

  const webhookPhpExample = `<?php
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$secret = getenv('BKAPAY_CALLBACK_SECRET');

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
              Inline / Modal Checkout
            </h1>
            <Badge variant="secondary" className="text-sm">
              {docVersion.version}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          La fenetre de paiement s'ouvre directement sur votre site
        </p>
        <VersionSelector currentVersion={docVersion.version} basePath={basePath} />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Comment ca marche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'integration Inline / Modal ouvre une fenetre de paiement directement sur votre site ou application.
            Le client ne quitte jamais votre page - la fenetre se superpose et gere tout le processus de paiement
            (selection du pays, operateur, saisie des informations, validation).
          </p>
          
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">1.</span> Ajoutez le script BKApay sur votre page</p>
            <p><span className="font-semibold">2.</span> Appelez <code className="bg-muted px-1 rounded font-mono text-xs">BKApay.checkout()</code> avec vos parametres</p>
            <p><span className="font-semibold">3.</span> La fenetre de paiement s'ouvre sur votre site</p>
            <p><span className="font-semibold">4.</span> Le client choisit son pays, operateur et paie</p>
            <p><span className="font-semibold">5.</span> La fenetre se ferme automatiquement et votre callback <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> ou <code className="bg-muted px-1 rounded font-mono text-xs">onError</code> est appele</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Integration rapide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary">
              {`<script src="${baseUrl}/bkapay-inline.js"></script>`}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            Ajoutez cette ligne dans le <code className="bg-muted px-1 rounded font-mono text-xs">&lt;head&gt;</code> ou avant la fermeture du <code className="bg-muted px-1 rounded font-mono text-xs">&lt;/body&gt;</code> de votre page HTML.
          </p>
          <Button 
            onClick={() => copyCode(`<script src="${baseUrl}/bkapay-inline.js"></script>`)} 
            variant="outline" 
            size="sm" 
            className="w-full"
            data-testid="button-copy-inline-script"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier le script
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Options de configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
            <pre>{configOptionsExample}</pre>
          </div>
          <Button 
            onClick={() => copyCode(configOptionsExample)} 
            variant="outline" 
            size="sm" 
            className="w-full"
            data-testid="button-copy-config"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier
          </Button>

          <div className="space-y-3 mt-4">
            <h4 className="font-semibold text-sm">Parametres requis</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">key</Badge>
                  <span className="text-muted-foreground">Votre cle API publique (commence par pk_live_)</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">amount</Badge>
                  <span className="text-muted-foreground">Montant a payer (minimum 200)</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-primary/30">
                  Dans la devise de votre compte (XOF, XAF ou CDF)
                </p>
              </div>
            </div>

            <h4 className="font-semibold text-sm mt-4">Parametres optionnels</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <Badge variant="outline">description</Badge>
                <span className="text-muted-foreground">Description du paiement</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">orderId</Badge>
                <span className="text-muted-foreground">Reference de votre commande</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">customer</Badge>
                <span className="text-muted-foreground">Objet avec name, email, phone (pre-remplissage)</span>
              </div>
            </div>

            <h4 className="font-semibold text-sm mt-4">Callbacks</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">onSuccess(response)</Badge>
                  <span className="text-muted-foreground">Paiement reussi - fermeture auto</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-green-500/30">
                  Contient transactionId, amount et status ("completed")
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">onError(error)</Badge>
                  <span className="text-muted-foreground">Echec du paiement - fermeture auto</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-red-500/30">
                  Contient message, transactionId et status ("failed" ou "expired")
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">onClose(data)</Badge>
                  <span className="text-muted-foreground">Client ferme sans payer</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-amber-500/30">
                  Contient status ("cancelled") - uniquement si fermeture manuelle
                </p>
              </div>
            </div>
          </div>
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
              <Badge>HTML / JavaScript</Badge>
              <span className="text-sm text-muted-foreground">Integration web basique</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{inlineJsExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(inlineJsExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-inline-js"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>React</Badge>
              <span className="text-sm text-muted-foreground">Composant React</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{inlineReactExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(inlineReactExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-inline-react"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>PHP</Badge>
              <span className="text-sm text-muted-foreground">Integration dans un template PHP</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{inlinePhpExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(inlinePhpExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-inline-php"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>Mobile (React Native / Flutter)</Badge>
              <span className="text-sm text-muted-foreground">Integration dans une application mobile</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{inlineMobileExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(inlineMobileExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-inline-mobile"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Verification du statut (cote serveur)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apres un paiement reussi, verifiez toujours le statut cote serveur avant d'activer un service ou de livrer une commande.
          </p>

          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary">
              GET {baseUrl}/api/inline-pay/status/TRANSACTION_ID
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">Reponse</h4>
            <div className="flex gap-2">
              <Badge variant="outline">status</Badge>
              <span className="text-muted-foreground">"completed", "pending" ou "failed"</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">amount</Badge>
              <span className="text-muted-foreground">Montant de la transaction</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">currency</Badge>
              <span className="text-muted-foreground">Devise (XOF, XAF, CDF)</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">transactionId</Badge>
              <span className="text-muted-foreground">Identifiant unique</span>
            </div>
          </div>

          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
            <pre>{statusCheckExample}</pre>
          </div>
          <Button 
            onClick={() => copyCode(statusCheckExample)} 
            variant="outline" 
            size="sm" 
            className="w-full"
            data-testid="button-copy-status-check"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier
          </Button>
        </CardContent>
      </Card>

      {docVersion.version === "v1.4" && (
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
                <p><span className="font-semibold">3.</span> Entrez l'URL de votre endpoint webhook (HTTPS requis)</p>
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
          Documentation API BKApay - Inline / Modal Checkout - Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour: {docVersion.releaseDate}
        </p>
      </div>
    </div>
  );
}
