import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Documentation() {
  const { toast } = useToast();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copié",
      description: "Le code a été copié dans le presse-papiers",
    });
  };

  const incomingCode = `// 1. Récupérez votre clé API publique depuis votre dashboard KEJAtransfer
// Section "API Gateway" -> Copiez "Clé publique"

// 2. Sur votre site, intégrez le bouton de paiement
async function handlePayment() {
  const amount = document.getElementById('amount').value;
  const customerName = document.getElementById('name').value;
  const customerEmail = document.getElementById('email').value;
  const customerPhone = document.getElementById('phone').value;
  const country = document.getElementById('country').value;
  const operator = document.getElementById('operator').value;

  try {
    // 3. Appelez l'endpoint de paiement
    const response = await fetch('https://keja.app/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: 'pk_live_YOUR_PUBLIC_KEY',
        amount: parseInt(amount),
        description: 'Achat sur votre site',
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        country: country,
        operator: operator
      })
    });

    const data = await response.json();
    
    // 4. Redirigez le client vers KEJAtransfer pour payer
    if (data.success) {
      window.location.href = data.redirectUrl;
    } else {
      alert('Erreur: ' + data.error);
    }
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
}`;

  const outgoingIntegrationCode = `// Intégrez un bouton "Retrait" sur votre site pour vos clients

// 1. Formulaire HTML simple
<form id="withdrawalForm">
  <input type="number" id="amount" placeholder="Montant (XOF)" min="500" required />
  <select id="country" required>
    <option value="">Sélectionnez un pays</option>
    <option value="SN">Sénégal</option>
    <option value="CI">Côte d'Ivoire</option>
    <option value="BF">Burkina Faso</option>
    <option value="BJ">Bénin</option>
    <option value="TG">Togo</option>
    <option value="ML">Mali</option>
  </select>
  <select id="operator" required>
    <option value="">Sélectionnez un opérateur</option>
    <option value="orange">Orange Money</option>
    <option value="wave">Wave</option>
    <option value="moov">Moov</option>
    <option value="mtn">MTN</option>
  </select>
  <input type="tel" id="phone" placeholder="Numéro de téléphone" required />
  <button type="submit">Demander un retrait</button>
</form>

// 2. Code JavaScript pour envoyer la demande
document.getElementById('withdrawalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const response = await fetch('https://keja.app/api/withdrawals/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      privateKey: 'sk_live_YOUR_PRIVATE_KEY', // ← Clé privée (SÉCURISÉE, côté serveur!)
      amount: parseInt(document.getElementById('amount').value),
      country: document.getElementById('country').value,
      operator: document.getElementById('operator').value,
      phone: document.getElementById('phone').value
    })
  });

  const data = await response.json();
  if (data.success) {
    alert('Retrait demandé avec succès!');
  } else {
    alert('Erreur: ' + data.error);
  }
});`;

  const outgoingCode = `// Sur votre dashboard KEJAtransfer, allez à "Transferts"

// 1. Entrez le montant à retirer (en XOF)
amount = 50000; // 50 000 francs CFA

// 2. Sélectionnez le pays et l'opérateur
country = 'SN';      // Code du pays
operator = 'orange'; // Code de l'opérateur

// 3. Entrez le numéro de téléphone du bénéficiaire
phone = '+221781234567'; // Format international

// 4. Cliquez sur "Confirmer"
// L'argent est débité de votre solde et envoyé au client`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Documentation API KEJAtransfer</h1>
        <p className="text-muted-foreground">Guide complet pour intégrer les paiements et retraits sur votre site</p>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold mb-1">⚠️ KEJAtransfer - Votre Fournisseur de Paiements</p>
            <p>KEJAtransfer est votre plateforme complète de paiement et retrait. Les clients payent directement sur KEJAtransfer, et vous gérez les retraits depuis votre dashboard.</p>
          </div>
        </div>
      </div>

      {/* Incoming Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">💰 Paiements Entrants - Collecte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Les clients payent directement sur <span className="font-bold">KEJAtransfer</span>. L'argent arrive immédiatement sur votre dashboard.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Flux de Paiement</h3>
            <ol className="space-y-2 list-decimal list-inside text-sm text-muted-foreground">
              <li>Votre client remplir le formulaire de paiement sur votre site</li>
              <li>Vous appelez l'API avec votre clé publique</li>
              <li>Le client est redirigé vers <span className="font-bold">KEJAtransfer</span> pour payer</li>
              <li>Le client choisit son opérateur mobile money (Orange, Wave, Moov, etc.)</li>
              <li>L'argent arrive immédiatement sur votre dashboard KEJAtransfer</li>
              <li>Vous pouvez alors faire des retraits vers vos clients</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Code d'Intégration</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{incomingCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(incomingCode)}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-copy-incoming"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Format du Numéro de Téléphone</h3>
            <p className="text-sm text-muted-foreground mb-2">Format international complet avec code pays:</p>
            <div className="bg-muted p-3 rounded-md space-y-1 font-mono text-xs">
              <p>🇸🇳 Sénégal: <span className="text-primary">+221781234567</span></p>
              <p>🇨🇮 Côte d'Ivoire: <span className="text-primary">+2250709876543</span></p>
              <p>🇧🇫 Burkina Faso: <span className="text-primary">+22650123456</span></p>
              <p>🇧🇯 Bénin: <span className="text-primary">+22967891234</span></p>
              <p>🇹🇬 Togo: <span className="text-primary">+22890123456</span></p>
              <p>🇲🇱 Mali: <span className="text-primary">+22365123456</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Opérateurs Supportés par Pays</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Sénégal</p>
                <p className="text-xs text-muted-foreground">Orange, Free, Expresso, Wave, Wizall</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Côte d'Ivoire</p>
                <p className="text-xs text-muted-foreground">Orange, MTN, Moov, Wave</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Burkina Faso</p>
                <p className="text-xs text-muted-foreground">Orange, Moov</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Bénin</p>
                <p className="text-xs text-muted-foreground">Moov, MTN</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Togo</p>
                <p className="text-xs text-muted-foreground">T-Money, Moov</p>
              </div>
              <div className="border-l-4 border-primary pl-3">
                <p className="font-bold text-sm">Mali</p>
                <p className="text-xs text-muted-foreground">Orange, Moov</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Réponse API</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`{
  "success": true,
  "redirectUrl": "https://keja.app/payment/xyz..." 
}

// Redirigez le client vers redirectUrl
// Il paiera sur KEJAtransfer`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing Payments - Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">🔄 Paiements Sortants - Retraits depuis votre Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100">
              <span className="font-bold">Depuis votre dashboard KEJAtransfer</span>, vous pouvez faire des retraits vers vos clients ou partenaires via mobile money.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Comment ça Marche</h3>
            <ol className="space-y-2 list-decimal list-inside text-sm text-muted-foreground">
              <li>Allez à la section <span className="font-bold">"Transferts"</span> sur votre dashboard</li>
              <li>Entrez le montant à retirer (en XOF - francs CFA)</li>
              <li>Sélectionnez le pays et l'opérateur mobile money</li>
              <li>Entrez le numéro de téléphone du bénéficiaire</li>
              <li>Confirmez le retrait</li>
              <li>L'argent est débité de votre solde et envoyé au bénéficiaire</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Interface Dashboard</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{outgoingCode}</pre>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Format du Numéro</h3>
            <div className="bg-muted p-3 rounded-md text-sm space-y-2">
              <p><span className="font-bold">Format recommandé:</span> <span className="font-mono text-primary">+221781234567</span> (international complet)</p>
              <p><span className="font-bold">Ou juste:</span> <span className="font-mono text-primary">781234567</span> (local)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing Payments - API Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">🔗 Paiements Sortants - Intégration sur Votre Site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-sm text-purple-900 dark:text-purple-100">
              Intégrez un bouton <span className="font-bold">"Retrait"</span> sur votre site pour que vos clients demandent des paiements. Les retraits sont collectés sur votre dashboard KEJAtransfer.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Flux Complet</h3>
            <ol className="space-y-2 list-decimal list-inside text-sm text-muted-foreground">
              <li>Votre client clique le bouton "Retrait" sur votre site</li>
              <li>Il remplit: montant, pays, opérateur, numéro de téléphone</li>
              <li>Vous appelez l'API de retrait avec votre clé privée</li>
              <li>KEJAtransfer valide et crée une demande de retrait</li>
              <li>La demande apparaît dans votre dashboard "Transferts"</li>
              <li>Vous confirmez et l'argent est envoyé au client</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Code d'Intégration</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{outgoingIntegrationCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(outgoingIntegrationCode)}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-copy-withdrawal"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-900 dark:text-red-100">
                <p className="font-semibold mb-1">🔒 Sécurité Importante</p>
                <p>Votre <span className="font-mono">privateKey (sk_live_...)</span> doit rester SECRÈTE! Appelez l'API de retrait depuis votre serveur backend, jamais depuis le navigateur du client.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Exemple Sécurisé (Backend Node.js)</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`// Sur VOTRE serveur backend (Node.js / Express)
app.post('/api/request-withdrawal', async (req, res) => {
  const { amount, country, operator, phone } = req.body;
  
  // Appelez KEJAtransfer depuis votre serveur
  const response = await fetch('https://keja.app/api/withdrawals/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      privateKey: process.env.KEJA_PRIVATE_KEY, // ← Clé privée en variable d'env
      amount: amount,
      country: country,
      operator: operator,
      phone: phone
    })
  });

  const data = await response.json();
  res.json(data);
});

// Sur votre site frontend
document.getElementById('withdrawalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Appelez VOTRE serveur backend
  const response = await fetch('/api/request-withdrawal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: document.getElementById('amount').value,
      country: document.getElementById('country').value,
      operator: document.getElementById('operator').value,
      phone: document.getElementById('phone').value
    })
  });

  const data = await response.json();
  alert(data.success ? 'Retrait demandé!' : 'Erreur: ' + data.error);
});`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle>📊 Résumé Complet du Système</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3 border-b pb-4">
            <p className="font-bold text-foreground">1️⃣ Votre Plateforme (vos clients qui intègrent vos API)</p>
            <div className="ml-4 space-y-2 text-muted-foreground">
              <p>✓ Vos clients intègrent votre clé publique sur leur site</p>
              <p>✓ Leurs clients paient directement sur KEJAtransfer</p>
              <p>✓ L'argent arrive sur VOTRE dashboard KEJAtransfer</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-bold text-foreground">2️⃣ Vos Retraits</p>
            <div className="ml-4 space-y-2 text-muted-foreground">
              <p>✓ Depuis votre dashboard, vous pouvez faire des retraits</p>
              <p>✓ Ou intégrer un bouton retrait sur VOTRE site</p>
              <p>✓ Les demandes de retrait arrivent sur votre dashboard</p>
              <p>✓ Vous confirmez et l'argent est envoyé aux bénéficiaires</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
