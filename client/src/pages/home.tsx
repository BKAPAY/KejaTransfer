import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, Link as LinkIcon, Code, BarChart3, Shield, Zap, User, Building2, Check, ArrowRight, ChevronRight, BookOpen } from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import { CardBrandIcon } from "@/components/card-brand-icon";
import { COUNTRIES } from "@shared/schema";
import { CountryFlag } from "@/components/country-flag";
import logoImage from "@assets/bkapay-logo.png";
import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";
import airtelImage from "@assets/image_search_1771486869310_1771487355059.png";
import mpesaImage from "@assets/image_search_1771486907537_1771487355101.png";
import celtiisImage from "@assets/image_search_1771486943445_1771487355123.jpg";
import expressoImage from "@assets/image_search_1771487048520_1771487355151.png";
import corisImage from "@assets/image_search_1771487069905_1771487355176.png";
import afrimoneyImage from "@assets/image_search_1771487089985_1771487355198.png";
import qmoneyImage from "@assets/image_search_1771487154605_1771487355255.jpg";
import telecelImage from "@assets/image_search_1771487186999_1771487355289.jpg";
import paymentLinksImage from "@assets/generated_images/v3_payment_links.png";
import merchantLinksImage from "@assets/generated_images/v3_merchant_links.png";
import apiGatewayImage from "@assets/generated_images/v3_api_gateway.png";
import dashboardImage from "@assets/generated_images/v3_dashboard.png";
import securityImage from "@assets/generated_images/v3_security.png";
import fastPaymentImage from "@assets/generated_images/v3_fast_payment.png";

import cryptoHeroImage from "@assets/crypto-payment-hero.png";
import cardHeroImage from "@assets/card-payment-hero.png";
import heroMainImage from "@assets/ChatGPT_Image_6_mai_2026,_13_22_24_1778070414038.png";
import mobileMoneyHeroImage from "@assets/generated_images/v3_mobile_money_hero.png";
import adAfricaMapImage from "@assets/ad_photos/ad_07_africa_map.png";
import adMarketImage from "@assets/ad_photos/ad_03_market_entrepreneur.png";
import adCryptoImage from "@assets/ad_photos/ad_05_crypto_mobile.png";
import adManJumpImage from "@assets/ad_photos/ad_08_man_celebrating.png";

const countries = COUNTRIES;

const operators = [
  { name: "Orange Money", image: omImage },
  { name: "MTN Mobile Money", image: mtnImage },
  { name: "Moov Money", image: moovImage },
  { name: "Wave", image: waveImage },
  { name: "Free Money", image: freeImage },
  { name: "T-Money", image: tmonyImage },
  { name: "Wizall", image: wizallImage },
  { name: "Airtel Money", image: airtelImage },
  { name: "M-Pesa", image: mpesaImage },
  { name: "Celtiis", image: celtiisImage },
  { name: "Expresso", image: expressoImage },
  { name: "Coris Money", image: corisImage },
  { name: "AfriMoney", image: afrimoneyImage },
  { name: "QMoney", image: qmoneyImage },
  { name: "Telecel", image: telecelImage },
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
    title: "API",
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
    description: "Recevez vos paiements instantanément via mobile money dans toute l'Afrique.",
    image: fastPaymentImage,
  },
];

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    const el = ref.current;
    if (el) {
      const targets = el.querySelectorAll(".animate-on-scroll");
      targets.forEach((t) => observer.observe(t));
    }

    return () => observer.disconnect();
  }, []);

  return ref;
}

const adSlides = [
  { src: adAfricaMapImage, alt: "BKApay - Plus de 17 pays connectés en Afrique" },
  { src: adMarketImage, alt: "BKApay - Acceptez les paiements partout" },
  { src: adCryptoImage, alt: "BKApay - Mobile Money + Crypto" },
  { src: adManJumpImage, alt: "BKApay - La joie des paiements réussis" },
];

