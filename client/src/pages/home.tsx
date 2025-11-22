import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, Link as LinkIcon, Code, BarChart3, Shield, Zap } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";

const countries = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
];

const operators = [
  "Orange Money",
  "MTN Mobile Money",
  "Moov Money",
  "Wave",
  "Free Money",
  "T-Money",
  "Wizall",
  "Expresso",
];

const features = [
  {
    icon: LinkIcon,
    title: "Liens de Paiement",
    description: "Créez des liens personnalisés pour vos produits et services. Partagez-les facilement avec vos clients.",
  },
  {
    icon: CreditCard,
    title: "Liens Marchands",
    description: "Un lien unique pour votre entreprise. Vos clients choisissent le montant à payer.",
  },
  {
    icon: Code,
    title: "API Gateway",
    description: "Intégrez les paiements directement dans votre site web ou application avec notre API sécurisée.",
  },
  {
    icon: BarChart3,
    title: "Tableau de Bord",
    description: "Suivez vos transactions en temps réel avec des statistiques détaillées en XOF.",
  },
  {
    icon: Shield,
    title: "Sécurité Maximale",
    description: "Tous les paiements sont sécurisés et conformes aux normes de l'industrie.",
  },
  {
    icon: Zap,
    title: "Traitement Rapide",
    description: "Recevez vos paiements instantanément via mobile money dans toute l'Afrique de l'Ouest.",
  },
];

export default function Home() {
  return (
    <div className="w-full min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
              <span className="text-xl font-bold text-foreground">BKApay</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" data-testid="button-login">Se connecter</Button>
              </Link>
              <Link href="/signup">
                <Button data-testid="button-signup">S'inscrire</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                  Paiements Mobile Money pour l'Afrique de l'Ouest
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground">
                  Acceptez les paiements Orange Money, MTN, Moov, Wave et plus dans 6 pays. Plateforme simple, sécurisée et fiable.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link href="/signup">
                  <Button size="lg" className="text-base" data-testid="button-hero-signup">
                    Commencer gratuitement
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="text-base" data-testid="button-hero-login">
                    Se connecter
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex justify-center">
              <img src={logoImage} alt="BKApay Platform" className="w-full max-w-md rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Countries Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Disponible dans 6 pays</h2>
            <p className="text-lg text-muted-foreground">Couvrant toute l'Afrique de l'Ouest francophone</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {countries.map((country) => (
              <Card key={country.code} className="p-6 text-center hover-elevate">
                <div className="text-4xl mb-3">{country.flag}</div>
                <div className="text-sm font-medium text-foreground">{country.name}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Fonctionnalités puissantes</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour accepter des paiements et gérer votre activité
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-8 hover-elevate">
                <div className="bg-primary/10 w-12 h-12 rounded-md flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Operators Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Tous les opérateurs supportés</h2>
            <p className="text-lg text-muted-foreground">Acceptez les paiements de tous les principaux opérateurs mobile money</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {operators.map((operator, index) => (
              <div
                key={index}
                className="bg-background border border-border rounded-md p-4 text-center text-sm font-medium hover-elevate"
              >
                {operator}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary-foreground">
            Prêt à commencer ?
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-8">
            Rejoignez des milliers d'entreprises qui font confiance à BKApay pour leurs paiements
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="text-base" data-testid="button-cta-signup">
              Créer un compte gratuitement
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="grid md:grid-cols-3 gap-12 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={logoImage} alt="BKApay" className="h-8 w-auto" />
                <span className="font-bold text-lg">BKApay</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Plateforme de paiement mobile money pour l'Afrique de l'Ouest
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Entreprise</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>À propos</li>
                <li>Carrières</li>
                <li>Blog</li>
                <li>Partenaires</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Centre d'aide</li>
                <li>Documentation</li>
                <li>Contact</li>
                <li>Statut</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-wrap justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2024 BKApay. Tous droits réservés.</p>
            <div className="flex gap-6">
              <span>Conditions</span>
              <span>Confidentialité</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
