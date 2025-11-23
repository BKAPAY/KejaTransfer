import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, Eye, EyeOff, Trash2, Key } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ApiKey } from "@shared/schema";
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

const apiKeySchema = z.object({
  name: z.string().min(1, "Le nom de la clé API est requis"),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

export default function ApiPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [selectedKeyForExample, setSelectedKeyForExample] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) => {
      return await apiRequest("POST", "/api/api-keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Clé API créée",
        description: "Votre clé API a été créée avec succès",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de la clé",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/api-keys/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Clé supprimée",
        description: "La clé API a été supprimée",
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

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: `${label} copié dans le presse-papiers`,
    });
  };

  const maskKey = (key: string) => {
    return key.substring(0, 12) + "..." + key.substring(key.length - 8);
  };

  const onSubmit = (data: ApiKeyFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Information Panel */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Comment utiliser vos clés API?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">🔑 Clé Publique (pk_live_xxxxx)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              À utiliser dans votre frontend ou applications publiques. Utilisez-la pour créer des paiements:
            </p>
            <code className="text-xs bg-background p-2 rounded block overflow-x-auto mb-2">
              {`fetch('https://bkapay.app/api/payments/create', {
  method: 'POST',
  body: JSON.stringify({
    publicKey: 'pk_live_xxxxx',
    amount: 50000,
    customerName: 'Jean',
    ...
  })
})`}
            </code>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">🔒 Clé Privée (sk_live_xxxxx)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              À utiliser UNIQUEMENT dans votre backend. Jamais dans le frontend!
            </p>
            <code className="text-xs bg-background p-2 rounded block overflow-x-auto">
              {`Authorization: Bearer sk_live_xxxxx
X-API-Key: sk_live_xxxxx`}
            </code>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Clés API</h1>
          <p className="text-sm text-muted-foreground">
            Intégrez BKApay dans votre app
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-api-key">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle clé API
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une clé API</DialogTitle>
              <DialogDescription>
                Créez une nouvelle clé pour intégrer les paiements dans votre application
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la clé</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Mon site web"
                          data-testid="input-key-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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
                    {createMutation.isPending ? "Création..." : "Créer la clé"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Keys List - Scrollable Container */}
      <div className="flex-1 overflow-y-auto pr-3">
        <div className="grid gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Chargement...</p>
            </CardContent>
          </Card>
        ) : apiKeys && apiKeys.length > 0 ? (
          apiKeys.map((apiKey) => (
            <Card key={apiKey.id} data-testid={`api-key-${apiKey.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                      <Badge variant={apiKey.isActive ? "default" : "secondary"}>
                        {apiKey.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">
                      Créée le {new Date(apiKey.createdAt).toLocaleDateString("fr-FR")}
                    </CardDescription>
                  </div>
                  <Key className="w-6 h-6 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Public Key */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium">Clé publique (Frontend)</label>
                    <Badge variant="outline" className="text-xs">Public</Badge>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <code className="flex-1 text-sm font-mono truncate">
                      {visibleKeys[apiKey.id + '-public'] ? apiKey.publicKey : maskKey(apiKey.publicKey)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleKeyVisibility(apiKey.id + '-public')}
                      data-testid={`button-toggle-public-${apiKey.id}`}
                    >
                      {visibleKeys[apiKey.id + '-public'] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(apiKey.publicKey, "Clé publique")}
                      data-testid={`button-copy-public-${apiKey.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pour les paiements côté client: fetch('/api/payments/create', {'{publicKey: ..}'})
                  </p>
                </div>

                {/* Private Key */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium">Clé privée (Backend)</label>
                    <Badge variant="destructive" className="text-xs">Secret</Badge>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <code className="flex-1 text-sm font-mono truncate">
                      {visibleKeys[apiKey.id + '-private'] ? apiKey.privateKey : maskKey(apiKey.privateKey)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleKeyVisibility(apiKey.id + '-private')}
                      data-testid={`button-toggle-private-${apiKey.id}`}
                    >
                      {visibleKeys[apiKey.id + '-private'] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(apiKey.privateKey, "Clé privée")}
                      data-testid={`button-copy-private-${apiKey.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pour le backend: Authorization: Bearer sk_... Gardez cette clé secrète!
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(apiKey.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${apiKey.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Vous n'avez pas encore créé de clé API
                </p>
                <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer votre première clé API
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
