import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";
import { Copy, Eye, EyeOff, Send, Plus, Trash2, RefreshCw, Check, X, Key, Webhook, Info, AlertTriangle, Lock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ApiKey, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const apiKeySchema = z.object({
  name: z.string().min(1, "Le nom de la cle est requis"),
  siteName: z.string().min(2, "Le nom du site est requis (min. 2 caracteres)"),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

export default function ApiPayoutPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [editingCallback, setEditingCallback] = useState<string | null>(null);
  const [callbackUrls, setCallbackUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const u = query.state.data as User | undefined;
      return u?.payoutApiEnabled ? false : 8000;
    },
  });

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const isKycVerified = user?.kycStatus === "verified";
  const isPayoutActivated = user?.payoutApiEnabled === true;

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { name: "", siteName: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) => {
      return await apiRequest("POST", "/api/api-keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Cle API creee", description: "Votre cle privee payout a ete creee avec succes." });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors de la creation", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/api-keys/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Cle supprimee" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const callbackMutation = useMutation({
    mutationFn: async ({ id, payoutCallbackUrl }: { id: string; payoutCallbackUrl: string }) => {
      const res = await apiRequest("PATCH", `/api/api-keys/${id}/payout-callback`, { payoutCallbackUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setEditingCallback(null);
      toast({ title: "Webhook configure", description: "L'URL de webhook payout a ete enregistree." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur", variant: "destructive" });
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/api-keys/${id}/regenerate-payout-secret`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Secret regenere", description: "Mettez a jour votre serveur avec le nouveau secret payout." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur", variant: "destructive" });
    },
  });

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copie", description: `${label} copie dans le presse-papiers` });
  };

  const maskKey = (key: string) => key ? key.substring(0, 12) + "..." + key.substring(key.length - 8) : "";

  const onSubmit = (data: ApiKeyFormData) => {
    if (!isKycVerified) {
      toast({
        title: "Verification requise",
        description: "Rendez-vous dans la section Verification KYC pour verifier votre compte.",
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
          <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-payout-api-title">
            API Payout
          </h1>
          <p className="text-sm text-muted-foreground">
            Generez votre cle privee pour envoyer des paiements mobile money via API
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-payout-key">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle cle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Creer une cle API Payout</DialogTitle>
              <DialogDescription>
                Cette cle privee vous permettra d'initier des paiements sortants via l'API
              </DialogDescription>
            </DialogHeader>
            {!isKycVerified ? (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  Votre compte doit etre verifie (KYC) avant de pouvoir generer une cle API.
                  Rendez-vous dans la section <strong>Verification KYC</strong>.
                </AlertDescription>
              </Alert>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la cle</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Production, Test..." data-testid="input-key-name" {...field} />
                        </FormControl>
                        <FormDescription>Un nom pour identifier cette cle</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de votre application</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: MonApp, MonService..." data-testid="input-site-name" {...field} />
                        </FormControl>
                        <FormDescription>Le nom de votre application ou service</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-create-key">
                    {createMutation.isPending ? "Creation..." : "Creer la cle"}
                  </Button>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Note informationnelle sur l'activation */}
      {!isPayoutActivated && (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Information :</strong> Vous pouvez generer votre cle maintenant. L'activation du Payout API
            se fait par le support BKApay. Une fois que vous integrerez la cle sur votre site, les appels API
            fonctionneront automatiquement des que votre acces sera active.
          </AlertDescription>
        </Alert>
      )}

      {/* Liste des cles */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-20 bg-muted animate-pulse rounded-md" /></CardContent></Card>
          ))}
        </div>
      ) : !apiKeys || apiKeys.length === 0 ? (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucune cle API</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Creez votre premiere cle privee pour commencer a integrer l'API Payout dans votre application.
            </p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first-key">
              <Plus className="w-4 h-4 mr-2" />
              Creer ma premiere cle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id} data-testid={`card-api-key-${apiKey.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      {apiKey.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">{(apiKey as any).siteName}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPayoutActivated ? (
                      <Badge variant="default" className="text-xs gap-1">
                        <Lock className="w-3 h-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">En attente d'activation</Badge>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-key-${apiKey.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette clé API payout ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible. Les intégrations utilisant cette clé cesseront de fonctionner.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(apiKey.id)}>Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Cle privee */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Cle privee — <span className="text-foreground">A utiliser dans Authorization: Bearer ...</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                      {visibleKeys[apiKey.id + "-private"]
                        ? (apiKey.privateKey || "—")
                        : maskKey(apiKey.privateKey || "")}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => toggleKeyVisibility(apiKey.id + "-private")} data-testid={`button-toggle-secret-${apiKey.id}`}>
                      {visibleKeys[apiKey.id + "-private"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(apiKey.privateKey || "", "Cle privee")} data-testid={`button-copy-secret-${apiKey.id}`}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <Alert className="mt-2 border-destructive/30 bg-destructive/5 py-2">
                    <AlertDescription className="text-destructive text-xs">
                      Ne partagez jamais cette cle. Ne la mettez pas dans votre code frontend (JavaScript navigateur).
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Webhook Payout */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Webhook className="w-4 h-4 text-muted-foreground" />
                    <label className="text-xs font-medium text-muted-foreground">
                      URL Webhook Payout (notifications de statut)
                    </label>
                  </div>

                  {(apiKey as any).payoutCallbackSecret && (
                    <div className="mb-3">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Secret de signature (HMAC-SHA256)
                      </label>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <code className="flex-1 text-xs font-mono truncate">
                          {visibleKeys[apiKey.id + "-sig"]
                            ? (apiKey as any).payoutCallbackSecret
                            : maskKey((apiKey as any).payoutCallbackSecret)}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => toggleKeyVisibility(apiKey.id + "-sig")} data-testid={`button-toggle-sig-${apiKey.id}`}>
                          {visibleKeys[apiKey.id + "-sig"] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard((apiKey as any).payoutCallbackSecret, "Secret payout")} data-testid={`button-copy-sig-${apiKey.id}`}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => regenerateSecretMutation.mutate(apiKey.id)} disabled={regenerateSecretMutation.isPending} title="Regenerer le secret payout" data-testid={`button-regenerate-sig-${apiKey.id}`}>
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {(editingCallback === apiKey.id || !(apiKey as any).payoutCallbackUrl) ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="https://votre-site.com/api/webhook/bkapay-payout"
                        value={callbackUrls[apiKey.id] ?? (apiKey as any).payoutCallbackUrl ?? ""}
                        onChange={(e) => setCallbackUrls((prev) => ({ ...prev, [apiKey.id]: e.target.value }))}
                        className="text-sm font-mono"
                        data-testid={`input-callback-${apiKey.id}`}
                      />
                      <p className="text-xs text-muted-foreground">L'URL doit utiliser HTTPS</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => callbackMutation.mutate({ id: apiKey.id, payoutCallbackUrl: callbackUrls[apiKey.id] ?? (apiKey as any).payoutCallbackUrl ?? "" })} disabled={callbackMutation.isPending} data-testid={`button-save-callback-${apiKey.id}`}>
                          <Check className="w-4 h-4 mr-1" />
                          {callbackMutation.isPending ? "..." : "Enregistrer"}
                        </Button>
                        {editingCallback === apiKey.id && (
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCallback(null); setCallbackUrls((prev) => { const c = { ...prev }; delete c[apiKey.id]; return c; }); }} data-testid={`button-cancel-callback-${apiKey.id}`}>
                            <X className="w-4 h-4 mr-1" /> Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                        <code className="flex-1 text-xs font-mono truncate text-green-700 dark:text-green-300">
                          {(apiKey as any).payoutCallbackUrl}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard((apiKey as any).payoutCallbackUrl, "URL webhook payout")} data-testid={`button-copy-callback-${apiKey.id}`}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setCallbackUrls((prev) => ({ ...prev, [apiKey.id]: (apiKey as any).payoutCallbackUrl || "" })); setEditingCallback(apiKey.id); }} data-testid={`button-edit-callback-${apiKey.id}`}>
                          Modifier
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer ce webhook ?")) callbackMutation.mutate({ id: apiKey.id, payoutCallbackUrl: "" }); }} disabled={callbackMutation.isPending} data-testid={`button-remove-callback-${apiKey.id}`}>
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
