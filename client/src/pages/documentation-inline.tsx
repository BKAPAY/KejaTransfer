import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, AlertTriangle, ArrowLeft, ArrowRight, Clock, Webhook, Layers, Monitor, Shield, MessageSquare, HelpCircle, CheckCircle, XCircle, Info } from "lucide-react";
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
    // Reference unique de votre commande (pour le suivi et le webhook)
    orderId: "CMD-2024-001",
    // Informations client (optionnelles - si non fournies, le formulaire les demandera)
    customer: {
      name: "Jean Dupont",
      email: "jean@example.com",
      phone: "22961000000"
    },
    onSuccess: function(response) {
      // IMPORTANT: Ce callback confirme le paiement cote client
      // Vous DEVEZ aussi verifier cote serveur avant d'activer un service
      console.log("Paiement reussi !");
      console.log("Transaction ID:", response.transactionId);
      console.log("Montant:", response.amount);
      console.log("Statut:", response.status); // "completed"
      // La fenetre se ferme automatiquement apres 3 secondes
      // Envoyez le transactionId a votre serveur pour verification
      verifierCoteServeur(response.transactionId);
    },
    onError: function(error) {
      console.log("Paiement echoue:", error.message);
      console.log("Transaction ID:", error.transactionId);
      console.log("Statut:", error.status); // "failed" ou "expired"
      // La fenetre se ferme automatiquement apres 3 secondes
    },
    onClose: function(data) {
      // Appele UNIQUEMENT quand le client ferme la fenetre manuellement
      // N'est PAS appele apres onSuccess ou onError
      console.log("Paiement annule par le client");
      console.log("Statut:", data.status); // "cancelled"
    }
  });
}

// Verification cote serveur (OBLIGATOIRE)
function verifierCoteServeur(transactionId) {
  fetch("/api/verifier-paiement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId: transactionId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.confirmed) {
      window.location.href = "/commande-confirmee";
    }
  });
}
<\/script>`;

  const inlineReactExample = `import { useEffect, useRef } from "react";

// Hook personnalise pour charger le script BKApay une seule fois
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

