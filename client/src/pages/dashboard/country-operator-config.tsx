import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Wifi, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CountryOperatorConfig } from "@shared/schema";
import { COUNTRIES as COUNTRIES_ARRAY, OPERATORS as OPERATORS_BY_COUNTRY } from "@shared/schema";

// Create lookup maps from shared arrays
const COUNTRIES: Record<string, { name: string; code: string; flag: string }> = Object.fromEntries(
  COUNTRIES_ARRAY.map(c => [c.code, c])
);

// Flatten all operators from all countries into a lookup map
const OPERATORS_NAMES: Record<string, string> = {};
Object.values(OPERATORS_BY_COUNTRY).forEach(ops => {
  ops.forEach(op => {
    OPERATORS_NAMES[op.code] = op.name;
  });
});

export default function CountryOperatorConfig() {
  const { toast } = useToast();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery<CountryOperatorConfig[]>({
    queryKey: ["/api/admin/country-operator-config"],
  });

  const updateMutation = useMutation({
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
        description: "Configuration mise à jour",
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

  const toggleSetting = (config: CountryOperatorConfig, type: "incoming" | "outgoing") => {
    const newValue = type === "incoming" ? !config.incomingEnabled : !config.outgoingEnabled;
    updateMutation.mutate({
      country: config.country,
      operator: config.operator,
      ...(type === "incoming" ? { incomingEnabled: newValue } : { outgoingEnabled: newValue }),
    });
  };

  const groupedConfigs: Record<string, CountryOperatorConfig[]> = {};
  if (configs) {
    configs.forEach((config) => {
      if (!groupedConfigs[config.country]) {
        groupedConfigs[config.country] = [];
      }
      groupedConfigs[config.country].push(config);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Gestion des Pays & Opérateurs</h1>
        <p className="text-sm text-muted-foreground">
          Contrôlez quels pays et opérateurs sont disponibles pour les paiements entrants et sortants
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
          {Object.entries(COUNTRIES).map(([countryCode, countryInfo]) => {
            const countryConfigs = groupedConfigs[countryCode] || [];
            const isExpanded = expandedCountry === countryCode;

            if (countryConfigs.length === 0) return null;

            return (
              <Card key={countryCode} className="cursor-pointer hover-elevate">
                <div
                  onClick={() => setExpandedCountry(isExpanded ? null : countryCode)}
                  className="p-6 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{countryInfo.flag}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{countryInfo.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {countryConfigs.length} opérateur{countryConfigs.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
                </div>

                {isExpanded && (
                  <CardContent className="border-t pt-6">
                    <div className="space-y-4">
                      {countryConfigs.map((config) => (
                        <div
                          key={`${config.country}-${config.operator}`}
                          className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Wifi className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {OPERATORS_NAMES[config.operator] || config.operator}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Incoming (Deposits) */}
                            <Button
                              size="sm"
                              variant={config.incomingEnabled ? "default" : "outline"}
                              onClick={() => toggleSetting(config, "incoming")}
                              disabled={updateMutation.isPending}
                              data-testid={`toggle-incoming-${config.country}-${config.operator}`}
                              className="gap-2"
                            >
                              {config.incomingEnabled ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              <span className="text-xs">Entrant</span>
                            </Button>

                            {/* Outgoing (Withdrawals) */}
                            <Button
                              size="sm"
                              variant={config.outgoingEnabled ? "default" : "outline"}
                              onClick={() => toggleSetting(config, "outgoing")}
                              disabled={updateMutation.isPending}
                              data-testid={`toggle-outgoing-${config.country}-${config.operator}`}
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
                        </div>
                      ))}
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
