import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Key, Shield, Eye, EyeOff, Save, Check, AlertCircle, Coins } from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CryptoCurrency {
  id: string | null;
  code: string;
  name: string;
  symbol: string;
  payinEnabled: boolean;
  payoutEnabled: boolean;
}

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

const PROVIDER_INFO = {
  afribapay: {
    name: "AfribaPay",
    description: "Fournisseur principal couvrant 15 pays africains",
    color: "bg-purple-500",
    fields: ["apiKey"],
    countries: "15 pays (Bénin, Togo, CI, Sénégal, Ghana, Cameroun, etc.)",
  },
  paydunya: {
    name: "Paydunya",
    description: "Solution de paiement mobile pour l'Afrique de l'Ouest",
    color: "bg-blue-500",
    fields: ["masterKey", "publicKey", "secretKey", "token"],
    countries: "6 pays (Bénin, Togo, CI, Sénégal, BF, Mali)",
  },
  fedapay: {
    name: "FedaPay",
    description: "Plateforme de paiement pour l'Afrique francophone",
    color: "bg-green-500",
    fields: ["secretKey"],
    countries: "7 pays (Bénin, Togo, CI, Sénégal, Guinée, Niger, BF)",
  },
  mbiyopay: {
    name: "MbiyoPay",
    description: "Passerelle de paiement pour 11 pays africains",
    color: "bg-teal-500",
    fields: ["apiKey", "publicKey"],
    countries: "11 pays (Bénin, BF, CI, Sénégal, Togo, Mali, Guinée, Cameroun, Congo, RDC, Gambie)",
  },
  moneyfusion: {
    name: "MoneyFusion",
    description: "Passerelle de paiement sortant (retraits/transferts) pour 24 pays africains",
    color: "bg-rose-500",
    fields: ["apiKey"],
    countries: "24 pays (CI, SN, BF, BJ, TG, ML, CM, CD, GA, GN, GM, GH, etc.)",
  },
  nowpayments: {
    name: "NOWPayments",
    description: "Paiements en cryptomonnaies (Bitcoin, Ethereum, USDT, etc.)",
    color: "bg-orange-500",
    fields: ["apiKey", "ipnSecret", "publicKey", "secretKey"],
    countries: "Global - Crypto uniquement",
  },
  exchangerate: {
    name: "ExchangeRate API",
    description: "Service de conversion de devises en temps reel",
    color: "bg-cyan-500",
    fields: ["apiKey"],
    countries: "Global - Conversion XOF, XAF, CDF, USD",
  },
  mailtrap: {
    name: "Mailtrap",
    description: "Service d'envoi d'emails transactionnels (inscription, mot de passe, connexion)",
    color: "bg-indigo-500",
    fields: ["apiKey", "secretKey", "publicKey"],
    countries: "Global - Emails transactionnels",
  },
};

const getFieldLabel = (provider: string, field: string): string => {
  if (provider === "paydunya") {
    switch (field) {
      case "masterKey": return "Clé Principale";
      case "publicKey": return "Clé Publique";
      case "secretKey": return "Clé Privée";
      case "token": return "Token";
      default: return field;
    }
  }
  if (provider === "fedapay") {
    if (field === "secretKey") return "Clé Secrète (sk_live_xxx ou sk_sandbox_xxx)";
  }
  if (provider === "nowpayments") {
    switch (field) {
      case "apiKey": return "Clé API NOWPayments";
      case "ipnSecret": return "IPN Secret (pour les webhooks)";
      case "publicKey": return "Email du compte NOWPayments (pour les payouts)";
      case "secretKey": return "Mot de passe du compte NOWPayments (pour les payouts)";
      default: return field;
    }
  }
  if (provider === "mbiyopay") {
    if (field === "apiKey") return "Clé API Merchant MbiyoPay (Bearer Token)";
    if (field === "publicKey") return "Clé Publique MbiyoPay";
  }
  if (provider === "moneyfusion") {
    if (field === "apiKey") return "Clé Privée MoneyFusion (moneyfusion-private-key)";
  }
  if (provider === "exchangerate") {
    if (field === "apiKey") return "Clé API ExchangeRate (exchangerate-api.com)";
  }
  if (provider === "mailtrap") {
    switch (field) {
      case "apiKey": return "API Token (depuis Settings > API Tokens sur mailtrap.io)";
      case "secretKey": return "Email expediteur (ex: noreply@votredomaine.com)";
      case "publicKey": return "Nom expediteur (ex: BKApay)";
      default: return field;
    }
  }
  switch (field) {
    case "apiKey": return "Clé API";
    case "secretKey": return "Clé Secrète";
    case "publicKey": return "Clé Publique";
    case "masterKey": return "Master Key";
    case "token": return "Token";
    case "ipnSecret": return "IPN Secret";
    default: return field;
  }
};

