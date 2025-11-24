import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

export default function Privacy() {
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
          Politique de Confidentialité
        </h1>
        <p className="text-muted-foreground mb-8">
          Dernière mise à jour : 24 novembre 2025
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay s'engage à protéger votre vie privée. Cette politique de confidentialité explique comment nous collectons, 
                utilisons, partageons et protégeons vos informations personnelles.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Informations Collectées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Nous collectons les informations suivantes :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Informations d'identification :</strong> Nom, prénom, email, numéro de téléphone</li>
                <li><strong>Informations KYC :</strong> Pièce d'identité, selfie, adresse</li>
                <li><strong>Informations de transaction :</strong> Montants, dates, opérateurs utilisés</li>
                <li><strong>Informations techniques :</strong> Adresse IP, type de navigateur, système d'exploitation</li>
                <li><strong>Cookies :</strong> Pour améliorer l'expérience utilisateur</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Utilisation des Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vos informations sont utilisées pour :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fournir et améliorer nos services</li>
                <li>Vérifier votre identité (KYC)</li>
                <li>Traiter vos transactions</li>
                <li>Communiquer avec vous concernant votre compte</li>
                <li>Prévenir la fraude et assurer la sécurité</li>
                <li>Respecter nos obligations légales et réglementaires</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Partage des Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Nous pouvons partager vos informations avec :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Partenaires de paiement :</strong> Nos fournisseurs de traitement des paiements</li>
                <li><strong>Opérateurs mobile money :</strong> Pour exécuter vos transactions</li>
                <li><strong>Autorités compétentes :</strong> En cas de demande légale ou réglementaire</li>
                <li><strong>Prestataires de services :</strong> Qui nous aident à opérer notre plateforme</li>
              </ul>
              <p className="mt-4">
                Nous ne vendons jamais vos informations personnelles à des tiers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Protection des Données</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Nous mettons en œuvre des mesures de sécurité appropriées :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Chiffrement SSL/TLS pour toutes les communications</li>
                <li>Hachage des mots de passe avec bcrypt</li>
                <li>Stockage sécurisé des données sensibles</li>
                <li>Accès limité aux données personnelles</li>
                <li>Surveillance continue de la sécurité</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Vos Droits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vous avez le droit de :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Accéder à vos données personnelles</li>
                <li>Corriger des informations inexactes</li>
                <li>Demander la suppression de vos données</li>
                <li>Retirer votre consentement</li>
                <li>Vous opposer au traitement de vos données</li>
                <li>Demander la portabilité de vos données</li>
              </ul>
              <p className="mt-4">
                Pour exercer ces droits, contactez-nous à : privacy@bkapay.com
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Conservation des Données</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Nous conservons vos données personnelles aussi longtemps que nécessaire pour :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fournir nos services</li>
                <li>Respecter nos obligations légales (minimum 5 ans pour les données financières)</li>
                <li>Résoudre les litiges</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Transferts Internationaux</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vos données peuvent être transférées et stockées dans des pays en dehors de votre pays de résidence. 
                Nous nous assurons que ces transferts respectent les normes de protection des données applicables.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Mineurs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay n'est pas destiné aux personnes de moins de 18 ans. Nous ne collectons pas sciemment d'informations 
                personnelles auprès de mineurs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Modifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Nous pouvons mettre à jour cette politique de confidentialité périodiquement. Les modifications importantes 
                seront notifiées par email ou via notre plateforme.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>11. Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Pour toute question concernant cette politique, contactez-nous :
              </p>
              <p className="mt-2">
                Email : privacy@bkapay.com<br />
                Site web : https://bkapay.com
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
