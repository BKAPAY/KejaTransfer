import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Link as LinkIcon, Copy, ExternalLink } from "lucide-react";
import type { PaymentLink, User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function AdminUserLinks() {
  const params = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const userId = params.userId;
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const { data: links, isLoading } = useQuery<PaymentLink[]>({
    queryKey: [`/api/admin/user/${userId}/payment-links`],
    enabled: !!userId,
  });

  const userCurrency = user?.country
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString("fr-FR")} ${userCurrency}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "Lien copié dans le presse-papiers",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button variant="ghost" onClick={() => setLocation("/dashboard/management")} className="mb-6" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la gestion
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Liens de paiement de {user?.firstName} {user?.lastName} ({links?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links && links.length > 0 ? (
            <div className="divide-y">
              {links.map((link) => (
                <div key={link.id} className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{link.productName}</p>
                      {link.description && (
                        <p className="text-sm text-muted-foreground truncate">{link.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatAmount(link.amount)}</p>
                      <Badge variant={link.isActive ? "default" : "secondary"}>
                        {link.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {`${window.location.origin}/pay/${link.token}`}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`${window.location.origin}/pay/${link.token}`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/pay/${link.token}`, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Créé le {new Date(link.createdAt).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Aucun lien de paiement</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