function AdSlideshow() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % adSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-4 sm:py-6 md:py-8 overflow-hidden">
      <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
        <div className="relative rounded-md overflow-hidden">
          {adSlides.map((slide, index) => (
            <img
              key={index}
              src={slide.src}
              alt={slide.alt}
              loading="lazy"
              decoding="async"
              className={`w-full rounded-md transition-opacity duration-1000 ${index === current ? "opacity-100" : "opacity-0 absolute inset-0"}`}
              data-testid={`img-ad-slide-${index}`}
            />
          ))}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {adSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all ${index === current ? "bg-white scale-110" : "bg-white/50"}`}
                data-testid={`button-ad-dot-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const scrollRef = useScrollAnimation();

  return (
    <div ref={scrollRef} className="w-full min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={logoImage} alt="BKApay" className="h-8 sm:h-10 w-auto" />
            </div>
            <a href="/docs">
              <Button variant="outline" size="sm" data-testid="button-documentation-api">
                <Code className="w-4 h-4 mr-1" />
                Documentation API
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section with background image */}
      <section className="relative py-12 md:py-24 lg:py-36 overflow-hidden bg-black">
        <div className="absolute inset-0">
          <img src={heroMainImage} alt="" className="w-full h-full object-cover" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        </div>
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl relative z-10">
          <div className="space-y-3 sm:space-y-6 lg:space-y-8 max-w-2xl">
            <div className="space-y-2 sm:space-y-4">
              <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
                Paiements Mobile Money pour l'Afrique
              </h1>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-white/80">
                Acceptez les paiements Orange Money, MTN, Moov, Wave et plus dans plus de 17 pays. Plateforme simple, sécurisée et fiable.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <Link href="/signup">
                <Button className="text-xs sm:text-sm md:text-base" data-testid="button-hero-signup">
                  Commencer
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="text-xs sm:text-sm md:text-base border-white/30 text-white bg-white/10 backdrop-blur-sm" data-testid="button-hero-login">
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
            <h2 className="animate-on-scroll anim-fade-up text-lg sm:text-xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-foreground">Disponible dans plus de 17 pays</h2>
            <p className="animate-on-scroll anim-fade-up anim-delay-1 text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Couvrant toute l'Afrique francophone et anglophone</p>
          </div>
          <div className="flex gap-2 sm:gap-4 carousel-scroll">
            {[...countries, ...countries].map((country, index) => (
              <Card key={`${country.code}-${index}`} className="p-2 sm:p-3 lg:p-6 text-center hover-elevate flex-shrink-0 min-w-max">
                <div className="mb-1 sm:mb-2 lg:mb-3 flex justify-center"><CountryFlag code={country.code} size="xl" /></div>
                <div className="text-xs sm:text-sm font-medium text-foreground">{country.name}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Promotional Slideshow */}
      <AdSlideshow />

      {/* Mobile Money Hero Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20 overflow-hidden">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
            <div className="animate-on-scroll anim-slide-left">
              <img
                src={mobileMoneyHeroImage}
                alt="Paiements Mobile Money"
                loading="lazy"
                decoding="async"
                className="w-full rounded-md"
                data-testid="img-mobile-money-hero"
              />
            </div>
            <div className="animate-on-scroll anim-slide-right">
              <div className="flex items-center -space-x-1 mb-3 sm:mb-4">
                <img src={omImage} alt="Orange Money" loading="lazy" decoding="async" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain bg-white border border-border" />
                <img src={mtnImage} alt="MTN" loading="lazy" decoding="async" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain bg-white border border-border" />
                <img src={moovImage} alt="Moov" loading="lazy" decoding="async" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain bg-white border border-border" />
                <img src={waveImage} alt="Wave" loading="lazy" decoding="async" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain bg-white border border-border" />
              </div>
              <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">
                Paiements Mobile Money
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
                Acceptez les paiements via tous les opérateurs Mobile Money d'Afrique. Orange Money, MTN, Moov, Wave, Free Money, T-Money et bien plus. Transactions instantanées, sécurisées et fiables.
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 rounded-md text-xs sm:text-sm font-medium"><img src={omImage} alt="OM" loading="lazy" decoding="async" className="w-4 h-4 rounded-full object-contain" /> Orange Money</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 rounded-md text-xs sm:text-sm font-medium"><img src={mtnImage} alt="MTN" loading="lazy" decoding="async" className="w-4 h-4 rounded-full object-contain" /> MTN</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-md text-xs sm:text-sm font-medium"><img src={moovImage} alt="Moov" loading="lazy" decoding="async" className="w-4 h-4 rounded-full object-contain" /> Moov</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 rounded-md text-xs sm:text-sm font-medium"><img src={waveImage} alt="Wave" loading="lazy" decoding="async" className="w-4 h-4 rounded-full object-contain" /> Wave</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-muted text-muted-foreground rounded-md text-xs sm:text-sm font-medium">+ 11 autres</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Crypto Payment Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20 overflow-hidden">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
            <div className="animate-on-scroll anim-slide-left order-2 md:order-1">
              <div className="flex items-center -space-x-1 mb-3 sm:mb-4">
                <CryptoIcon code="btc" size="lg" />
                <CryptoIcon code="eth" size="lg" />
                <CryptoIcon code="usdttrc20" size="lg" />
              </div>
              <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">
                Paiements en Cryptomonnaie
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
                Acceptez Bitcoin, Ethereum, USDT, TRX et bien d'autres cryptomonnaies. Conversion automatique en XOF, XAF ou CDF. Vos clients paient en crypto, vous recevez en monnaie locale.
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-md text-xs sm:text-sm font-medium"><CryptoIcon code="btc" size="xs" /> BTC</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded-md text-xs sm:text-sm font-medium"><CryptoIcon code="eth" size="xs" /> ETH</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 rounded-md text-xs sm:text-sm font-medium"><CryptoIcon code="usdttrc20" size="xs" /> USDT</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-md text-xs sm:text-sm font-medium"><CryptoIcon code="trx" size="xs" /> TRX</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-md text-xs sm:text-sm font-medium"><CryptoIcon code="ltc" size="xs" /> LTC</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-muted text-muted-foreground rounded-md text-xs sm:text-sm font-medium">+ plus</span>
              </div>
            </div>
            <div className="animate-on-scroll anim-slide-right order-1 md:order-2">
              <img
                src={cryptoHeroImage}
                alt="Paiements en cryptomonnaie"
                loading="lazy"
                decoding="async"
                className="w-full rounded-md"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
