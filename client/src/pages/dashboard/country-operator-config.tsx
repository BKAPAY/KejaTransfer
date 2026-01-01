import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Wifi, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CountryOperatorConfig, CountryStatus } from "@shared/schema";
import { AFRIBAPAY_COUNTRIES } from "@shared/afribapay-countries";

export default function CountryOperatorConfig() {
  const { toast } = useToast();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const { data: operatorConfigs, isLoading: isLoadingOperators } = useQuery<CountryOperatorConfig[]>({
    queryKey: ["/api/admin/country-operator-config"],
  });

  const { data: countryStatuses, isLoading: isLoadingCountries } = useQuery<CountryStatus[]>({
    queryKey: ["/api/admin/country-status"],
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async (payload: {
      country: string;
      operator: string;
      incomingEnabled?: boolean;
      outgoingEnabled?: boolean;
    }) => {
      return apiRequest("PUT", `/api/admin/country-operator-config/${payload.country}/${payload.operator}`, {
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
      country: string;
      payinEnabled?: boolean;
      payoutEnabled?: boolean;
    }) => {
      return apiRequest("PUT", `/api/admin/country-status/${payload.country}`, {
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
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  const toggleOperatorSetting = (config: CountryOperatorConfig, type: "incoming" | "outgoing") => {
    const newValue = type === "incoming" ? !config.incomingEnabled : !config.outgoingEnabled;
    updateOperatorMutation.mutate({
      country: config.country,
      operator: config.operator,
      ...(type === "incoming" ? { incomingEnabled: newValue } : { outgoingEnabled: newValue }),
    });
  };

  const toggleCountrySetting = (status: CountryStatus, type: "payin" | "payout") => {
    const newValue = type === "payin" ? !status.payinEnabled : !status.payoutEnabled;
    updateCountryMutation.mutate({
      country: status.country,
      ...(type === "payin" ? { payinEnabled: newValue } : { payoutEnabled: newValue }),
    });
  };

  const groupedConfigs: Record<string, CountryOperatorConfig[]> = {};
  if (operatorConfigs) {
    operatorConfigs.forEach((config) => {
      if (!groupedConfigs[config.country]) {
        groupedConfigs[config.country] = [];
      }
      groupedConfigs[config.country].push(config);
    });
  }

  const countryStatusMap: Record<string, CountryStatus> = {};
  if (countryStatuses) {
    countryStatuses.forEach((status) => {
      countryStatusMap[status.country] = status;
    });
  }

  const isLoading = isLoadingOperators || isLoadingCountries;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Pays et Opérateurs</h1>
        <p className="text-sm text-muted-foreground">
          Contrôlez quels pays et opérateurs sont disponibles pour les paiements entrants et sortants (AfribaPay)
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {AFRIBAPAY_COUNTRIES.map((countryInfo) => {
            const countryCode = countryInfo.code;
            const countryConfigs = groupedConfigs[countryCode] || [];
            const countryStatus = countryStatusMap[countryCode];
            const isExpanded = expandedCountry === countryCode;

            return (
              <Card key={countryCode} className="overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{countryInfo.flag}</span>
                      <div>
                        <h3 className="font-semibold text-foreground">{countryInfo.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {countryInfo.operators.length} opérateur{countryInfo.operators.length > 1 ? "s" : ""} - {countryInfo.currency}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {countryStatus && (
                        <>
                          <Button
                            size="sm"
                            variant={countryStatus.payinEnabled ? "default" : "outline"}
                            onClick={() => toggleCountrySetting(countryStatus, "payin")}
                            disabled={updateCountryMutation.isPending}
                            data-testid={`toggle-country-payin-${countryCode}`}
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
                            data-testid={`toggle-country-payout-${countryCode}`}
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
                        onClick={() => setExpandedCountry(isExpanded ? null : countryCode)}
                        data-testid={`expand-country-${countryCode}`}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Opérateurs AfribaPay</h4>
                      {countryInfo.operators.map((afribapayOp) => {
                        const config = countryConfigs.find(c => c.operator === afribapayOp.code);
                        
                        return (
                          <div
                            key={`${countryCode}-${afribapayOp.code}`}
                            className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Wifi className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <span className="font-medium text-foreground">{afribapayOp.name}</span>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  {afribapayOp.payin && <span className="text-green-600">Payin</span>}
                                  {afribapayOp.payout && <span className="text-blue-600">Payout</span>}
                                  {afribapayOp.requiresOtp && <span className="text-orange-600">OTP</span>}
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
                                  data-testid={`toggle-incoming-${countryCode}-${afribapayOp.code}`}
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
                                  data-testid={`toggle-outgoing-${countryCode}-${afribapayOp.code}`}
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
    </div>
  );
}
