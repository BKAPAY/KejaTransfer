import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, ExternalLink, AlertTriangle, ArrowLeft, ArrowRight, Clock, Webhook, CheckCircle, Shield, DollarSign, HelpCircle, RefreshCw, Lock, Zap, ArrowDown, Server } from "lucide-react";
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

  const statusVerificationJsExample = `// Verification du statut de paiement cote serveur (Node.js)
// IMPORTANT: Toujours verifier le statut cote serveur, ne jamais
// se fier uniquement aux parametres de l'URL de retour.

const axios = require('axios');

async function verifierPaiement(transactionId) {
  try {
    const response = await axios.get(
      '${baseUrl}/api/inline-pay/status/' + transactionId
    );
    
    const { status, amount, currency } = response.data;
    
    switch (status) {
      case 'completed':
        console.log('Paiement confirme:', amount, currency);
        // Le solde a deja ete credite automatiquement
        // Activez le service/produit pour le client
        return { verified: true, amount, currency };
        
      case 'pending':
        console.log('Paiement en attente...');
        // Le paiement n est pas encore finalise
        // Reessayez dans quelques secondes
        return { verified: false, pending: true };
        
      case 'failed':
        console.log('Paiement echoue');
        return { verified: false, pending: false };
        
      default:
        console.log('Statut inconnu:', status);
        return { verified: false, pending: false };
    }
  } catch (error) {
    console.error('Erreur de verification:', error.message);
    throw error;
  }
}

// Utilisation dans une route Express
app.get('/success', async (req, res) => {
  const { status, transactionId, amount } = req.query;
  
  if (status === 'success' && transactionId) {
    // TOUJOURS verifier cote serveur
    const result = await verifierPaiement(transactionId);
    
    if (result.verified) {
      res.render('success', { amount: result.amount });
    } else {
      res.render('pending', { transactionId });
    }
  } else {
    res.render('error', { message: 'Paiement echoue' });
  }
});`;

  const statusVerificationPhpExample = `<?php
// Verification du statut de paiement cote serveur (PHP)

function verifierPaiement($transactionId) {
    $url = "${baseUrl}/api/inline-pay/status/" . $transactionId;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("Erreur HTTP: " . $httpCode);
    }
    
    $data = json_decode($response, true);
    
    if ($data['status'] === 'completed') {
        return [
            'verified' => true,
            'amount' => $data['amount'],
            'currency' => $data['currency']
        ];
    }
    
    return ['verified' => false, 'status' => $data['status']];
}

// Utilisation
$transactionId = $_GET['transactionId'] ?? '';
$status = $_GET['status'] ?? '';

if ($status === 'success' && $transactionId) {
    $result = verifierPaiement($transactionId);
    
    if ($result['verified']) {
        echo "Paiement confirme: " . $result['amount'] . " " . $result['currency'];
    } else {
        echo "Paiement en cours de traitement...";
    }
}
?>`;

  const statusVerificationPythonExample = `# Verification du statut de paiement cote serveur (Python)
import requests
from flask import request, render_template

def verifier_paiement(transaction_id):
    """Verifie le statut d'un paiement aupres de l'API BKApay."""
    url = f"${baseUrl}/api/inline-pay/status/{transaction_id}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data['status'] == 'completed':
            return {
                'verified': True,
                'amount': data['amount'],
                'currency': data['currency']
            }
        
        return {'verified': False, 'status': data['status']}
        
    except requests.RequestException as e:
        raise Exception(f"Erreur de verification: {e}")

@app.route('/success')
def success():
    status = request.args.get('status')
    transaction_id = request.args.get('transactionId')
    
    if status == 'success' and transaction_id:
        result = verifier_paiement(transaction_id)
        
        if result['verified']:
            return render_template('success.html', amount=result['amount'])
    
    return render_template('error.html')`;

  const webhookExample = `// Webhook BKApay - Activation automatique (Node.js / Express)
// Ce code recoit les notifications de paiement et active les services

const crypto = require('crypto');
const express = require('express');

// IMPORTANT: Utilisez express.json() AVANT votre route webhook
// pour que req.body soit correctement parse
app.post('/api/webhook/bkapay', express.json(), (req, res) => {
  const signature = req.headers['x-bkapay-signature'];
  const event = req.headers['x-bkapay-event'];
  const timestamp = req.headers['x-bkapay-timestamp'];
  const secret = process.env.BKAPAY_CALLBACK_SECRET;
  
  // Etape 1: Verifier que tous les headers sont presents
  if (!signature || !event || !timestamp) {
    console.error('Headers manquants dans le webhook');
    return res.status(400).json({ error: 'Headers manquants' });
  }
  
  // Etape 2: Verifier que le timestamp n est pas trop ancien (5 min max)
  const timestampDate = new Date(timestamp);
  const now = new Date();
  const diffMinutes = (now - timestampDate) / 1000 / 60;
  
  if (diffMinutes > 5) {
    console.error('Webhook trop ancien, possible replay attack');
    return res.status(401).json({ error: 'Timestamp expire' });
  }
  
  // Etape 3: Verifier la signature HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    console.error('Signature invalide');
    return res.status(401).json({ error: 'Signature invalide' });
  }
  
  // Etape 4: Traiter l evenement
  const { 
    event: paymentEvent, 
    transactionId, 
    amount, 
    netAmount,
    fee,
    status, 
    customerEmail,
    customerName,
    description 
  } = req.body;
  
  console.log('Webhook recu:', paymentEvent, transactionId);
  
  if (paymentEvent === 'payment.completed' && status === 'completed') {
    // Le solde a DEJA ete credite sur votre compte BKApay
    // Ici, activez le service pour votre client
    activerAbonnement(customerEmail, transactionId, amount);
    envoyerEmailConfirmation(customerEmail, customerName, amount);
    
    console.log('Service active pour:', customerEmail);
  } else if (paymentEvent === 'payment.failed') {
    // Le paiement a echoue - informer le client
    envoyerEmailEchec(customerEmail, customerName);
    console.log('Paiement echoue pour:', customerEmail);
  }
  
  // IMPORTANT: Repondre 200 rapidement pour confirmer la reception
  // Si vous ne repondez pas 200, BKApay pourrait renvoyer le webhook
  res.json({ received: true });
});`;

  const webhookPhpExample = `<?php
// Webhook BKApay - Activation automatique (PHP)

// Lire le body brut (important pour la verification de signature)
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$event = $_SERVER['HTTP_X_BKAPAY_EVENT'] ?? '';
$timestamp = $_SERVER['HTTP_X_BKAPAY_TIMESTAMP'] ?? '';
$secret = getenv('BKAPAY_CALLBACK_SECRET');

// Etape 1: Verifier les headers
if (empty($signature) || empty($event) || empty($timestamp)) {
    http_response_code(400);
    echo json_encode(['error' => 'Headers manquants']);
    exit;
}

// Etape 2: Verifier le timestamp (max 5 minutes)
$timestampDate = strtotime($timestamp);
$now = time();
$diffMinutes = ($now - $timestampDate) / 60;

if ($diffMinutes > 5) {
    http_response_code(401);
    echo json_encode(['error' => 'Timestamp expire']);
    exit;
}

// Etape 3: Verifier la signature HMAC-SHA256
// IMPORTANT: Utilisez le payload brut, pas json_encode($data)
$expectedSignature = hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Signature invalide']);
    exit;
}

// Etape 4: Traiter les donnees
$data = json_decode($payload, true);

if ($data['event'] === 'payment.completed' && $data['status'] === 'completed') {
    // Le solde a DEJA ete credite sur votre compte BKApay
    activerAbonnement($data['customerEmail'], $data['transactionId']);
    envoyerEmailConfirmation($data['customerEmail'], $data['amount']);
    
    error_log("Service active pour: " . $data['customerEmail']);
} elseif ($data['event'] === 'payment.failed') {
    error_log("Paiement echoue pour: " . $data['customerEmail']);
}

// Repondre 200 pour confirmer la reception
http_response_code(200);
echo json_encode(['received' => true]);
?>`;

  const webhookPythonExample = `# Webhook BKApay - Activation automatique (Python / Flask)
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

CALLBACK_SECRET = os.environ.get('BKAPAY_CALLBACK_SECRET')

@app.route('/api/webhook/bkapay', methods=['POST'])
def webhook_bkapay():
    # Etape 1: Recuperer les headers
    signature = request.headers.get('X-BKApay-Signature', '')
    event = request.headers.get('X-BKApay-Event', '')
    timestamp = request.headers.get('X-BKApay-Timestamp', '')
    
    if not signature or not event or not timestamp:
        return jsonify({'error': 'Headers manquants'}), 400
    
    # Etape 2: Verifier le timestamp
    try:
        ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        if datetime.now(ts.tzinfo) - ts > timedelta(minutes=5):
            return jsonify({'error': 'Timestamp expire'}), 401
    except ValueError:
        return jsonify({'error': 'Timestamp invalide'}), 400
    
    # Etape 3: Verifier la signature
    # IMPORTANT: Utilisez request.get_data() pour le body brut
    payload = request.get_data(as_text=True)
    expected = hmac.new(
        CALLBACK_SECRET.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected):
        return jsonify({'error': 'Signature invalide'}), 401
    
    # Etape 4: Traiter l'evenement
    data = request.get_json()
    
    if data['event'] == 'payment.completed' and data['status'] == 'completed':
        # Le solde a DEJA ete credite sur votre compte BKApay
        activer_abonnement(data['customerEmail'], data['transactionId'])
        envoyer_email_confirmation(data['customerEmail'], data['amount'])
        
        app.logger.info(f"Service active pour: {data['customerEmail']}")
    
    elif data['event'] == 'payment.failed':
        app.logger.warning(f"Paiement echoue pour: {data['customerEmail']}")
    
    return jsonify({'received': True}), 200`;

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
          Integration par redirection vers la page de paiement securisee BKApay.
          Ce mode est le plus simple a integrer : il ne necessite aucune dependance,
          aucun SDK et fonctionne avec n'importe quel langage ou framework.
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

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Flux de paiement complet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <p className="text-muted-foreground">
            Le Redirect Checkout (aussi appele HPP - Hosted Payment Page) est le moyen le plus simple
            d'accepter des paiements mobile money via BKApay. Voici exactement ce qui se passe a chaque etape :
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="font-semibold">Creez une cle API dans votre tableau de bord</p>
                <p className="text-muted-foreground mt-1">
                  Allez dans la section "Cles API" de votre tableau de bord BKApay. Cliquez sur "Generer une cle API".
                  Vous recevrez une cle publique (commence par <code className="text-xs bg-muted px-1 py-0.5 rounded">pk_live_</code>) qui sera utilisee dans l'URL de paiement.
                  Cette cle est securisee et peut etre exposee dans le code front-end.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="font-semibold">Redirigez votre client vers l'URL de paiement BKApay</p>
                <p className="text-muted-foreground mt-1">
                  Construisez l'URL avec votre cle publique, le montant, une description et l'URL de retour.
                  Redirigez le navigateur du client vers cette URL. Le client quitte temporairement votre site.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <p className="font-semibold">Le client remplit ses informations et paie</p>
                <p className="text-muted-foreground mt-1">
                  Sur la page de paiement BKApay, le client entre son nom, son email, son numero de telephone,
                  choisit son pays et son operateur mobile money (Orange Money, MTN Mobile Money, Wave, Moov Money, etc.).
                  Il confirme le paiement. Selon l'operateur, il peut recevoir un OTP par SMS ou une notification USSD.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <p className="font-semibold">Le paiement est traite automatiquement</p>
                <p className="text-muted-foreground mt-1">
                  BKApay traite le paiement via l'operateur mobile money. Les frais (6%) sont deduits automatiquement
                  et le montant net est credite sur votre solde BKApay. Vous n'avez aucune action a faire - tout est automatique.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">5</div>
              <div>
                <p className="font-semibold">Le client est redirige vers votre site</p>
                <p className="text-muted-foreground mt-1">
                  Apres le paiement (reussi ou echoue), le client est automatiquement redirige vers votre URL de callback
                  avec des parametres dans l'URL : <code className="text-xs bg-muted px-1 py-0.5 rounded">status</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">transactionId</code> et{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">amount</code>.
                </p>
              </div>
            </div>

            {docVersion.version === "v1.4" && (
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">6</div>
                <div>
                  <span className="font-semibold flex items-center gap-2">
                    Webhook envoye a votre serveur
                    <Badge variant="default" className="text-xs">v1.4</Badge>
                  </span>
                  <p className="text-muted-foreground mt-1">
                    En parallele de la redirection, BKApay envoie une notification POST a votre URL webhook (si configuree).
                    Cette notification contient toutes les informations du paiement et est signee cryptographiquement.
                    Utilisez-la pour activer automatiquement les abonnements ou services.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Traitement automatique des soldes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Quand un client effectue un paiement via BKApay, votre solde marchand est credite <strong>automatiquement</strong>.
            Vous n'avez aucune action a effectuer, aucun endpoint a appeler, aucune confirmation a envoyer.
            Le systeme BKApay gere tout de maniere atomique : la transaction est marquee comme completee et votre solde est credite en une seule operation.
          </p>

          <div className="space-y-3">
            <h4 className="font-semibold">Comment les frais sont calcules</h4>
            <p className="text-muted-foreground">
              BKApay applique des frais de <strong>6%</strong> sur chaque transaction entrante.
              Ces frais couvrent les couts des operateurs mobile money et les services de la plateforme.
              Les frais sont deduits automatiquement avant de crediter votre solde.
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm">Exemple de calcul</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="text-center p-3 bg-background rounded-md">
                <p className="text-xs text-muted-foreground">Client paie</p>
                <p className="text-lg font-bold text-foreground" data-testid="text-example-amount">5 000 XOF</p>
              </div>
              <div className="text-center p-3 bg-background rounded-md">
                <p className="text-xs text-muted-foreground">Frais BKApay (6%)</p>
                <p className="text-lg font-bold text-destructive" data-testid="text-example-fee">- 300 XOF</p>
              </div>
              <div className="text-center p-3 bg-background rounded-md">
                <p className="text-xs text-muted-foreground">Vous recevez</p>
                <p className="text-lg font-bold text-green-600" data-testid="text-example-net">4 700 XOF</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Formule : montant_net = montant - (montant x 0.06)
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Autres exemples</h4>
            <div className="grid gap-1 text-xs">
              <div className="flex justify-between items-center gap-2">
                <span>Client paie 1 000 XOF</span>
                <span className="text-muted-foreground">Frais: 60 XOF</span>
                <span className="font-semibold text-green-600">Vous recevez: 940 XOF</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>Client paie 10 000 XOF</span>
                <span className="text-muted-foreground">Frais: 600 XOF</span>
                <span className="font-semibold text-green-600">Vous recevez: 9 400 XOF</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>Client paie 50 000 XOF</span>
                <span className="text-muted-foreground">Frais: 3 000 XOF</span>
                <span className="font-semibold text-green-600">Vous recevez: 47 000 XOF</span>
              </div>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Le solde est credite instantanement des que le paiement est confirme par l'operateur mobile money.
              Vous pouvez consulter votre solde en temps reel dans votre tableau de bord BKApay.
              Les fonds sont disponibles immediatement pour les retraits.
            </AlertDescription>
          </Alert>
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
          <p className="text-sm text-muted-foreground">
            Pour initier un paiement, redirigez le navigateur de votre client vers l'URL suivante.
            Remplacez les valeurs en majuscules par vos propres valeurs.
          </p>

          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary" data-testid="text-redirect-url">
              {redirectUrl}
            </code>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold">Parametres de l'URL</h4>
            <p className="text-xs text-muted-foreground">
              Les parametres sont passes dans la query string de l'URL. Les valeurs doivent etre encodees (URL encoding).
            </p>
            <div className="border rounded-lg">
              <div className="grid grid-cols-[120px_80px_1fr] gap-2 p-3 border-b bg-muted/50 text-xs font-semibold">
                <span>Parametre</span>
                <span>Requis</span>
                <span>Description</span>
              </div>
              <div className="grid grid-cols-[120px_80px_1fr] gap-2 p-3 border-b text-sm items-start">
                <Badge variant="outline" className="w-fit">amount</Badge>
                <Badge variant="default" className="w-fit text-xs">Oui</Badge>
                <div>
                  <p className="text-muted-foreground">Montant a payer en unite monetaire entiere (pas de decimales). Minimum : 200.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    La devise depend de votre pays d'inscription : XOF (Afrique de l'Ouest), XAF (Afrique Centrale), CDF (RD Congo).
                    Consultez votre tableau de bord pour connaitre votre devise.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[120px_80px_1fr] gap-2 p-3 border-b text-sm items-start">
                <Badge variant="outline" className="w-fit">description</Badge>
                <Badge variant="secondary" className="w-fit text-xs">Non</Badge>
                <div>
                  <p className="text-muted-foreground">Description du paiement affichee au client sur la page de paiement.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemple : "Achat produit", "Abonnement Premium", "Commande #1234". Doit etre encodee (utilisez encodeURIComponent en JS ou urlencode en PHP).
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[120px_80px_1fr] gap-2 p-3 text-sm items-start">
                <Badge variant="outline" className="w-fit">callback</Badge>
                <Badge variant="secondary" className="w-fit text-xs">Non</Badge>
                <div>
                  <p className="text-muted-foreground">URL vers laquelle le client sera redirige apres le paiement (reussi ou echoue).</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si non fourni, le client verra une page de confirmation BKApay sans redirection. L'URL doit etre encodee.
                    Exemple : <code className="text-xs bg-muted px-1 py-0.5 rounded">https://votresite.com/success</code>
                  </p>
                </div>
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
          <p className="text-sm text-muted-foreground">
            Voici des exemples concrets pour integrer le paiement par redirection dans differents langages.
            Choisissez l'exemple qui correspond a votre stack technique.
          </p>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>HTML</Badge>
              <span className="text-sm text-muted-foreground">Bouton de paiement simple - aucun code serveur requis</span>
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
              <span className="text-sm text-muted-foreground">Fonction de redirection dynamique</span>
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
              <span className="text-sm text-muted-foreground">Redirection serveur avec header Location</span>
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
              <span className="text-sm text-muted-foreground">Redirection serveur avec Flask</span>
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
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Parametres de retour (callback)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apres le paiement (reussi ou echoue), le client est redirige vers votre URL de callback.
            BKApay ajoute automatiquement des parametres a l'URL pour vous informer du resultat.
            Ces parametres sont envoyes dans la query string (apres le "?").
          </p>
          
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Exemple d'URL de retour :</p>
            <code className="text-sm font-mono break-all" data-testid="text-callback-example-url">
              https://votresite.com/success?status=success&transactionId=abc123-def456&amount=5000
            </code>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Detail de chaque parametre</h4>
            <div className="border rounded-lg">
              <div className="grid grid-cols-[140px_1fr] gap-2 p-3 border-b bg-muted/50 text-xs font-semibold">
                <span>Parametre</span>
                <span>Description</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 p-3 border-b text-sm items-start">
                <Badge variant="outline" className="w-fit">status</Badge>
                <div>
                  <p className="text-muted-foreground">Resultat du paiement. Deux valeurs possibles :</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">success</Badge>
                      <span className="text-xs text-muted-foreground">Le paiement a ete complete avec succes. Votre solde a ete credite.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">failed</Badge>
                      <span className="text-xs text-muted-foreground">Le paiement a echoue (solde insuffisant, annulation, erreur operateur, timeout).</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 p-3 border-b text-sm items-start">
                <Badge variant="outline" className="w-fit">transactionId</Badge>
                <div>
                  <p className="text-muted-foreground">
                    Identifiant unique de la transaction (format UUID). Utilisez cet identifiant pour :
                  </p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                    <li>Verifier le statut du paiement cote serveur via l'API</li>
                    <li>Associer le paiement a une commande dans votre base de donnees</li>
                    <li>Contacter le support BKApay en cas de probleme</li>
                  </ul>
                </div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 p-3 text-sm items-start">
                <Badge variant="outline" className="w-fit">amount</Badge>
                <div>
                  <p className="text-muted-foreground">
                    Montant paye par le client (en unite monetaire entiere). C'est le montant brut, avant deduction des frais.
                    Verifiez que ce montant correspond a ce que vous attendiez pour eviter les fraudes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Attention :</strong> Les parametres de l'URL de retour peuvent etre manipules par le client.
              Ne vous fiez JAMAIS uniquement a ces parametres pour activer un service ou valider un paiement.
              Verifiez toujours le statut cote serveur via l'API de verification (voir section suivante).
            </AlertDescription>
          </Alert>

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Verification du statut (cote serveur)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            La verification du statut cote serveur est <strong>essentielle</strong> pour securiser votre integration.
            Les parametres de l'URL de retour transitent par le navigateur du client et peuvent etre modifies.
            Utilisez toujours l'API de verification pour confirmer le statut reel d'un paiement avant d'activer un service.
          </p>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Endpoint de verification</h4>
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="text-xs">GET</Badge>
              </div>
              <code className="text-sm font-mono break-all text-primary" data-testid="text-status-endpoint">
                {baseUrl}/api/inline-pay/status/{"{transactionId}"}
              </code>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Reponse de l'API</h4>
            <p className="text-xs text-muted-foreground">L'API retourne un objet JSON avec les informations suivantes :</p>
            <div className="border rounded-lg">
              <div className="grid grid-cols-[120px_1fr] gap-2 p-3 border-b bg-muted/50 text-xs font-semibold">
                <span>Champ</span>
                <span>Description</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2 p-3 border-b text-sm items-start">
                <Badge variant="outline" className="w-fit">status</Badge>
                <div>
                  <p className="text-muted-foreground">Statut du paiement. Valeurs possibles :</p>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">completed</Badge>
                      <span className="text-xs text-muted-foreground">Paiement confirme et solde credite</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">pending</Badge>
                      <span className="text-xs text-muted-foreground">Paiement en cours de traitement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">failed</Badge>
                      <span className="text-xs text-muted-foreground">Paiement echoue ou annule</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2 p-3 border-b text-sm items-start">
                <Badge variant="outline" className="w-fit">amount</Badge>
                <span className="text-muted-foreground">Montant de la transaction</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2 p-3 text-sm items-start">
                <Badge variant="outline" className="w-fit">currency</Badge>
                <span className="text-muted-foreground">Devise (XOF, XAF, CDF)</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>Node.js</Badge>
              <span className="text-sm text-muted-foreground">Verification et traitement du retour</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{statusVerificationJsExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(statusVerificationJsExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-status-js"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>PHP</Badge>
              <span className="text-sm text-muted-foreground">Verification avec cURL</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{statusVerificationPhpExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(statusVerificationPhpExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-status-php"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>Python (Flask)</Badge>
              <span className="text-sm text-muted-foreground">Verification avec requests</span>
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{statusVerificationPythonExample}</pre>
            </div>
            <Button 
              onClick={() => copyCode(statusVerificationPythonExample)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-status-python"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>
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
              Les webhooks vous permettent de recevoir des notifications automatiques en temps reel quand un paiement est complete ou echoue.
              Contrairement aux parametres de l'URL de retour qui passent par le navigateur du client, les webhooks sont envoyes directement
              de serveur a serveur (server-to-server), ce qui les rend beaucoup plus fiables et securises.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Cas d'usage typiques :</strong> activation automatique d'abonnements, mise a jour du statut de commande,
              envoi d'emails de confirmation, generation de factures, mise a jour de stocks.
            </p>

            <div className="space-y-4">
              <h4 className="font-semibold">Configuration etape par etape</h4>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <p className="font-medium">Accedez a la section "Cles API"</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Dans votre tableau de bord BKApay, cliquez sur "Cles API" dans le menu lateral.
                      Vous verrez la liste de vos cles API existantes.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <p className="font-medium">Cliquez sur "Configurer un callback"</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Sur la cle API que vous souhaitez configurer, cliquez sur le bouton "Configurer un callback".
                      Un formulaire apparaitra pour saisir l'URL de votre endpoint webhook.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
                  <div>
                    <p className="font-medium">Entrez votre URL de webhook (HTTPS requis)</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Saisissez l'URL complete de votre endpoint webhook. L'URL doit etre en HTTPS et accessible publiquement depuis Internet.
                      BKApay enverra une requete POST a cette URL a chaque evenement de paiement.
                    </p>
                    <div className="bg-muted p-3 rounded-lg mt-2 space-y-1">
                      <code className="block text-xs font-mono text-primary">https://votresite.com/api/webhook/bkapay</code>
                      <code className="block text-xs font-mono text-primary">https://monapp.com/webhooks/paiement</code>
                      <code className="block text-xs font-mono text-primary">https://api.monservice.com/callbacks/bkapay</code>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
                  <div>
                    <p className="font-medium">Copiez et sauvegardez le secret genere</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Apres la configuration, BKApay genere un <strong>callbackSecret</strong> unique. Ce secret est utilise pour signer
                      chaque webhook. Sauvegardez-le de maniere securisee (variable d'environnement, coffre-fort de secrets).
                      <strong> Ne le partagez jamais et ne l'exposez pas dans le code front-end.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Headers envoyes avec chaque webhook</h4>
              <p className="text-xs text-muted-foreground">
                Chaque requete POST envoyee par BKApay inclut les headers suivants. Utilisez-les pour verifier l'authenticite du webhook.
              </p>
              <div className="border rounded-lg">
                <div className="grid grid-cols-[200px_1fr] gap-2 p-3 border-b bg-muted/50 text-xs font-semibold">
                  <span>Header</span>
                  <span>Description</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2 p-3 border-b text-sm items-start">
                  <Badge variant="outline" className="w-fit text-xs">X-BKApay-Signature</Badge>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Signature HMAC-SHA256 du corps de la requete (payload JSON). Calculee avec votre callbackSecret.
                      La formule est : <code className="bg-muted px-1 py-0.5 rounded text-xs">HMAC-SHA256(JSON.stringify(payload), callbackSecret)</code>.
                      Verifiez cette signature pour vous assurer que le webhook provient bien de BKApay.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2 p-3 border-b text-sm items-start">
                  <Badge variant="outline" className="w-fit text-xs">X-BKApay-Event</Badge>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Type d'evenement. Valeurs possibles :
                    </p>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">payment.completed</code>
                        <span className="text-xs text-muted-foreground">Paiement reussi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">payment.failed</code>
                        <span className="text-xs text-muted-foreground">Paiement echoue</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2 p-3 text-sm items-start">
                  <Badge variant="outline" className="w-fit text-xs">X-BKApay-Timestamp</Badge>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Horodatage ISO 8601 de l'envoi du webhook. Utilisez-le pour rejeter les webhooks trop anciens
                      (protection contre les attaques par rejeu / replay attacks). Recommandation : rejetez les webhooks de plus de 5 minutes.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Le header <code className="bg-muted px-1 py-0.5 rounded">Content-Type</code> est toujours <code className="bg-muted px-1 py-0.5 rounded">application/json</code>.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Payload complet du webhook</h4>
              <p className="text-xs text-muted-foreground">
                Voici un exemple complet du corps JSON envoye par BKApay. Tous les champs sont decrits ci-dessous.
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
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Reference des champs du payload</h4>
              <div className="border rounded-lg text-xs">
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b bg-muted/50 font-semibold">
                  <span>Champ</span>
                  <span>Type</span>
                  <span>Description</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">event</code>
                  <span className="text-muted-foreground">string</span>
                  <span className="text-muted-foreground">Type d'evenement : "payment.completed" ou "payment.failed"</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">transactionId</code>
                  <span className="text-muted-foreground">string</span>
                  <span className="text-muted-foreground">Identifiant unique de la transaction (UUID)</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">externalReference</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Reference externe que vous avez fournie (si applicable). Utile pour relier a votre commande.</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">amount</code>
                  <span className="text-muted-foreground">number</span>
                  <span className="text-muted-foreground">Montant brut paye par le client (ex: 5000)</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">fee</code>
                  <span className="text-muted-foreground">number</span>
                  <span className="text-muted-foreground">Frais BKApay deduits (6% du montant, ex: 300)</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">netAmount</code>
                  <span className="text-muted-foreground">number</span>
                  <span className="text-muted-foreground">Montant net credite sur votre solde (amount - fee, ex: 4700)</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">currency</code>
                  <span className="text-muted-foreground">string</span>
                  <span className="text-muted-foreground">Code devise ISO : "XOF", "XAF" ou "CDF"</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">status</code>
                  <span className="text-muted-foreground">string</span>
                  <span className="text-muted-foreground">Statut : "completed" ou "failed"</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">customerName</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Nom complet du client (renseigne par le client)</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">customerEmail</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Email du client. Utile pour envoyer des confirmations.</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">customerPhone</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Numero de telephone mobile money du client</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">country</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Code pays ISO a 2 lettres (ex: "SN", "CI", "BF", "ML", "CM")</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">operator</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Operateur mobile money utilise (ex: "orange", "mtn", "wave", "moov")</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 border-b items-start">
                  <code className="font-mono">description</code>
                  <span className="text-muted-foreground">string?</span>
                  <span className="text-muted-foreground">Description du paiement fournie lors de la creation</span>
                </div>
                <div className="grid grid-cols-[160px_80px_1fr] gap-2 p-3 items-start">
                  <code className="font-mono">timestamp</code>
                  <span className="text-muted-foreground">string</span>
                  <span className="text-muted-foreground">Date/heure de l'evenement au format ISO 8601</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les champs marques avec "?" sont optionnels et peuvent ne pas etre presents dans certains cas.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Verification de la signature</h4>
              <p className="text-sm text-muted-foreground">
                La verification de la signature est <strong>obligatoire</strong>. Sans cette verification, un attaquant pourrait
                envoyer de fausses notifications a votre endpoint et activer des services sans paiement reel.
                La signature est calculee en appliquant HMAC-SHA256 sur le corps JSON de la requete avec votre callbackSecret.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge>Node.js / Express</Badge>
                <span className="text-sm text-muted-foreground">Verification complete avec securite</span>
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
                <span className="text-sm text-muted-foreground">Verification complete avec securite</span>
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
                <span className="text-sm text-muted-foreground">Verification complete avec securite</span>
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
              <h4 className="font-semibold">Comportement de retry</h4>
              <p className="text-sm text-muted-foreground">
                Si votre endpoint ne repond pas avec un code HTTP 200 dans les <strong>10 secondes</strong>,
                BKApay considere l'envoi comme echoue. Actuellement, BKApay effectue <strong>un seul essai</strong> d'envoi.
                Il est donc important que votre endpoint soit toujours disponible et reponde rapidement.
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-xs">
                <p className="font-semibold">Bonnes pratiques pour votre endpoint :</p>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li>Repondez HTTP 200 immediatement, avant de traiter le webhook en profondeur</li>
                  <li>Traitez le webhook de maniere asynchrone si necessaire (queue, background job)</li>
                  <li>Implementez l'idempotence : si vous recevez deux fois le meme transactionId, ne traitez qu'une fois</li>
                  <li>Loguez les webhooks recus pour le debugging</li>
                  <li>Utilisez la verification du statut comme fallback si un webhook est manque</li>
                </ul>
              </div>
            </div>

            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">Securite des webhooks</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm space-y-2">
                <p>Respectez ces regles de securite pour vos webhooks :</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Verifiez <strong>toujours</strong> la signature HMAC-SHA256 avant de traiter les donnees</li>
                  <li>Verifiez que le timestamp n'est pas trop ancien (max 5 minutes)</li>
                  <li>Stockez le callbackSecret dans une variable d'environnement, jamais dans le code source</li>
                  <li>Utilisez HTTPS pour votre endpoint webhook</li>
                  <li>Utilisez <code className="bg-muted px-1 py-0.5 rounded">hash_equals()</code> (PHP) ou comparaison en temps constant pour eviter les timing attacks</li>
                  <li>Ne loguez jamais le callbackSecret ou les signatures en production</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            FAQ / Erreurs courantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-4">
            <div className="border-b pb-4">
              <p className="font-semibold">Le client est redirige mais le montant est incorrect</p>
              <p className="text-muted-foreground mt-1">
                Verifiez que le parametre <code className="text-xs bg-muted px-1 py-0.5 rounded">amount</code> est un nombre entier positif
                superieur ou egal a 200. N'utilisez pas de decimales ni de separateurs de milliers. Exemple correct : <code className="text-xs bg-muted px-1 py-0.5 rounded">amount=5000</code>.
              </p>
            </div>

            <div className="border-b pb-4">
              <p className="font-semibold">Le callback ne redirige pas vers mon site</p>
              <p className="text-muted-foreground mt-1">
                Assurez-vous que le parametre <code className="text-xs bg-muted px-1 py-0.5 rounded">callback</code> est correctement encode avec
                <code className="text-xs bg-muted px-1 py-0.5 rounded">encodeURIComponent()</code> en JavaScript ou <code className="text-xs bg-muted px-1 py-0.5 rounded">urlencode()</code> en PHP.
                L'URL doit etre complete (commencer par https://).
              </p>
            </div>

            <div className="border-b pb-4">
              <p className="font-semibold">Le statut est "success" mais mon service n'est pas active</p>
              <p className="text-muted-foreground mt-1">
                Les parametres de l'URL de retour sont informels et peuvent etre manipules. Implementez la verification du statut
                cote serveur (voir section "Verification du statut") et/ou configurez un webhook (v1.4+) pour une activation fiable.
              </p>
            </div>

            <div className="border-b pb-4">
              <p className="font-semibold">Mon solde n'a pas ete credite</p>
              <p className="text-muted-foreground mt-1">
                Le solde est credite automatiquement des que le paiement est confirme par l'operateur. Si votre solde ne semble pas a jour,
                attendez quelques secondes et actualisez votre tableau de bord. Les paiements en statut "pending" n'ont pas encore ete
                confirmes par l'operateur. Contactez le support si le probleme persiste.
              </p>
            </div>

            <div className="border-b pb-4">
              <p className="font-semibold">Erreur "Cle API invalide"</p>
              <p className="text-muted-foreground mt-1">
                Verifiez que vous utilisez la cle publique (commence par <code className="text-xs bg-muted px-1 py-0.5 rounded">pk_live_</code>) et non la cle secrete.
                Assurez-vous que la cle est active dans votre tableau de bord et qu'elle n'a pas ete revoquee.
              </p>
            </div>

            <div className="border-b pb-4">
              <p className="font-semibold">Le webhook ne fonctionne pas / je ne recois pas de notifications</p>
              <p className="text-muted-foreground mt-1">
                Verifiez que : (1) votre URL est en HTTPS, (2) votre endpoint est accessible publiquement, (3) votre serveur repond en moins de 10 secondes,
                (4) vous avez bien configure le callback URL dans les parametres de votre cle API. Testez votre endpoint manuellement avec cURL ou Postman.
              </p>
            </div>

            <div>
              <p className="font-semibold">La signature du webhook est invalide</p>
              <p className="text-muted-foreground mt-1">
                Assurez-vous d'utiliser le body brut de la requete (pas un objet reparseur). En PHP, utilisez <code className="text-xs bg-muted px-1 py-0.5 rounded">file_get_contents('php://input')</code>.
                En Python Flask, utilisez <code className="text-xs bg-muted px-1 py-0.5 rounded">request.get_data(as_text=True)</code>.
                En Node.js, assurez-vous que <code className="text-xs bg-muted px-1 py-0.5 rounded">express.json()</code> est configure AVANT votre route.
                Le secret utilise doit etre le callbackSecret genere par BKApay, pas votre cle API.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Securite - Bonnes pratiques pour la production
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Avant de mettre votre integration en production, assurez-vous de respecter ces bonnes pratiques de securite
            pour proteger vos transactions et vos utilisateurs.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Toujours verifier le statut cote serveur</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Ne vous fiez jamais uniquement aux parametres de l'URL de retour. Verifiez toujours le statut de la transaction
                  via l'API de verification ou le webhook avant d'activer un service ou livrer un produit.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Verifier le montant</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Apres verification du statut, comparez le montant retourne par l'API avec le montant attendu.
                  Un attaquant pourrait tenter de payer un montant inferieur et modifier les parametres de retour.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Utiliser HTTPS partout</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Votre site, vos pages de retour et vos endpoints webhook doivent tous utiliser HTTPS.
                  Les donnees non chiffrees peuvent etre interceptees.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Proteger vos cles et secrets</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Stockez vos cles secretes et callbackSecret dans des variables d'environnement.
                  Ne les incluez jamais dans le code source, les fichiers de configuration commits ou les logs.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Implementer l'idempotence</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Enregistrez les transactionId deja traites dans votre base de donnees. Si vous recevez un webhook ou une
                  redirection avec un transactionId deja traite, ignorez-le. Cela evite les doubles activations.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Verifier les signatures des webhooks</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Verifiez systematiquement la signature HMAC-SHA256 de chaque webhook. Utilisez une comparaison en temps constant
                  (<code className="bg-muted px-1 py-0.5 rounded">crypto.timingSafeEqual</code> en Node.js, <code className="bg-muted px-1 py-0.5 rounded">hash_equals</code> en PHP,
                  <code className="bg-muted px-1 py-0.5 rounded">hmac.compare_digest</code> en Python) pour eviter les timing attacks.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Logger les evenements</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Gardez un journal de tous les paiements recus (webhook et redirections) avec les dates,
                  montants et transactionId. Cela vous aidera a debugger les problemes et a auditer votre systeme.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center py-8 border-t">
        <p className="text-sm text-muted-foreground">
          Documentation API BKApay - Redirect Checkout - Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour: {docVersion.releaseDate}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Besoin d'aide ? Contactez le support via votre tableau de bord BKApay.
        </p>
      </div>
    </div>
  );
}
