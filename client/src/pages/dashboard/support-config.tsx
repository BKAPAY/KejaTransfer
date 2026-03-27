import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Save, ArrowLeft, Loader2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useLocation } from "wouter";
import type { SupportSettings } from "@shared/schema";

export default function SupportConfig() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [supportWhatsappPhone, setSupportWhatsappPhone] = useState("");

  const { data: settings, isLoading } = useQuery<SupportSettings>({
    queryKey: ["/api/support-settings"],
  });

  useEffect(() => {
    if (settings) {
      setSupportEmail(settings.supportEmail);
      setSupportPhone(settings.supportPhone);
      setWhatsappLink(settings.whatsappLink);
      setSupportWhatsappPhone(settings.supportWhatsappPhone || "");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/support-settings", {
        supportEmail,
        supportPhone,
        whatsappLink,
        supportWhatsappPhone,
      });
      return res.json();
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/support-settings"] });
        toast({
          title: "Succes",
          description: "Les informations de support ont ete mises a jour",
        });
      } else {
        toast({
          title: "Erreur",
          description: response.error || "Erreur lors de la mise a jour",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!supportEmail || !supportPhone || !whatsappLink) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires (email, telephone, lien communaute)",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/dashboard/admin")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuration du Support</h1>
          <p className="text-sm text-muted-foreground">
            Modifiez les informations de contact affichees aux utilisateurs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Informations de Contact
          </CardTitle>
          <CardDescription>
            Ces informations seront visibles par tous les utilisateurs dans la page Support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="supportEmail" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email de Support
            </Label>
            <Input
              id="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@bkapay.com"
              data-testid="input-support-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportPhone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Numero de Telephone
            </Label>
            <Input
              id="supportPhone"
              type="tel"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="+229 01 46 44 73 19"
              data-testid="input-support-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportWhatsappPhone" className="flex items-center gap-2">
              <SiWhatsapp className="w-4 h-4 text-green-600" />
              Numero WhatsApp du Support
            </Label>
            <Input
              id="supportWhatsappPhone"
              type="tel"
              value={supportWhatsappPhone}
              onChange={(e) => setSupportWhatsappPhone(e.target.value)}
              placeholder="+229 01 46 44 73 19"
              data-testid="input-support-whatsapp-phone"
            />
            <p className="text-xs text-muted-foreground">
              Les utilisateurs seront rediriges vers ce numero sur WhatsApp. Laissez vide pour masquer cette option.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappLink" className="flex items-center gap-2">
              <SiWhatsapp className="w-4 h-4 text-green-600" />
              Lien Communaute WhatsApp
            </Label>
            <Input
              id="whatsappLink"
              type="url"
              value={whatsappLink}
              onChange={(e) => setWhatsappLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              data-testid="input-whatsapp-link"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full gap-2"
            data-testid="button-save-support"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Enregistrer les modifications
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apercu</CardTitle>
          <CardDescription>
            Voici comment les informations apparaitront aux utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-primary" />
                <span className="font-medium">Email</span>
              </div>
              <p className="text-sm text-muted-foreground">{supportEmail || "Non defini"}</p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-primary" />
                <span className="font-medium">Telephone</span>
              </div>
              <p className="text-sm text-muted-foreground">{supportPhone || "Non defini"}</p>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <SiWhatsapp className="w-4 h-4 text-green-600" />
                <span className="font-medium">WhatsApp Support</span>
              </div>
              <p className="text-sm text-muted-foreground">{supportWhatsappPhone || "Non defini"}</p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <SiWhatsapp className="w-4 h-4 text-green-600" />
                <span className="font-medium">Communaute</span>
              </div>
              <p className="text-sm text-muted-foreground truncate">{whatsappLink || "Non defini"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
