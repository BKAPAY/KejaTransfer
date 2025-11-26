import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, Eye, EyeOff, Trash2, Key, AlertCircle, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ApiKey, User } from "@shared/schema";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Link } from "wouter";

const apiKeySchema = z.object({
  name: z.string().min(1, "Le nom de la cle est requis"),
  siteName: z.string().min(2, "Le nom du site est requis (min. 2 caracteres)"),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

export default function ApiPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const isKycVerified = user?.kycStatus === "verified";

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
      siteName: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) => {
      return await apiRequest("POST", "/api/api-keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Cle API creee",
        description: "Votre cle API a ete creee avec succes",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la creation de la cle",
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
        title: "Cle supprimee",
        description: "La cle API a ete supprimee",
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
      title: "Copie",
      description: `${label} copie dans le presse-papiers`,
    });
  };

  const maskKey = (key: string) => {
    return key.substring(0, 12) + "..." + key.substring(key.length - 8);
  };

  const onSubmit = (data: ApiKeyFormData) => {
    createMutation.mutate(data);
  };

  const getRedirectUrl = (publicKey: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api-pay/${publicKey}?amount=MONTANT&description=DESCRIPTION`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Cles API</h1>
          <p className="text-sm text-muted-foreground">
            Integrez BKApay dans votre application
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/documentation">
            <Button variant="outline" data-testid="button-view-documentation">
              <ExternalLink className="w-4 h-4 mr-2" />
              Documentation
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                data-testid="button-create-api-key"
                disabled={!isKycVerified}
                title={!isKycVerified ? "Vous devez verifier votre identite (KYC) pour creer une cle API" : undefined}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle cle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Creer une cle API</DialogTitle>
                <DialogDescription>
                  Creez une cle pour integrer les paiements dans votre site
                </DialogDescription>
              </DialogHeader>
              {!isKycVerified ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Vous devez verifier votre identite (KYC) avant de generer des cles API.
                  </AlertDescription>
                </Alert>
              ) : null}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la cle</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Production, Test..."
                            data-testid="input-key-name"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Un nom pour identifier cette cle
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de votre site</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: MaBoutique, MonService..."
                            data-testid="input-site-name"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Ce nom sera affiche aux clients: "Payer a [Nom du site]"
                        </FormDescription>
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
                      {createMutation.isPending ? "Creation..." : "Creer la cle"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                      Site: <span className="font-semibold text-foreground">{(apiKey as any).siteName || apiKey.name}</span>
                    </CardDescription>
                    <CardDescription className="text-xs">
                      Creee le {new Date(apiKey.createdAt).toLocaleDateString("fr-FR")}
                    </CardDescription>
                  </div>
                  <Key className="w-6 h-6 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium">Cle publique</label>
                    <Badge variant="outline" className="text-xs">Pour la redirection</Badge>
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
                      onClick={() => copyToClipboard(apiKey.publicKey, "Cle publique")}
                      data-testid={`button-copy-public-${apiKey.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium">URL de redirection</label>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <code className="flex-1 text-xs font-mono truncate text-primary">
                      {getRedirectUrl(apiKey.publicKey)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(getRedirectUrl(apiKey.publicKey), "URL de redirection")}
                      data-testid={`button-copy-url-${apiKey.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Remplacez MONTANT et DESCRIPTION par les valeurs reelles
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
                  Vous n'avez pas encore cree de cle API
                </p>
                <Button 
                  onClick={() => setDialogOpen(true)} 
                  data-testid="button-create-first"
                  disabled={!isKycVerified}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Creer votre premiere cle API
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
