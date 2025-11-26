import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Documentation() {
  const { toast } = useToast();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bkapay.com";

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
  <button>Payer 5 000 XOF</button>
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
    <div className="space-y-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-doc-title">
          Documentation API BKApay
        </h1>
        <p className="text-sm text-muted-foreground">
          Integrez facilement les paiements mobile money dans votre application
        </p>
      </div>

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
              <div className="flex gap-2">
                <Badge variant="outline">amount</Badge>
                <span className="text-muted-foreground">Montant en XOF (minimum 100)</span>
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
              <span className="text-muted-foreground">Montant paye en XOF</span>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Pays et operateurs supportes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Senegal (SN)</p>
              <p className="text-xs text-muted-foreground">
                Orange, Free, Expresso, Wave, Wizall
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Cote d'Ivoire (CI)</p>
              <p className="text-xs text-muted-foreground">
                Orange, MTN, Moov, Wave
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Burkina Faso (BF)</p>
              <p className="text-xs text-muted-foreground">
                Orange, Moov
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Benin (BJ)</p>
              <p className="text-xs text-muted-foreground">
                Moov, MTN
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Togo (TG)</p>
              <p className="text-xs text-muted-foreground">
                T-Money, Moov
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-background">
              <p className="font-bold text-sm mb-2">Mali (ML)</p>
              <p className="text-xs text-muted-foreground">
                Orange, Moov
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
