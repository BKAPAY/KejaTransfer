import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Store, Copy, ExternalLink, Pencil } from "lucide-react";
import type { MerchantLink, User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminUserMerchant() {
  const params = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const userId = params.userId;
  const { toast } = useToast();

  const [editingLink, setEditingLink] = useState<MerchantLink | null>(null);
  const [newName, setNewName] = useState("");

  const { data: user } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const { data: links, isLoading } = useQuery<MerchantLink[]>({
    queryKey: [`/api/admin/user/${userId}/merchant-links`],
    enabled: !!userId,
  });

  const userCurrency = user?.country
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const renameMutation = useMutation({
    mutationFn: async ({ linkId, merchantName }: { linkId: string; merchantName: string }) => {
      return apiRequest("PATCH", `/api/admin/user/${userId}/merchant-links/${linkId}`, { merchantName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user/${userId}/merchant-links`] });
      toast({
        title: "Nom mis à jour",
        description: "Le nom marchand a été modifié avec succès.",
      });
      setEditingLink(null);
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de modifier le nom marchand.",
        variant: "destructive",
      });
    },
  });

  const openEdit = (link: MerchantLink) => {
    setEditingLink(link);
    setNewName(link.merchantName);
  };

  const handleRename = () => {
    if (!editingLink || !newName.trim()) return;
    renameMutation.mutate({ linkId: editingLink.id, merchantName: newName.trim() });
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
      <Button
        variant="ghost"
        onClick={() => setLocation("/dashboard/management")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la gestion
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Liens marchands de {user?.firstName} {user?.lastName} ({links?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links && links.length > 0 ? (
            <div className="divide-y">
              {links.map((link) => (
                <div key={link.id} className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{link.merchantName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={link.isActive ? "default" : "secondary"}>
                        {link.isActive ? "Actif" : "Inactif"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(link)}
                        data-testid={`button-edit-merchant-${link.id}`}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Renommer
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {`${window.location.origin}/merchant/${link.token}`}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`${window.location.origin}/merchant/${link.token}`)}
                      data-testid={`button-copy-${link.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/merchant/${link.token}`, "_blank")}
                      data-testid={`button-open-${link.id}`}
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
            <p className="text-center py-8 text-muted-foreground">Aucun lien marchand</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingLink} onOpenChange={(open) => { if (!open) setEditingLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le nom marchand</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="merchant-name-input">Nouveau nom marchand</Label>
              <Input
                id="merchant-name-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex : Boutique Keja, Restaurant Chez Ali..."
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                data-testid="input-merchant-name"
              />
              <p className="text-xs text-muted-foreground">
                Ce nom sera mis à jour partout où il apparaît (page de paiement, historique, affiches QR).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLink(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameMutation.isPending || !newName.trim() || newName.trim() === editingLink?.merchantName}
              data-testid="button-confirm-rename"
            >
              {renameMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
