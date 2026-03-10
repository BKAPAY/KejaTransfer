import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Wifi, CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CountryOperatorConfig, CountryStatus } from "@shared/schema";
import { AFRIBAPAY_COUNTRIES } from "@shared/afribapay-countries";
import { PAYDUNYA_COUNTRIES } from "@shared/paydunya-countries";
import { FEDAPAY_COUNTRIES } from "@shared/fedapay-countries";
import { MBIYOPAY_COUNTRIES } from "@shared/mbiyopay-countries";
import { MONEYFUSION_COUNTRIES } from "@shared/moneyfusion-countries";
import { PAWAPAY_COUNTRIES } from "@shared/pawapay-countries";

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
    id: "moneyfusion", 
    name: "MoneyFusion", 
    color: "bg-rose-500",
    countries: MONEYFUSION_COUNTRIES 
  },
  {
    id: "pawapay",
    name: "PawaPay",
    color: "bg-yellow-500",
    countries: PAWAPAY_COUNTRIES,
  },
];

export default function AdminBusinessCountryOperator() {
  const { toast } = useToast();
  const [activeProvider, setActiveProvider] = useState("afribapay");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const { data: allOperatorConfigs, isLoading: isLoadingOperators } = useQuery<CountryOperatorConfig[]>({
    queryKey: ["/api/admin/business/country-operator"],
  });

  const { data: allCountryStatuses, isLoading: isLoadingCountries } = useQuery<CountryStatus[]>({
    queryKey: ["/api/admin/business/country-status"],
  });

  const { data: providers } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/admin/business/provider-configs"],
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async (payload: {
      provider: string;
      country: string;
      operator: string;
      incomingEnabled?: boolean;
      outgoingEnabled?: boolean;
    }) => {
      return apiRequest("PUT", `/api/admin/business/country-operator/${payload.provider}/${payload.country}/${payload.operator}`, {
        incomingEnabled: payload.incomingEnabled,
        outgoingEnabled: payload.outgoingEnabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succes",
        description: "Configuration operateur mise a jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-operator"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour",
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
      return apiRequest("PUT", `/api/admin/business/country-status/${payload.provider}/${payload.country}`, {
        payinEnabled: payload.payinEnabled,
        payoutEnabled: payload.payoutEnabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succes",
        description: "Statut du pays mis a jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-operator"] });
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
    return providers?.find((p: any) => p.provider === providerId)?.isActive || false;
  };

  const isLoading = isLoadingOperators || isLoadingCountries;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-business-country-operator-title">
          Pays & Operateurs Business
        </h1>
        <p className="text-sm text-muted-foreground">
          Controlez quels pays et operateurs sont disponibles pour les paiements entrants et sortants par fournisseur (scope business)
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
                data-testid={`tab-business-provider-${provider.id}`}
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
                    Ce fournisseur est actuellement desactive. 
                    Allez dans la page <strong>Fournisseurs Business</strong> pour l'activer.
                  </p>
                </div>
              )}

              {isLoading ? (
                <div className="grid gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
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
                                <h3 className="font-semibold text-foreground" data-testid={`text-business-country-${provider.id}-${countryCode}`}>
                                  {countryInfo.name} ({countryCode})
                                </h3>
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
                                    data-testid={`toggle-business-country-payin-${provider.id}-${countryCode}`}
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
                                    data-testid={`toggle-business-country-payout-${provider.id}-${countryCode}`}
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
                                data-testid={`expand-business-country-${provider.id}-${countryCode}`}
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
                                Operateurs {provider.name}
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
                                          data-testid={`toggle-business-incoming-${provider.id}-${countryCode}-${op.code}`}
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
                                          data-testid={`toggle-business-outgoing-${provider.id}-${countryCode}-${op.code}`}
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
