import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy, Shield, Code, ArrowDown, ArrowUp, Zap, Globe, Lock, CheckCircle } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-doc-title">
          Documentation API BKApay
        </h1>
        <p className="text-sm text-muted-foreground">
          Intégrez facilement les paiements mobile money en Afrique de l'Ouest
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Base URL: <code className="bg-muted px-2 py-1 rounded">https://bkapay.com</code>
        </p>
      </div>

      {/* Introduction */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Vue d'ensemble
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            BKApay est une plateforme complète de paiement mobile money pour l'Afrique de l'Ouest.
            Elle vous permet d'accepter des paiements et d'effectuer des transferts dans 6 pays.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="border rounded-lg p-4 bg-background">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-green-600" />
                Paiements Entrants (PAY-IN)
              </h4>
              <p className="text-xs text-muted-foreground">
                Collectez de l'argent depuis vos clients via mobile money. L'argent arrive directement sur votre solde BKApay.
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-blue-600" />
                Paiements Sortants (PAY-OUT)
              </h4>
              <p className="text-xs text-muted-foreground">
                Envoyez de l'argent à vos clients ou partenaires via mobile money. Débité de votre solde BKApay.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">
              🌍 6 Pays supportés
            </h4>
            <p className="text-xs text-blue-900 dark:text-blue-100">
              Sénégal (SN), Côte d'Ivoire (CI), Burkina Faso (BF), Bénin (BJ), Togo (TG), Mali (ML)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Authentification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <p className="text-muted-foreground">
            BKApay utilise un système de clés API publiques/privées pour l'authentification.
          </p>

          {/* Public Key */}
          <div className="border-l-4 border-green-500 pl-4 bg-green-50 dark:bg-green-950 p-4 rounded-r">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900">Frontend</Badge>
              <h4 className="font-semibold">Clé Publique (pk_live_xxxxx)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              ✅ <span className="font-semibold">Utilisation:</span> Frontend (React, Vue, JavaScript)
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              ✅ <span className="font-semibold">Permissions:</span> Créer des paiements entrants
            </p>
            <p className="text-sm text-green-900 dark:text-green-100 font-semibold">
              ✅ Sûre d'exposer publiquement
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto mt-3">
              <pre>{`// Méthode 1: Dans le corps de la requête
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
    callbackUrl: 'https://votresite.com/callback'
  })
});

// Méthode 2: En Bearer token
fetch('https://bkapay.com/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY'
  },
  body: JSON.stringify({ amount: 50000, /* ... */ })
});`}</pre>
            </div>
            <Button 
              onClick={() => copyCode(`fetch('https://bkapay.com/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY'
  },
  body: JSON.stringify({
    amount: 50000,
    description: 'Achat produit',
    customerName: 'Jean Dupont',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange',
    callbackUrl: 'https://votresite.com/callback'
  })
});`)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-public-key"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          {/* Private Key */}
          <div className="border-l-4 border-red-500 pl-4 bg-red-50 dark:bg-red-950 p-4 rounded-r">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="destructive">Backend</Badge>
              <h4 className="font-semibold">Clé Privée (sk_live_xxxxx)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              🔒 <span className="font-semibold">Utilisation:</span> UNIQUEMENT backend (Node.js, Python, PHP)
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              🔒 <span className="font-semibold">Permissions:</span> Transferts, consultation de transactions
            </p>
            <p className="text-sm text-red-900 dark:text-red-100 font-semibold">
              🔒 SECRÈTE - Jamais au frontend!
            </p>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto mt-3">
              <pre>{`// UNIQUEMENT côté serveur
const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY;

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

// Méthode 2: Header X-API-Key
fetch('https://bkapay.com/api/transactions', {
  headers: { 'X-API-Key': BKAPAY_SECRET_KEY }
});`}</pre>
            </div>
            <Button 
              onClick={() => copyCode(`const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY;

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
});`)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-private-key"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PAY-IN (Incoming Payments) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-green-600" />
            Paiements Entrants (PAY-IN)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100">
              <span className="font-bold">PAY-IN</span> = Vos clients payent vers vous via mobile money. L'argent arrive sur votre solde BKApay.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">🔄 Flux complet</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Client visite votre site web</p>
              <p>2. Client clique "Payer"</p>
              <p>3. Votre site appelle <code className="bg-muted px-2 py-1 rounded">POST /api/payments/create</code></p>
              <p>4. BKApay retourne une URL de redirection</p>
              <p>5. Client est redirigé vers la page de paiement BKApay</p>
              <p>6. Client choisit son opérateur et paie via mobile money</p>
              <p>7. BKApay redirige le client vers votre <code className="bg-muted px-2 py-1 rounded">callbackUrl</code></p>
              <p>8. Votre serveur crédite automatiquement le compte du client</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">📝 Endpoint: POST /api/payments/create</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{`// Créer un paiement entrant
const response = await fetch('https://bkapay.com/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY'
  },
  body: JSON.stringify({
    amount: 50000,                    // Montant en XOF (min: 100)
    description: 'Achat produit ABC', // Description
    customerName: 'Jean Dupont',      // Nom du client
    customerEmail: 'jean@example.com',// Email du client
    customerPhone: '+221781234567',   // Téléphone (+CODE NUMERO)
    country: 'SN',                    // Code pays (SN, CI, BF, BJ, TG, ML)
    operator: 'orange',               // Opérateur (orange, mtn, moov, wave, etc.)
    callbackUrl: 'https://votresite.com/callback' // URL de redirection
  })
});

const data = await response.json();

if (data.success) {
  // Rediriger le client vers la page de paiement
  window.location.href = data.redirectUrl;
}

// Réponse:
{
  "success": true,
  "redirectUrl": "https://bkapay.com/pay/abc123",
  "transactionId": "xyz789"
}`}</pre>
            </div>
            <Button 
              onClick={() => copyCode(`const response = await fetch('https://bkapay.com/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY'
  },
  body: JSON.stringify({
    amount: 50000,
    description: 'Achat produit ABC',
    customerName: 'Jean Dupont',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange',
    callbackUrl: 'https://votresite.com/callback'
  })
});

