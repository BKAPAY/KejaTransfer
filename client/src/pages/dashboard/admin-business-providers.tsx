import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Key, Shield, Eye, EyeOff, Save, Check, AlertCircle, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

interface ProviderConfig {
  id: string;
  provider: string;
  isActive: boolean;
  apiKey: string | null;
  secretKey: string | null;
  publicKey: string | null;
  masterKey: string | null;
  token: string | null;
  ipnSecret: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderForm {
  apiKey: string;
  secretKey: string;
  publicKey: string;
  masterKey: string;
  token: string;
  ipnSecret: string;
}

const PROVIDER_INFO: Record<string, { name: string; description: string; color: string; fields: string[]; countries: string }> = {
  afribapay: {
    name: "AfribaPay",
    description: "Fournisseur principal couvrant 14 pays africains (Business)",
    color: "bg-purple-500",
    fields: ["publicKey", "apiKey", "secretKey", "masterKey"],
    countries: "14 pays (CI, BF, ML, SN, TG, GN, CM, BJ, CD, NE, TD, CG, CF, GA)",
  },
  pawapay: {
    name: "PawaPay",
    description: "Agregateur mobile money pan-africain (Business)",
    color: "bg-yellow-500",
    fields: ["apiKey", "secretKey"],
    countries: "19 pays (BJ, BF, CM, CG, CD, CI, GA, GH, KE, LS, MW, MZ, NG, RW, SN, SL, TZ, UG, ZM)",
  },
  paydunya: {
    name: "Paydunya",
    description: "Solution de paiement mobile pour l'Afrique (Business)",
    color: "bg-blue-500",
    fields: ["masterKey", "publicKey", "secretKey", "token"],
    countries: "6 pays (Benin, Togo, CI, Senegal, BF, Mali)",
  },
  fedapay: {
    name: "FedaPay",
    description: "Plateforme de paiement pour l'Afrique francophone (Business)",
    color: "bg-green-500",
    fields: ["secretKey"],
    countries: "7 pays (Benin, Togo, CI, Senegal, Guinee, Niger, BF)",
  },
  mbiyopay: {
    name: "MbiyoPay",
    description: "Passerelle de paiement pour 11 pays africains (Business)",
    color: "bg-teal-500",
    fields: ["apiKey", "publicKey"],
    countries: "11 pays (Benin, BF, CI, Senegal, Togo, Mali, Guinee, Cameroun, Congo, RDC, Gambie)",
  },
  moneyfusion: {
    name: "MoneyFusion",
    description: "Passerelle de paiement sortant (retraits/transferts) pour 24 pays africains (Business)",
    color: "bg-rose-500",
    fields: ["apiKey"],
    countries: "24 pays (CI, SN, BF, BJ, TG, ML, CM, CD, GA, GN, GM, GH, etc.)",
  },
};

const getFieldLabel = (provider: string, field: string): string => {
  if (provider === "afribapay") {
    switch (field) {
      case "publicKey": return "Utilisateur API (pk_...)";
      case "apiKey": return "Cle Secrete API (sk_...)";
      case "secretKey": return "Cle Marchand (mk_...)";
      case "masterKey": return "Identifiant Agent (APM...)";
      default: return field;
    }
  }
  if (provider === "paydunya") {
    switch (field) {
      case "masterKey": return "Cle Principale";
      case "publicKey": return "Cle Publique";
      case "secretKey": return "Cle Privee";
      case "token": return "Token";
      default: return field;
    }
  }
  if (provider === "fedapay") {
    if (field === "secretKey") return "Cle Secrete (sk_live_xxx ou sk_sandbox_xxx)";
  }
  if (provider === "mbiyopay") {
    if (field === "apiKey") return "Cle API Merchant MbiyoPay (Bearer Token)";
    if (field === "publicKey") return "Cle Publique MbiyoPay";
  }
  if (provider === "moneyfusion") {
    if (field === "apiKey") return "Cle Privee MoneyFusion (moneyfusion-private-key)";
  }
  if (provider === "pawapay") {
    if (field === "apiKey") return "Token API PawaPay (Bearer Token du Dashboard PawaPay)";
    if (field === "secretKey") return "Mode : entrez exactement 'live' pour compte production PawaPay (obligatoire pour les vrais paiements). Laisser vide = mode sandbox uniquement.";
  }
  switch (field) {
    case "apiKey": return "Cle API";
    case "secretKey": return "Cle Secrete";
    case "publicKey": return "Cle Publique";
    case "masterKey": return "Master Key";
    case "token": return "Token";
    case "ipnSecret": return "IPN Secret";
    default: return field;
  }
};

export default function AdminBusinessProviders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("afribapay");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const defaultForm: ProviderForm = { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" };
  const [forms, setForms] = useState<Record<string, ProviderForm>>(
    Object.keys(PROVIDER_INFO).reduce((acc, key) => ({ ...acc, [key]: { ...defaultForm } }), {})
  );

  const { data: providers, isLoading } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/admin/business/provider-configs"],
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { provider: string; updates: Partial<ProviderConfig> }) => {
      return apiRequest("PUT", `/api/admin/business/provider-configs/${payload.provider}`, payload.updates);
    },
    onSuccess: () => {
      toast({
        title: "Succes",
        description: "Configuration du fournisseur mise a jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/provider-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour",
        variant: "destructive",
      });
    },
  });

  const toggleActive = (provider: string, currentActive: boolean) => {
    updateMutation.mutate({
      provider,
      updates: { isActive: !currentActive },
    });
  };

  const saveKeys = (provider: string) => {
    const form = forms[provider];
    const updates: Partial<ProviderConfig> = {};

    if (form.apiKey) updates.apiKey = form.apiKey;
    if (form.secretKey) updates.secretKey = form.secretKey;
    if (form.publicKey) updates.publicKey = form.publicKey;
    if (form.masterKey) updates.masterKey = form.masterKey;
    if (form.token) updates.token = form.token;
    if (form.ipnSecret) updates.ipnSecret = form.ipnSecret;

    if (Object.keys(updates).length === 0) {
      toast({
        title: "Aucune modification",
        description: "Veuillez entrer au moins une cle API",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ provider, updates });
    setForms(prev => ({
      ...prev,
      [provider]: { ...defaultForm },
    }));
  };

  const updateForm = (provider: string, field: keyof ProviderForm, value: string) => {
    setForms(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getProviderConfig = (provider: string) => {
    return providers?.find(p => p.provider === provider);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")} data-testid="button-back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Fournisseurs Business</h1>
            <p className="text-sm text-muted-foreground">
              Configurez les cles API et activez/desactivez les fournisseurs de paiement business
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")} data-testid="button-back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Fournisseurs Business</h1>
          <p className="text-sm text-muted-foreground">
            Configurez les cles API et activez/desactivez les fournisseurs de paiement business
          </p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-4 mb-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Exclusivite mutuelle par pays
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Un pays ne peut etre active que chez un seul fournisseur a la fois (separement pour les paiements entrants et sortants).
              Activer un pays chez un fournisseur le desactivera automatiquement chez les autres.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {Object.entries(PROVIDER_INFO).map(([key, info]) => {
            const config = getProviderConfig(key);
            return (
              <TabsTrigger key={key} value={key} className="relative gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid={`tab-biz-provider-${key}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${config?.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="truncate">{info.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
          const config = getProviderConfig(provider);
          const form = forms[provider] || defaultForm;

          return (
            <TabsContent key={provider} value={provider} className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-md ${info.color} flex items-center justify-center`}>
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          {info.name}
                          {config?.isActive ? (
                            <Badge variant="default" className="bg-green-500">Actif</Badge>
                          ) : (
                            <Badge variant="outline">Inactif</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{info.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`active-biz-${provider}`} className="text-sm">
                        {config?.isActive ? "Desactiver" : "Activer"}
                      </Label>
                      <Switch
                        id={`active-biz-${provider}`}
                        checked={config?.isActive || false}
                        onCheckedChange={() => toggleActive(provider, config?.isActive || false)}
                        disabled={updateMutation.isPending}
                        data-testid={`switch-biz-provider-${provider}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Couverture :</span> {info.countries}
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Cles API
                    </h3>

                    <div className="space-y-4">
                      {info.fields.includes("apiKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`biz-apiKey-${provider}`}>{getFieldLabel(provider, "apiKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`biz-apiKey-${provider}`}
                                type={showKeys[`apiKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.apiKey || "Entrez votre cle API..."}
                                value={form.apiKey}
                                onChange={(e) => updateForm(provider, "apiKey", e.target.value)}
                                data-testid={`input-biz-apiKey-${provider}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => toggleShowKey(`apiKey-${provider}`)}
                              >
                                {showKeys[`apiKey-${provider}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          {config?.apiKey && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              Cle configuree : {config.apiKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("secretKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`biz-secretKey-${provider}`}>{getFieldLabel(provider, "secretKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`biz-secretKey-${provider}`}
                                type={showKeys[`secretKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.secretKey || "Entrez votre cle secrete..."}
                                value={form.secretKey}
                                onChange={(e) => updateForm(provider, "secretKey", e.target.value)}
                                data-testid={`input-biz-secretKey-${provider}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => toggleShowKey(`secretKey-${provider}`)}
                              >
                                {showKeys[`secretKey-${provider}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          {config?.secretKey && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              Cle configuree : {config.secretKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("publicKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`biz-publicKey-${provider}`}>{getFieldLabel(provider, "publicKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`biz-publicKey-${provider}`}
                                type={showKeys[`publicKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.publicKey || "Entrez votre cle publique..."}
                                value={form.publicKey}
                                onChange={(e) => updateForm(provider, "publicKey", e.target.value)}
                                data-testid={`input-biz-publicKey-${provider}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => toggleShowKey(`publicKey-${provider}`)}
                              >
                                {showKeys[`publicKey-${provider}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          {config?.publicKey && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              Cle configuree : {config.publicKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("masterKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`biz-masterKey-${provider}`}>{getFieldLabel(provider, "masterKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`biz-masterKey-${provider}`}
                                type={showKeys[`masterKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.masterKey || "Entrez votre master key..."}
                                value={form.masterKey}
                                onChange={(e) => updateForm(provider, "masterKey", e.target.value)}
                                data-testid={`input-biz-masterKey-${provider}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => toggleShowKey(`masterKey-${provider}`)}
                              >
                                {showKeys[`masterKey-${provider}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          {config?.masterKey && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              Cle configuree : {config.masterKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("token") && (
                        <div className="space-y-2">
                          <Label htmlFor={`biz-token-${provider}`}>{getFieldLabel(provider, "token")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`biz-token-${provider}`}
                                type={showKeys[`token-${provider}`] ? "text" : "password"}
                                placeholder={config?.token || "Entrez votre token..."}
                                value={form.token}
                                onChange={(e) => updateForm(provider, "token", e.target.value)}
                                data-testid={`input-biz-token-${provider}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => toggleShowKey(`token-${provider}`)}
                              >
                                {showKeys[`token-${provider}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          {config?.token && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              Token configure : {config.token}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("ipnSecret") && (
                        <div className="space-y-2">
                          <Label htmlFor={`biz-ipnSecret-${provider}`}>{getFieldLabel(provider, "ipnSecret")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`biz-ipnSecret-${provider}`}
                                type={showKeys[`ipnSecret-${provider}`] ? "text" : "password"}
                                placeholder={config?.ipnSecret ? "••••••••" : "Entrez votre IPN Secret..."}
                                value={form.ipnSecret}
                                onChange={(e) => updateForm(provider, "ipnSecret", e.target.value)}
                                data-testid={`input-biz-ipnSecret-${provider}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => toggleShowKey(`ipnSecret-${provider}`)}
                              >
                                {showKeys[`ipnSecret-${provider}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          {config?.ipnSecret && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              IPN Secret configure
                            </p>
                          )}
                        </div>
                      )}

                      <div className="pt-4 flex gap-2 flex-wrap">
                        <Button
                          onClick={() => saveKeys(provider)}
                          disabled={updateMutation.isPending}
                          className="gap-2"
                          data-testid={`save-biz-keys-${provider}`}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Enregistrer les cles
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
