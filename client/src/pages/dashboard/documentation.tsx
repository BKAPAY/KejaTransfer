import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy, Shield, Code, ArrowDown, ArrowUp, Zap } from "lucide-react";
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

  // ====== INTRODUCTION ======
  const introductionText = `BKApay est une plateforme complète de paiement mobile money pour l'Afrique de l'Ouest.
  
Vous pouvez:
- Collecter de l'argent depuis vos clients (PAY-IN)
- Envoyer de l'argent à vos partenaires (PAY-OUT)
- Intégrer via API avec clés publiques/privées
- Configurer des webhooks pour les notifications en temps réel`;

  // ====== AUTHENTIFICATION ======
  const authPublicKeyCode = `// Méthode 1: Clé publique dans le body JSON
fetch('https://bkapay.com/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: 'pk_live_YOUR_PUBLIC_KEY',
    amount: 50000,
    description: 'Achat produit',
    customerName: 'Jean Dupont',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange',
    callbackUrl: 'https://votresite.com/callback' // ← Important!
  })
});

// Méthode 2: Clé publique en Bearer token
fetch('https://bkapay.com/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY'
  },
  body: JSON.stringify({
    amount: 50000,
    // ... autres données
    callbackUrl: 'https://votresite.com/callback'
  })
});`;

  const authPrivateKeyCode = `// Clé privée UNIQUEMENT au backend
const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY; // sk_live_xxxxx

// Méthode 1: Authorization header (recommandé)
fetch('https://bkapay.com/api/transfers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\`
  },
  body: JSON.stringify({
    amount: 50000,
    country: 'SN',
    operator: 'orange',
    phone: '+221781234567'
  })
});

// Méthode 2: Header alternatif
fetch('https://bkapay.com/api/transactions', {
  headers: {
    'X-API-Key': BKAPAY_SECRET_KEY
  }
});`;

  const sessionAuthCode = `// Authentification par session (après login)
// Les cookies sont automatiquement inclus

fetch('https://bkapay.com/api/dashboard/stats', {
  method: 'GET',
  credentials: 'include' // Important: inclure les cookies
})
.then(r => r.json())
.then(data => console.log(data));`;

  // ====== PAY-IN (PAIEMENTS ENTRANTS) ======
  const payInCompleteFlowCode = `// ========================================
// PAY-IN: Flux complet du paiement entrant
// ========================================

// ÉTAPE 1: Votre site collecte les infos du client
async function initializePayment() {
  const publicKey = 'pk_live_YOUR_PUBLIC_KEY';
  
  const paymentData = {
    publicKey: publicKey,
    amount: 50000,
    description: 'Achat de produit ABC',
    customerName: 'Jean Dupont',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange',
    callbackUrl: 'https://votresite.com/callback' // ← CLÉS!
  };

  // ÉTAPE 2: Appel BKApay
  const response = await fetch('https://bkapay.com/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData)
  });

  const data = await response.json();
  
  // ÉTAPE 3: Redirection vers BKApay
  if (data.success) {
    window.location.href = data.redirectUrl;
    // Client voit: page de paiement BKApay
    // Client choisit son opérateur (Orange, Wave, etc.)
    // Client paie via son mobile money
  }
}`;

  const payInFlowExplanation = `// Flux COMPLET du paiement entrant
// ====================================

// ÉTAPE 1: CLIENT visite votre site
// ÉTAPE 2: CLIENT clique "Payer"
// ÉTAPE 3: VOTRE SITE appelle BKApay avec:
//          - publicKey (votre clé publique)
//          - Montant et détails du client
//          - callbackUrl (URL de votre site pour la redirection)

// ÉTAPE 4: BKApay retourne une URL de redirection
// ÉTAPE 5: CLIENT est redirigé vers la page de paiement BKApay
// ÉTAPE 6: CLIENT choisit son opérateur (Orange, Wave, Moov, etc.)
// ÉTAPE 7: CLIENT paie via son mobile money
// ÉTAPE 8: Le paiement est complété (succès ou échec)

// ÉTAPE 9: BKApay redirige AUTOMATIQUEMENT le client vers:
//          https://votresite.com/callback?status=success&transactionId=xxx&amount=50000

// ÉTAPE 10: Votre endpoint callback crédite le compte du client
// ÉTAPE 11: Client voit "Paiement réussi!" sur votre site`;

  // ====== CALLBACK/WEBHOOK - PARTIE CRUCIALE ======
  const callbackServerCode = `// ========================================
// CALLBACK: Côté serveur (VOTRE SITE)
// Cet endpoint reçoit la redirection de BKApay
// ========================================

app.get('/callback', async (req, res) => {
  // ÉTAPE 1: Récupérer les paramètres de la redirection
  const { status, transactionId, amount } = req.query;

  console.log(\`Paiement \${status}: \${amount} XOF pour transaction \${transactionId}\`);

  // ÉTAPE 2: Vérifier le statut du paiement
  if (status === 'success') {
    // Le paiement a réussi!
    
    // ÉTAPE 3: Créditer le compte du client
    const userId = req.session.userId; // ou récupérer depuis la transaction
    await database.updateUserBalance(userId, amount);

    // ÉTAPE 4: Enregistrer dans votre base de données
    await database.createTransaction({
      userId: userId,
      type: 'deposit',
      amount: amount,
      status: 'completed',
      paymentId: transactionId,
      source: 'bkapay_api'
    });

    // ÉTAPE 5: Afficher succès à l'utilisateur
    res.send(\`
      <html>
        <body style="text-align: center; padding: 50px;">
          <h1 style="color: green;">✓ Paiement Réussi!</h1>
          <p>Montant: \${amount} XOF</p>
          <p>Votre compte a été crédité.</p>
          <a href="/dashboard">Retour au dashboard</a>
        </body>
      </html>
    \`);
  } 
  else if (status === 'failed') {
    // Le paiement a échoué

    // ÉTAPE 3: Enregistrer l'échec
    await database.createTransaction({
      userId: req.session.userId,
      type: 'deposit',
      amount: amount,
      status: 'failed',
      paymentId: transactionId,
      source: 'bkapay_api'
    });

    // ÉTAPE 4: Afficher erreur à l'utilisateur
    res.send(\`
      <html>
        <body style="text-align: center; padding: 50px;">
          <h1 style="color: red;">✗ Paiement Échoué</h1>
          <p>Le paiement n'a pas pu être complété.</p>
          <a href="/dashboard">Retour au dashboard</a>
        </body>
      </html>
    \`);
  }
});`;

  const callbackClientCode = `// ========================================
// CALLBACK: Côté client JavaScript
// Afficher un message après redirection
// ========================================

// Quand l'utilisateur arrive sur la page de callback
document.addEventListener('DOMContentLoaded', async () => {
  // ÉTAPE 1: Récupérer les paramètres de l'URL
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const transactionId = params.get('transactionId');
  const amount = params.get('amount');

  // ÉTAPE 2: Afficher le résultat
  const resultDiv = document.getElementById('result');

  if (status === 'success') {
    resultDiv.innerHTML = \`
      <div style="color: green; text-align: center;">
        <h2>✓ Paiement Réussi!</h2>
        <p>Montant: \${amount} XOF</p>
        <p>Transaction: \${transactionId}</p>
        <p>Votre compte a été crédité automatiquement.</p>
        <button onclick="window.location.href='/dashboard'">
          Aller au dashboard
        </button>
      </div>
    \`;
  } 
  else if (status === 'failed') {
    resultDiv.innerHTML = \`
      <div style="color: red; text-align: center;">
        <h2>✗ Paiement Échoué</h2>
        <p>Transaction: \${transactionId}</p>
        <p>Veuillez réessayer.</p>
        <button onclick="window.location.href='/dashboard'">
          Retour
        </button>
      </div>
    \`;
  }
});`;

  // ====== PAY-OUT (PAIEMENTS SORTANTS) ======
  const payOutCode = `// ========================================
// PAY-OUT: Paiements sortants (Retraits)
// ========================================

// Option 1: Via le Dashboard BKApay
// 1. Allez dans "Dashboard" > "Transferts"
// 2. Cliquez "Nouveau Transfert"
// 3. Remplissez:
//    - Montant (XOF)
//    - Pays (SN, CI, BF, BJ, TG, ML)
//    - Opérateur (Orange, Wave, Moov, etc.)
//    - Téléphone (+221781234567 ou 781234567)
// 4. Confirmez
// 5. L'argent arrive en 2-5 minutes

// Option 2: Via API (Backend)
const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY;

app.post('/api/request-withdrawal', async (req, res) => {
  const { amount, country, operator, phone } = req.body;

  const response = await fetch('https://bkapay.com/api/transfers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\`
    },
    body: JSON.stringify({
      amount: amount,
      country: country,
      operator: operator,
      phone: phone,
      description: 'Retrait demandé'
    })
  });

  const data = await response.json();
  res.json(data);
});`;

  // ====== GESTION DES ERREURS ======
  const errorHandlingCode = `// ========================================
// GESTION DES ERREURS
// ========================================

// Toujours vérifier la réponse
async function safeApiCall(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // Gérer l'erreur
      console.error(\`Erreur \${response.status}: \${data.error}\`);
      
      // Codes d'erreur courants:
      // 401 - Clé API invalide ou manquante
      // 400 - Paramètres invalides
      // 402 - Solde insuffisant
      // 409 - Ressource existe déjà
      // 429 - Rate limit (trop de requêtes)
      // 500 - Erreur serveur
      
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erreur réseau:', error);
    return null;
  }
}

// Implémenter un retry
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (response.ok) return data;
      
      // Si rate limit, attendre
      if (response.status === 429) {
        const waitTime = 1000 * (i + 1);
        console.log(\`Rate limit - attendre \${waitTime}ms\`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      throw new Error(data.error);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}`;

  // ====== LIMITES ET SÉCURITÉ ======
  const limitsCode = `// ========================================
// LIMITES ET SÉCURITÉ
// ========================================

// Rate Limiting
// - 10 requêtes par seconde par clé API
// - Si dépassé: réponse 429 avec header Retry-After

// Montants (XOF)
// Minimum: 100 XOF
// Maximum: 10,000,000 XOF par transaction

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
// ✓ Clés publiques: OK au frontend
// ✓ Clés privées: JAMAIS au frontend
// ✓ Vérifier les signatures webhook
// ✓ Valider tous les montants côté serveur
// ✓ Ne pas logguer les clés API
// ✓ Faire tourner les clés régulièrement`;

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Documentation API BKApay</h1>
        <p className="text-sm text-muted-foreground">Guide complet - Du début à la fin</p>
        <p className="text-xs text-muted-foreground mt-2">Domaine: bkapay.com</p>
      </div>

      {/* Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle>Vue d'ensemble</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground whitespace-pre-wrap">{introductionText}</p>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-green-600" />
                PAY-IN (Entrants)
              </h4>
              <p className="text-xs text-muted-foreground">
                Collectez de l'argent depuis vos clients. Ils payent via mobile money. L'argent arrive sur votre dashboard.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-blue-600" />
                PAY-OUT (Sortants)
              </h4>
              <p className="text-xs text-muted-foreground">
                Envoyez de l'argent à vos clients via mobile money. Débité de votre solde.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentification */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Authentification API (3 Méthodes)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          {/* Public Key */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">Frontend</Badge>
              <h4 className="font-semibold">1. Clé Publique (pk_live_xxxxx)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              ✅ <span className="font-semibold">Où:</span> Frontend JavaScript, React, Vue
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ✅ <span className="font-semibold">Pour quoi:</span> Créer des paiements (PAY-IN)
            </p>
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded text-xs text-green-900 dark:text-green-100 mb-3">
              ✅ <span className="font-semibold">Sûre d'exposer</span> - C'est son rôle!
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto mb-3">
              <pre>{authPublicKeyCode}</pre>
            </div>
            <Button onClick={() => copyCode(authPublicKeyCode)} variant="outline" size="sm" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          {/* Private Key */}
          <div className="border-l-4 border-red-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="destructive">Backend</Badge>
              <h4 className="font-semibold">2. Clé Privée (sk_live_xxxxx)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              🔒 <span className="font-semibold">Où:</span> UNIQUEMENT backend (Node.js, Python, PHP)
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              🔒 <span className="font-semibold">Pour quoi:</span> Opérations sensibles (transferts, vérifications)
            </p>
            <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-xs text-red-900 dark:text-red-100 mb-3">
              🔒 <span className="font-semibold">SECRÈTE</span> - Jamais au frontend!
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto mb-3">
              <pre>{authPrivateKeyCode}</pre>
            </div>
            <Button onClick={() => copyCode(authPrivateKeyCode)} variant="outline" size="sm" className="w-full">
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
            <p className="text-sm text-muted-foreground mb-3">
              ✅ <span className="font-semibold">Où:</span> Dashboard utilisateur
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ✅ <span className="font-semibold">Pour quoi:</span> Après login via cookies
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs text-blue-900 dark:text-blue-100 mb-3">
              ✅ <span className="font-semibold">Automatique</span> - Les cookies sont inclus
            </div>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto mb-3">
              <pre>{sessionAuthCode}</pre>
            </div>
            <Button onClick={() => copyCode(sessionAuthCode)} variant="outline" size="sm" className="w-full">
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
            PAY-IN: Collecte de Paiements Entrants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100">
              <span className="font-bold">PAY-IN</span> = Vos clients payent VERS vous via mobile money. L'argent arrive sur votre dashboard.
            </p>
          </div>

          {/* Flux complet */}
          <div>
            <h3 className="text-lg font-semibold mb-3">🔄 Flux complet du paiement</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3">
              <pre>{payInFlowExplanation}</pre>
            </div>
          </div>

          {/* Code d'intégration */}
          <div>
            <h3 className="text-lg font-semibold mb-3">💻 Code d'intégration complet</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3">
              <pre>{payInCompleteFlowCode}</pre>
            </div>
            <Button onClick={() => copyCode(payInCompleteFlowCode)} variant="outline" size="sm" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          {/* Opérateurs */}
          <div>
            <h3 className="text-lg font-semibold mb-3">🌍 Opérateurs supportés par pays</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇸🇳 Sénégal</p>
                <p className="text-xs text-muted-foreground">orange, free, expresso, wave, wizall</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇨🇮 Côte d'Ivoire</p>
                <p className="text-xs text-muted-foreground">orange, mtn, moov, wave</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇧🇫 Burkina Faso</p>
                <p className="text-xs text-muted-foreground">orange, moov</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇧🇯 Bénin</p>
                <p className="text-xs text-muted-foreground">moov, mtn</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇹🇬 Togo</p>
                <p className="text-xs text-muted-foreground">tmoney, moov</p>
              </div>
              <div className="border rounded p-3">
                <p className="font-bold text-sm">🇲🇱 Mali</p>
                <p className="text-xs text-muted-foreground">orange, moov</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CALLBACK / WEBHOOK - SECTION CRITIQUE */}
      <Card className="border-2 border-amber-500">
        <CardHeader className="pb-2 bg-amber-50 dark:bg-amber-950">
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <Zap className="w-5 h-5" />
            🎯 CALLBACK/WEBHOOK: La redirection automatique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100 font-semibold">
              ⚡ C'est LA PIÈCE MAÎTRESSE du système:
            </p>
            <ul className="text-sm text-amber-900 dark:text-amber-100 mt-2 space-y-1">
              <li>✅ Après un paiement (succès ou échec)</li>
              <li>✅ L'utilisateur est automatiquement redirigé vers VOTRE site</li>
              <li>✅ VOTRE serveur crédite automatiquement le compte</li>
              <li>✅ L'utilisateur voit le résultat sur VOTRE site (pas BKApay!)</li>
            </ul>
          </div>

          {/* Explication 1 */}
          <div>
            <h3 className="text-lg font-semibold mb-3">📍 ÉTAPE 1: Comment ça marche?</h3>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Quand vous créez un paiement:</p>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-mono mt-1">
                  callbackUrl: 'https://votresite.com/callback'
                </p>
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Après le paiement, BKApay redirige vers:</p>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-mono mt-1">
                  https://votresite.com/callback?status=success&transactionId=xxx&amount=50000
                </p>
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Si le paiement échoue:</p>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-mono mt-1">
                  https://votresite.com/callback?status=failed&transactionId=xxx&amount=50000
                </p>
              </div>
            </div>
          </div>

          {/* Code serveur */}
          <div>
            <h3 className="text-lg font-semibold mb-3">💾 ÉTAPE 2: Code serveur (Votre endpoint callback)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Cet endpoint reçoit la redirection de BKApay et crédite automatiquement l'utilisateur:
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3 border-l-4 border-red-500">
              <pre>{callbackServerCode}</pre>
            </div>
            <Button onClick={() => copyCode(callbackServerCode)} variant="outline" size="sm" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copier le code serveur
            </Button>
          </div>

          {/* Code client */}
          <div>
            <h3 className="text-lg font-semibold mb-3">🖥️ ÉTAPE 3: Code frontend (JavaScript)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Afficher le résultat du paiement à l'utilisateur:
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3 border-l-4 border-green-500">
              <pre>{callbackClientCode}</pre>
            </div>
            <Button onClick={() => copyCode(callbackClientCode)} variant="outline" size="sm" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copier le code client
            </Button>
          </div>

          {/* Résumé */}
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="font-semibold text-purple-900 dark:text-purple-100 mb-2">📊 Résumé du flux:</p>
            <ol className="text-sm text-purple-900 dark:text-purple-100 space-y-1">
              <li>1️⃣ Votre site envoie: POST /api/payments/create + callbackUrl</li>
              <li>2️⃣ Utilisateur paie sur BKApay</li>
              <li>3️⃣ BKApay redirige vers: callbackUrl?status=success&amount=xxx</li>
              <li>4️⃣ Votre serveur crédite le compte</li>
              <li>5️⃣ Votre client JavaScript affiche "Succès!"</li>
              <li>6️⃣ Utilisateur voit le solde à jour ✅</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* PAY-OUT */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5 text-blue-600" />
            PAY-OUT: Paiements sortants (Retraits)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-bold">PAY-OUT</span> = Vous envoyez de l'argent à vos clients via mobile money.
            </p>
          </div>

          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3">
            <pre>{payOutCode}</pre>
          </div>
          <Button onClick={() => copyCode(payOutCode)} variant="outline" size="sm" className="w-full">
            <Copy className="w-4 h-4 mr-2" />
            Copier le code
          </Button>
        </CardContent>
      </Card>

      {/* Gestion des erreurs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Gestion des erreurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3">
            <pre>{errorHandlingCode}</pre>
          </div>
          <Button onClick={() => copyCode(errorHandlingCode)} variant="outline" size="sm" className="w-full">
            <Copy className="w-4 h-4 mr-2" />
            Copier le code
          </Button>
        </CardContent>
      </Card>

      {/* Limites et sécurité */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Limites et sécurité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto mb-3">
            <pre>{limitsCode}</pre>
          </div>
          <Button onClick={() => copyCode(limitsCode)} variant="outline" size="sm" className="w-full">
            <Copy className="w-4 h-4 mr-2" />
            Copier
          </Button>
        </CardContent>
      </Card>

      {/* Support */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Avez-vous des questions? Consultez:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>📧 Email: support@bkapay.com</li>
            <li>💬 Chat: support.bkapay.com</li>
            <li>📚 Docs: docs.bkapay.com</li>
            <li>🐛 Issues: github.com/bkapay/api-issues</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
