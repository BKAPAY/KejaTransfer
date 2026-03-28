import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Loader2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useQuery } from "@tanstack/react-query";
import type { SupportSettings } from "@shared/schema";

export default function Support() {
  const { data: settings, isLoading } = useQuery<SupportSettings>({
    queryKey: ["/api/support-settings"],
  });

  const supportEmail = settings?.supportEmail || "support@bkapay.com";
  const supportPhone = settings?.supportPhone || "+229 01 46 44 73 19";
  const whatsappLink = settings?.whatsappLink || "https://chat.whatsapp.com/DRe55FMRXCt87VxNvjF1EF";
  const supportWhatsappPhone = settings?.supportWhatsappPhone || "";

  const whatsappChatUrl = supportWhatsappPhone
    ? `https://wa.me/${supportWhatsappPhone.replace(/[\s+\-()]/g, '')}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Support</h1>
        <p className="text-sm text-muted-foreground">Nous sommes là pour vous aider</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover-elevate min-w-0">
          <CardHeader className="pb-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardTitle className="text-xs">Email</CardTitle>
            </div>
            <CardDescription className="text-xs">Contactez-nous</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 px-3 pb-3">
            <p className="text-muted-foreground">Reponse en 24h</p>
            {isLoading ? (
              <div className="flex items-center justify-center h-8">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full min-w-0" 
                data-testid="button-email-support"
                onClick={() => window.location.href = `mailto:${supportEmail}`}
              >
                <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{supportEmail}</span>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate min-w-0">
          <CardHeader className="pb-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardTitle className="text-xs">Telephone</CardTitle>
            </div>
            <CardDescription className="text-xs">Appelez-nous</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 px-3 pb-3">
            <p className="text-muted-foreground">Lun-Ven 9h-18h</p>
            {isLoading ? (
              <div className="flex items-center justify-center h-8">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full min-w-0" 
                data-testid="button-phone"
                onClick={() => window.location.href = `tel:${supportPhone.replace(/\s/g, '')}`}
              >
                <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{supportPhone}</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {supportWhatsappPhone && (
          <Card className="hover-elevate min-w-0">
            <CardHeader className="pb-2 px-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <SiWhatsapp className="w-3.5 h-3.5 text-green-600" />
                </div>
                <CardTitle className="text-xs">WhatsApp</CardTitle>
              </div>
              <CardDescription className="text-xs">Ecrivez-nous</CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2 px-3 pb-3">
              <p className="text-muted-foreground">Reponse rapide</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full min-w-0 bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" 
                data-testid="button-whatsapp-support"
                onClick={() => window.open(whatsappChatUrl, "_blank")}
              >
                <SiWhatsapp className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{supportWhatsappPhone}</span>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="hover-elevate min-w-0">
          <CardHeader className="pb-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <SiWhatsapp className="w-3.5 h-3.5 text-green-600" />
              </div>
              <CardTitle className="text-xs">Communaute</CardTitle>
            </div>
            <CardDescription className="text-xs">Rejoignez notre groupe</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 px-3 pb-3">
            <p className="text-muted-foreground">Echangez avec la communaute</p>
            {isLoading ? (
              <div className="flex items-center justify-center h-8">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full min-w-0 bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" 
                data-testid="button-whatsapp-community"
                onClick={() => window.open(whatsappLink, "_blank")}
              >
                <SiWhatsapp className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">Rejoindre le groupe</span>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
