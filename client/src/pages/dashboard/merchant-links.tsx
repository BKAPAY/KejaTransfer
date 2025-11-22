import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, ExternalLink, Trash2, Store } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MerchantLink } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const merchantLinkSchema = z.object({
  merchantName: z.string()
    .min(3, "Le nom marchand doit contenir au minimum 3 caractères")
    .max(10, "Le nom marchand doit contenir au maximum 10 caractères")
    .regex(/^[A-Z]+$/, "Le nom marchand doit contenir uniquement des lettres majuscules"),
});

type MerchantLinkFormData = z.infer<typeof merchantLinkSchema>;

export default function MerchantLinks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: merchantLinks, isLoading } = useQuery<MerchantLink[]>({
    queryKey: ["/api/merchant-links"],
  });

  const form = useForm<MerchantLinkFormData>({
    resolver: zodResolver(merchantLinkSchema),
    defaultValues: {
      merchantName: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MerchantLinkFormData) => {
      return await apiRequest("POST", "/api/merchant-links", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-links"] });
      toast({
        title: "Lien marchand créé",
        description: "Votre lien marchand a été créé avec succès",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création du lien",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/merchant-links/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-links"] });
      toast({
        title: "Lien supprimé",
        description: "Le lien marchand a été supprimé",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/merchant/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copié",
      description: "Le lien a été copié dans le presse-papiers",
    });
  };

  const onSubmit = (data: MerchantLinkFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Lien marchand</h1>
          <p className="text-muted-foreground">
            Vous pouvez créer un seul lien marchand où vos clients choisissent le montant à payer
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              data-testid="button-create-merchant-link"
              disabled={merchantLinks && merchantLinks.length > 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              {merchantLinks && merchantLinks.length > 0 ? "Lien créé" : "Créer mon lien"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un lien marchand</DialogTitle>
              <DialogDescription>
                Vos clients pourront entrer le montant qu'ils souhaitent payer
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="merchantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du marchand</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: BOUTIQUE (3-10 majuscules)"
                          data-testid="input-merchant-name"
                          value={field.value || ""}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            field.onChange(val);
                          }}
                          maxLength={10}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-1">3-10 lettres majuscules. Unique et immuable.</p>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending ? "Création..." : "Créer le lien"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Merchant Links List */}
      <div className="grid gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Chargement...</p>
            </CardContent>
          </Card>
        ) : merchantLinks && merchantLinks.length > 0 ? (
          merchantLinks.map((link) => (
            <Card key={link.id} data-testid={`merchant-link-${link.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{link.merchantName}</CardTitle>
                      <Badge variant={link.isActive ? "default" : "secondary"}>
                        {link.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">
                      Créé le {new Date(link.createdAt).toLocaleDateString("fr-FR")}
                    </CardDescription>
                  </div>
                  <Store className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <code className="flex-1 text-sm truncate">
                      {window.location.origin}/merchant/{link.token}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(link.token)}
                      data-testid={`button-copy-${link.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid={`button-open-${link.id}`}
                    >
                      <a href={`/merchant/${link.token}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
                    Ce lien marchand a été créé une seule fois et ne peut pas être modifié ni supprimé.
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Store className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Vous n'avez pas encore créé de lien marchand
                </p>
                <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer mon lien marchand
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
