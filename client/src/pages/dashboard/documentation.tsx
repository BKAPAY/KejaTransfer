import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy, Shield, Code, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Documentation() {
  const { toast } = useToast();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copié",
      description: "Le code a été copié dans le presse-papiers",
    });
  };

  // AUTHENTIFICATION
  const authPublicKeyCode = `// Méthode 1: Clé publique dans le body JSON
fetch('https://bkapay.app/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: 'pk_live_YOUR_PUBLIC_KEY',
    amount: 50000,
    ...
  })
});

// Méthode 2: Clé publique en Bearer token
fetch('https://bkapay.app/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY'
  },
  body: JSON.stringify({
    amount: 50000,
    ...
  })
});`;

  const authPrivateKeyCode = `// Clé privée UNIQUEMENT au backend
const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY; // sk_live_xxxxx

// Méthode 1: Authorization header (recommandé)
fetch('https://bkapay.app/api/transactions', {
  headers: {
    'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\`
  }
});

// Méthode 2: Header alternatif
fetch('https://bkapay.app/api/transactions', {
  headers: {
    'X-API-Key': BKAPAY_SECRET_KEY
  }
});`;

  const sessionAuthCode = `// Authentification par session (après login)
// Les cookies sont automatiquement inclus

fetch('https://bkapay.app/api/dashboard/stats', {
  method: 'GET',
  credentials: 'include' // Important: inclure les cookies
})
.then(r => r.json())
.then(data => console.log(data));`;

  // PAY-IN (Paiements entrants)
  const payInFrontendCode = `// ========================================
// PAY-IN: INTÉGRATION FRONTEND
// Collecte de paiements depuis votre site
// ========================================

async function initializePayment() {
  const publicKey = 'pk_live_YOUR_PUBLIC_KEY'; // Clé publique
  
  // Récupérer les données du formulaire
  const amount = document.getElementById('amount').value;
  const customerName = document.getElementById('name').value;
  const customerEmail = document.getElementById('email').value;
  const customerPhone = document.getElementById('phone').value;
  const country = document.getElementById('country').value;
  const operator = document.getElementById('operator').value;

  try {
    // 1. Appeler l'API BKApay
    const response = await fetch('https://bkapay.app/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: publicKey,
        amount: parseInt(amount),
        description: 'Achat de produit',
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        country: country,
        operator: operator
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // 2. Rediriger le client vers la page de paiement BKApay
      window.location.href = data.data.redirectUrl;
    } else {
      alert('Erreur: ' + data.error);
    }
  } catch (error) {
    console.error('Erreur réseau:', error);
    alert('Erreur de connexion');
  }
}

// HTML du formulaire
\`<form id="paymentForm">
  <input type="text" id="name" placeholder="Nom complet" required />
  <input type="email" id="email" placeholder="Email" required />
  <input type="tel" id="phone" placeholder="+221781234567" required />
  <input type="number" id="amount" placeholder="Montant XOF" required />
  
  <select id="country" required>
    <option value="">Pays</option>
    <option value="SN">Sénégal</option>
    <option value="CI">Côte d'Ivoire</option>
    <option value="BF">Burkina Faso</option>
    <option value="BJ">Bénin</option>
    <option value="TG">Togo</option>
    <option value="ML">Mali</option>
  </select>

  <select id="operator" required>
    <option value="">Opérateur</option>
    <option value="orange">Orange Money</option>
    <option value="wave">Wave</option>
    <option value="moov">Moov</option>
    <option value="mtn">MTN</option>
    <option value="free">Free Money</option>
    <option value="tmoney">T-Money</option>
    <option value="wizall">Wizall</option>
    <option value="expresso">Expresso</option>
  </select>
  
  <button type="button" onclick="initializePayment()">Payer maintenant</button>
</form>\``;

  const payInFlowCode = `// Flux complet de paiement entrant (PAY-IN)
// ==========================================

// 1. CLIENT visite votre site
// 2. CLIENT remplit le formulaire de paiement
// 3. VOTRE SITE appelle l'API avec:
//    - publicKey (clé publique exposée)
//    - montant et détails du client
// 4. API retourne: redirectUrl
// 5. CLIENT rediriges vers BKApay
// 6. CLIENT choisit son opérateur (Orange, Wave, etc.)
// 7. CLIENT paie via son mobile money
// 8. BKApay redirige vers votre site (callback)
// 9. L'ARGENT arrive sur VOTRE DASHBOARD BKApay
// 10. VOUS pouvez le retirer (pay-out)`;

  // PAY-OUT (Paiements sortants)
  const payOutBackendCode = `// ========================================
// PAY-OUT: INTÉGRATION BACKEND
// Transferts/retraits vers vos clients
// ========================================

const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY; // sk_live_xxxxx

// Option 1: Depuis votre backend (recommandé)
app.post('/api/request-withdrawal', async (req, res) => {
  const { amount, country, operator, phone } = req.body;

  try {
    // Appelez l'API de transfert avec clé PRIVÉE
    const response = await fetch('https://bkapay.app/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\` // 🔒 Clé privée
      },
      body: JSON.stringify({
        amount: amount,
        country: country,
        operator: operator,
        phone: phone,
        description: 'Retrait demandé par client'
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Frontend: appelle VOTRE serveur (pas directement BKApay)
document.getElementById('withdrawBtn').addEventListener('click', async () => {
  const response = await fetch('/api/request-withdrawal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 50000,
      country: 'SN',
      operator: 'orange',
      phone: '+221781234567'
    })
  });

  const data = await response.json();
  if (data.success) {
    alert('Retrait demandé avec succès!');
  }
});`;

  const payOutDashboardCode = `// ========================================
// PAY-OUT: Via le Dashboard
// Interface simple depuis BKApay
// ========================================

// 1. Allez dans "Tableau de Bord" > "Transferts"
// 2. Cliquez "Nouveau Transfert"
// 3. Remplissez:
//    - Montant (en XOF)
//    - Pays (SN, CI, BF, BJ, TG, ML)
//    - Opérateur (Orange, Wave, Moov, etc.)
//    - Numéro de téléphone (+221781234567 ou 781234567)
// 4. Confirmez
// 5. L'argent est débité de votre solde
// 6. Envoyé au bénéficiaire en 2-5 minutes

// Formats de téléphone acceptés:
// +221781234567 (format international)
// 781234567 (format local Sénégal)`;

  // WEBHOOKS
  const webhookVerificationCode = `// ========================================
// WEBHOOKS: Notifications en temps réel
// ========================================

import crypto from 'crypto';

const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY;

// Vérifier la signature du webhook (sécurité)
function verifyWebhookSignature(payload, signature) {
  const hash = crypto
    .createHmac('sha256', BKAPAY_SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}

// Endpoint webhook
app.post('/webhook/bkapay', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  // Vérifier que c'est vraiment BKApay
  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Traiter les différents événements
  switch (payload.event) {
    case 'payment.completed':
      // Paiement réussi
      console.log('Paiement de', payload.data.amount, 'XOF reçu');
      console.log('Client:', payload.data.customerEmail);
      // Mettre à jour votre base de données
      break;

    case 'payment.failed':
      // Paiement échoué
      console.log('Paiement échoué:', payload.data.reason);
      break;

    case 'transfer.completed':
      // Transfert réussi
      console.log('Transfert de', payload.data.amount, 'vers', payload.data.phone);
      break;

    case 'transfer.failed':
      // Transfert échoué
      console.log('Transfert échoué:', payload.data.reason);
      break;
  }

  // Toujours retourner 200 OK
  res.json({ success: true });
});`;

  const webhookEventTypesCode = `// Événements webhook disponibles:

// PAY-IN (Paiements entrants)
{
  "event": "payment.completed",
  "data": {
    "transactionId": "uuid",
    "amount": 50000,
    "currency": "XOF",
    "customerName": "Jean Dupont",
    "customerEmail": "jean@example.com",
    "customerPhone": "+221781234567",
    "operator": "orange",
    "country": "SN",
    "status": "completed",
    "timestamp": "2025-01-23T10:30:00Z"
  }
}

{
  "event": "payment.failed",
  "data": {
    "transactionId": "uuid",
    "reason": "insufficient_funds",
    "timestamp": "2025-01-23T10:35:00Z"
  }
}

// PAY-OUT (Paiements sortants)
{
  "event": "transfer.completed",
  "data": {
    "transferId": "uuid",
    "amount": 50000,
    "phone": "+221781234567",
    "operator": "orange",
    "country": "SN",
    "status": "completed",
    "timestamp": "2025-01-23T10:40:00Z"
  }
}

{
  "event": "transfer.failed",
  "data": {
    "transferId": "uuid",
    "reason": "invalid_phone",
    "timestamp": "2025-01-23T10:45:00Z"
  }
}`;

  // GESTION D'ERREURS
  const errorHandlingCode = `// ========================================
// GESTION DES ERREURS
// ========================================

// 1. Toujours vérifier data.success
if (!response.ok || !data.success) {
  const errorMessage = data.error || 'Erreur inconnue';
  console.error('Erreur API:', errorMessage);
  // Afficher un message à l'utilisateur
}

// 2. Codes d'erreur courants:

// 401 Unauthorized
// Raison: Clé API invalide ou manquante
// Solution: Vérifiez votre clé API

// 400 Bad Request
// Raison: Paramètres invalides (montant négatif, pays invalide)
// Solution: Validez les données avant d'envoyer

// 402 Payment Required
// Raison: Solde insuffisant pour le transfert
// Solution: Charger votre compte

// 409 Conflict
// Raison: Ressource existe déjà ou état invalide
// Solution: Vérifiez l'état actuel

// 500 Internal Server Error
// Raison: Erreur serveur
// Solution: Réessayez plus tard

// 3. Implémenter un retry avec attente
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (data.success) return data;
      
      // Si rate limit, attendre
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      
      throw new Error(data.error);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}`;

  // LIMITES ET SÉCURITÉ
  const limitsCode = `// ========================================
// LIMITES ET SÉCURITÉ
// ========================================

// Rate Limiting
// - 10 requêtes par seconde par clé API
// - Headers de réponse:
//   X-RateLimit-Limit: 10
//   X-RateLimit-Remaining: 8
//   X-RateLimit-Reset: 1234567890

// Montants
// Minimum: 100 XOF
// Maximum: 10,000,000 XOF (par transaction)

// Numéros de téléphone
// Format: +CODE_PAYS + NUMERO
// Exemples:
// +221 781234567 (Sénégal)
// +225 0709876543 (Côte d'Ivoire)
// +226 50123456 (Burkina Faso)
// +229 67891234 (Bénin)
// +228 90123456 (Togo)
// +223 65123456 (Mali)

// Sécurité:
// - Clés privées: JAMAIS au frontend
// - Vérifier les signatures webhook
// - Valider tous les montants côté serveur
// - Ne pas logguer les clés API
// - Faire tourner les clés régulièrement`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Documentation API BKApay</h1>
        <p className="text-sm text-muted-foreground">Guide complet - Du début à la fin</p>
      </div>

      {/* Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle>Vue d'ensemble</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-sm text-muted-foreground">
            BKApay offre une plateforme complète de paiement pour l'Afrique de l'Ouest. Vous pouvez:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-green-600" />
                PAY-IN (Paiements entrants)
              </h4>
              <p className="text-xs text-muted-foreground">
                Collectez de l'argent depuis vos clients. Ils payent via mobile money (Orange, Wave, Moov, etc.). L'argent arrive sur votre dashboard.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-blue-600" />
                PAY-OUT (Paiements sortants)
              </h4>
              <p className="text-xs text-muted-foreground">
                Envoyez de l'argent à vos clients ou partenaires via mobile money. Débité de votre solde BKApay.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Authentification API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-lg mb-4">Comment ça marche?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              BKApay supporte 3 façons de s'authentifier. Choisissez celle qui correspond à votre cas d'usage:
            </p>
          </div>

          {/* Clé Publique */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">Public</Badge>
              <h4 className="font-semibold">1. Clé Publique (Frontend)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Format: <span className="font-mono bg-muted px-2 py-1 rounded">pk_live_xxxxx</span>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-semibold">Où:</span> Utilisez-la au frontend (JavaScript, React, Vue)
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-semibold">Pour quoi:</span> Créer des paiements (PAY-IN)
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs text-blue-900 dark:text-blue-100 mb-3">
              ✅ <span className="font-semibold">Sûre d'exposer</span> - C'est son rôle!
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{authPublicKeyCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(authPublicKeyCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          {/* Clé Privée */}
          <div className="border-l-4 border-red-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="destructive">Secret</Badge>
              <h4 className="font-semibold">2. Clé Privée (Backend)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Format: <span className="font-mono bg-muted px-2 py-1 rounded">sk_live_xxxxx</span>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-semibold">Où:</span> UNIQUEMENT au backend (Node.js, Python, PHP)
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-semibold">Pour quoi:</span> Opérations sensibles (transferts, vérifications)
            </p>
            <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-xs text-red-900 dark:text-red-100 mb-3">
              🔒 <span className="font-semibold">SECRÈTE</span> - Jamais au frontend!
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{authPrivateKeyCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(authPrivateKeyCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          {/* Session */}
          <div className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">Session</Badge>
              <h4 className="font-semibold">3. Authentification par Session</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-semibold">Où:</span> Web applications
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-semibold">Pour quoi:</span> Dashboard utilisateur
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs text-blue-900 dark:text-blue-100 mb-3">
              ✅ <span className="font-semibold">Automatique</span> - Après login via cookies
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{sessionAuthCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(sessionAuthCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PAY-IN Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-green-600" />
            PAY-IN: Collecte de Paiements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100">
              <span className="font-bold">PAY-IN</span> signifie que vos clients payent VERS vous. L'argent arrive sur votre dashboard BKApay.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">🔄 Flux complet</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{payInFlowCode}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">💻 Intégration Frontend</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Utilisez votre <span className="font-mono bg-muted px-2 py-1 rounded">clé publique (pk_live_xxxxx)</span>
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{payInFrontendCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(payInFrontendCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">🌍 Opérateurs par Pays</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇸🇳 Sénégal (SN)</p>
                <p className="text-xs text-muted-foreground">orange, free, expresso, wave, wizall</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇨🇮 Côte d'Ivoire (CI)</p>
                <p className="text-xs text-muted-foreground">orange, mtn, moov, wave</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇧🇫 Burkina Faso (BF)</p>
                <p className="text-xs text-muted-foreground">orange, moov</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇧🇯 Bénin (BJ)</p>
                <p className="text-xs text-muted-foreground">moov, mtn</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇹🇬 Togo (TG)</p>
                <p className="text-xs text-muted-foreground">tmoney, moov</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇲🇱 Mali (ML)</p>
                <p className="text-xs text-muted-foreground">orange, moov</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">📞 Format des Numéros de Téléphone</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-bold">Format international:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+221781234567</span></p>
              <p><span className="font-bold">Sénégal:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+221 (code 2-3 chiffres) 7/8 (7-8 chiffres)</span></p>
              <p><span className="font-bold">Côte d'Ivoire:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+225 07/05 (8 chiffres)</span></p>
              <p><span className="font-bold">Burkina Faso:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+226 5/6 (8 chiffres)</span></p>
              <p><span className="font-bold">Bénin:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+229 6/9 (8 chiffres)</span></p>
              <p><span className="font-bold">Togo:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+228 9/2 (8 chiffres)</span></p>
              <p><span className="font-bold">Mali:</span> <span className="font-mono bg-muted px-2 py-1 rounded">+223 6/7 (8 chiffres)</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PAY-OUT Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5 text-blue-600" />
            PAY-OUT: Transferts et Retraits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-bold">PAY-OUT</span> signifie envoyer de l'argent DEPUIS vous vers vos clients. Débité de votre solde BKApay.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">📊 Deux façons de faire des PAY-OUT</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Vous pouvez faire des transferts soit depuis votre dashboard, soit depuis votre application.
            </p>
          </div>

          {/* Option 1: Dashboard */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold mb-3">Option 1: Via le Dashboard BKApay</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Interface simple pour les retraits manuels.
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{payOutDashboardCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(payOutDashboardCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          {/* Option 2: API */}
          <div className="border-l-4 border-cyan-500 pl-4">
            <h4 className="font-semibold mb-3">Option 2: Via l'API Backend (Automatisé)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Utilisez votre <span className="font-mono bg-muted px-2 py-1 rounded">clé privée (sk_live_xxxxx)</span> pour automatiser les transferts.
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{payOutBackendCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(payOutBackendCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Webhooks: Notifications en Temps Réel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-sm text-muted-foreground">
            Les webhooks permettent à BKApay de vous notifier en temps réel quand un paiement ou transfert est complété.
          </p>

          <div>
            <h3 className="text-lg font-semibold mb-3">Comment ça marche?</h3>
            <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
              <li>Un paiement/transfert se termine sur BKApay</li>
              <li>BKApay envoie une notification à votre URL webhook</li>
              <li>Vous recevez les détails (montant, statut, etc.)</li>
              <li>Vous confirmez avec un statut 200 OK</li>
              <li>Vous mettez à jour votre base de données</li>
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Implémentation avec Vérification de Signature</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{webhookVerificationCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(webhookVerificationCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Types d'Événements Webhook</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{webhookEventTypesCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(webhookEventTypesCode)}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier les événements
            </Button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-semibold">Sécurité:</span> Toujours vérifier la signature du webhook avec votre clé privée avant de traiter les données!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error Handling */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Gestion des Erreurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
            <pre>{errorHandlingCode}</pre>
          </div>
          <Button
            onClick={() => copyCode(errorHandlingCode)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier le code
          </Button>
        </CardContent>
      </Card>

      {/* Limits and Security */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Limites et Sécurité</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
            <pre>{limitsCode}</pre>
          </div>
          <Button
            onClick={() => copyCode(limitsCode)}
            variant="outline"
            size="sm"
            className="mt-3 w-full"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier les limites
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle>Résumé Complet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-bold text-foreground">✅ Vous avez appris:</p>
            <ul className="text-muted-foreground space-y-1 ml-4">
              <li>✓ Les 3 méthodes d'authentification</li>
              <li>✓ Comment collecter des paiements (PAY-IN)</li>
              <li>✓ Comment faire des transferts (PAY-OUT)</li>
              <li>✓ Comment gérer les webhooks</li>
              <li>✓ Comment gérer les erreurs</li>
              <li>✓ Les limites et bonnes pratiques de sécurité</li>
            </ul>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="font-bold text-foreground">🚀 Prochaines étapes:</p>
            <ul className="text-muted-foreground space-y-1 ml-4">
              <li>1. Créez une clé API dans "Clés API"</li>
              <li>2. Copiez votre clé publique (pk_live_xxxxx)</li>
              <li>3. Intégrez le code PAY-IN dans votre site</li>
              <li>4. Testez avec un paiement en mode test</li>
              <li>5. Configurez vos webhooks pour les notifications</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
