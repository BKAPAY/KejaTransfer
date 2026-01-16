import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Percent, Save, ChevronDown, ChevronRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FeeConfig } from "@shared/schema";
import { COUNTRIES, OPERATORS } from "@shared/schema";

export default function FeeConfigPage() {
  const { toast } = useToast();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<Record<string, { incoming: string; outgoing: string }>>({});

  const { data: feeConfigs, isLoading } = useQuery<FeeConfig[]>({
    queryKey: ["/api/admin/fee-configs"],
  });

  const updateFeeMutation = useMutation({
    mutationFn: async (payload: {
      country: string;
      operator: string;
      incomingFeePercentage?: number;
      outgoingFeePercentage?: number;
    }) => {
      return apiRequest("PUT", `/api/admin/fee-configs/${payload.country}/${payload.operator}`, {
        incomingFeePercentage: payload.incomingFeePercentage,
        outgoingFeePercentage: payload.outgoingFeePercentage,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succes",
        description: "Frais mis a jour avec succes",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fee-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour les frais",
        variant: "destructive",
      });
    },
  });

  const getConfigForOperator = (country: string, operator: string): FeeConfig | undefined => {
    return feeConfigs?.find(c => c.country === country && c.operator === operator);
  };

  const getEditingFee = (country: string, operator: string) => {
    const key = `${country}-${operator}`;
    return editingFees[key];
  };

  const setEditingFee = (country: string, operator: string, type: "incoming" | "outgoing", value: string) => {
    const key = `${country}-${operator}`;
    setEditingFees(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: value,
      },
    }));
  };

  const handleSaveFee = (country: string, operator: string, type: "incoming" | "outgoing") => {
    const key = `${country}-${operator}`;
    const editing = editingFees[key];
    const value = type === "incoming" ? editing?.incoming : editing?.outgoing;
    
    if (value === undefined || value === "") return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      toast({
        title: "Erreur",
        description: "Le pourcentage doit etre entre 0 et 100",
        variant: "destructive",
      });
      return;
    }

    const percentage = Math.round(numValue * 10);

    updateFeeMutation.mutate({
      country,
      operator,
      ...(type === "incoming" 
        ? { incomingFeePercentage: percentage } 
        : { outgoingFeePercentage: percentage }),
    });

    setEditingFees(prev => {
      const newState = { ...prev };
      if (newState[key]) {
        delete newState[key][type];
        if (Object.keys(newState[key]).length === 0) {
          delete newState[key];
        }
      }
      return newState;
    });
  };

  const formatFeeDisplay = (percentage: number | undefined): string => {
    if (percentage === undefined) return "-";
    return `${(percentage / 10).toFixed(1)}%`;
  };

  const formatFeeInput = (percentage: number | undefined): string => {
    if (percentage === undefined) return "";
    return (percentage / 10).toFixed(1);
  };

  const countryOperators = (countryCode: string) => {
    return OPERATORS[countryCode as keyof typeof OPERATORS] || [];
  };

  const getCountryName = (code: string) => {
    return COUNTRIES.find(c => c.code === code)?.name || code;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Configuration des Frais</h1>
        <p className="text-sm text-muted-foreground">
          Configurez les frais de transaction par pays et par operateur pour les paiements entrants et sortants
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Frais par Pays et Operateur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {COUNTRIES.map((country) => {
              const operators = countryOperators(country.code);
              const isExpanded = expandedCountry === country.code;

              return (
                <div key={country.code} className="border rounded-lg">
                  <button
                    onClick={() => setExpandedCountry(isExpanded ? null : country.code)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    data-testid={`button-expand-${country.code}`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{country.name}</span>
                      <Badge variant="outline">{country.code}</Badge>
                      <Badge variant="secondary">{operators.length} operateurs</Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t p-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                          <div>Operateur</div>
                          <div className="flex items-center gap-1">
                            <ArrowDownToLine className="w-4 h-4" />
                            Frais Entrants
                          </div>
                          <div className="flex items-center gap-1">
                            <ArrowUpFromLine className="w-4 h-4" />
                            Frais Sortants
                          </div>
                          <div>Actions</div>
                        </div>

                        {operators.map((op) => {
                          const config = getConfigForOperator(country.code, op.code);
                          const editing = getEditingFee(country.code, op.code);
                          const incomingValue = editing?.incoming ?? formatFeeInput(config?.incomingFeePercentage);
                          const outgoingValue = editing?.outgoing ?? formatFeeInput(config?.outgoingFeePercentage);

                          return (
                            <div key={op.code} className="grid grid-cols-4 gap-4 items-center py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{op.name}</span>
                                <Badge variant="outline" className="text-xs">{op.code}</Badge>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1 max-w-24">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={incomingValue}
                                    onChange={(e) => setEditingFee(country.code, op.code, "incoming", e.target.value)}
                                    className="pr-6 text-center"
                                    data-testid={`input-incoming-${country.code}-${op.code}`}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                                </div>
                                {editing?.incoming && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveFee(country.code, op.code, "incoming")}
                                    disabled={updateFeeMutation.isPending}
                                    data-testid={`button-save-incoming-${country.code}-${op.code}`}
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1 max-w-24">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={outgoingValue}
                                    onChange={(e) => setEditingFee(country.code, op.code, "outgoing", e.target.value)}
                                    className="pr-6 text-center"
                                    data-testid={`input-outgoing-${country.code}-${op.code}`}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                                </div>
                                {editing?.outgoing && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveFee(country.code, op.code, "outgoing")}
                                    disabled={updateFeeMutation.isPending}
                                    data-testid={`button-save-outgoing-${country.code}-${op.code}`}
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="text-sm text-muted-foreground">
                                Actuel: {formatFeeDisplay(config?.incomingFeePercentage)} / {formatFeeDisplay(config?.outgoingFeePercentage)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
