import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowLeft } from "lucide-react";

const ADMIN_CODE = "19992025";

export default function AdminAccessCodePage() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const { toast } = useToast();

  // Check if already has access
  useEffect(() => {
    const storedCode = localStorage.getItem("adminAccessCode");
    if (storedCode === ADMIN_CODE) {
      setHasAccess(true);
      navigate("/dashboard/management");
    }
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (code === ADMIN_CODE) {
      localStorage.setItem("adminAccessCode", ADMIN_CODE);
      toast({
        title: "Succès",
        description: "Accès à l'interface gestionnaire accordé",
      });
      navigate("/dashboard/management");
    } else {
      toast({
        title: "Erreur",
        description: "Code d'accès incorrect",
        variant: "destructive",
      });
      setCode("");
    }

    setIsSubmitting(false);
  };

  if (hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mx-auto">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-center">Interface Gestionnaire</CardTitle>
            <CardDescription className="text-center">
              Veuillez entrer le code d'accès pour accéder à l'interface de gestion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Entrez le code d'accès"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-center text-2xl tracking-widest"
                  maxLength={8}
                  data-testid="input-admin-access-code"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || code.length === 0}
                className="w-full"
                data-testid="button-submit-admin-code"
              >
                {isSubmitting ? "Vérification..." : "Accéder"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
