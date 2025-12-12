import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, Link as LinkIcon, Code, BarChart3, Shield, Zap, Menu } from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";
import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";
import paymentLinksImage from "@assets/generated_images/payment_links_feature_image.png";
import merchantLinksImage from "@assets/generated_images/merchant_links_feature_image.png";
import apiGatewayImage from "@assets/generated_images/api_gateway_feature_image.png";
import dashboardImage from "@assets/generated_images/dashboard_analytics_feature_image.png";
import securityImage from "@assets/generated_images/security_feature_image.png";
import fastPaymentImage from "@assets/generated_images/fast_payment_processing_image.png";

const countries = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "GN", name: "Guinée", flag: "🇬🇳" },
  { code: "NE", name: "Niger", flag: "🇳🇪" },
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
    image: paymentLinksImage,
  },
  {
    icon: CreditCard,
    title: "Liens Marchands",
    description: "Un lien unique pour votre entreprise. Vos clients choisissent le montant à payer.",
    image: merchantLinksImage,
  },
  {
    icon: Code,
    title: "API Gateway",
    description: "Intégrez les paiements directement dans votre site web ou application avec notre API sécurisée.",
    image: apiGatewayImage,
  },
  {
    icon: BarChart3,
    title: "Tableau de Bord",
    description: "Suivez vos transactions en temps réel avec des statistiques détaillées en XOF.",
    image: dashboardImage,
  },
  {
    icon: Shield,
    title: "Sécurité Maximale",
    description: "Tous les paiements sont sécurisés et conformes aux normes de l'industrie.",
    image: securityImage,
  },
  {
    icon: Zap,
    title: "Traitement Rapide",
    description: "Recevez vos paiements instantanément via mobile money dans toute l'Afrique de l'Ouest.",
    image: fastPaymentImage,
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-auth-menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/documentation" data-testid="menu-documentation">
                    Documentation
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/login" data-testid="menu-login">
                    Se connecter
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/signup" data-testid="menu-signup">
                    S'inscrire
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-8 md:py-20 lg:py-32 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="space-y-3 sm:space-y-6 lg:space-y-8">
            <div className="space-y-2 sm:space-y-4">
              <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
                Paiements Mobile Money pour l'Afrique de l'Ouest
              </h1>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">
                Acceptez les paiements Orange Money, MTN, Moov, Wave et plus dans 8 pays. Plateforme simple, sécurisée et fiable.
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
        </div>
      </section>

      {/* Countries Section */}
      <section className="py-6 sm:py-8 md:py-12 lg:py-16 bg-card overflow-hidden">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-foreground">Disponible dans 8 pays</h2>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Couvrant toute l'Afrique de l'Ouest francophone</p>
          </div>
          <div className="flex gap-2 sm:gap-4 carousel-scroll">
            {[...countries, ...countries].map((country, index) => (
              <Card key={`${country.code}-${index}`} className="p-2 sm:p-3 lg:p-6 text-center hover-elevate flex-shrink-0 min-w-max">
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
              <Card key={index} className="overflow-hidden hover-elevate flex flex-col h-full">
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className="w-full h-40 sm:h-48 object-cover"
                />
                <div className="p-3 sm:p-4 lg:p-6 flex flex-col flex-1">
                  <div className="bg-primary/10 w-8 h-8 sm:w-10 sm:h-10 rounded-md flex items-center justify-center mb-2 sm:mb-3">
                    <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-1 sm:mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Operators Section */}
      <section className="py-6 sm:py-10 md:py-14 lg:py-16 bg-card overflow-hidden">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="text-center mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-foreground">Tous les opérateurs supportés</h2>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Acceptez les paiements de tous les principaux opérateurs</p>
          </div>
          <div className="flex gap-1 sm:gap-2 carousel-scroll">
            {[...operators, ...operators].map((operator, index) => (
              <div
                key={`${index}`}
                className="flex items-center justify-center bg-background border border-border rounded-md p-1 sm:p-2 hover-elevate flex-shrink-0 min-w-max"
              >
                <img 
                  src={operator.image} 
                  alt={operator.name} 
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
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
            <p>© 2025 BKApay</p>
            <div className="flex gap-3 sm:gap-6">
              <Link href="/terms">
                <span className="hover:text-foreground cursor-pointer transition-colors" data-testid="link-terms">
                  Conditions
                </span>
              </Link>
              <Link href="/privacy">
                <span className="hover:text-foreground cursor-pointer transition-colors" data-testid="link-privacy">
                  Confidentialité
                </span>
              </Link>
              <Link href="/cookies">
                <span className="hover:text-foreground cursor-pointer transition-colors" data-testid="link-cookies">
                  Cookies
                </span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
