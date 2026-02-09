import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, ExternalLink, AlertTriangle, ArrowRight, Clock, Webhook, Layers, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { useState } from "react";
import { 
  DOC_VERSIONS, 
  CURRENT_VERSION, 
  getDocVersion, 
  getLatestVersion,
  isValidVersion,
  type DocVersion 
} from "@/lib/doc-versions";

type IntegrationType = "redirect" | "inline";

interface DocumentationVersionProps {
  version: string;
}

function DeprecatedBanner({ version, latestVersion }: { version: DocVersion; latestVersion: DocVersion }) {
  const [, setLocation] = useLocation();
  
  return (
    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400">Version obsolete</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          Cette version de la documentation ({version.version}) est obsolete depuis le {version.releaseDate}.
          Veuillez utiliser la derniere version pour beneficier des dernieres fonctionnalites.
        </p>
        <Button 
          onClick={() => setLocation(`/documentation/${latestVersion.version}`)}
          size="sm"
          className="gap-2"
          data-testid="button-go-latest"
        >
          Voir la version {latestVersion.version}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function VersionNotFound({ requestedVersion }: { requestedVersion: string }) {
  const [, setLocation] = useLocation();
  const latestVersion = getLatestVersion();
  
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Version introuvable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            La version <span className="font-mono font-bold text-foreground">{requestedVersion}</span> de la documentation n'existe pas ou n'est plus disponible.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3">Versions disponibles:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {DOC_VERSIONS.filter(v => !v.isDeprecated).map(v => (
                <Badge 
                  key={v.version}
                  variant={v.isLatest ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/documentation/${v.version}`)}
                  data-testid={`badge-version-${v.version}`}
                >
                  {v.version}
                  {v.isLatest && " (Actuelle)"}
                </Badge>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={() => setLocation(`/documentation/${latestVersion.version}`)}
            size="lg"
            className="gap-2"
            data-testid="button-go-latest-from-404"
          >
            Voir la documentation actuelle ({latestVersion.version})
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function VersionSelector({ currentVersion }: { currentVersion: string }) {
  const [, setLocation] = useLocation();
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Version:</span>
      {DOC_VERSIONS.map(v => (
        <Badge 
          key={v.version}
          variant={v.version === currentVersion ? "default" : "outline"}
          className={`cursor-pointer ${v.isDeprecated ? "opacity-60" : ""}`}
          onClick={() => setLocation(`/documentation/${v.version}`)}
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

function Changelog({ version }: { version: DocVersion }) {
  if (!version.changelog || version.changelog.length === 0) return null;
  
  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="w-5 h-5" />
          Nouveautes de la version {version.version}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {version.changelog.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1">•</span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4">
          Publiee le {version.releaseDate}
        </p>
      </CardContent>
    </Card>
  );
}

function IntegrationTypeSelector({ selected, onChange }: { selected: IntegrationType; onChange: (type: IntegrationType) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-muted-foreground">Type d'integration :</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onChange("redirect")}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
            selected === "redirect"
              ? "border-primary bg-primary/5"
              : "border-border hover-elevate"
          }`}
          data-testid="btn-integration-redirect"
        >
          <ExternalLink className={`w-5 h-5 mt-0.5 shrink-0 ${selected === "redirect" ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className={`font-semibold text-sm ${selected === "redirect" ? "text-primary" : "text-foreground"}`}>
              Redirect Checkout / HPP
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Le client est redirige vers la page de paiement BKApay
            </p>
          </div>
        </button>
        <button
          onClick={() => onChange("inline")}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
            selected === "inline"
              ? "border-primary bg-primary/5"
              : "border-border hover-elevate"
          }`}
          data-testid="btn-integration-inline"
        >
          <Monitor className={`w-5 h-5 mt-0.5 shrink-0 ${selected === "inline" ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className={`font-semibold text-sm ${selected === "inline" ? "text-primary" : "text-foreground"}`}>
              Inline / Modal Checkout
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              La fenetre de paiement s'ouvre directement sur votre site
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function RedirectCheckoutDocs({ baseUrl, copyCode }: { baseUrl: string; copyCode: (code: string) => void }) {
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

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Comment ca marche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            L'API BKApay utilise un systeme de redirection simple. Vos clients sont rediriges vers
            une page de paiement securisee BKApay ou ils peuvent payer via mobile money.
          </p>
          
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">1.</span> Creez une cle API dans votre tableau de bord</p>
            <p><span className="font-semibold">2.</span> Redirigez vos clients vers l'URL de paiement BKApay</p>
            <p><span className="font-semibold">3.</span> Le client remplit ses informations et paie</p>
            <p><span className="font-semibold">4.</span> Le client est redirige vers votre site avec le statut du paiement</p>
          </div>
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
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono break-all text-primary">
              {redirectUrl}
            </code>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold">Parametres</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge variant="outline">amount</Badge>
                  <span className="text-muted-foreground">Montant minimum 200</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-primary/30">
                  Utilisez la devise affichee sur votre tableau de bord apres inscription (XOF, XAF ou CDF selon votre pays)
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">description</Badge>
                <span className="text-muted-foreground">Description du paiement (optionnel)</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">callback</Badge>
                <span className="text-muted-foreground">URL de retour apres paiement (optionnel)</span>
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
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>HTML</Badge>
              <span className="text-sm text-muted-foreground">Bouton de paiement simple</span>
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
              <span className="text-sm text-muted-foreground">Fonction de redirection</span>
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
              <span className="text-sm text-muted-foreground">Redirection serveur</span>
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
              <span className="text-sm text-muted-foreground">Redirection serveur</span>
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
          <CardTitle>Gestion du retour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apres le paiement, le client est redirige vers votre URL de callback avec les parametres suivants:
          </p>
          
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm font-mono">
              https://votresite.com/success?status=success&transactionId=xxx&amount=5000
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Badge variant="outline">status</Badge>
              <span className="text-muted-foreground">"success" ou "failed"</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">transactionId</Badge>
              <span className="text-muted-foreground">Identifiant unique de la transaction</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">amount</Badge>
              <span className="text-muted-foreground">Montant paye</span>
            </div>
          </div>

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
    </>
  );
}

function InlineCheckoutDocs({ baseUrl, copyCode }: { baseUrl: string; copyCode: (code: string) => void }) {
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
      console.log("Statut:", response.status);
      // Rediriger ou mettre a jour votre interface
    },
    onError: function(error) {
      console.log("Paiement echoue:", error.message);
    },
    onClose: function() {
      console.log("Fenetre de paiement fermee");
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
        // Mettre a jour votre state React
      },
      onError: (error) => {
        console.error("Erreur:", error.message);
      },
      onClose: () => {
        console.log("Modal ferme");
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
        }
      });
    }
  <\/script>
</body>
</html>`;

  const inlineMobileExample = `// React Native / Expo - Utilisation avec WebView
import { WebView } from "react-native-webview";
import { Modal, View } from "react-native";

function BKApayModal({ visible, onClose, amount, publicKey, onSuccess }) {
  const paymentUrl = "${baseUrl}/api-pay/" + publicKey 
    + "?amount=" + amount 
    + "&mode=inline";

  const handleMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === "bkapay_payment_success") {
      onSuccess(data);
      onClose();
    } else if (data.type === "bkapay_payment_error") {
      console.error("Erreur:", data.message);
    } else if (data.type === "bkapay_payment_close") {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
  },
  onError: function(error) {
    // error.message - Description de l'erreur
  },
  onClose: function() {
    // Appele quand l'utilisateur ferme la fenetre
  }
});`;

  return (
    <>
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
            <p><span className="font-semibold">5.</span> Votre callback <code className="bg-muted px-1 rounded font-mono text-xs">onSuccess</code> est appele automatiquement</p>
          </div>

          <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <Layers className="h-4 w-4" />
            <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
              Toutes les fonctionnalites sont identiques a la page de redirection : Mobile Money, cartes bancaires,
              crypto-monnaies, selection de pays/operateur, conversion de devises, et respect des pays/operateurs
              actives par l'administrateur.
            </AlertDescription>
          </Alert>
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
                  <span className="text-muted-foreground">Paiement reussi</span>
                </div>
                <p className="text-xs text-muted-foreground ml-2 pl-2 border-l-2 border-green-500/30">
                  Contient transactionId, amount et status
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">onError(error)</Badge>
                <span className="text-muted-foreground">Erreur de paiement</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">onClose()</Badge>
                <span className="text-muted-foreground">Fenetre fermee par l'utilisateur</span>
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
    </>
  );
}

export default function DocumentationVersion({ version }: DocumentationVersionProps) {
  const { toast } = useToast();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";
  const [integrationType, setIntegrationType] = useState<IntegrationType>("redirect");
  
  const docVersion = getDocVersion(version);
  const latestVersion = getLatestVersion();
  
  if (!docVersion) {
    return <VersionNotFound requestedVersion={version} />;
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copie",
      description: "Le code a ete copie dans le presse-papiers",
    });
  };

  const webhookExample = `// Webhook BKApay - Activation automatique d'abonnement
// Ce code recoit les notifications de paiement reussi

// Node.js / Express
const crypto = require('crypto');

app.post('/api/webhook/bkapay', express.json(), (req, res) => {
  const signature = req.headers['x-bkapay-signature'];
  const secret = process.env.BKAPAY_CALLBACK_SECRET;
  
  // Verifier la signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Signature invalide' });
  }
  
  const { event, transactionId, amount, status, customerEmail } = req.body;
  
  if (event === 'payment.completed' && status === 'completed') {
    // Activer l'abonnement de l'utilisateur
    activerAbonnement(customerEmail, transactionId);
    console.log('Abonnement active pour:', customerEmail);
  }
  
  res.json({ received: true });
});`;

  const webhookPhpExample = `<?php
// Webhook BKApay - PHP

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BKAPAY_SIGNATURE'] ?? '';
$secret = getenv('BKAPAY_CALLBACK_SECRET');

// Verifier la signature
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-doc-title">
            Documentation API BKApay
          </h1>
          <Badge variant="secondary" className="w-fit text-sm" data-testid="badge-current-version">
            {docVersion.version}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Integrez facilement les paiements mobile money dans votre application
        </p>
        <VersionSelector currentVersion={docVersion.version} />
      </div>

      {docVersion.isDeprecated && (
        <DeprecatedBanner version={docVersion} latestVersion={latestVersion} />
      )}
      
      {docVersion.isLatest && <Changelog version={docVersion} />}

      <Card>
        <CardContent className="pt-6">
          <IntegrationTypeSelector selected={integrationType} onChange={setIntegrationType} />
        </CardContent>
      </Card>

      {integrationType === "redirect" ? (
        <RedirectCheckoutDocs baseUrl={baseUrl} copyCode={copyCode} />
      ) : (
        <InlineCheckoutDocs baseUrl={baseUrl} copyCode={copyCode} />
      )}

      {docVersion.version === "v1.3" && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-green-600" />
              Webhooks - Activation automatique
              <Badge variant="default" className="text-xs">Nouveau v1.3</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configurez un webhook pour recevoir une notification automatique quand un paiement est complete.
              Ideal pour activer automatiquement les abonnements ou comptes utilisateurs.
              {integrationType === "inline" && (
                <span className="block mt-2 text-green-700 dark:text-green-300">
                  Les webhooks fonctionnent avec les deux types d'integration (Redirect et Inline).
                </span>
              )}
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
              <h4 className="font-semibold">Exemple d'URL de Webhook</h4>
              <p className="text-sm text-muted-foreground">
                Voici des exemples d'URLs que vous pouvez configurer dans l'interface "Cles API":
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <code className="block text-sm font-mono text-primary">
                  https://votresite.com/api/webhook/bkapay
                </code>
                <code className="block text-sm font-mono text-primary">
                  https://monapp.com/webhooks/paiement
                </code>
                <code className="block text-sm font-mono text-primary">
                  https://api.monservice.com/callbacks/bkapay
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                L'URL doit etre en HTTPS et accessible publiquement. BKApay enverra une requete POST a cette URL a chaque paiement.
              </p>
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
          Documentation API BKApay - Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour: {docVersion.releaseDate}
        </p>
      </div>
    </div>
  );
}
