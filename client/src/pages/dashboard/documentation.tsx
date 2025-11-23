import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy, Shield, Code } from "lucide-react";
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

  const frontendCode = `// 🔑 FRONTEND - Utilisez la CLÉ PUBLIQUE
// Cette clé peut être exposée au navigateur - c'est normal!

async function handlePayment() {
  const publicKey = 'pk_live_YOUR_PUBLIC_KEY'; // Visible au frontend
  
  try {
    const response = await fetch('https://bkapay.app/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: publicKey,  // ✅ Clé publique
        amount: 50000,
        description: 'Achat de produit',
        customerName: 'Jean Dupont',
        customerEmail: 'jean@example.com',
        customerPhone: '+221781234567',
        country: 'SN',
        operator: 'orange'
      })
    });

    const data = await response.json();
    if (data.success) {
      // Rediriger vers le paiement
      window.location.href = data.data.redirectUrl;
    } else {
      console.error('Erreur:', data.error);
    }
  } catch (error) {
    console.error('Erreur réseau:', error.message);
  }
}`;

  const backendCode = `// 🔒 BACKEND - Utilisez la CLÉ PRIVÉE UNIQUEMENT
// Cette clé doit rester secrète! En variable d'environnement.

const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY; // sk_live_xxxxx

// Exemple 1: Récupérer les transactions
app.get('/api/check-transactions', async (req, res) => {
  try {
    const response = await fetch('https://bkapay.app/api/transactions', {
      headers: {
        'Authorization': \`Bearer \${BKAPAY_SECRET_KEY}\` // 🔒 Clé privée
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exemple 2: Vérifier la signature du webhook (sécurité)
import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}

app.post('/webhook/bkapay', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  if (!verifyWebhookSignature(req.body, signature, BKAPAY_SECRET_KEY)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Webhook vérifié, traiter en confiance
  console.log('Paiement reçu:', req.body);
  res.json({ success: true });
});`;

  const alternativeAuthCode = `// Alternative: Utiliser Authorization header avec clé publique
fetch('https://bkapay.app/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_YOUR_PUBLIC_KEY' // ✅ Bearer token
  },
  body: JSON.stringify({
    amount: 50000,
    description: 'Mon paiement',
    customerName: 'Jean',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange'
  })
})`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Documentation API BKApay</h1>
        <p className="text-muted-foreground">Guide complet pour intégrer les paiements dans votre application</p>
      </div>

      {/* Authentication Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Authentification API - 3 Méthodes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Public Key */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Public</Badge>
                <span className="font-semibold text-sm">Clé Publique</span>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-primary">pk_live_xxxxx</span>
              </p>
              <div className="text-sm space-y-2">
                <p className="font-semibold">Où l'utiliser:</p>
                <p className="text-muted-foreground">Frontend / JavaScript côté client</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold">Pour:</p>
                <p className="text-muted-foreground">Créer des paiements</p>
              </div>
              <p className="text-xs bg-blue-50 dark:bg-blue-950 p-2 rounded text-blue-900 dark:text-blue-100">
                ✅ Peut être exposée au navigateur
              </p>
            </div>

            {/* Private Key */}
            <div className="border rounded-lg p-4 space-y-3 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Secret</Badge>
                <span className="font-semibold text-sm">Clé Privée</span>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-red-600 dark:text-red-400">sk_live_xxxxx</span>
              </p>
              <div className="text-sm space-y-2">
                <p className="font-semibold">Où l'utiliser:</p>
                <p className="text-muted-foreground">Backend UNIQUEMENT</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold">Pour:</p>
                <p className="text-muted-foreground">Opérations sensibles</p>
              </div>
              <p className="text-xs bg-red-200 dark:bg-red-900 p-2 rounded text-red-900 dark:text-red-100">
                🔒 Jamais au frontend!
              </p>
            </div>

            {/* Session */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Session</Badge>
                <span className="font-semibold text-sm">Authentification</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cookies de session
              </p>
              <div className="text-sm space-y-2">
                <p className="font-semibold">Où l'utiliser:</p>
                <p className="text-muted-foreground">Dashboard Web</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold">Pour:</p>
                <p className="text-muted-foreground">Authentification utilisateur</p>
              </div>
              <p className="text-xs bg-green-50 dark:bg-green-950 p-2 rounded text-green-900 dark:text-green-100">
                ✅ Automatique après login
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frontend Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Code className="w-6 h-6 text-primary" />
            Intégration Frontend (Clé Publique)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-bold">✅ Sûr d'exposer votre clé publique</span> au frontend. C'est son objectif!
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Code d'Intégration</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{frontendCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(frontendCode)}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-copy-frontend"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Opérateurs Supportés par Pays</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Sénégal (SN)</p>
                <p className="text-xs text-muted-foreground">orange, free, expresso, wave, wizall</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Côte d'Ivoire (CI)</p>
                <p className="text-xs text-muted-foreground">orange, mtn, moov, wave</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Burkina Faso (BF)</p>
                <p className="text-xs text-muted-foreground">orange, moov</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Bénin (BJ)</p>
                <p className="text-xs text-muted-foreground">moov, mtn</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Togo (TG)</p>
                <p className="text-xs text-muted-foreground">tmoney, moov</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Mali (ML)</p>
                <p className="text-xs text-muted-foreground">orange, moov</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backend Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-600" />
            Intégration Backend (Clé Privée)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-900 dark:text-red-100">
                <p className="font-semibold mb-1">🔒 Clé Privée - Sécurité Critique</p>
                <p className="mb-2">Votre clé privée doit rester SECRÈTE! Stockez-la UNIQUEMENT en variable d'environnement sur votre serveur.</p>
                <p className="font-mono text-xs">Ne la commitez JAMAIS dans Git, ne l'exposez jamais au frontend!</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Code d'Intégration Backend</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{backendCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(backendCode)}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-copy-backend"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Configuration Environnement</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`# .env (fichier local, ne pas commiter!)
BKAPAY_SECRET_KEY=sk_live_YOUR_PRIVATE_KEY

# .env.example (pour Git - version publique)
BKAPAY_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Alternative: Header Bearer Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Au lieu de passer la clé dans le body JSON, vous pouvez utiliser le header <span className="font-mono">Authorization: Bearer</span>
          </p>
          <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
            <pre>{alternativeAuthCode}</pre>
          </div>
          <Button
            onClick={() => copyCode(alternativeAuthCode)}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="button-copy-bearer"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier le code
          </Button>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="text-2xl">✅ Bonnes Pratiques de Sécurité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="font-bold text-green-900 dark:text-green-100 mb-2">À FAIRE:</p>
              <ul className="space-y-1 text-sm text-green-900 dark:text-green-100">
                <li>✅ Stocker clés privées en variables d'environnement</li>
                <li>✅ Créer une clé par environnement (dev, staging, prod)</li>
                <li>✅ Utiliser clé publique UNIQUEMENT au frontend</li>
                <li>✅ Vérifier les signatures des webhooks</li>
                <li>✅ Faire appels API depuis votre backend</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-red-700 dark:text-red-300 mb-2">À NE PAS FAIRE:</p>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                <li>❌ Commiter clés dans Git</li>
                <li>❌ Exposer clés privées au frontend</li>
                <li>❌ Partager clés entre développeurs</li>
                <li>❌ Utiliser même clé pour tous environnements</li>
                <li>❌ Logger ou afficher les clés</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Ressources Supplémentaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pour plus d'informations, consultez notre documentation complète:
          </p>
          <div className="space-y-2">
            <a href="https://docs.bkapay.app" target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline text-sm">
              📖 Documentation Complète → docs.bkapay.app
            </a>
            <a href="https://docs.bkapay.app/quick-start" target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline text-sm">
              ⚡ Quick Start Guide → docs.bkapay.app/quick-start
            </a>
            <a href="https://docs.bkapay.app/sdk" target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline text-sm">
              🔗 SDK Examples → docs.bkapay.app/sdk
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
