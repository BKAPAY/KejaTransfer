import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Key, Copy, Eye, EyeOff, Globe } from "lucide-react";
import type { ApiKey, BusinessToken, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function AdminUserApi() {
  const params = useParams<{ userId: string }>();
  const [location, setLocation] = useLocation();
  const userId = params.userId;
  const isBusinessContext = location.includes("/admin/business/");
  const backUrl = isBusinessContext ? "/dashboard/admin/business/management" : "/dashboard/management";
  const { toast } = useToast();
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const { data: user } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery<ApiKey[]>({
    queryKey: [`/api/admin/user/${userId}/api-keys`],
    enabled: !!userId && !isBusinessContext,
  });

  const { data: businessTokens, isLoading: tokensLoading } = useQuery<BusinessToken[]>({
    queryKey: [`/api/admin/business/users/${userId}/tokens`],
    enabled: !!userId && isBusinessContext,
  });

  const isLoading = isBusinessContext ? tokensLoading : apiKeysLoading;

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Copié", description: `${label} copié dans le presse-papiers` });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    if (!key) return "—";
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 6) + "••••••••" + key.substring(key.length - 4);
  };

  const KeyField = ({ label, value, id }: { label: string; value?: string | null; id: string }) => {
    if (!value) return (
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xs text-muted-foreground italic">Non configuré</p>
      </div>
    );
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
            {visibleKeys[id] ? value : maskKey(value)}
          </code>
          <Button size="icon" variant="outline" onClick={() => toggleKeyVisibility(id)} data-testid={`button-toggle-${id}`}>
            {visibleKeys[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="outline" onClick={() => copyToClipboard(value, label)} data-testid={`button-copy-${id}`}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
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
      <Button variant="ghost" onClick={() => setLocation(backUrl)} className="mb-6" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la gestion
      </Button>

      {isBusinessContext ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Tokens API de {user?.businessName || `${user?.firstName} ${user?.lastName}`} ({businessTokens?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {businessTokens && businessTokens.length > 0 ? (
              <div className="divide-y">
                {businessTokens.map((token) => (
                  <div key={token.id} className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{token.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Créé le {new Date(token.createdAt).toLocaleDateString("fr-FR", {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={token.isActive ? "default" : "secondary"}>
                          {token.isActive ? "Actif" : "Inactif"}
                        </Badge>
                        {token.customerPaysFee && (
                          <Badge variant="outline">Client paie les frais</Badge>
                        )}
                        {token.allowedCountries && token.allowedCountries.length > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {token.allowedCountries.join(", ")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <KeyField label="Token (Bearer)" value={token.token} id={`token-${token.id}`} />
                      <KeyField label="Secret Callback Payin" value={token.callbackSecret} id={`cb-secret-${token.id}`} />
                      <KeyField label="Secret Callback Payout" value={token.payoutCallbackSecret} id={`payout-secret-${token.id}`} />
                      {token.callbackUrl && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">URL Callback Payin</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{token.callbackUrl}</code>
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(token.callbackUrl!, "URL Callback")}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {token.payoutCallbackUrl && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">URL Callback Payout</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{token.payoutCallbackUrl}</code>
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(token.payoutCallbackUrl!, "URL Callback Payout")}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucun token API configuré</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Clés API de {user?.firstName} {user?.lastName} ({apiKeys?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apiKeys && apiKeys.length > 0 ? (
              <div className="divide-y">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{apiKey.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Créé le {new Date(apiKey.createdAt).toLocaleDateString("fr-FR", {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge variant={apiKey.isActive ? "default" : "secondary"}>
                        {apiKey.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Clé publique</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{apiKey.publicKey}</code>
                          <Button size="icon" variant="outline" onClick={() => copyToClipboard(apiKey.publicKey, "Clé publique")}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <KeyField label="Clé privée payin (sessions)" value={(apiKey as any).payinPrivateKey} id={`payin-${apiKey.id}`} />
                      <KeyField label="Clé privée payout" value={apiKey.privateKey} id={`payout-${apiKey.id}`} />
                      {apiKey.callbackUrl && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">URL Callback</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{apiKey.callbackUrl}</code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucune clé API</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
