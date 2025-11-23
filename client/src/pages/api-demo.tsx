import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { OPERATORS } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";

export default function ApiDemo() {
  const [step, setStep] = useState<"form" | "success" | "loading">("form");
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  
  const countryOperators = OPERATORS[(country as keyof typeof OPERATORS) || ("BJ" as const)] || [];

  const demoTransaction = {
    amount: 50000,
    description: "Achat de produit - Panier ABC123",
    customerName: "Jean Dupont",
    reference: "TXN-2024-001245",
  };

  const handlePaymentSubmit = () => {
    if (country && operator) {
      setStep("loading");
      setTimeout(() => {
        setStep("success");
      }, 3000);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (step === "loading") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
            
            <div className="space-y-2">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
              <h2 className="text-xl font-bold text-foreground">Paiement en cours</h2>
              <p className="text-sm text-muted-foreground">
                Veuillez confirmer la transaction sur votre téléphone
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Ne fermez pas cette page
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-6">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto" />

            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Paiement Réussi !</h2>
              <p className="text-sm text-muted-foreground">Merci pour votre paiement.</p>
            </div>

            <div className="w-full bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-semibold text-foreground">{formatAmount(demoTransaction.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Client</span>
                <span className="text-sm text-foreground">{demoTransaction.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pays</span>
                <span className="text-sm text-foreground">
                  {country === "SN" ? "🇸🇳 Sénégal" : 
                   country === "CI" ? "🇨🇮 Côte d'Ivoire" :
                   country === "BF" ? "🇧🇫 Burkina Faso" :
                   country === "BJ" ? "🇧🇯 Bénin" :
                   country === "TG" ? "🇹🇬 Togo" :
                   country === "ML" ? "🇲🇱 Mali" : country}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Opérateur</span>
                <span className="text-sm text-foreground font-semibold">
                  {countryOperators.find(op => op.code === operator)?.name || operator}
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-sm text-muted-foreground">Référence</span>
                <span className="font-mono text-sm text-foreground">{demoTransaction.reference}</span>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={() => {
                setStep("form");
                setCountry("");
                setOperator("");
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au formulaire
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 overflow-hidden flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <img src={logoImage} alt="BKApay" className="h-8 w-auto" />
            <h1 className="text-xl font-bold text-foreground">BKApay</h1>
          </div>
          <CardTitle>Paiement Sécurisé</CardTitle>
          <CardDescription>Intégration via clés API - DÉMO</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Transaction Details */}
          <div className="space-y-3 pb-4 border-b">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
              <p className="text-4xl font-bold text-primary">
                {formatAmount(demoTransaction.amount)}
              </p>
            </div>
            {demoTransaction.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm text-foreground font-medium">{demoTransaction.description}</p>
              </div>
            )}
            {demoTransaction.customerName && (
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="text-sm text-foreground">{demoTransaction.customerName}</p>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Choisissez votre méthode de paiement</h3>

            <div className="space-y-2">
              <Label htmlFor="country-demo" className="text-sm">Pays</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country-demo" data-testid="select-country-demo">
                  <SelectValue placeholder="Sélectionnez un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
                  <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                  <SelectItem value="BF">🇧🇫 Burkina Faso</SelectItem>
                  <SelectItem value="BJ">🇧🇯 Bénin</SelectItem>
                  <SelectItem value="TG">🇹🇬 Togo</SelectItem>
                  <SelectItem value="ML">🇲🇱 Mali</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator-demo" className="text-sm">Opérateur Mobile Money</Label>
              <Select value={operator} onValueChange={setOperator} disabled={!country}>
                <SelectTrigger id="operator-demo" data-testid="select-operator-demo">
                  <SelectValue placeholder={country ? "Sélectionnez un opérateur" : "Choisissez un pays d'abord"} />
                </SelectTrigger>
                <SelectContent>
                  {countryOperators.map((op) => (
                    <SelectItem key={op.code} value={op.code}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">Sécurité du paiement:</p>
            <ul className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
              <li>✓ Redirection sécurisée vers l'opérateur</li>
              <li>✓ Chiffrement end-to-end</li>
              <li>✓ Vérification instantanée du paiement</li>
            </ul>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handlePaymentSubmit}
            disabled={!country || !operator}
            className="w-full"
            size="lg"
            data-testid="button-pay-demo"
          >
            Procéder au paiement
          </Button>

          {/* Integration Note */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
            <p className="text-xs text-amber-900 dark:text-amber-200">
              <strong>Cette page est une DÉMO.</strong> Cliquez sur "Procéder au paiement" pour voir le flux complète incluant:
            </p>
            <ul className="text-xs text-amber-900 dark:text-amber-200 mt-2 space-y-1">
              <li>• Page de chargement du paiement</li>
              <li>• Confirmation de succès avec détails</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