function CryptoConfigSection() {
  const { toast } = useToast();

  const { data: cryptoStatus, isLoading: statusLoading } = useQuery<{ available: boolean; message: string }>({
    queryKey: ["/api/crypto/status"],
  });

  const { data: currencies, isLoading: currenciesLoading } = useQuery<CryptoCurrency[]>({
    queryKey: ["/api/admin/crypto-currencies"],
  });

  const updateCryptoMutation = useMutation({
    mutationFn: async ({ code, payinEnabled, payoutEnabled }: { code: string; payinEnabled?: boolean; payoutEnabled?: boolean }) => {
      return apiRequest("PUT", `/api/admin/crypto-currencies/${code}`, { payinEnabled, payoutEnabled });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Cryptomonnaie mise à jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crypto-currencies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  if (statusLoading || currenciesLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Cryptomonnaies acceptées
        </CardTitle>
        <CardDescription>
          Activez ou désactivez les cryptomonnaies pour les paiements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!cryptoStatus?.available && (
          <Alert variant="destructive">
            <AlertDescription>
              NOWPayments n'est pas configuré. Veuillez d'abord entrer la clé API ci-dessus.
            </AlertDescription>
          </Alert>
        )}

        {cryptoStatus?.available && (
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              NOWPayments connecté - Les cryptomonnaies sont opérationnelles
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currencies?.map((crypto) => (
            <div
              key={crypto.code}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <CryptoIcon code={crypto.code} size="lg" />
                <div>
                  <p className="font-medium">{crypto.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {crypto.symbol}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Entrant</span>
                  <Switch
                    checked={crypto.payinEnabled}
                    onCheckedChange={() => updateCryptoMutation.mutate({ code: crypto.code, payinEnabled: !crypto.payinEnabled })}
                    disabled={updateCryptoMutation.isPending || !cryptoStatus?.available}
                    data-testid={`switch-crypto-payin-${crypto.code}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Sortant</span>
                  <Switch
                    checked={crypto.payoutEnabled}
                    onCheckedChange={() => updateCryptoMutation.mutate({ code: crypto.code, payoutEnabled: !crypto.payoutEnabled })}
                    disabled={updateCryptoMutation.isPending || !cryptoStatus?.available}
                    data-testid={`switch-crypto-payout-${crypto.code}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {(!currencies || currencies.length === 0) && cryptoStatus?.available && (
          <div className="text-center py-8 text-muted-foreground">
            Chargement des cryptomonnaies...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FournisseursPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("afribapay");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [forms, setForms] = useState<Record<string, ProviderForm>>({
    afribapay: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    paydunya: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    fedapay: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    mbiyopay: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    moneyfusion: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    nowpayments: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    exchangerate: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
    mailtrap: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "", enableKycSubmitted: "", enableKycVerified: "", enableKycRejected: "" },
  });

  const { data: providers, isLoading } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/admin/providers"],
  });

  // Initialize mailtrap toggles from database when data loads
  const mailtrapConfig = providers?.find(p => p.provider === "mailtrap");
  
  useEffect(() => {
    if (mailtrapConfig) {
      setForms(prev => ({
        ...prev,
        mailtrap: {
          ...prev.mailtrap,
          masterKey: mailtrapConfig.masterKey || "false",
          token: mailtrapConfig.token || "false",
          ipnSecret: mailtrapConfig.ipnSecret || "false",
          enableKycSubmitted: (mailtrapConfig as any).enableKycSubmitted || "false",
          enableKycVerified: (mailtrapConfig as any).enableKycVerified || "false",
          enableKycRejected: (mailtrapConfig as any).enableKycRejected || "false",
        }
      }));
    }
  }, [mailtrapConfig?.masterKey, mailtrapConfig?.token, mailtrapConfig?.ipnSecret, (mailtrapConfig as any)?.enableKycSubmitted, (mailtrapConfig as any)?.enableKycVerified, (mailtrapConfig as any)?.enableKycRejected]);

  // Auto-save toggle for mailtrap email types
  const saveMailtrapToggle = async (field: "masterKey" | "token" | "ipnSecret" | "enableKycSubmitted" | "enableKycVerified" | "enableKycRejected", value: string) => {
    const updates: Partial<ProviderConfig> = { [field]: value };
    try {
      await apiRequest("PUT", "/api/admin/providers/mailtrap", updates);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      toast({
        title: "Configuration mise a jour",
        description: value === "true" ? "Email active" : "Email desactive",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: { provider: string; updates: Partial<ProviderConfig> }) => {
      return apiRequest("PUT", `/api/admin/providers/${payload.provider}`, payload.updates);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Configuration du fournisseur mise à jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/test-email", {});
    },
    onSuccess: () => {
      toast({
        title: "Connexion reussie",
        description: "La connexion Mailtrap a ete verifiee avec succes",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Echec de la connexion",
        description: error.message || "Impossible de se connecter a Mailtrap. Verifiez vos identifiants.",
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
        description: "Veuillez entrer au moins une clé API",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ provider, updates });
    // For mailtrap, preserve toggle values; for others, clear all fields
    if (provider === "mailtrap") {
      setForms(prev => ({
        ...prev,
        mailtrap: { 
          apiKey: "", 
          secretKey: "", 
          publicKey: "", 
          masterKey: prev.mailtrap.masterKey, 
          token: prev.mailtrap.token, 
          ipnSecret: prev.mailtrap.ipnSecret 
        },
      }));
    } else {
      setForms(prev => ({
        ...prev,
        [provider]: { apiKey: "", secretKey: "", publicKey: "", masterKey: "", token: "", ipnSecret: "" },
      }));
    }
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
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Fournisseurs</h1>
          <p className="text-sm text-muted-foreground">
            Configurez les clés API et activez/désactivez les fournisseurs de paiement
          </p>
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
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Fournisseurs</h1>
        <p className="text-sm text-muted-foreground">
          Configurez les clés API et activez/désactivez les fournisseurs de paiement
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Exclusivité mutuelle par pays
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Un pays ne peut être activé que chez un seul fournisseur à la fois (séparément pour les paiements entrants et sortants).
              Activer un pays chez un fournisseur le désactivera automatiquement chez les autres.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {Object.entries(PROVIDER_INFO).map(([key, info]) => {
            const config = getProviderConfig(key);
            return (
              <TabsTrigger key={key} value={key} className="relative gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid={`tab-provider-${key}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${config?.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="truncate">{info.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
          const config = getProviderConfig(provider);
          const form = forms[provider] || { apiKey: "", secretKey: "", publicKey: "", privateKey: "", masterKey: "", token: "", appId: "", merchantId: "", smtpHost: "", smtpPort: "", smtpEmail: "", smtpPassword: "", isSandbox: false };

          return (
            <TabsContent key={provider} value={provider} className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg ${info.color} flex items-center justify-center`}>
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
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
                      <Label htmlFor={`active-${provider}`} className="text-sm">
                        {config?.isActive ? "Désactiver" : "Activer"}
                      </Label>
                      <Switch
                        id={`active-${provider}`}
                        checked={config?.isActive || false}
                        onCheckedChange={() => toggleActive(provider, config?.isActive || false)}
                        disabled={updateMutation.isPending}
                        data-testid={`switch-provider-${provider}`}
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
                      Clés API
                    </h3>

                    <div className="space-y-4">
                      {info.fields.includes("apiKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`apiKey-${provider}`}>{getFieldLabel(provider, "apiKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`apiKey-${provider}`}
                                type={showKeys[`apiKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.apiKey || "Entrez votre clé API..."}
                                value={form.apiKey}
                                onChange={(e) => updateForm(provider, "apiKey", e.target.value)}
                                data-testid={`input-apiKey-${provider}`}
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
                              Clé configurée : {config.apiKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("secretKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`secretKey-${provider}`}>{getFieldLabel(provider, "secretKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`secretKey-${provider}`}
                                type={showKeys[`secretKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.secretKey || "Entrez votre clé secrète..."}
                                value={form.secretKey}
                                onChange={(e) => updateForm(provider, "secretKey", e.target.value)}
                                data-testid={`input-secretKey-${provider}`}
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
                              Clé configurée : {config.secretKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("publicKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`publicKey-${provider}`}>{getFieldLabel(provider, "publicKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`publicKey-${provider}`}
                                type={showKeys[`publicKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.publicKey || "Entrez votre clé publique..."}
                                value={form.publicKey}
                                onChange={(e) => updateForm(provider, "publicKey", e.target.value)}
                                data-testid={`input-publicKey-${provider}`}
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
                              Clé configurée : {config.publicKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("masterKey") && (
                        <div className="space-y-2">
                          <Label htmlFor={`masterKey-${provider}`}>{getFieldLabel(provider, "masterKey")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`masterKey-${provider}`}
                                type={showKeys[`masterKey-${provider}`] ? "text" : "password"}
                                placeholder={config?.masterKey || "Entrez votre master key..."}
                                value={form.masterKey}
                                onChange={(e) => updateForm(provider, "masterKey", e.target.value)}
                                data-testid={`input-masterKey-${provider}`}
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
                              Clé configurée : {config.masterKey}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("token") && (
                        <div className="space-y-2">
                          <Label htmlFor={`token-${provider}`}>{getFieldLabel(provider, "token")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`token-${provider}`}
                                type={showKeys[`token-${provider}`] ? "text" : "password"}
                                placeholder={config?.token || "Entrez votre token..."}
                                value={form.token}
                                onChange={(e) => updateForm(provider, "token", e.target.value)}
                                data-testid={`input-token-${provider}`}
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
                              Token configuré : {config.token}
                            </p>
                          )}
                        </div>
                      )}

                      {info.fields.includes("ipnSecret") && (
                        <div className="space-y-2">
                          <Label htmlFor={`ipnSecret-${provider}`}>{getFieldLabel(provider, "ipnSecret")}</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`ipnSecret-${provider}`}
                                type={showKeys[`ipnSecret-${provider}`] ? "text" : "password"}
                                placeholder={config?.ipnSecret ? "••••••••" : "Entrez votre IPN Secret..."}
                                value={form.ipnSecret}
                                onChange={(e) => updateForm(provider, "ipnSecret", e.target.value)}
                                data-testid={`input-ipnSecret-${provider}`}
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
                              IPN Secret configuré
                            </p>
                          )}
                        </div>
                      )}

                      <div className="pt-4 flex gap-2 flex-wrap">
                        <Button
                          onClick={() => saveKeys(provider)}
                          disabled={updateMutation.isPending}
                          className="gap-2"
                          data-testid={`save-keys-${provider}`}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Enregistrer les clés
                        </Button>
                        {provider === "mailtrap" && (
                          <Button
                            variant="outline"
                            onClick={() => testEmailMutation.mutate()}
                            disabled={testEmailMutation.isPending}
                            className="gap-2"
                            data-testid="test-mailtrap-connection"
                          >
                            {testEmailMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Tester la connexion
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {provider === "mailtrap" && (
                    <div className="border-t pt-4 mt-4 space-y-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Activer/Desactiver les types d'emails</h4>
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <Label className="font-medium">Emails d'inscription</Label>
                              <p className="text-xs text-muted-foreground">Verification email lors de la creation de compte</p>
                            </div>
                            <Switch
                              checked={forms.mailtrap.masterKey === "true"}
                              onCheckedChange={(checked) => {
                                const value = checked ? "true" : "false";
                                setForms(prev => ({...prev, mailtrap: {...prev.mailtrap, masterKey: value}}));
                                saveMailtrapToggle("masterKey", value);
                              }}
                              data-testid="toggle-email-signup"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <Label className="font-medium">Emails mot de passe oublie</Label>
                              <p className="text-xs text-muted-foreground">Lien de reinitialisation du mot de passe</p>
                            </div>
                            <Switch
                              checked={forms.mailtrap.token === "true"}
                              onCheckedChange={(checked) => {
                                const value = checked ? "true" : "false";
                                setForms(prev => ({...prev, mailtrap: {...prev.mailtrap, token: value}}));
                                saveMailtrapToggle("token", value);
                              }}
                              data-testid="toggle-email-password"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <Label className="font-medium">Emails de connexion (2FA)</Label>
                              <p className="text-xs text-muted-foreground">Code de verification a chaque connexion</p>
                            </div>
                            <Switch
                              checked={forms.mailtrap.ipnSecret === "true"}
                              onCheckedChange={(checked) => {
                                const value = checked ? "true" : "false";
                                setForms(prev => ({...prev, mailtrap: {...prev.mailtrap, ipnSecret: value}}));
                                saveMailtrapToggle("ipnSecret", value);
                              }}
                              data-testid="toggle-email-login"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <Label className="font-medium">KYC soumis</Label>
                              <p className="text-xs text-muted-foreground">Email envoye quand un utilisateur soumet sa verification</p>
                            </div>
                            <Switch
                              checked={forms.mailtrap.enableKycSubmitted === "true"}
                              onCheckedChange={(checked) => {
                                const value = checked ? "true" : "false";
                                setForms(prev => ({...prev, mailtrap: {...prev.mailtrap, enableKycSubmitted: value}}));
                                saveMailtrapToggle("enableKycSubmitted", value);
                              }}
                              data-testid="toggle-email-kyc-submitted"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <Label className="font-medium">KYC verifie</Label>
                              <p className="text-xs text-muted-foreground">Email envoye quand la verification est approuvee</p>
                            </div>
                            <Switch
                              checked={forms.mailtrap.enableKycVerified === "true"}
                              onCheckedChange={(checked) => {
                                const value = checked ? "true" : "false";
                                setForms(prev => ({...prev, mailtrap: {...prev.mailtrap, enableKycVerified: value}}));
                                saveMailtrapToggle("enableKycVerified", value);
                              }}
                              data-testid="toggle-email-kyc-verified"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <Label className="font-medium">KYC rejete</Label>
                              <p className="text-xs text-muted-foreground">Email envoye quand la verification est rejetee</p>
                            </div>
                            <Switch
                              checked={forms.mailtrap.enableKycRejected === "true"}
                              onCheckedChange={(checked) => {
                                const value = checked ? "true" : "false";
                                setForms(prev => ({...prev, mailtrap: {...prev.mailtrap, enableKycRejected: value}}));
                                saveMailtrapToggle("enableKycRejected", value);
                              }}
                              data-testid="toggle-email-kyc-rejected"
                            />
                          </div>
                        </div>
                      </div>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Comment obtenir votre API Token Mailtrap :</strong>
                          <ol className="list-decimal ml-4 mt-2 space-y-1">
                            <li>Creez un compte sur <a href="https://mailtrap.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">mailtrap.io</a></li>
                            <li>Allez dans <strong>Settings {">"} API Tokens</strong></li>
                            <li>Cliquez sur <strong>"Add Token"</strong> pour generer un nouveau token</li>
                            <li>Copiez le token et collez-le dans le champ "API Token" ci-dessus</li>
                          </ol>
                          <p className="mt-2"><strong>Pour l'email expediteur :</strong> Utilisez une adresse email de votre domaine verifie sur Mailtrap (ex: noreply@votredomaine.com)</p>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>

              {provider === "nowpayments" && <CryptoConfigSection />}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
