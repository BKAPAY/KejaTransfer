import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Building2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { CURRENT_VERSION } from "@/lib/doc-versions";

export default function DocumentationLanding() {
  const [location, setLocation] = useLocation();
  const isDashboard = location.startsWith("/dashboard");
  const personalUrl = isDashboard
    ? `/dashboard/documentation/${CURRENT_VERSION}`
    : `/documentation/${CURRENT_VERSION}`;
  const businessUrl = isDashboard
    ? "/dashboard/documentation-business"
    : "/documentation-business";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-doc-landing-title">
          Documentation API BKApay
        </h1>
        <p className="text-muted-foreground">
          Choisissez le type de documentation correspondant a votre compte
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        <Card
          className="cursor-pointer hover-elevate border-2 transition-colors"
          onClick={() => setLocation(personalUrl)}
          data-testid="card-doc-personal"
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Documentation Compte Personnel</CardTitle>
            <CardDescription>Pour les comptes particuliers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                Redirect Checkout / HPP
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                Inline / Modal Checkout
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                API Payout
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                Sessions de Paiement Securisees
              </li>
            </ul>
            <Button className="w-full" data-testid="button-doc-personal">
              Voir la documentation
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover-elevate border-2 transition-colors"
          onClick={() => setLocation(businessUrl)}
          data-testid="card-doc-business"
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-purple-600" />
            </div>
            <CardTitle className="text-xl">Documentation Compte Entreprise</CardTitle>
            <CardDescription>Pour les comptes professionnels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">-</span>
                API Payin (collecte directe)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">-</span>
                API Payout (envoi direct)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">-</span>
                Webhooks et verification HMAC
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">-</span>
                Pays et operateurs supportes
              </li>
            </ul>
            <Button variant="outline" className="w-full border-purple-300 dark:border-purple-700" data-testid="button-doc-business">
              Voir la documentation
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