const data = await response.json();
if (data.success) {
  window.location.href = data.redirectUrl;
}`)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-payin"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div className="border-2 border-amber-500 rounded-lg p-4 bg-amber-50 dark:bg-amber-950">
            <h3 className="text-lg font-semibold mb-3 text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Callback URL - Important!
            </h3>
            <p className="text-sm text-amber-900 dark:text-amber-100 mb-3">
              Après le paiement, BKApay redirige automatiquement le client vers votre <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">callbackUrl</code> avec des paramètres:
            </p>
            <code className="block bg-amber-100 dark:bg-amber-900 p-3 rounded text-xs text-amber-900 dark:text-amber-100">
              https://votresite.com/callback?status=success&transactionId=xyz789&amount=50000
            </code>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2 text-amber-900 dark:text-amber-100">Paramètres du callback:</h4>
              <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                <li>• <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">status</code>: "success" ou "failed"</li>
                <li>• <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">transactionId</code>: ID de la transaction</li>
                <li>• <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">amount</code>: Montant payé en XOF</li>
              </ul>
            </div>

            <div className="bg-gray-950 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto mt-4">
              <pre>{`// Exemple de callback côté serveur
app.get('/callback', async (req, res) => {
  const { status, transactionId, amount } = req.query;

  if (status === 'success') {
    // Créditer le compte du client
    await db.updateUserBalance(userId, amount);
    
    // Enregistrer la transaction
    await db.createTransaction({
      type: 'deposit',
      amount: amount,
      status: 'completed',
      transactionId: transactionId
    });

    res.send('Paiement réussi!');
  } else {
    res.send('Paiement échoué');
  }
});`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PAY-OUT (Outgoing Payments) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5 text-blue-600" />
            Paiements Sortants (PAY-OUT)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-bold">PAY-OUT</span> = Vous envoyez de l'argent à vos clients via mobile money. Débité de votre solde BKApay.
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-red-900 dark:text-red-100" />
              <p className="text-sm text-red-900 dark:text-red-100 font-semibold">
                Clé privée requise + Vérification KYC obligatoire
              </p>
            </div>
            <p className="text-xs text-red-900 dark:text-red-100">
              Les transferts doivent être effectués depuis le backend avec votre clé privée.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">📝 Endpoint: POST /api/transfers</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{`// Effectuer un transfert (Backend uniquement)
const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY;

const response = await fetch('https://bkapay.com/api/transfers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\`
  },
  body: JSON.stringify({
    amount: 50000,                // Montant en XOF
    country: 'SN',                // Code pays (SN, CI, BF, BJ, TG, ML)
    operator: 'orange',           // Opérateur mobile money
    phone: '+221781234567',       // Numéro du bénéficiaire
    description: 'Paiement commande #123' // Description (optionnel)
  })
});

const data = await response.json();

// Réponse en cas de succès:
{
  "success": true,
  "message": "Transfert effectué avec succès",
  "transactionId": "xyz789",
  "amount": 50000,
  "fees": 3000,              // Frais appliqués
  "total": 53000             // Montant total débité
}

// Réponse en cas d'erreur:
{
  "success": false,
  "error": "Solde insuffisant"
}`}</pre>
            </div>
            <Button 
              onClick={() => copyCode(`const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY;

