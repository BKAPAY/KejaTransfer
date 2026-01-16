import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src={logoImage} alt="BKApay" className="h-8 w-auto" />
              </div>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 md:px-8 max-w-4xl py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-muted-foreground mb-8">
          Dernière mise à jour : 24 novembre 2025
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Acceptation des Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                En accédant et en utilisant BKApay, vous acceptez d'être lié par les présentes conditions générales d'utilisation. 
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Description du Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay est une plateforme de paiement mobile money pour l'Afrique de l'Ouest qui permet :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>L'acceptation de paiements via mobile money dans 6 pays (Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso, Mali)</li>
                <li>La création de liens de paiement personnalisés</li>
                <li>Les dépôts et retraits de fonds</li>
                <li>L'accès à une API pour développeurs</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Inscription et Compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Pour utiliser BKApay, vous devez créer un compte en fournissant des informations exactes et complètes. Vous êtes responsable de :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintenir la confidentialité de vos identifiants de connexion</li>
                <li>Toutes les activités effectuées sous votre compte</li>
                <li>Notifier immédiatement BKApay de toute utilisation non autorisée</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Vérification KYC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Pour certaines fonctionnalités (transferts, API), une vérification d'identité (KYC) est requise. Vous devez fournir :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Une pièce d'identité valide</li>
                <li>Un selfie pour vérification</li>
                <li>Des informations d'adresse précises</li>
              </ul>
              <p className="mt-4">
                BKApay se réserve le droit de refuser ou de suspendre tout compte qui ne respecte pas les exigences KYC.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Frais et Paiements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay applique des frais sur les transactions :
              </p>
              <p>
                Les frais varient selon le pays et l'opérateur utilisé. Ces frais sont automatiquement calculés et déduits lors des transactions. BKApay se réserve le droit de modifier ces frais avec un préavis de 30 jours.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Utilisation Acceptable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vous vous engagez à ne pas :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Utiliser BKApay pour des activités illégales ou frauduleuses</li>
                <li>Violer les droits de propriété intellectuelle</li>
                <li>Tenter d'accéder à des comptes qui ne vous appartiennent pas</li>
                <li>Perturber ou interférer avec les services de BKApay</li>
                <li>Utiliser des robots ou des scripts automatisés</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Suspension et Résiliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay se réserve le droit de suspendre ou de résilier votre compte en cas de :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violation des présentes conditions</li>
                <li>Activité suspecte ou frauduleuse</li>
                <li>Non-respect des exigences KYC</li>
                <li>Demande des autorités compétentes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Limitation de Responsabilité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay ne saurait être tenu responsable de :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Pertes indirectes ou consécutives</li>
                <li>Interruptions de service dues à des tiers (opérateurs mobile money, fournisseurs de services)</li>
                <li>Erreurs de transaction dues à des informations incorrectes fournies par l'utilisateur</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Modifications des Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs seront notifiés des modifications importantes par email ou via la plateforme.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Pour toute question concernant ces conditions, veuillez contacter :
              </p>
              <p className="mt-2">
                Email : support@bkapay.com<br />
                Site web : https://bkapay.com
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
