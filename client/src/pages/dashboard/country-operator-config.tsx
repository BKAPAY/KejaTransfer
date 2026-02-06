import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Wifi, CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertCircle, Bitcoin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CountryOperatorConfig, CountryStatus, CryptoCurrency } from "@shared/schema";
import { AFRIBAPAY_COUNTRIES } from "@shared/afribapay-countries";
import { PAYDUNYA_COUNTRIES } from "@shared/paydunya-countries";
import { FEDAPAY_COUNTRIES } from "@shared/fedapay-countries";
import { MBIYOPAY_COUNTRIES } from "@shared/mbiyopay-countries";

interface ProviderConfig {
  id: string;
  provider: string;
  isActive: boolean;
}

const PROVIDERS = [
  { 
    id: "afribapay", 
    name: "AfribaPay", 
    color: "bg-purple-500",
    countries: AFRIBAPAY_COUNTRIES 
  },
  { 
    id: "paydunya", 
    name: "Paydunya", 
    color: "bg-blue-500",
    countries: PAYDUNYA_COUNTRIES 
  },
  { 
    id: "fedapay", 
    name: "FedaPay", 
    color: "bg-green-500",
    countries: FEDAPAY_COUNTRIES 
  },
  { 
    id: "mbiyopay", 
    name: "MbiyoPay", 
    color: "bg-teal-500",
    countries: MBIYOPAY_COUNTRIES 
  },
  { 
    id: "nowpayments", 
    name: "NOWPayments", 
    color: "bg-orange-500",
    countries: [] 
  },
];