const response = await fetch('https://bkapay.com/api/transfers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\`
  },
  body: JSON.stringify({
    amount: 50000,
    country: 'SN',
    operator: 'orange',
    phone: '+221781234567',
    description: 'Paiement commande #123'
  })
});

const data = await response.json();`)} 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
              data-testid="button-copy-payout"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier
            </Button>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-yellow-900 dark:text-yellow-100">💰 Frais de transfert</h4>
            <ul className="text-xs text-yellow-900 dark:text-yellow-100 space-y-1">
              <li>• <strong>Bénin:</strong> 3% du montant transféré</li>
              <li>• <strong>Autres pays:</strong> 6% du montant transféré</li>
              <li>• Les frais sont automatiquement déduits de votre solde</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Supported Operators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Opérateurs Supportés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">🇸🇳 Sénégal (SN)</p>
              <p className="text-xs text-muted-foreground">
                orange, free, expresso, wave, wizall
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">🇨🇮 Côte d'Ivoire (CI)</p>
              <p className="text-xs text-muted-foreground">
                orange, mtn, moov, wave
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">🇧🇫 Burkina Faso (BF)</p>
              <p className="text-xs text-muted-foreground">
                orange, moov
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">🇧🇯 Bénin (BJ)</p>
              <p className="text-xs text-muted-foreground">
                moov, mtn
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">🇹🇬 Togo (TG)</p>
              <p className="text-xs text-muted-foreground">
                tmoney, moov
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">🇲🇱 Mali (ML)</p>
              <p className="text-xs text-muted-foreground">
                orange, moov
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Handling */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Gestion des Erreurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'API retourne des codes HTTP standards et des messages d'erreur en JSON.
          </p>

          <div>
            <h4 className="font-semibold mb-2">Codes d'erreur courants:</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• <code className="bg-muted px-2 py-1 rounded">400</code> - Paramètres invalides</li>
              <li>• <code className="bg-muted px-2 py-1 rounded">401</code> - Clé API invalide ou manquante</li>
              <li>• <code className="bg-muted px-2 py-1 rounded">402</code> - Solde insuffisant</li>
              <li>• <code className="bg-muted px-2 py-1 rounded">403</code> - KYC non vérifié</li>
              <li>• <code className="bg-muted px-2 py-1 rounded">404</code> - Ressource non trouvée</li>
              <li>• <code className="bg-muted px-2 py-1 rounded">429</code> - Trop de requêtes (rate limit)</li>
              <li>• <code className="bg-muted px-2 py-1 rounded">500</code> - Erreur serveur</li>
            </ul>
          </div>

          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
            <pre>{`// Gestion robuste des erreurs
async function safeApiCall(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(\`Erreur \${response.status}: \${data.error}\`);
      
      // Gérer selon le code d'erreur
      if (response.status === 401) {
        console.error('Clé API invalide');
      } else if (response.status === 402) {
        console.error('Solde insuffisant');
      } else if (response.status === 429) {
        console.error('Rate limit - Réessayer plus tard');
      }
      
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erreur réseau:', error);
    return null;
  }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Bonnes Pratiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 dark:text-green-100">✅ À faire</h4>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li>• Utiliser les clés publiques au frontend pour les paiements entrants</li>
                <li>• Stocker les clés privées dans les variables d'environnement</li>
                <li>• Valider tous les montants côté serveur</li>
                <li>• Implémenter le callback URL pour les paiements</li>
                <li>• Vérifier le statut des transactions après paiement</li>
                <li>• Gérer les erreurs et retry les requêtes échouées</li>
              </ul>
            </div>

            <div className="border-l-4 border-red-500 pl-4">
              <h4 className="font-semibold text-red-900 dark:text-red-100">❌ À éviter</h4>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li>• Exposer les clés privées au frontend</li>
                <li>• Logger les clés API dans les logs</li>
                <li>• Stocker les clés en clair dans le code</li>
                <li>• Faire des transferts sans vérifier le solde</li>
                <li>• Oublier de valider les paramètres</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">🔒 Sécurité</h4>
            <ul className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
              <li>• Toutes les requêtes utilisent HTTPS/SSL</li>
              <li>• Les clés API peuvent être régénérées à tout moment</li>
              <li>• Rate limiting: 10 requêtes/seconde par clé</li>
              <li>• Vérification KYC obligatoire pour les transferts</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle>Besoin d'aide?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Notre équipe est là pour vous aider à intégrer BKApay dans votre application.
          </p>
          <div className="space-y-2">
            <p className="text-xs">
              <span className="font-semibold">Email:</span> support@bkapay.com
            </p>
            <p className="text-xs">
              <span className="font-semibold">Documentation:</span> Dashboard → Documentation
            </p>
            <p className="text-xs">
              <span className="font-semibold">Support:</span> Dashboard → Support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
