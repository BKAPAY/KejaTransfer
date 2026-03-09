import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Users, ShieldCheck, Truck, Globe, Percent, ChevronLeft, Lock } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ADMIN_ACCESS_CODE = "19992025";

export default function AdminBusiness() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [accessCodeDialogOpen, setAccessCodeDialogOpen] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const handleProtectedNavigation = (path: string) => {
    setPendingNavigation(path);
    setAccessCode("");
    setAccessCodeDialogOpen(true);
  };

  const handleAccessCodeSubmit = () => {
    if (accessCode === ADMIN_ACCESS_CODE) {
      setAccessCodeDialogOpen(false);
      if (pendingNavigation) {
        setLocation(pendingNavigation);
        setPendingNavigation(null);
      }
      setAccessCode("");
    } else {
      toast({
        title: "Erreur",
        description: "Code d'accès incorrect",
        variant: "destructive",
      });
      setAccessCode("");
    }
  };

  const menuItems = [
    {
      title: "Gestion utilisateurs",
      icon: Users,
      path: "/dashboard/admin/business/management",
      description: "Gérer les comptes entreprise et leurs portefeuilles",
      protected: true,
    },
    {
      title: "Vérifications KYC",
      icon: ShieldCheck,
      path: "/dashboard/admin/business/kyc",
      description: "Approuver ou rejeter les documents d'entreprise",
      protected: true,
    },
    {
      title: "Fournisseurs",
      icon: Truck,
      path: "/dashboard/admin/business/providers",
      description: "Configuration des APIs (PawaPay, Paydunya)",
      protected: true,
    },
    {
      title: "Pays & Opérateurs",
      icon: Globe,
      path: "/dashboard/admin/business/country-operator",
      description: "Activer/Désactiver les pays et opérateurs",
      protected: true,
    },
    {
      title: "Frais",
      icon: Percent,
      path: "/dashboard/admin/business/fees",
      description: "Configurer les frais par pays et opérateur",
      protected: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setLocation("/dashboard/admin")}
          data-testid="button-back-admin"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Administration Entreprise</h1>
          <p className="text-sm text-muted-foreground">Gestion spécifique aux comptes business</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <Card 
            key={item.path} 
            className="hover-elevate cursor-pointer border-primary/20"
            onClick={() => item.protected ? handleProtectedNavigation(item.path) : setLocation(item.path)}
          >
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <div className="p-2 bg-primary/10 rounded-lg">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {item.title}
                  {item.protected && <Lock className="h-3 w-3 text-muted-foreground" />}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={accessCodeDialogOpen} onOpenChange={setAccessCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Code d'accès requis</DialogTitle>
            <DialogDescription>
              Veuillez saisir le code administrateur pour accéder à cette section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder="Code d'accès"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccessCodeSubmit()}
              autoFocus
              data-testid="input-access-code"
            />
            <Button onClick={handleAccessCodeSubmit} className="w-full" data-testid="button-submit-access-code">
              Valider
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
