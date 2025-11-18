import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Code, Link as LinkIcon, Store } from "lucide-react";

export default function Documentation() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Documentation</h1>
        <p className="text-muted-foreground">Guides et tutoriels pour utiliser KEJAtransfer</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Liens de paiement</CardTitle>
            </div>
            <CardDescription>
              Créez et partagez des liens de paiement personnalisés pour vos produits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les liens de paiement vous permettent de créer des URL uniques avec un montant fixe.
              Partagez-les avec vos clients par email, SMS ou réseaux sociaux.
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Liens marchands</CardTitle>
            </div>
            <CardDescription>
              Un lien unique où vos clients choisissent le montant à payer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Parfait pour les donations, pourboires, ou paiements flexibles. Vos clients entrent
              le montant qu'ils souhaitent payer.
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Code className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>API Gateway</CardTitle>
            </div>
            <CardDescription>
              Intégrez les paiements directement dans votre application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Utilisez nos clés API pour intégrer KEJAtransfer dans votre site web ou application.
              Documentation complète disponible dans la section API.
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Guides pratiques</CardTitle>
            </div>
            <CardDescription>
              Tutoriels pas à pas pour démarrer rapidement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Consultez nos guides détaillés pour configurer votre compte, créer votre premier
              lien de paiement et plus encore.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
