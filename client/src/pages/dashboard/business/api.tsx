import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Eye, EyeOff, Trash2, Key, Webhook, RefreshCw, Check, X, Shield, Plus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BusinessToken, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

const tokenNameSchema = z.object({
  name: z.string().min(1, "Le nom du token est requis"),
});

type TokenNameFormData = z.infer<typeof tokenNameSchema>;

export default function BusinessApiPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [editingCallbackId, setEditingCallbackId] = useState<string | null>(null);
  const [callbackUrls, setCallbackUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: tokens, isLoading } = useQuery<BusinessToken[]>({
    queryKey: ["/api/business/tokens"],
  });

  const isKycVerified = user?.kycStatus === "verified";

  const form = useForm<TokenNameFormData>({
    resolver: zodResolver(tokenNameSchema),
    defaultValues: { name: "Token API" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TokenNameFormData) => {
      const res = await apiRequest("POST", "/api/business/tokens", { name: data.name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/tokens"] });
      toast({ title: "Token cree", description: "Votre token API a ete cree avec succes" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors de la creation", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/business/tokens/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/tokens"] });
      toast({ title: "Token supprime", description: "Le token API a ete supprime" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/business/tokens/${id}/regenerate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/tokens"] });
      toast({ title: "Token regenere", description: "Le token a ete regenere. Mettez a jour votre serveur." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/business/tokens/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/tokens"] });
      setEditingCallbackId(null);
      toast({ title: "Enregistre", description: "Les parametres ont ete mis a jour" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur", variant: "destructive" });
    },
  });

  const regenerateCallbackSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/business/tokens/${id}/regenerate-callback-secret`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/tokens"] });
      toast({ title: "Secret regenere", description: "Le secret de signature a ete regenere." });
    },
  });

  const toggleVisibility = (key: string) => {
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copie", description: `${label} copie dans le presse-papiers` });
  };

  const maskValue = (val: string) => {
    if (val.length <= 16) return val.substring(0, 8) + "...";
    return val.substring(0, 12) + "..." + val.substring(val.length - 8);
  };

  const onSubmit = (data: TokenNameFormData) => {
    if (!isKycVerified) {
      toast({
        title: "Verification requise",
        description: "Votre compte doit etre verifie avant de creer des tokens API.",
        variant: "destructive",
      });
      setDialogOpen(false);
      return;
    }
    createMutation.mutate(data);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-page-title">Token API Entreprise</h1>
          <p className="text-sm text-muted-foreground">
            Integrez les paiements Mobile Money directement via votre token unique
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-token">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Creer un token API</DialogTitle>
              <DialogDescription>
                Creez un token pour integrer les paiements payin/payout dans votre application
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du token</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Production, Test..."
                          data-testid="input-token-name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Un nom pour identifier ce token</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? "Creation..." : "Creer le token"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto pr-3">
        <div className="grid gap-6">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground" data-testid="text-loading">Chargement...</p>
              </CardContent>
            </Card>
          ) : tokens && tokens.length > 0 ? (
            tokens.map((token) => (
              <Card key={token.id} data-testid={`card-token-${token.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg" data-testid={`text-token-name-${token.id}`}>{token.name}</CardTitle>
                        <Badge variant={token.isActive ? "default" : "secondary"} data-testid={`badge-status-${token.id}`}>
                          {token.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Cree le {new Date(token.createdAt).toLocaleDateString("fr-FR")}
                      </CardDescription>
                    </div>
                    <Key className="w-6 h-6 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <label className="text-sm font-medium">Token API</label>
                      <Badge variant="outline" className="text-xs">bt_live_...</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Utilisez ce token dans le header <code className="bg-muted px-1 rounded">Authorization: Bearer bt_live_...</code> pour les appels payin et payout.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-xs break-all" data-testid={`text-token-value-${token.id}`}>
                        {visibleFields[`token-${token.id}`] ? token.token : maskValue(token.token)}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => toggleVisibility(`token-${token.id}`)} data-testid={`button-toggle-token-${token.id}`}>
                        {visibleFields[`token-${token.id}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(token.token, "Token API")} data-testid={`button-copy-token-${token.id}`}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Regenerer le token ? L'ancien token sera invalide.")) {
                            regenerateMutation.mutate(token.id);
                          }
                        }}
                        disabled={regenerateMutation.isPending}
                        title="Regenerer le token"
                        data-testid={`button-regenerate-token-${token.id}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <Alert className="mt-2 border-destructive/30 bg-destructive/5 py-2">
                      <AlertDescription className="text-destructive text-xs">
                        Ne partagez jamais ce token. Ne le mettez pas dans votre code frontend.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Webhook className="w-4 h-4 text-muted-foreground" />
                      <label className="text-sm font-medium">Webhook (Callback)</label>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Recevez les notifications payin et payout sur une seule URL. Configurez votre endpoint : <code className="bg-muted px-1 rounded">https://votre-site.com/api/webhook/bkapay</code>
                    </p>

                    {editingCallbackId === token.id ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="https://votre-site.com/api/webhook/bkapay"
                          value={callbackUrls[token.id] ?? token.callbackUrl ?? ""}
                          onChange={(e) => setCallbackUrls(prev => ({ ...prev, [token.id]: e.target.value }))}
                          data-testid={`input-callback-url-${token.id}`}
                        />
                        <p className="text-xs text-muted-foreground">L'URL doit utiliser HTTPS</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate({ id: token.id, data: { callbackUrl: callbackUrls[token.id] ?? token.callbackUrl ?? "" } })}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-callback-${token.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {updateMutation.isPending ? "..." : "Enregistrer"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCallbackId(null); setCallbackUrls(prev => { const c = { ...prev }; delete c[token.id]; return c; }); }} data-testid={`button-cancel-callback-${token.id}`}>
                            <X className="w-4 h-4 mr-1" /> Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {token.callbackUrl ? (
                          <>
                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                              <code className="flex-1 text-xs font-mono truncate text-green-700 dark:text-green-300" data-testid={`text-callback-url-${token.id}`}>{token.callbackUrl}</code>
                              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(token.callbackUrl!, "URL webhook")} data-testid={`button-copy-callback-${token.id}`}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            {token.callbackSecret && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Secret HMAC-SHA256</label>
                                <div className="flex items-center gap-2 p-2 bg-muted rounded-md mt-1">
                                  <code className="flex-1 text-xs font-mono truncate" data-testid={`text-callback-secret-${token.id}`}>
                                    {visibleFields[`secret-${token.id}`] ? token.callbackSecret : maskValue(token.callbackSecret)}
                                  </code>
                                  <Button variant="ghost" size="sm" onClick={() => toggleVisibility(`secret-${token.id}`)} data-testid={`button-toggle-secret-${token.id}`}>
                                    {visibleFields[`secret-${token.id}`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(token.callbackSecret!, "Secret webhook")} data-testid={`button-copy-secret-${token.id}`}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => regenerateCallbackSecretMutation.mutate(token.id)} disabled={regenerateCallbackSecretMutation.isPending} data-testid={`button-regenerate-secret-${token.id}`}>
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setCallbackUrls(prev => ({ ...prev, [token.id]: token.callbackUrl || "" })); setEditingCallbackId(token.id); }} data-testid={`button-edit-callback-${token.id}`}>Modifier</Button>
                              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer ce webhook ?")) updateMutation.mutate({ id: token.id, data: { callbackUrl: "" } }); }} disabled={updateMutation.isPending} data-testid={`button-remove-callback-${token.id}`}>Supprimer</Button>
                            </div>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setEditingCallbackId(token.id)} data-testid={`button-add-callback-${token.id}`}>
                            <Webhook className="w-4 h-4 mr-2" />
                            Configurer le webhook
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Supprimer ce token ? Cette action est irreversible.")) {
                          deleteMutation.mutate(token.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${token.id}`}
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
                  <p className="text-muted-foreground mb-4" data-testid="text-empty-state">
                    Vous n'avez pas encore cree de token API
                  </p>
                  <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Creer votre premier token API
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
