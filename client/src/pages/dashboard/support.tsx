import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, HelpCircle, Phone } from "lucide-react";

export default function Support() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Support</h1>
        <p className="text-sm text-muted-foreground">Nous sommes là pour vous aider</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Email</CardTitle>
            </div>
            <CardDescription className="text-xs">Contactez-nous</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-muted-foreground">Réponse en 24h</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-email-support">
              <Mail className="w-3 h-3 mr-1" />
              support@kejatransfer.com
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Chat</CardTitle>
            </div>
            <CardDescription className="text-xs">Assistance instantanée</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-muted-foreground">En ligne maintenant</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-chat">
              <MessageCircle className="w-3 h-3 mr-1" />
              Démarrer le chat
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Téléphone</CardTitle>
            </div>
            <CardDescription className="text-xs">Appelez-nous</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-muted-foreground">Lun-Ven 9h-18h</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-phone">
              <Phone className="w-3 h-3 mr-1" />
              +221 XX XXX XX XX
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm">FAQ</CardTitle>
            </div>
            <CardDescription className="text-xs">Questions fréquentes</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-muted-foreground">Réponses rapides</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-faq">
              <HelpCircle className="w-3 h-3 mr-1" />
              Consulter la FAQ
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
