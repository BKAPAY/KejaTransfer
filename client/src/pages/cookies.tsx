import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

export default function Cookies() {
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
          Politique de Cookies
        </h1>
        <p className="text-muted-foreground mb-8">
          Dernière mise à jour : 24 novembre 2025
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Qu'est-ce qu'un Cookie ?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Un cookie est un petit fichier texte stocké sur votre appareil lorsque vous visitez un site web. 
                Les cookies permettent au site de mémoriser vos actions et préférences pendant une période donnée.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Comment BKApay Utilise les Cookies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay utilise des cookies pour :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintenir votre session de connexion</li>
                <li>Mémoriser vos préférences (langue, thème)</li>
                <li>Améliorer la sécurité de la plateforme</li>
                <li>Analyser l'utilisation de notre site</li>
                <li>Personnaliser votre expérience</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Types de Cookies Utilisés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <h4 className="font-semibold text-foreground mt-4">Cookies Essentiels</h4>
              <p>
                Ces cookies sont nécessaires au fonctionnement du site et ne peuvent pas être désactivés :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Session de connexion :</strong> Maintient votre authentification</li>
                <li><strong>Sécurité :</strong> Protège contre les attaques CSRF et XSS</li>
                <li><strong>Préférences :</strong> Stocke vos choix d'affichage</li>
              </ul>

              <h4 className="font-semibold text-foreground mt-6">Cookies de Performance</h4>
              <p>
                Ces cookies nous aident à comprendre comment les visiteurs utilisent notre site :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Analytiques :</strong> Mesure le trafic et l'engagement</li>
                <li><strong>Erreurs :</strong> Détecte et corrige les problèmes techniques</li>
              </ul>

              <h4 className="font-semibold text-foreground mt-6">Cookies Fonctionnels</h4>
              <p>
                Ces cookies permettent des fonctionnalités améliorées :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Thème :</strong> Mode clair/sombre</li>
                <li><strong>Langue :</strong> Préférence linguistique</li>
                <li><strong>Code d'accès admin :</strong> Stockage du code gestionnaire</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Cookies Tiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                BKApay peut utiliser des services tiers qui déposent leurs propres cookies :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Processeurs de paiement :</strong> Pour le traitement des paiements</li>
                <li><strong>Services d'analyse :</strong> Pour améliorer nos services</li>
              </ul>
              <p className="mt-4">
                Ces tiers ont leurs propres politiques de confidentialité et de cookies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Durée de Conservation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Les cookies que nous utilisons ont différentes durées de vie :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Cookies de session :</strong> Supprimés à la fermeture du navigateur</li>
                <li><strong>Cookies persistants :</strong> Conservés jusqu'à 12 mois ou jusqu'à leur suppression</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Gestion des Cookies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vous pouvez gérer vos préférences de cookies :
              </p>
              
              <h4 className="font-semibold text-foreground mt-4">Via votre Navigateur</h4>
              <p>
                La plupart des navigateurs vous permettent de :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Afficher les cookies stockés</li>
                <li>Supprimer les cookies individuellement ou tous les cookies</li>
                <li>Bloquer les cookies de certains sites</li>
                <li>Bloquer tous les cookies tiers</li>
                <li>Supprimer tous les cookies à la fermeture du navigateur</li>
              </ul>

              <h4 className="font-semibold text-foreground mt-6">Instructions par Navigateur</h4>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Chrome :</strong> Paramètres → Confidentialité et sécurité → Cookies</li>
                <li><strong>Firefox :</strong> Paramètres → Vie privée et sécurité → Cookies</li>
                <li><strong>Safari :</strong> Préférences → Confidentialité → Cookies</li>
                <li><strong>Edge :</strong> Paramètres → Cookies et autorisations</li>
              </ul>

              <p className="mt-4 font-semibold text-foreground">
                Note : La désactivation des cookies essentiels peut affecter le fonctionnement de BKApay.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Stockage Local (LocalStorage)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                En plus des cookies, BKApay utilise le stockage local du navigateur pour :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Mémoriser le code d'accès gestionnaire</li>
                <li>Sauvegarder les préférences de thème</li>
                <li>Améliorer les performances de l'application</li>
              </ul>
              <p className="mt-4">
                Ces données sont stockées localement sur votre appareil et ne sont pas transmises à nos serveurs sauf en cas de besoin.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Modifications de cette Politique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Nous pouvons mettre à jour cette politique de cookies pour refléter les changements dans nos pratiques. 
                La date de dernière mise à jour est indiquée en haut de cette page.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Pour toute question concernant notre utilisation des cookies, contactez-nous :
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