export default function CountryOperatorConfigPage() {
  const { toast } = useToast();
  const [activeProvider, setActiveProvider] = useState("afribapay");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const { data: allOperatorConfigs, isLoading: isLoadingOperators } = useQuery<CountryOperatorConfig[]>({
    queryKey: ["/api/admin/country-operator-config"],
  });

  const { data: allCountryStatuses, isLoading: isLoadingCountries } = useQuery<CountryStatus[]>({
    queryKey: ["/api/admin/country-status"],
  });

  const { data: providers } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/admin/providers"],
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async (payload: {
      provider: string;
      country: string;
      operator: string;
      incomingEnabled?: boolean;
      outgoingEnabled?: boolean;
    }) => {
      return apiRequest("PUT", `/api/admin/country-operator-config/${payload.provider}/${payload.country}/${payload.operator}`, {
        incomingEnabled: payload.incomingEnabled,
        outgoingEnabled: payload.outgoingEnabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Configuration opérateur mise à jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/country-operator-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/country-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  const updateCountryMutation = useMutation({
    mutationFn: async (payload: {
      provider: string;
      country: string;
      payinEnabled?: boolean;
      payoutEnabled?: boolean;
    }) => {
      return apiRequest("PUT", `/api/admin/country-status/${payload.provider}/${payload.country}`, {
        payinEnabled: payload.payinEnabled,
        payoutEnabled: payload.payoutEnabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Statut du pays mis à jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/country-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/country-operator-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  const { data: cryptoCurrencies, isLoading: isLoadingCrypto } = useQuery<CryptoCurrency[]>({
    queryKey: ["/api/admin/crypto-currencies"],
  });

  const toggleCryptoMutation = useMutation({
    mutationFn: async (payload: { code: string; payinEnabled?: boolean; payoutEnabled?: boolean }) => {
      return apiRequest("PUT", `/api/admin/crypto-currencies/${payload.code}`, {
        payinEnabled: payload.payinEnabled,
        payoutEnabled: payload.payoutEnabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succes",
        description: "Cryptomonnaie mise a jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crypto-currencies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour",
        variant: "destructive",
      });
    },
  });

  const toggleOperatorSetting = (config: CountryOperatorConfig, type: "incoming" | "outgoing") => {
    const newValue = type === "incoming" ? !config.incomingEnabled : !config.outgoingEnabled;
    updateOperatorMutation.mutate({
      provider: config.provider,
      country: config.country,
      operator: config.operator,
      ...(type === "incoming" ? { incomingEnabled: newValue } : { outgoingEnabled: newValue }),
    });
  };

  const toggleCountrySetting = (status: CountryStatus, type: "payin" | "payout") => {
    const newValue = type === "payin" ? !status.payinEnabled : !status.payoutEnabled;
    updateCountryMutation.mutate({
      provider: status.provider,
      country: status.country,
      ...(type === "payin" ? { payinEnabled: newValue } : { payoutEnabled: newValue }),
    });
  };

  const getOperatorConfigsForProvider = (provider: string) => {
    return allOperatorConfigs?.filter(c => c.provider === provider) || [];
  };

  const getCountryStatusesForProvider = (provider: string) => {
    return allCountryStatuses?.filter(c => c.provider === provider) || [];
  };

  const isProviderActive = (providerId: string) => {
    return providers?.find(p => p.provider === providerId)?.isActive || false;
  };

  const isLoading = isLoadingOperators || isLoadingCountries;

  const currentProviderInfo = PROVIDERS.find(p => p.id === activeProvider);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Pays et Opérateurs</h1>
        <p className="text-sm text-muted-foreground">
          Contrôlez quels pays et opérateurs sont disponibles pour les paiements entrants et sortants par fournisseur
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Exclusivite mutuelle par operateur
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Activer un operateur (ex: MTN Benin) pour un fournisseur le desactivera automatiquement chez les autres fournisseurs.
              Vous pouvez activer differents operateurs du meme pays chez differents fournisseurs.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeProvider} onValueChange={setActiveProvider}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {PROVIDERS.map((provider) => {
            const isActive = isProviderActive(provider.id);
            return (
              <TabsTrigger 
                key={provider.id} 
                value={provider.id} 
                className="relative gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                data-testid={`tab-provider-${provider.id}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="truncate">{provider.name}</span>
                {!isActive && (
                  <Badge variant="outline" className="ml-1 text-xs">Inactif</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PROVIDERS.map((provider) => {
          const operatorConfigs = getOperatorConfigsForProvider(provider.id);
          const countryStatuses = getCountryStatusesForProvider(provider.id);
          const isActive = isProviderActive(provider.id);

          const groupedConfigs: Record<string, CountryOperatorConfig[]> = {};
          operatorConfigs.forEach((config) => {
            if (!groupedConfigs[config.country]) {
              groupedConfigs[config.country] = [];
            }
            groupedConfigs[config.country].push(config);
          });

          const countryStatusMap: Record<string, CountryStatus> = {};
          countryStatuses.forEach((status) => {
            countryStatusMap[status.country] = status;
          });

          return (
            <TabsContent key={provider.id} value={provider.id} className="mt-4">
              {!isActive && (
                <div className="bg-muted/50 border rounded-lg p-4 mb-4 text-center">
                  <p className="text-muted-foreground">
                    Ce fournisseur est actuellement désactivé. 
                    Allez dans la page <strong>Fournisseurs</strong> pour l'activer.
                  </p>
                </div>
              )}

              {isLoading ? (
                <div className="grid gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : provider.id === "nowpayments" ? (
                <div className="grid gap-4">
                  <div className="bg-muted/50 border rounded-lg p-4 mb-2">
                    <p className="text-sm text-muted-foreground">
                      NOWPayments gere les paiements en cryptomonnaie. Activez ou desactivez les cryptomonnaies disponibles pour les paiements.
                    </p>
                  </div>
                  {isLoadingCrypto ? (
                    <div className="grid gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {cryptoCurrencies?.map((crypto) => (
                        <Card key={crypto.code}>
                          <div className="p-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-3">
                                <Bitcoin className="w-6 h-6 text-muted-foreground" />
                                <div>
                                  <h3 className="font-semibold text-foreground">{crypto.name}</h3>
                                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                    <span>{crypto.symbol}</span>
                                    <span className="text-xs text-muted-foreground">({crypto.code})</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant={crypto.payinEnabled ? "default" : "outline"}
                                  onClick={() => toggleCryptoMutation.mutate({ code: crypto.code, payinEnabled: !crypto.payinEnabled })}
                                  disabled={toggleCryptoMutation.isPending}
                                  data-testid={`toggle-crypto-payin-${crypto.code}`}
                                  className="gap-2"
                                >
                                  {crypto.payinEnabled ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                  <span className="text-xs">Entrant</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant={crypto.payoutEnabled ? "default" : "outline"}
                                  onClick={() => toggleCryptoMutation.mutate({ code: crypto.code, payoutEnabled: !crypto.payoutEnabled })}
                                  disabled={toggleCryptoMutation.isPending}
                                  data-testid={`toggle-crypto-payout-${crypto.code}`}
                                  className="gap-2"
                                >
                                  {crypto.payoutEnabled ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                  <span className="text-xs">Sortant</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {(!cryptoCurrencies || cryptoCurrencies.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          Aucune cryptomonnaie configuree
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {provider.countries.map((countryInfo) => {
                    const countryCode = countryInfo.code;
                    const countryConfigs = groupedConfigs[countryCode] || [];
                    const countryStatus = countryStatusMap[countryCode];
                    const isExpanded = expandedCountry === `${provider.id}-${countryCode}`;
                    
                    const activePayinOperators = countryConfigs.filter(c => c.incomingEnabled).length;
                    const activePayoutOperators = countryConfigs.filter(c => c.outgoingEnabled).length;
                    const hasPayinActive = countryStatus?.payinEnabled && activePayinOperators > 0;
                    const hasPayoutActive = countryStatus?.payoutEnabled && activePayoutOperators > 0;
                    const noPayinOperators = countryStatus?.payinEnabled && activePayinOperators === 0;
                    const noPayoutOperators = countryStatus?.payoutEnabled && activePayoutOperators === 0;

                    return (
                      <Card key={`${provider.id}-${countryCode}`} className="overflow-hidden">
                        <div className="p-4 border-b bg-muted/30">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <Globe className="w-6 h-6 text-muted-foreground" />
                              <div>
                                <h3 className="font-semibold text-foreground">{countryInfo.name} ({countryCode})</h3>
                                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                  <span>{countryInfo.operators.length} operateur{countryInfo.operators.length > 1 ? "s" : ""}</span>
                                  <span>-</span>
                                  <span>{countryInfo.currency}</span>
                                  {hasPayinActive && (
                                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                                      {activePayinOperators} payin actif{activePayinOperators > 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                  {hasPayoutActive && (
                                    <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600">
                                      {activePayoutOperators} payout actif{activePayoutOperators > 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                  {noPayinOperators && (
                                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                      Aucun operateur payin
                                    </Badge>
                                  )}
                                  {noPayoutOperators && (
                                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                      Aucun operateur payout
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              {countryStatus && (
                                <>
                                  <Button
                                    size="sm"
                                    variant={countryStatus.payinEnabled ? "default" : "outline"}
                                    onClick={() => toggleCountrySetting(countryStatus, "payin")}
                                    disabled={updateCountryMutation.isPending}
                                    data-testid={`toggle-country-payin-${provider.id}-${countryCode}`}
                                    className="gap-2"
                                  >
                                    {countryStatus.payinEnabled ? (
                                      <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                    <span className="text-xs">Payin</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant={countryStatus.payoutEnabled ? "default" : "outline"}
                                    onClick={() => toggleCountrySetting(countryStatus, "payout")}
                                    disabled={updateCountryMutation.isPending}
                                    data-testid={`toggle-country-payout-${provider.id}-${countryCode}`}
                                    className="gap-2"
                                  >
                                    {countryStatus.payoutEnabled ? (
                                      <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                    <span className="text-xs">Payout</span>
                                  </Button>
                                </>
                              )}

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setExpandedCountry(isExpanded ? null : `${provider.id}-${countryCode}`)}
                                data-testid={`expand-country-${provider.id}-${countryCode}`}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                Opérateurs {provider.name}
                              </h4>
                              {countryInfo.operators.map((op: any) => {
                                const config = countryConfigs.find(c => c.operator === op.code);
                                
                                return (
                                  <div
                                    key={`${provider.id}-${countryCode}-${op.code}`}
                                    className="flex items-center justify-between p-3 bg-secondary rounded-lg flex-wrap gap-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Wifi className="w-4 h-4 text-muted-foreground" />
                                      <div>
                                        <span className="font-medium text-foreground">{op.name}</span>
                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                          {op.payin && <span className="text-green-600">Payin</span>}
                                          {op.payout && <span className="text-blue-600">Payout</span>}
                                          {op.requiresOtp && <span className="text-orange-600">OTP</span>}
                                        </div>
                                      </div>
                                    </div>

                                    {config && (
                                      <div className="flex items-center gap-3">
                                        <Button
                                          size="sm"
                                          variant={config.incomingEnabled ? "default" : "outline"}
                                          onClick={() => toggleOperatorSetting(config, "incoming")}
                                          disabled={updateOperatorMutation.isPending}
                                          data-testid={`toggle-incoming-${provider.id}-${countryCode}-${op.code}`}
                                          className="gap-2"
                                        >
                                          {config.incomingEnabled ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                          ) : (
                                            <XCircle className="w-4 h-4" />
                                          )}
                                          <span className="text-xs">Entrant</span>
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant={config.outgoingEnabled ? "default" : "outline"}
                                          onClick={() => toggleOperatorSetting(config, "outgoing")}
                                          disabled={updateOperatorMutation.isPending}
                                          data-testid={`toggle-outgoing-${provider.id}-${countryCode}-${op.code}`}
                                          className="gap-2"
                                        >
                                          {config.outgoingEnabled ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                          ) : (
                                            <XCircle className="w-4 h-4" />
                                          )}
                                          <span className="text-xs">Sortant</span>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
