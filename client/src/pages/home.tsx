import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, Link as LinkIcon, Code, BarChart3, Shield, Zap } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";
import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";

const countries = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
];

const operators = [
  { name: "Orange Money", image: omImage },
  { name: "MTN Mobile Money", image: mtnImage },
  { name: "Moov Money", image: moovImage },
  { name: "Wave", image: waveImage },
  { name: "Free Money", image: freeImage },
  { name: "T-Money", image: tmonyImage },
  { name: "Wizall", image: wizallImage },
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
        <div className="container mx-auto px-2 sm:px-4 md:px-8 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={logoImage} alt="BKApay" className="h-8 sm:h-10 w-auto" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" data-testid="button-login" className="text-xs sm:text-sm">Se connecter</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" data-testid="button-signup" className="text-xs sm:text-sm">S'inscrire</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-8 md:py-20 lg:py-32 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-12 items-center">
            <div className="space-y-3 sm:space-y-6 lg:space-y-8">
              <div className="space-y-2 sm:space-y-4">
                <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
                  Paiements Mobile Money pour l'Afrique de l'Ouest
                </h1>
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">
                  Acceptez les paiements Orange Money, MTN, Moov, Wave et plus dans 6 pays. Plateforme simple, sécurisée et fiable.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <Link href="/signup">
                  <Button size="sm" className="text-xs sm:text-sm md:text-base" data-testid="button-hero-signup">
                    Commencer
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="sm" variant="outline" className="text-xs sm:text-sm md:text-base" data-testid="button-hero-login">
                    Se connecter
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex justify-center hidden md:block">
              <img src={logoImage} alt="BKApay Platform" className="w-full max-w-xs lg:max-w-md rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Countries Section */}
      <section className="py-6 sm:py-8 md:py-12 lg:py-16 bg-card">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-foreground">Disponible dans 6 pays</h2>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Couvrant toute l'Afrique de l'Ouest francophone</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {countries.map((country) => (
              <Card key={country.code} className="p-2 sm:p-3 lg:p-6 text-center hover-elevate">
                <div className="text-2xl sm:text-3xl lg:text-4xl mb-1 sm:mb-2 lg:mb-3">{country.flag}</div>
                <div className="text-xs sm:text-sm font-medium text-foreground">{country.name}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-6 sm:py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-6 sm:mb-10 lg:mb-16">
            <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-foreground">Fonctionnalités puissantes</h2>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour accepter des paiements et gérer votre activité
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-3 sm:p-4 lg:p-8 hover-elevate">
                <div className="bg-primary/10 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md flex items-center justify-center mb-2 sm:mb-3 lg:mb-4">
                  <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base lg:text-xl font-semibold mb-1 sm:mb-2 lg:mb-3 text-foreground">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Operators Section */}
      <section className="py-6 sm:py-10 md:py-14 lg:py-16 bg-card">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-foreground">Tous les opérateurs supportés</h2>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Acceptez les paiements de tous les principaux opérateurs</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {operators.map((operator, index) => (
              <div
                key={index}
                className="flex items-center justify-center bg-background border border-border rounded-lg p-4 sm:p-6 lg:p-8 hover-elevate min-h-24 sm:min-h-32"
              >
                <img 
                  src={operator.image} 
                  alt={operator.name} 
                  className="w-full h-full object-contain max-w-[120px] max-h-[120px]"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20 bg-gradient-to-br from-primary to-primary/80">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-4xl text-center">
          <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 sm:mb-6 text-primary-foreground">
            Prêt à commencer ?
          </h2>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-primary-foreground/90 mb-4 sm:mb-8">
            Rejoignez des milliers d'entreprises qui font confiance à BKApay
          </p>
          <Link href="/signup">
            <Button size="sm" variant="secondary" className="text-xs sm:text-sm md:text-base" data-testid="button-cta-signup">
              Créer un compte
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-6 sm:py-8 md:py-10 lg:py-12">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 mb-4 sm:mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <img src={logoImage} alt="BKApay" className="h-6 sm:h-8 w-auto" />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Plateforme de paiement mobile money pour l'Afrique de l'Ouest
              </p>
            </div>
            <div className="hidden md:block">
              <h3 className="font-semibold mb-3 sm:mb-4 text-foreground text-sm sm:text-base">Entreprise</h3>
              <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li>À propos</li>
                <li>Carrières</li>
                <li>Blog</li>
                <li>Partenaires</li>
              </ul>
            </div>
            <div className="hidden md:block">
              <h3 className="font-semibold mb-3 sm:mb-4 text-foreground text-sm sm:text-base">Support</h3>
              <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li>Centre d'aide</li>
                <li>Documentation</li>
                <li>Contact</li>
                <li>Statut</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-4 sm:pt-6 lg:pt-8 flex flex-col sm:flex-row flex-wrap justify-between items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <p>© 2024 BKApay</p>
            <div className="flex gap-3 sm:gap-6">
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
