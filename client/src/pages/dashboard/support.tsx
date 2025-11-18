import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, HelpCircle, Phone } from "lucide-react";

export default function Support() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Support</h1>
        <p className="text-muted-foreground">Nous sommes là pour vous aider</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Email</CardTitle>
            </div>
            <CardDescription>Contactez-nous par email</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Envoyez-nous un email et nous vous répondrons dans les 24 heures
            </p>
            <Button variant="outline" className="w-full" data-testid="button-email-support">
              <Mail className="w-4 h-4 mr-2" />
              support@kejatransfer.com
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Chat en direct</CardTitle>
            </div>
            <CardDescription>Assistance instantanée</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Discutez avec notre équipe pour une aide immédiate
            </p>
            <Button variant="outline" className="w-full" data-testid="button-chat">
              <MessageCircle className="w-4 h-4 mr-2" />
              Démarrer le chat
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Téléphone</CardTitle>
            </div>
            <CardDescription>Appelez-nous directement</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Support téléphonique disponible du lundi au vendredi
            </p>
            <Button variant="outline" className="w-full" data-testid="button-phone">
              <Phone className="w-4 h-4 mr-2" />
              +221 XX XXX XX XX
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>FAQ</CardTitle>
            </div>
            <CardDescription>Questions fréquentes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Trouvez rapidement des réponses aux questions courantes
            </p>
            <Button variant="outline" className="w-full" data-testid="button-faq">
              <HelpCircle className="w-4 h-4 mr-2" />
              Consulter la FAQ
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
