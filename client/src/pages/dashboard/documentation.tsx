import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy } from "lucide-react";
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

  const incomingCode = `// 1. Obtenir votre clé API publique depuis KEJAtransfer
// Allez dans la section "API Gateway" et copiez votre "Clé publique"

// 2. Sur votre site web, créez un formulaire pour récupérer les infos du client
const collectPaymentInfo = async () => {
  const amount = document.getElementById('amount').value;
  const customerName = document.getElementById('name').value;
  const customerEmail = document.getElementById('email').value;
  const customerPhone = document.getElementById('phone').value; // Format: +221781234567
  const country = document.getElementById('country').value; // SN, CI, BF, BJ, TG, ML
  const operator = document.getElementById('operator').value; // orange, wave, moov, etc

  // 3. Appelez l'endpoint de paiement avec votre clé publique
  try {
    const response = await fetch('https://keja.app/api/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publicKey: 'pk_live_YOUR_PUBLIC_KEY', // ← Votre clé publique
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
    
    if (data.success) {
      // 4. Redirigez le client vers la page de paiement Paydunya
      window.location.href = data.redirectUrl;
    } else {
      alert('Erreur: ' + data.error);
    }
  } catch (error) {
    alert('Erreur de connexion: ' + error.message);
  }
};`;

  const outgoingCode = `// Les paiements sortants se font depuis votre dashboard KEJAtransfer
// Accédez à la section "Transferts" et:

// 1. Entrez le montant à transférer (en francs CFA - XOF)
const amount = 50000; // 50 000 XOF

// 2. Sélectionnez le pays et l'opérateur mobile money
const country = 'SN';      // BJ, TG, CI, SN, BF, ML
const operator = 'orange'; // orange, wave, moov, free, mtn, etc

// 3. Entrez le numéro de téléphone du bénéficiaire
// Format: Numéro international complet
const phone = '+221781234567'; // Exemple: Sénégal (Orange Money)

// 4. Cliquez sur "Confirmer le transfert"
// L'argent sera débité de votre solde et envoyé au numéro via mobile money`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Documentation API</h1>
        <p className="text-muted-foreground">Guide complet pour intégrer KEJAtransfer sur votre site</p>
      </div>

      {/* Incoming Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Paiements Entrants - Intégration Complète</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Les paiements entrants permettent à vos clients de payer directement depuis votre site. L'argent va immédiatement sur votre dashboard KEJAtransfer.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Fonctionnement</h3>
            <ol className="space-y-3 list-decimal list-inside text-sm text-muted-foreground">
              <li>Votre client remplir le formulaire de paiement sur votre site</li>
              <li>Vous appelez l'endpoint `/api/payments/create` avec votre clé API publique</li>
              <li>KEJAtransfer crée une invoice Paydunya et retourne une URL de redirection</li>
              <li>Le client est redirigé vers la page de paiement Paydunya</li>
              <li>Le client paye via son mobile money (Orange Money, Wave, Moov, etc.)</li>
              <li>Paydunya confirme le paiement et l'argent arrive sur votre dashboard</li>
              <li>Vous pouvez ensuite faire des retraits vers vos clients</li>
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
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Le numéro de téléphone doit être au format international complet:
              </p>
              <div className="bg-muted p-3 rounded-md space-y-2 font-mono text-xs">
                <p>Sénégal: <span className="text-primary">+221781234567</span></p>
                <p>Côte d'Ivoire: <span className="text-primary">+2250709876543</span></p>
                <p>Burkina Faso: <span className="text-primary">+22650123456</span></p>
                <p>Bénin: <span className="text-primary">+22967891234</span></p>
                <p>Togo: <span className="text-primary">+22890123456</span></p>
                <p>Mali: <span className="text-primary">+22365123456</span></p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Codes Pays et Opérateurs</h3>
            <div className="space-y-4">
              <div>
                <p className="font-mono text-sm text-primary">SN - Sénégal</p>
                <p className="text-sm text-muted-foreground">Opérateurs: orange, free, expresso, wave, wizall</p>
              </div>
              <div>
                <p className="font-mono text-sm text-primary">CI - Côte d'Ivoire</p>
                <p className="text-sm text-muted-foreground">Opérateurs: orange, mtn, moov, wave</p>
              </div>
              <div>
                <p className="font-mono text-sm text-primary">BF - Burkina Faso</p>
                <p className="text-sm text-muted-foreground">Opérateurs: orange, moov</p>
              </div>
              <div>
                <p className="font-mono text-sm text-primary">BJ - Bénin</p>
                <p className="text-sm text-muted-foreground">Opérateurs: moov, mtn</p>
              </div>
              <div>
                <p className="font-mono text-sm text-primary">TG - Togo</p>
                <p className="text-sm text-muted-foreground">Opérateurs: tmoney, moov</p>
              </div>
              <div>
                <p className="font-mono text-sm text-primary">ML - Mali</p>
                <p className="text-sm text-muted-foreground">Opérateurs: orange, moov</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Réponse de l'API</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`{
  "success": true,
  "redirectUrl": "https://app.paydunya.com/checkout/..." 
}

// redirectUrl est l'URL vers laquelle rediriger le client`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Paiements Sortants - Transferts et Retraits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-900 dark:text-green-100">
                Les paiements sortants permettent de transférer l'argent collecté sur votre dashboard vers vos clients via mobile money.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Fonctionnement</h3>
            <ol className="space-y-3 list-decimal list-inside text-sm text-muted-foreground">
              <li>Vous allez à la section "Transferts" sur votre dashboard</li>
              <li>Vous entrez le montant à transférer (en XOF - francs CFA)</li>
              <li>Vous sélectionnez le pays et l'opérateur mobile money</li>
              <li>Vous entrez le numéro de téléphone du bénéficiaire</li>
              <li>Vous confirmez le transfert</li>
              <li>L'argent est débité de votre solde et envoyé au bénéficiaire</li>
              <li>Le statut de la transaction s'affiche dans votre historique</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Code d'Intégration (Référence)</h3>
            <div className="bg-gray-950 dark:bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{outgoingCode}</pre>
            </div>
            <Button
              onClick={() => copyCode(outgoingCode)}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-copy-outgoing"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Format du Numéro de Téléphone</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Pour les transferts, le numéro doit être au format international complet:
              </p>
              <div className="bg-muted p-3 rounded-md space-y-2 font-mono text-xs">
                <p><span className="font-bold">Complet:</span> +221781234567 (Avec le code pays)</p>
                <p><span className="font-bold">Sénégal (221):</span> +221781234567 ou 781234567</p>
                <p><span className="font-bold">Côte d'Ivoire (225):</span> +2250709876543 ou 0709876543</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Exigences Pour Chaque Pays</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <p className="font-bold text-sm">Sénégal (SN)</p>
                <p className="text-sm text-muted-foreground">Opérateurs: Orange Money, Free Money, Expresso, Wave, Wizall</p>
                <p className="text-sm text-muted-foreground">Numéro: Commence par +221</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <p className="font-bold text-sm">Côte d'Ivoire (CI)</p>
                <p className="text-sm text-muted-foreground">Opérateurs: Orange Money, MTN, Moov, Wave</p>
                <p className="text-sm text-muted-foreground">Numéro: Commence par +225</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <p className="font-bold text-sm">Burkina Faso (BF)</p>
                <p className="text-sm text-muted-foreground">Opérateurs: Orange Money, Moov</p>
                <p className="text-sm text-muted-foreground">Numéro: Commence par +226</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <p className="font-bold text-sm">Bénin (BJ)</p>
                <p className="text-sm text-muted-foreground">Opérateurs: Moov, MTN</p>
                <p className="text-sm text-muted-foreground">Numéro: Commence par +229</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <p className="font-bold text-sm">Togo (TG)</p>
                <p className="text-sm text-muted-foreground">Opérateurs: T-Money, Moov</p>
                <p className="text-sm text-muted-foreground">Numéro: Commence par +228</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <p className="font-bold text-sm">Mali (ML)</p>
                <p className="text-sm text-muted-foreground">Opérateurs: Orange Money, Moov</p>
                <p className="text-sm text-muted-foreground">Numéro: Commence par +223</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Limitations et Conditions</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Le montant minimum est de 500 XOF</li>
              <li>Vous ne pouvez pas transférer plus que votre solde disponible</li>
              <li>Les transferts prennent quelques minutes à être traités</li>
              <li>Vérifiez toujours le numéro et l'opérateur avant de confirmer</li>
              <li>En cas d'erreur, contactez le support de votre opérateur mobile money</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle>Résumé du Flux Complet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-semibold text-foreground">1️⃣ Intégration de votre site</p>
            <p className="text-muted-foreground">
              Intégrez le code d'intégration avec votre clé publique (pk_live_...) sur votre site web
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">2️⃣ Client paie sur votre site</p>
            <p className="text-muted-foreground">
              Les clients remplissent le formulaire et sont redirigés vers Paydunya
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">3️⃣ Argent arrive sur votre dashboard</p>
            <p className="text-muted-foreground">
              Après le paiement, l'argent augmente votre solde disponible immédiatement
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">4️⃣ Vous retirez vers vos clients</p>
            <p className="text-muted-foreground">
              Depuis la section Transferts, vous envoyez l'argent à vos bénéficiaires via mobile money
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
