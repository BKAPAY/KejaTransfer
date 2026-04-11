import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, Eye, EyeOff, Trash2, Key, AlertCircle, ExternalLink, Webhook, RefreshCw, Check, X, Settings, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ApiKey, User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { CountryFlag } from "@/components/country-flag";
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
  const [editingCallback, setEditingCallback] = useState<string | null>(null);
  const [callbackUrls, setCallbackUrls] = useState<Record<string, string>>({});
  const [editingPayoutCallback, setEditingPayoutCallback] = useState<string | null>(null);
  const [payoutCallbackUrls, setPayoutCallbackUrls] = useState<Record<string, string>>({});
  const [editingSettings, setEditingSettings] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<Record<string, { allowedCountries: string[]; customerPaysFee: boolean; customerPaysCryptoFee: boolean }>>({});
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const { data: enabledCountriesOperators } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/deposits"],
  });

  const activeCountries = enabledCountriesOperators 
    ? COUNTRIES.filter(c => Object.keys(enabledCountriesOperators).includes(c.code))
    : COUNTRIES;

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

  const callbackMutation = useMutation({
    mutationFn: async ({ id, callbackUrl }: { id: string; callbackUrl: string }) => {
      const res = await apiRequest("PATCH", `/api/api-keys/${id}/callback`, { callbackUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setEditingCallback(null);
      toast({
        title: "Callback configure",
        description: "L'URL de callback a ete configuree avec succes",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la configuration du callback",
        variant: "destructive",
      });
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/api-keys/${id}/regenerate-secret`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Secret regenere",
        description: "Le secret de signature payin a ete regenere. Mettez a jour votre serveur.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la regeneration",
        variant: "destructive",
      });
    },
  });

  const payoutCallbackMutation = useMutation({
    mutationFn: async ({ id, payoutCallbackUrl }: { id: string; payoutCallbackUrl: string }) => {
      const res = await apiRequest("PATCH", `/api/api-keys/${id}/payout-callback`, { payoutCallbackUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setEditingPayoutCallback(null);
      toast({
        title: "Webhook payout configure",
        description: "L'URL de webhook payout a ete configuree avec succes",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la configuration du webhook payout",
        variant: "destructive",
      });
    },
  });

  const regeneratePayoutSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/api-keys/${id}/regenerate-payout-secret`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Secret payout regenere",
        description: "Le secret de signature payout a ete regenere. Mettez a jour votre serveur.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la regeneration",
        variant: "destructive",
      });
    },
  });

  const regeneratePayinKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/api-keys/${id}/regenerate-payin-key`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Cle payin regeneree",
        description: "La cle privee payin a ete regeneree. Mettez a jour votre serveur.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la regeneration",
        variant: "destructive",
      });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async ({ id, allowedCountries, customerPaysFee, customerPaysCryptoFee }: { id: string; allowedCountries: string[]; customerPaysFee: boolean; customerPaysCryptoFee: boolean }) => {
      const res = await apiRequest("PATCH", `/api/api-keys/${id}/settings`, { allowedCountries, customerPaysFee, customerPaysCryptoFee });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setEditingSettings(null);
      toast({
        title: "Parametres enregistres",
        description: "Les options de paiement ont ete mises a jour",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la sauvegarde",
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
    if (!isKycVerified) {
      toast({
        title: "Verification requise",
        description: "Rendez-vous dans la section Verification KYC pour verifier votre compte et acceder a toutes les fonctionnalites.",
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
          <h1 className="text-2xl font-bold text-foreground mb-1">Cles API</h1>
          <p className="text-sm text-muted-foreground">
            Integrez BKApay dans votre application
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://bkapay.com/docs" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" data-testid="button-view-documentation">
              <ExternalLink className="w-4 h-4 mr-2" />
              Documentation
            </Button>
          </a>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                data-testid="button-create-api-key"
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
                    <label className="text-sm font-medium">Cle privee payin</label>
                    <Badge variant="outline" className="text-xs">Sessions de paiement API</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Utilisez cette cle dans votre serveur pour creer des sessions de paiement via <code className="bg-muted px-1 rounded">POST /api/v1/payment-sessions</code>.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                      {(apiKey as any).payinPrivateKey
                        ? (visibleKeys[apiKey.id + '-payin']
                          ? (apiKey as any).payinPrivateKey
                          : maskKey((apiKey as any).payinPrivateKey))
                        : "—"}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleKeyVisibility(apiKey.id + '-payin')}
                      data-testid={`button-toggle-payin-${apiKey.id}`}
                    >
                      {visibleKeys[apiKey.id + '-payin'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard((apiKey as any).payinPrivateKey || "", "Cle privee payin")}
                      data-testid={`button-copy-payin-${apiKey.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Regenerer la cle privee payin ? L'ancienne cle sera invalidee.")) {
                          regeneratePayinKeyMutation.mutate(apiKey.id);
                        }
                      }}
                      disabled={regeneratePayinKeyMutation.isPending}
                      title="Regenerer la cle privee payin"
                      data-testid={`button-regenerate-payin-${apiKey.id}`}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <Alert className="mt-2 border-destructive/30 bg-destructive/5 py-2">
                    <AlertDescription className="text-destructive text-xs">
                      Ne partagez jamais cette cle. Ne la mettez pas dans votre code frontend (JavaScript navigateur).
                    </AlertDescription>
                  </Alert>
                </div>

                <Separator className="my-4" />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Webhook className="w-4 h-4 text-muted-foreground" />
                    <label className="text-sm font-medium">URL de Callback (Webhook)</label>
                    <Badge variant="outline" className="text-xs">Abonnements</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Recevez une notification automatique quand un paiement est complete. Ideal pour activer automatiquement les abonnements.
                  </p>
                  
                  {editingCallback === apiKey.id ? (
                    <div className="space-y-3">
                      <Input
                        placeholder="https://votre-site.com/api/webhook/bkapay"
                        value={callbackUrls[apiKey.id] ?? (apiKey as any).callbackUrl ?? ""}
                        onChange={(e) => setCallbackUrls(prev => ({ ...prev, [apiKey.id]: e.target.value }))}
                        data-testid={`input-callback-url-${apiKey.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        L'URL doit utiliser HTTPS pour la securite
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            const url = callbackUrls[apiKey.id] ?? (apiKey as any).callbackUrl ?? "";
                            callbackMutation.mutate({ id: apiKey.id, callbackUrl: url });
                          }}
                          disabled={callbackMutation.isPending}
                          data-testid={`button-save-callback-${apiKey.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {callbackMutation.isPending ? "..." : "Enregistrer"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCallback(null);
                            setCallbackUrls(prev => {
                              const copy = { ...prev };
                              delete copy[apiKey.id];
                              return copy;
                            });
                          }}
                          data-testid={`button-cancel-callback-${apiKey.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(apiKey as any).callbackSecret && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <label className="text-xs font-medium text-muted-foreground">Secret de signature payin (HMAC-SHA256)</label>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <code className="flex-1 text-xs font-mono truncate">
                              {visibleKeys[apiKey.id + '-secret']
                                ? (apiKey as any).callbackSecret
                                : maskKey((apiKey as any).callbackSecret)}
                            </code>
                            <Button variant="ghost" size="sm" onClick={() => toggleKeyVisibility(apiKey.id + '-secret')} data-testid={`button-toggle-secret-${apiKey.id}`}>
                              {visibleKeys[apiKey.id + '-secret'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard((apiKey as any).callbackSecret, "Secret payin")} data-testid={`button-copy-secret-${apiKey.id}`}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => regenerateSecretMutation.mutate(apiKey.id)} disabled={regenerateSecretMutation.isPending} title="Regenerer le secret payin" data-testid={`button-regenerate-secret-${apiKey.id}`}>
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {(apiKey as any).callbackUrl ? (
                        <>
                          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                            <code className="flex-1 text-xs font-mono truncate text-green-700 dark:text-green-300">
                              {(apiKey as any).callbackUrl}
                            </code>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard((apiKey as any).callbackUrl, "URL de callback")} data-testid={`button-copy-callback-${apiKey.id}`}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setCallbackUrls(prev => ({ ...prev, [apiKey.id]: (apiKey as any).callbackUrl || "" })); setEditingCallback(apiKey.id); }} data-testid={`button-edit-callback-${apiKey.id}`}>
                              Modifier l'URL
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer cette URL de callback ?")) { callbackMutation.mutate({ id: apiKey.id, callbackUrl: "" }); } }} disabled={callbackMutation.isPending} data-testid={`button-remove-callback-${apiKey.id}`}>
                              Supprimer
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setEditingCallback(apiKey.id)} data-testid={`button-add-callback-${apiKey.id}`}>
                          <Webhook className="w-4 h-4 mr-2" />
                          Configurer l'URL de callback
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <label className="text-sm font-medium">Options de paiement</label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Configurez les pays visibles et qui paie les frais de transaction.
                  </p>
                  
                  {editingSettings === apiKey.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Pays visibles pour les paiements
                        </label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Selectionnez les pays que vos clients peuvent utiliser. Si aucun n'est selectionne, tous les pays seront visibles.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {activeCountries.map((country) => {
                            const currentData = settingsData[apiKey.id];
                            const isChecked = currentData?.allowedCountries?.includes(country.code) || false;
                            return (
                              <div key={country.code} className="flex items-center gap-2">
                                <Checkbox
                                  id={`country-${apiKey.id}-${country.code}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    setSettingsData(prev => {
                                      const current = prev[apiKey.id] || { allowedCountries: [], customerPaysFee: false };
                                      const newAllowed = checked
                                        ? [...current.allowedCountries, country.code]
                                        : current.allowedCountries.filter(c => c !== country.code);
                                      return { ...prev, [apiKey.id]: { ...current, allowedCountries: newAllowed } };
                                    });
                                  }}
                                  data-testid={`checkbox-country-${apiKey.id}-${country.code}`}
                                />
                                <label 
                                  htmlFor={`country-${apiKey.id}-${country.code}`}
                                  className="text-sm cursor-pointer flex items-center gap-1"
                                >
                                  <CountryFlag code={country.code} size="xs" />
                                  <span>{country.name}</span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <label className="text-sm font-medium">Frais Mobile Money a la charge du client</label>
                          <p className="text-xs text-muted-foreground">
                            Si active, les frais Mobile Money seront ajoutes au montant paye par le client
                          </p>
                        </div>
                        <Switch
                          checked={settingsData[apiKey.id]?.customerPaysFee || false}
                          onCheckedChange={(checked) => {
                            setSettingsData(prev => {
                              const current = prev[apiKey.id] || { allowedCountries: [], customerPaysFee: false, customerPaysCryptoFee: false };
                              return { ...prev, [apiKey.id]: { ...current, customerPaysFee: checked } };
                            });
                          }}
                          data-testid={`switch-fee-${apiKey.id}`}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <label className="text-sm font-medium">Frais Crypto a la charge du client</label>
                          <p className="text-xs text-muted-foreground">
                            Si active, les frais crypto seront ajoutes au montant paye par le client
                          </p>
                        </div>
                        <Switch
                          checked={settingsData[apiKey.id]?.customerPaysCryptoFee || false}
                          onCheckedChange={(checked) => {
                            setSettingsData(prev => {
                              const current = prev[apiKey.id] || { allowedCountries: [], customerPaysFee: false, customerPaysCryptoFee: false };
                              return { ...prev, [apiKey.id]: { ...current, customerPaysCryptoFee: checked } };
                            });
                          }}
                          data-testid={`switch-crypto-fee-${apiKey.id}`}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            const data = settingsData[apiKey.id];
                            settingsMutation.mutate({
                              id: apiKey.id,
                              allowedCountries: data?.allowedCountries || [],
                              customerPaysFee: data?.customerPaysFee || false,
                              customerPaysCryptoFee: data?.customerPaysCryptoFee || false,
                            });
                          }}
                          disabled={settingsMutation.isPending}
                          data-testid={`button-save-settings-${apiKey.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {settingsMutation.isPending ? "..." : "Enregistrer"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSettings(null);
                            setSettingsData(prev => {
                              const copy = { ...prev };
                              delete copy[apiKey.id];
                              return copy;
                            });
                          }}
                          data-testid={`button-cancel-settings-${apiKey.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pays supportes: </span>
                          {(apiKey as any).allowedCountries?.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(apiKey as any).allowedCountries.map((code: string) => {
                                const country = COUNTRIES.find(c => c.code === code);
                                return (
                                  <Badge key={code} variant="secondary" className="text-xs">
                                    <span className="flex items-center gap-1"><CountryFlag code={code} size="xs" />{country?.name || code}</span>
                                  </Badge>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="font-medium">Tous les pays</span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Frais Mobile Money: </span>
                          <Badge variant={(apiKey as any).customerPaysFee ? "default" : "outline"} className="text-xs">
                            {(apiKey as any).customerPaysFee ? "Client" : "A votre charge"}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Frais Crypto: </span>
                          <Badge variant={(apiKey as any).customerPaysCryptoFee ? "default" : "outline"} className="text-xs">
                            {(apiKey as any).customerPaysCryptoFee ? "Client" : "A votre charge"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSettingsData(prev => ({
                            ...prev,
                            [apiKey.id]: {
                              allowedCountries: (apiKey as any).allowedCountries || [],
                              customerPaysFee: (apiKey as any).customerPaysFee || false,
                              customerPaysCryptoFee: (apiKey as any).customerPaysCryptoFee || false,
                            }
                          }));
                          setEditingSettings(apiKey.id);
                        }}
                        data-testid={`button-edit-settings-${apiKey.id}`}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configurer
                      </Button>
                    </div>
                  )}
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