function BoutonPaiement({ montant, description, orderId, onPaymentComplete }) {
  useBKApayScript();

  const handlePayer = () => {
    window.BKApay.checkout({
      key: "pk_live_VOTRE_CLE_PUBLIQUE",
      amount: montant,
      description: description,
      orderId: orderId,
      onSuccess: (response) => {
        // response = { transactionId, amount, status: "completed" }
        console.log("Paiement reussi:", response.transactionId);
        // IMPORTANT: Verifier cote serveur avant d'activer le service
        fetch("/api/verifier-paiement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: response.transactionId })
        }).then(res => res.json()).then(data => {
          if (data.confirmed) onPaymentComplete(response);
        });
        // La fenetre se ferme automatiquement apres 3 secondes
      },
      onError: (error) => {
        // error = { message, transactionId, status: "failed"|"expired" }
        console.error("Erreur:", error.message, error.status);
        // La fenetre se ferme automatiquement apres 3 secondes
      },
      onClose: (data) => {
        // data = { status: "cancelled" }
        // Uniquement si fermeture manuelle par le client
        console.log("Annule:", data.status);
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
        orderId: "<?= $orderId ?>",
        onSuccess: function(response) {
          // IMPORTANT: Envoyer le transactionId a votre serveur pour verification
          // Ne JAMAIS activer un service basee uniquement sur ce callback
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
          // error.status peut etre "failed" ou "expired"
          // La fenetre se ferme automatiquement apres 3 secondes
        },
        onClose: function(data) {
          // Uniquement si le client ferme manuellement la fenetre
          console.log("Paiement annule:", data.status); // "cancelled"
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
      // Paiement reussi - fenetre se ferme automatiquement apres 3 secondes
      // IMPORTANT: Verifier cote serveur avant d'activer le service
      onSuccess({ transactionId: data.transactionId, amount: data.amount, status: "completed" });
      onClose();
    } else if (data.type === "bkapay_payment_error") {
      // Echec ou expiration - fermeture automatique apres 3 secondes
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
// Apres que onSuccess est appele, verifiez TOUJOURS cote serveur
// avant d'activer un service ou de livrer une commande

// === Node.js / Express ===
const verifierPaiement = async (transactionId) => {
  const response = await fetch(
    "${baseUrl}/api/inline-pay/status/" + transactionId
  );
  const data = await response.json();
  
  if (data.status === "completed") {
    console.log("Paiement confirme par le serveur !");
    console.log("Montant:", data.amount, data.currency);
    console.log("Client:", data.customerName, data.customerEmail);
    // Le solde du marchand a deja ete credite automatiquement
    // Vous pouvez maintenant activer le service / livrer la commande
    return { confirmed: true, amount: data.amount };
  } else if (data.status === "pending") {
    console.log("Paiement en attente de confirmation...");
    // Re-verifier dans quelques secondes
    return { confirmed: false, pending: true };
  } else {
    console.log("Paiement echoue ou annule:", data.status);
    return { confirmed: false };
  }
};

// Route Express pour la verification
app.post("/api/verifier-paiement", async (req, res) => {
  const { transactionId } = req.body;
  const result = await verifierPaiement(transactionId);
  res.json(result);
});`;

  const statusCheckPhpExample = `<?php
// === PHP - Verification du statut ===
function verifierPaiement($transactionId) {
    $url = "${baseUrl}/api/inline-pay/status/" . $transactionId;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return ['confirmed' => false, 'error' => 'Erreur HTTP ' . $httpCode];
    }
    
    $data = json_decode($response, true);
    
    if ($data['status'] === 'completed') {
        // Paiement confirme - le solde marchand a deja ete credite
        return ['confirmed' => true, 'amount' => $data['amount']];
    }
    
    return ['confirmed' => false, 'status' => $data['status']];
}

// Utilisation dans votre controller
$transactionId = $_POST['transactionId'];
$result = verifierPaiement($transactionId);

if ($result['confirmed']) {
    activerCommande($transactionId);
    echo json_encode(['confirmed' => true]);
} else {
    echo json_encode(['confirmed' => false]);
}
?>`;

  const statusCheckPythonExample = `# === Python (Flask / Django) - Verification du statut ===
import requests

def verifier_paiement(transaction_id):
    url = f"${baseUrl}/api/inline-pay/status/{transaction_id}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data["status"] == "completed":
            # Paiement confirme - le solde marchand a deja ete credite
            return {"confirmed": True, "amount": data["amount"]}
        elif data["status"] == "pending":
            return {"confirmed": False, "pending": True}
        else:
            return {"confirmed": False, "status": data["status"]}
    except requests.RequestException as e:
        return {"confirmed": False, "error": str(e)}

# Flask
@app.route("/api/verifier-paiement", methods=["POST"])
def api_verifier():
    transaction_id = request.json.get("transactionId")
    result = verifier_paiement(transaction_id)
    return jsonify(result)`;

  const configOptionsExample = `BKApay.checkout({
  // === REQUIS ===
  key: "pk_live_VOTRE_CLE_PUBLIQUE",   // Votre cle API publique
  amount: 5000,                          // Montant a payer (minimum 200)

  // === OPTIONNELS ===
  description: "Achat produit",          // Description du paiement
  orderId: "CMD-12345",                  // Reference de votre commande

  // Informations client pre-remplies (optionnel)
  // Si non fournies, le formulaire de paiement les demandera
  customer: {
    name: "Jean Dupont",                 // Nom du client
    email: "jean@example.com",           // Email du client
    phone: "22961000000"                 // Telephone avec indicatif pays
  },

  // === CALLBACKS ===
  onSuccess: function(response) {
    // Appele quand le paiement est confirme
    // response.transactionId  - ID unique de la transaction
    // response.amount         - Montant paye
    // response.status         - "completed"
    // La fenetre se ferme automatiquement apres 3 secondes
    // IMPORTANT: Verifiez toujours cote serveur !
  },
  onError: function(error) {
    // Appele quand le paiement echoue ou expire
    // error.message           - Description de l'erreur
    // error.transactionId     - ID de la transaction echouee
    // error.status            - "failed" ou "expired"
    // La fenetre se ferme automatiquement apres 3 secondes
  },
  onClose: function(data) {
    // Appele UNIQUEMENT quand le client ferme la fenetre manuellement
    // N'est PAS appele apres onSuccess ou onError
    // data.status             - "cancelled"
  }
});`;

  const webhookExample = `// Webhook BKApay - Verification de signature et traitement
const crypto = require('crypto');
const express = require('express');

app.post('/api/webhook/bkapay', express.json(), (req, res) => {
  // 1. Recuperer la signature et le secret
  const signature = req.headers['x-bkapay-signature'];
  const event = req.headers['x-bkapay-event'];
  const timestamp = req.headers['x-bkapay-timestamp'];
  const secret = process.env.BKAPAY_CALLBACK_SECRET;
  
  // 2. Verifier la signature HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    console.error('Signature webhook invalide !');
    return res.status(401).json({ error: 'Signature invalide' });
  }
  
  // 3. Verifier que le timestamp n'est pas trop ancien (anti-replay)
  const webhookTime = new Date(timestamp).getTime();
  const now = Date.now();
  if (Math.abs(now - webhookTime) > 5 * 60 * 1000) { // 5 minutes
    return res.status(400).json({ error: 'Timestamp expire' });
  }
  
  // 4. Traiter l'evenement
  const { 
    event: eventType, 
    transactionId, 
    externalReference,
    amount, 
    fee,
    netAmount,
    currency,
    status, 
    customerName,
    customerEmail,
    customerPhone,
    country,
    operator,
    description
  } = req.body;
  
  if (eventType === 'payment.completed' && status === 'completed') {
    // Le solde du marchand a deja ete credite automatiquement
    // netAmount = montant net recu par le marchand
    console.log(\`Paiement recu: \${amount} \${currency}\`);
    console.log(\`Montant net: \${netAmount} \${currency}\`);
    console.log(\`Client: \${customerName} (\${customerEmail})\`);
    
    // Activer l'abonnement ou livrer la commande
    activerAbonnement(customerEmail, transactionId, externalReference);
  } else if (eventType === 'payment.failed') {
    console.log(\`Paiement echoue: \${transactionId}\`);
    // Gerer l'echec si necessaire
  }
  
  // 5. Repondre rapidement (200 OK)
  res.json({ received: true });
});`;

  const webhookPhpExample = `<?php
// Webhook BKApay - PHP - Verification et traitement

// 1. Lire le payload brut (IMPORTANT: ne pas utiliser $_POST)
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$event = $_SERVER['HTTP_X_BKAPAY_EVENT'] ?? '';
$timestamp = $_SERVER['HTTP_X_BKAPAY_TIMESTAMP'] ?? '';
$secret = getenv('BKAPAY_CALLBACK_SECRET');

// 2. Verifier la signature HMAC-SHA256
$expectedSignature = hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Signature invalide']);
    exit;
}

// 3. Verifier le timestamp (anti-replay, 5 minutes max)
$webhookTime = strtotime($timestamp);
$now = time();
if (abs($now - $webhookTime) > 300) {
    http_response_code(400);
    echo json_encode(['error' => 'Timestamp expire']);
    exit;
}

// 4. Decoder et traiter le payload
$data = json_decode($payload, true);

if ($data['event'] === 'payment.completed' && $data['status'] === 'completed') {
    // Le solde du marchand a deja ete credite automatiquement
    $transactionId = $data['transactionId'];
    $montant = $data['amount'];        // Montant paye par le client
    $frais = $data['fee'];             // Frais de service
    $montantNet = $data['netAmount'];  // Montant net recu par le marchand
    $email = $data['customerEmail'];
    $reference = $data['externalReference'];
    
    // Activer l'abonnement ou livrer la commande
    activerAbonnement($email, $transactionId, $reference);
}

// 5. Repondre rapidement
echo json_encode(['received' => true]);
?>`;

  const webhookPythonExample = `# Webhook BKApay - Python (Flask) - Verification et traitement
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/webhook/bkapay', methods=['POST'])
def webhook_bkapay():
    # 1. Recuperer les headers et le payload
    signature = request.headers.get('X-BKApay-Signature', '')
    event = request.headers.get('X-BKApay-Event', '')
    timestamp = request.headers.get('X-BKApay-Timestamp', '')
    secret = os.environ.get('BKAPAY_CALLBACK_SECRET', '')
    
    payload = request.get_data(as_text=True)
    
    # 2. Verifier la signature HMAC-SHA256
    expected = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected, signature):
        return jsonify({'error': 'Signature invalide'}), 401
    
    # 3. Verifier le timestamp (anti-replay)
    webhook_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    if abs((datetime.now(webhook_time.tzinfo) - webhook_time).total_seconds()) > 300:
        return jsonify({'error': 'Timestamp expire'}), 400
    
    # 4. Traiter l'evenement
    data = request.get_json()
    
    if data['event'] == 'payment.completed' and data['status'] == 'completed':
        # Le solde du marchand a deja ete credite automatiquement
        transaction_id = data['transactionId']
        montant_net = data['netAmount']  # Montant net recu
        email = data.get('customerEmail')
        reference = data.get('externalReference')
        
        activer_abonnement(email, transaction_id, reference)
    
    # 5. Repondre rapidement
    return jsonify({'received': True})`;

  const webhookPayloadExample = `{
  "event": "payment.completed",
  "transactionId": "abc123-def456",
  "externalReference": "CMD-2024-001",
  "amount": 5000,
  "fee": 0,
  "netAmount": 5000,
  "currency": "XOF",
  "status": "completed",
  "customerName": "Jean Dupont",
  "customerEmail": "jean@example.com",
  "customerPhone": "771234567",
  "country": "SN",
  "operator": "orange",
  "description": "Abonnement Premium",
  "timestamp": "2026-01-15T10:30:00.000Z"
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
          La fenetre de paiement s'ouvre directement sur votre site - le client ne quitte jamais votre page
        </p>
        <VersionSelector currentVersion={docVersion.version} basePath={basePath} />
      </div>

      {/* Section 1: Comment ca marche */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Comment ca marche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'integration Inline / Modal ouvre une fenetre de paiement (iframe) directement sur votre site ou application.
            Le client ne quitte jamais votre page - la fenetre se superpose et gere tout le processus de paiement
            (selection du pays, operateur, saisie des informations, validation). C'est la methode recommandee pour une
            experience utilisateur optimale car elle evite la redirection vers une page externe.
          </p>
          
          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
              <div>
                <p className="font-semibold">Ajoutez le script BKApay</p>
                <p className="text-muted-foreground">Incluez <code className="bg-muted px-1 rounded font-mono text-xs">&lt;script src="{baseUrl}/bkapay-inline.js"&gt;</code> dans votre page HTML. Ce script charge la librairie BKApay qui permet d'ouvrir la fenetre de paiement.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
              <div>
                <p className="font-semibold">Appelez BKApay.checkout()</p>
                <p className="text-muted-foreground">Quand le client clique sur votre bouton de paiement, appelez <code className="bg-muted px-1 rounded font-mono text-xs">BKApay.checkout({`{...}`})</code> avec votre cle publique, le montant, et vos callbacks.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
              <div>
                <p className="font-semibold">La fenetre de paiement s'ouvre</p>
                <p className="text-muted-foreground">Un modal/iframe s'affiche par-dessus votre page. Le client voit le formulaire de paiement BKApay sans quitter votre site.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</div>
              <div>
                <p className="font-semibold">Le client choisit son pays, operateur et paie</p>
                <p className="text-muted-foreground">Le formulaire gere la selection du pays, de l'operateur mobile money, la saisie du numero de telephone et la validation du paiement.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">5</div>
              <div>
                <p className="font-semibold">Le paiement est traite</p>
                <p className="text-muted-foreground">BKApay traite le paiement via l'operateur mobile money. Le solde du marchand est credite automatiquement. Aucune action requise de votre part.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">6</div>
              <div>
                <p className="font-semibold">Callback JavaScript + fermeture automatique</p>
                <p className="text-muted-foreground">Votre callback <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> ou <code className="bg-muted px-1 rounded font-mono text-xs">onError</code> est appele. La fenetre se ferme automatiquement apres 3 secondes. Verifiez ensuite le paiement cote serveur.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Section 3: Securite - Verification serveur obligatoire */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Securite - Verification serveur obligatoire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 dark:text-red-200">CRITIQUE : Ne jamais faire confiance au callback JavaScript seul</AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
              Le callback <code className="bg-red-100 dark:bg-red-900 px-1 rounded font-mono text-xs">onSuccess</code> s'execute dans le navigateur du client. 
              Un utilisateur malveillant pourrait modifier le code JavaScript ou simuler un appel a <code className="bg-red-100 dark:bg-red-900 px-1 rounded font-mono text-xs">onSuccess</code> sans 
              avoir reellement paye. <strong>Vous DEVEZ toujours verifier le paiement cote serveur</strong> avant d'activer un service, 
              de livrer une commande, ou de debloquer du contenu.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-semibold">Pourquoi la verification serveur est necessaire ?</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Le JavaScript cote client peut etre modifie par l'utilisateur via les outils de developpement du navigateur</li>
              <li>Un attaquant pourrait appeler directement votre fonction <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> avec de faux parametres</li>
              <li>Les requetes reseau peuvent etre interceptees et modifiees (attaque "man-in-the-middle")</li>
              <li>Seule la verification serveur via l'API BKApay garantit l'authenticite du paiement</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Deux methodes de verification :</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-lg bg-background border">
                <p className="font-semibold text-sm">1. Verification active (Polling)</p>
                <p className="text-xs text-muted-foreground">Apres <code className="bg-muted px-1 rounded font-mono">onSuccess</code>, envoyez le <code className="bg-muted px-1 rounded font-mono">transactionId</code> a votre serveur qui appelle l'API de statut BKApay.</p>
                <Badge variant="outline" className="mt-2">Recommande pour les sites simples</Badge>
              </div>
              <div className="p-3 rounded-lg bg-background border">
                <p className="font-semibold text-sm">2. Webhook (Notification push)</p>
                <p className="text-xs text-muted-foreground">BKApay envoie automatiquement une notification POST signee a votre serveur quand le paiement est complete.</p>
                <Badge variant="outline" className="mt-2">Recommande pour les SaaS / abonnements</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Exemples de verification serveur</h4>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Node.js</Badge>
              </div>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{statusCheckExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(statusCheckExample)} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                data-testid="button-copy-verify-nodejs"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>PHP</Badge>
              </div>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{statusCheckPhpExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(statusCheckPhpExample)} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                data-testid="button-copy-verify-php"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Python</Badge>
              </div>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{statusCheckPythonExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(statusCheckPythonExample)} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                data-testid="button-copy-verify-python"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Integration rapide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Integration rapide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pour commencer, ajoutez le script BKApay a votre page HTML. Ce script met a disposition l'objet global 
            <code className="bg-muted px-1 rounded font-mono text-xs"> BKApay</code> qui contient la methode <code className="bg-muted px-1 rounded font-mono text-xs">checkout()</code>.
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary">
              {`<script src="${baseUrl}/bkapay-inline.js"></script>`}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            Ajoutez cette ligne dans le <code className="bg-muted px-1 rounded font-mono text-xs">&lt;head&gt;</code> ou avant la fermeture du <code className="bg-muted px-1 rounded font-mono text-xs">&lt;/body&gt;</code> de votre page HTML.
            Le script est leger et se charge de maniere asynchrone pour ne pas ralentir votre page.
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

      {/* Section 5: Options de configuration */}
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
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">key</Badge>
                  <Badge variant="secondary" className="text-xs">requis</Badge>
                  <span className="text-xs text-muted-foreground font-mono">string</span>
                </div>
                <p className="text-muted-foreground mt-1">Votre cle API publique (commence par <code className="bg-muted px-1 rounded font-mono text-xs">pk_live_</code>). Vous la trouverez dans la section "Cles API" de votre tableau de bord BKApay. Ne confondez pas avec votre cle secrete qui ne doit JAMAIS etre utilisee cote client.</p>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">amount</Badge>
                  <Badge variant="secondary" className="text-xs">requis</Badge>
                  <span className="text-xs text-muted-foreground font-mono">number</span>
                </div>
                <p className="text-muted-foreground mt-1">Montant a payer en unite monetaire (pas de centimes). Minimum 200. La devise est determinee par la configuration de votre compte marchand (XOF, XAF ou CDF).</p>
              </div>
            </div>

            <h4 className="font-semibold text-sm mt-4">Parametres optionnels</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">description</Badge>
                  <span className="text-xs text-muted-foreground font-mono">string</span>
                </div>
                <p className="text-muted-foreground mt-1">Description du paiement affichee au client dans la fenetre de paiement. Exemple : "Abonnement Premium", "Commande #12345".</p>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">orderId</Badge>
                  <span className="text-xs text-muted-foreground font-mono">string</span>
                </div>
                <p className="text-muted-foreground mt-1">Reference unique de votre commande dans votre systeme. Cette valeur sera renvoyee dans le champ <code className="bg-muted px-1 rounded font-mono text-xs">externalReference</code> du webhook, vous permettant de retrouver la commande correspondante.</p>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">customer</Badge>
                  <span className="text-xs text-muted-foreground font-mono">object</span>
                </div>
                <p className="text-muted-foreground mt-1">Objet contenant les informations pre-remplies du client. Si non fourni, le formulaire de paiement demandera ces informations.</p>
                <div className="ml-4 mt-2 space-y-1 text-xs text-muted-foreground">
                  <p><code className="bg-muted px-1 rounded font-mono">name</code> - Nom complet du client</p>
                  <p><code className="bg-muted px-1 rounded font-mono">email</code> - Adresse email du client</p>
                  <p><code className="bg-muted px-1 rounded font-mono">phone</code> - Numero de telephone avec indicatif pays (ex: "22961000000")</p>
                </div>
              </div>
            </div>

            <h4 className="font-semibold text-sm mt-4">Callbacks</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">onSuccess(response)</Badge>
                  <span className="text-xs text-muted-foreground font-mono">function</span>
                </div>
                <p className="text-muted-foreground mt-1">Appele quand le paiement est confirme avec succes. La fenetre se ferme automatiquement apres 3 secondes.</p>
                <div className="ml-4 mt-2 space-y-1 text-xs text-muted-foreground">
                  <p><code className="bg-muted px-1 rounded font-mono">response.transactionId</code> - Identifiant unique de la transaction</p>
                  <p><code className="bg-muted px-1 rounded font-mono">response.amount</code> - Montant paye par le client</p>
                  <p><code className="bg-muted px-1 rounded font-mono">response.status</code> - Toujours <code className="bg-muted px-1 rounded font-mono">"completed"</code></p>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">onError(error)</Badge>
                  <span className="text-xs text-muted-foreground font-mono">function</span>
                </div>
                <p className="text-muted-foreground mt-1">Appele quand le paiement echoue ou expire. La fenetre se ferme automatiquement apres 3 secondes.</p>
                <div className="ml-4 mt-2 space-y-1 text-xs text-muted-foreground">
                  <p><code className="bg-muted px-1 rounded font-mono">error.message</code> - Description de l'erreur</p>
                  <p><code className="bg-muted px-1 rounded font-mono">error.transactionId</code> - Identifiant de la transaction echouee</p>
                  <p><code className="bg-muted px-1 rounded font-mono">error.status</code> - <code className="bg-muted px-1 rounded font-mono">"failed"</code> (echec) ou <code className="bg-muted px-1 rounded font-mono">"expired"</code> (expiration)</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">onClose(data)</Badge>
                  <span className="text-xs text-muted-foreground font-mono">function</span>
                </div>
                <p className="text-muted-foreground mt-1">Appele <strong>uniquement</strong> quand le client ferme la fenetre manuellement sans avoir complete le paiement. N'est PAS appele apres <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> ou <code className="bg-muted px-1 rounded font-mono text-xs">onError</code>.</p>
                <div className="ml-4 mt-2 space-y-1 text-xs text-muted-foreground">
                  <p><code className="bg-muted px-1 rounded font-mono">data.status</code> - Toujours <code className="bg-muted px-1 rounded font-mono">"cancelled"</code></p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Callbacks detailles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Callbacks detailles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Les callbacks sont des fonctions JavaScript que vous definissez et qui sont appelees automatiquement 
            par BKApay a differents moments du processus de paiement. Comprendre leur fonctionnement est essentiel 
            pour une integration correcte.
          </p>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <h4 className="font-semibold">onSuccess(response) - Paiement reussi</h4>
              </div>
              <p className="text-muted-foreground mb-2">
                Ce callback est appele quand le paiement a ete confirme avec succes par l'operateur mobile money. 
                A ce moment, le solde du marchand a deja ete credite automatiquement.
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>Timing :</strong> Appele immediatement apres la confirmation du paiement. La fenetre de paiement 
                affiche un message de succes pendant 3 secondes, puis se ferme automatiquement.
              </p>
              <p className="text-muted-foreground">
                <strong>Action recommandee :</strong> Envoyez le <code className="bg-muted px-1 rounded font-mono text-xs">transactionId</code> a votre serveur 
                pour verification via l'API de statut, puis activez le service ou redirigez le client.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/50">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <h4 className="font-semibold">onError(error) - Paiement echoue</h4>
              </div>
              <p className="text-muted-foreground mb-2">
                Ce callback est appele dans deux cas : quand le paiement echoue (solde insuffisant, numero invalide, 
                refus de l'operateur) ou quand le delai d'attente expire (le client n'a pas valide a temps sur son telephone).
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>Timing :</strong> Appele apres detection de l'echec ou expiration. La fenetre affiche un message 
                d'erreur pendant 3 secondes, puis se ferme automatiquement.
              </p>
              <p className="text-muted-foreground">
                <strong>Distinction des statuts :</strong> <code className="bg-muted px-1 rounded font-mono text-xs">error.status === "failed"</code> signifie un echec 
                definitif. <code className="bg-muted px-1 rounded font-mono text-xs">error.status === "expired"</code> signifie que le delai d'attente a expire 
                (le client peut retenter).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-amber-600" />
                <h4 className="font-semibold">onClose(data) - Fermeture manuelle</h4>
              </div>
              <p className="text-muted-foreground mb-2">
                Ce callback est appele <strong>uniquement</strong> quand le client ferme la fenetre de paiement lui-meme 
                (en cliquant sur le bouton fermer ou en appuyant sur Echap) sans avoir complete le paiement.
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>Important :</strong> Ce callback n'est PAS appele apres <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> ou 
                <code className="bg-muted px-1 rounded font-mono text-xs"> onError</code>. Dans ces cas, la fenetre se ferme automatiquement sans declencher <code className="bg-muted px-1 rounded font-mono text-xs">onClose</code>.
              </p>
              <p className="text-muted-foreground">
                <strong>Cas d'usage :</strong> Utilisez ce callback pour afficher un message "Paiement annule" ou 
                pour proposer au client de reessayer.
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Ordre d'exclusivite :</strong> Pour chaque session de paiement, un seul callback parmi 
              <code className="bg-muted px-1 rounded font-mono text-xs"> onSuccess</code>, <code className="bg-muted px-1 rounded font-mono text-xs">onError</code> et <code className="bg-muted px-1 rounded font-mono text-xs">onClose</code> sera appele. 
              Ils sont mutuellement exclusifs.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Section 7: Exemples d'integration */}
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
              <span className="text-sm text-muted-foreground">Integration web basique avec verification serveur</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Exemple complet montrant l'integration du script, l'appel a BKApay.checkout(), 
              la gestion des callbacks et la verification cote serveur.
            </p>
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
              <span className="text-sm text-muted-foreground">Composant React avec hook personnalise</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Utilisation d'un hook <code className="bg-muted px-1 rounded font-mono">useBKApayScript()</code> pour charger le script 
              une seule fois, et d'un composant reutilisable pour le bouton de paiement.
            </p>
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
              <span className="text-sm text-muted-foreground">Integration dans un template PHP avec verification</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Les variables PHP sont injectees dans le JavaScript cote client. Le callback <code className="bg-muted px-1 rounded font-mono">onSuccess</code> envoie 
              le <code className="bg-muted px-1 rounded font-mono">transactionId</code> a un endpoint PHP pour verification serveur.
            </p>
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
            <p className="text-xs text-muted-foreground mb-2">
              Pour les applications mobiles, utilisez un WebView pour afficher la page de paiement BKApay. 
              Les messages sont echanges via postMessage entre le WebView et votre application native.
            </p>
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

      {/* Section 8: Verification du statut */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Verification du statut (cote serveur)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apres un paiement reussi, verifiez <strong>toujours</strong> le statut cote serveur avant d'activer un service ou de livrer une commande.
            Cette verification est votre garantie que le paiement a bien ete effectue et confirme par BKApay.
          </p>

          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary">
              GET {baseUrl}/api/inline-pay/status/TRANSACTION_ID
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">Champs de la reponse</h4>
            <div className="grid gap-2">
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">status</Badge>
                  <span className="text-xs font-mono text-muted-foreground">string</span>
                </div>
                <p className="text-xs text-muted-foreground"><code className="bg-muted px-1 rounded font-mono">"completed"</code> (paiement confirme), <code className="bg-muted px-1 rounded font-mono">"pending"</code> (en attente de confirmation operateur) ou <code className="bg-muted px-1 rounded font-mono">"failed"</code> (echec)</p>
              </div>
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">amount</Badge>
                  <span className="text-xs font-mono text-muted-foreground">number</span>
                </div>
                <p className="text-xs text-muted-foreground">Montant de la transaction paye par le client</p>
              </div>
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">currency</Badge>
                  <span className="text-xs font-mono text-muted-foreground">string</span>
                </div>
                <p className="text-xs text-muted-foreground">Devise de la transaction : <code className="bg-muted px-1 rounded font-mono">"XOF"</code>, <code className="bg-muted px-1 rounded font-mono">"XAF"</code> ou <code className="bg-muted px-1 rounded font-mono">"CDF"</code></p>
              </div>
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">transactionId</Badge>
                  <span className="text-xs font-mono text-muted-foreground">string</span>
                </div>
                <p className="text-xs text-muted-foreground">Identifiant unique de la transaction BKApay</p>
              </div>
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">customerName</Badge>
                  <span className="text-xs font-mono text-muted-foreground">string</span>
                </div>
                <p className="text-xs text-muted-foreground">Nom du client qui a effectue le paiement</p>
              </div>
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">customerEmail</Badge>
                  <span className="text-xs font-mono text-muted-foreground">string</span>
                </div>
                <p className="text-xs text-muted-foreground">Adresse email du client</p>
              </div>
              <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">customerPhone</Badge>
                  <span className="text-xs font-mono text-muted-foreground">string</span>
                </div>
                <p className="text-xs text-muted-foreground">Numero de telephone du client</p>
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Si le statut est <code className="bg-muted px-1 rounded font-mono text-xs">"pending"</code>, le paiement est en cours de traitement par l'operateur. 
              Attendez quelques secondes et re-verifiez. Les paiements mobile money peuvent prendre jusqu'a 60 secondes 
              pour etre confirmes selon l'operateur.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Section 9: Webhooks */}
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
              Les webhooks permettent a BKApay d'envoyer automatiquement une notification HTTP POST a votre serveur 
              quand un paiement est complete ou echoue. C'est la methode la plus fiable pour activer automatiquement 
              des abonnements, livrer des commandes ou debloquer du contenu, car elle ne depend pas du navigateur du client.
            </p>

            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Webhook vs Verification de statut :</strong> La verification de statut (polling) necessite que votre 
                frontend envoie une requete a votre serveur apres <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code>. Le webhook est envoye 
                directement par BKApay a votre serveur, meme si le client ferme son navigateur. Utilisez les deux pour 
                une fiabilite maximale.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h4 className="font-semibold">Configuration en 4 etapes</h4>
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="font-semibold">Accedez a "Cles API" dans votre tableau de bord</p>
                    <p className="text-muted-foreground">Connectez-vous a votre compte BKApay et allez dans la section "Cles API".</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                  <div>
                    <p className="font-semibold">Cliquez sur "Configurer un callback"</p>
                    <p className="text-muted-foreground">Sur la cle API concernee, cliquez sur le bouton de configuration du callback.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                  <div>
                    <p className="font-semibold">Entrez l'URL de votre endpoint</p>
                    <p className="text-muted-foreground">L'URL doit etre accessible publiquement en HTTPS. Exemple : <code className="bg-muted px-1 rounded font-mono text-xs">https://votre-site.com/api/webhook/bkapay</code></p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</div>
                  <div>
                    <p className="font-semibold">Copiez le secret genere</p>
                    <p className="text-muted-foreground">Un secret unique est genere. Conservez-le dans une variable d'environnement (<code className="bg-muted px-1 rounded font-mono text-xs">BKAPAY_CALLBACK_SECRET</code>). Il sert a verifier la signature des webhooks.</p>
                  </div>
                </div>
              </div>
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <AlertDescription className="text-green-800 dark:text-green-200 text-xs">
                  <strong>Astuce :</strong> la meme URL (<code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">https://votre-site.com/api/webhook/bkapay</code>) peut recevoir a la fois les webhooks payin (<code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">payment.completed</code>, <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">payment.failed</code>) et les webhooks payout (<code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">payout.completed</code>, ...). Identifiez le type par le champ <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">event</code> du payload.
                </AlertDescription>
              </Alert>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Headers HTTP envoyes avec chaque webhook</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">X-BKApay-Signature</Badge>
                    <span className="text-xs font-mono text-muted-foreground">string</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Signature HMAC-SHA256 du body JSON, calculee avec votre <code className="bg-muted px-1 rounded font-mono">callbackSecret</code>. Permet de verifier que le webhook provient bien de BKApay et n'a pas ete modifie.</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">X-BKApay-Event</Badge>
                    <span className="text-xs font-mono text-muted-foreground">string</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Type d'evenement : <code className="bg-muted px-1 rounded font-mono">"payment.completed"</code> ou <code className="bg-muted px-1 rounded font-mono">"payment.failed"</code></p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">X-BKApay-Timestamp</Badge>
                    <span className="text-xs font-mono text-muted-foreground">string</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Horodatage ISO 8601 de l'envoi du webhook. Utile pour la verification anti-replay (rejetez les webhooks trop anciens).</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">Content-Type</Badge>
                    <span className="text-xs font-mono text-muted-foreground">string</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Toujours <code className="bg-muted px-1 rounded font-mono">"application/json"</code></p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Payload complet du webhook</h4>
              <p className="text-sm text-muted-foreground">
                Voici le body JSON envoye par BKApay lors d'un webhook. Tous les champs sont presents a chaque envoi.
              </p>
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

              <div className="grid gap-2 text-sm mt-3">
                <h4 className="font-semibold text-sm">Reference des champs du payload</h4>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">event</Badge>
                  <p className="text-xs text-muted-foreground"><code className="bg-muted px-1 rounded font-mono">"payment.completed"</code> ou <code className="bg-muted px-1 rounded font-mono">"payment.failed"</code> - Le type d'evenement</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">transactionId</Badge>
                  <p className="text-xs text-muted-foreground">Identifiant unique de la transaction BKApay. Utilisez-le pour retrouver la transaction dans votre systeme.</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">externalReference</Badge>
                  <p className="text-xs text-muted-foreground">La valeur de <code className="bg-muted px-1 rounded font-mono">orderId</code> que vous avez passe lors de l'appel a <code className="bg-muted px-1 rounded font-mono">BKApay.checkout()</code>. Permet de retrouver votre commande.</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">amount</Badge>
                  <p className="text-xs text-muted-foreground">Montant total paye par le client</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">fee</Badge>
                  <p className="text-xs text-muted-foreground">Frais de service deduits</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">netAmount</Badge>
                  <p className="text-xs text-muted-foreground">Montant net credite sur votre solde marchand (amount - fee)</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">currency</Badge>
                  <p className="text-xs text-muted-foreground">Devise : <code className="bg-muted px-1 rounded font-mono">"XOF"</code>, <code className="bg-muted px-1 rounded font-mono">"XAF"</code> ou <code className="bg-muted px-1 rounded font-mono">"CDF"</code></p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">status</Badge>
                  <p className="text-xs text-muted-foreground"><code className="bg-muted px-1 rounded font-mono">"completed"</code> ou <code className="bg-muted px-1 rounded font-mono">"failed"</code> - Le statut final de la transaction</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">customerName / customerEmail / customerPhone</Badge>
                  <p className="text-xs text-muted-foreground">Informations du client qui a effectue le paiement</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">country</Badge>
                  <p className="text-xs text-muted-foreground">Code pays ISO a 2 lettres du client (ex: "SN", "CI", "BF", "CM")</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">operator</Badge>
                  <p className="text-xs text-muted-foreground">Operateur mobile money utilise (ex: "orange", "mtn", "wave", "moov")</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">description</Badge>
                  <p className="text-xs text-muted-foreground">Description du paiement que vous avez definie lors de l'appel</p>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded bg-muted/50">
                  <Badge variant="outline">timestamp</Badge>
                  <p className="text-xs text-muted-foreground">Horodatage ISO 8601 du moment ou le webhook a ete envoye</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Calcul de la signature (algorithme)</h4>
              <p className="text-sm text-muted-foreground">
                La signature est calculee en utilisant HMAC-SHA256 sur le body JSON (stringify) avec votre <code className="bg-muted px-1 rounded font-mono text-xs">callbackSecret</code> comme cle :
              </p>
              <div className="bg-muted p-3 rounded-lg">
                <code className="text-sm font-mono text-primary">
                  signature = HMAC-SHA256(JSON.stringify(payload), callbackSecret)
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Comparez cette signature calculee avec la valeur du header <code className="bg-muted px-1 rounded font-mono">X-BKApay-Signature</code>. 
                Si elles ne correspondent pas, le webhook n'est pas authentique : rejetez-le avec un code HTTP 401.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge>Node.js / Express</Badge>
                <span className="text-sm text-muted-foreground">Verification complete avec anti-replay</span>
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
                <span className="text-sm text-muted-foreground">Verification complete avec anti-replay</span>
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

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge>Python (Flask)</Badge>
                <span className="text-sm text-muted-foreground">Verification complete avec anti-replay</span>
              </div>
              <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                <pre>{webhookPythonExample}</pre>
              </div>
              <Button 
                onClick={() => copyCode(webhookPythonExample)} 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-copy-webhook-python"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Bonnes pratiques de securite pour les webhooks</h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li><strong>Verifiez toujours la signature</strong> - Ne traitez jamais un webhook sans avoir verifie que la signature HMAC-SHA256 correspond</li>
                <li><strong>Verifiez le timestamp</strong> - Rejetez les webhooks dont le timestamp est trop ancien (plus de 5 minutes) pour prevenir les attaques de rejeu (replay attacks)</li>
                <li><strong>Utilisez hash_equals / compare_digest</strong> - Utilisez des fonctions de comparaison a temps constant pour eviter les attaques de timing</li>
                <li><strong>Repondez rapidement</strong> - Votre endpoint doit repondre en moins de 10 secondes avec un HTTP 200. Si le traitement est long, mettez-le dans une file d'attente</li>
                <li><strong>Rendez votre traitement idempotent</strong> - Un meme webhook peut etre recu plusieurs fois. Verifiez le <code className="bg-muted px-1 rounded font-mono text-xs">transactionId</code> pour eviter de traiter un paiement deux fois</li>
                <li><strong>Utilisez HTTPS</strong> - Votre endpoint webhook doit etre accessible en HTTPS pour securiser la communication</li>
                <li><strong>Gardez le secret en securite</strong> - Stockez le <code className="bg-muted px-1 rounded font-mono text-xs">callbackSecret</code> dans une variable d'environnement, jamais dans le code source</li>
              </ul>
            </div>

            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Securite:</strong> Verifiez toujours la signature avant de traiter le webhook.
                Ne faites jamais confiance aux donnees sans verification. Le traitement du webhook ne doit 
                activer un service que si <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded font-mono text-xs">event === "payment.completed"</code> ET <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded font-mono text-xs">status === "completed"</code>.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Section 10: FAQ / Erreurs courantes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            FAQ / Erreurs courantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-1">La fenetre de paiement ne s'ouvre pas</p>
              <p className="text-muted-foreground">
                Verifiez que le script <code className="bg-muted px-1 rounded font-mono text-xs">bkapay-inline.js</code> est bien charge avant d'appeler <code className="bg-muted px-1 rounded font-mono text-xs">BKApay.checkout()</code>. 
                Ouvrez la console du navigateur (F12) et verifiez qu'il n'y a pas d'erreur de chargement. Assurez-vous que votre 
                cle publique est correcte et commence par <code className="bg-muted px-1 rounded font-mono text-xs">pk_live_</code>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-2">Le callback onSuccess est appele mais mon service n'est pas active</p>
              <p className="text-muted-foreground">
                Le callback <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> est un signal cote client. Vous devez implementer la verification 
                cote serveur pour activer votre service. Envoyez le <code className="bg-muted px-1 rounded font-mono text-xs">transactionId</code> a votre backend 
                et appelez l'API de statut BKApay, ou configurez un webhook pour etre notifie automatiquement.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-3">Le paiement est en statut "pending" trop longtemps</p>
              <p className="text-muted-foreground">
                Certains operateurs mobile money peuvent prendre jusqu'a 60 secondes pour confirmer un paiement. 
                Si le statut reste "pending" apres 2 minutes, le paiement a probablement expire. Le callback <code className="bg-muted px-1 rounded font-mono text-xs">onError</code> sera 
                appele avec <code className="bg-muted px-1 rounded font-mono text-xs">status: "expired"</code>. Le client peut retenter le paiement.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-4">Le montant minimum est rejete</p>
              <p className="text-muted-foreground">
                Le montant minimum pour un paiement est de 200 unites dans votre devise (200 XOF, 200 XAF ou 200 CDF). 
                Si vous passez un montant inferieur, l'erreur sera affichee dans la fenetre de paiement.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-5">Mon webhook ne recoit pas les notifications</p>
              <p className="text-muted-foreground">
                Verifiez que : (1) votre URL de callback est accessible publiquement en HTTPS, (2) votre serveur repond 
                avec un code HTTP 200 en moins de 10 secondes, (3) le callback est bien configure dans la section "Cles API" 
                du tableau de bord. BKApay abandonne l'envoi apres un timeout de 10 secondes.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-6">La fenetre se ferme mais aucun callback n'est appele</p>
              <p className="text-muted-foreground">
                Si le client ferme la fenetre manuellement (bouton X ou touche Echap), le callback <code className="bg-muted px-1 rounded font-mono text-xs">onClose</code> est appele 
                avec <code className="bg-muted px-1 rounded font-mono text-xs">status: "cancelled"</code>. Assurez-vous d'avoir defini la fonction <code className="bg-muted px-1 rounded font-mono text-xs">onClose</code> dans 
                votre configuration.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-semibold mb-1" data-testid="text-faq-7">Ou se trouve mon solde apres un paiement reussi ?</p>
              <p className="text-muted-foreground">
                Votre solde est credite automatiquement et instantanement apres la confirmation du paiement. 
                Le montant net est ajoute a votre solde BKApay visible dans le tableau de bord.
                Aucune action de votre part n'est necessaire pour recevoir les fonds.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 11: Securite - Bonnes pratiques */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Securite - Bonnes pratiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            La securite de votre integration est primordiale. Suivez ces recommandations pour proteger vos utilisateurs et votre activite.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Utilisez toujours votre cle publique cote client</p>
                <p className="text-muted-foreground">Seule la cle commencant par <code className="bg-muted px-1 rounded font-mono text-xs">pk_live_</code> doit etre utilisee dans le JavaScript du navigateur. Votre cle secrete ne doit JAMAIS apparaitre dans le code cote client.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Verifiez toujours les paiements cote serveur</p>
                <p className="text-muted-foreground">Ne faites jamais confiance uniquement au callback JavaScript <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code>. Utilisez l'API de statut ou les webhooks pour confirmer chaque paiement avant d'activer un service.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Verifiez le montant cote serveur</p>
                <p className="text-muted-foreground">Lors de la verification serveur, comparez le montant retourne par l'API BKApay avec le montant attendu pour votre commande. Un attaquant pourrait tenter de payer un montant inferieur.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Utilisez HTTPS partout</p>
                <p className="text-muted-foreground">Votre site doit etre servi en HTTPS pour securiser les echanges. Les endpoints webhook doivent egalement etre en HTTPS.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Gardez vos secrets en securite</p>
                <p className="text-muted-foreground">Stockez votre <code className="bg-muted px-1 rounded font-mono text-xs">callbackSecret</code> et autres cles sensibles dans des variables d'environnement. Ne les commitez jamais dans votre code source ou vos fichiers de configuration versiones.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Rendez vos traitements idempotents</p>
                <p className="text-muted-foreground">Un meme paiement peut generer plusieurs notifications (webhook + verification active). Utilisez le <code className="bg-muted px-1 rounded font-mono text-xs">transactionId</code> comme cle unique pour eviter de traiter un paiement deux fois.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
