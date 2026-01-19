import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Percent, Save, ChevronDown, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Building2, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FeeConfig } from "@shared/schema";
import { MBIYOPAY_COUNTRIES } from "@shared/mbiyopay-countries";
import { FEDAPAY_COUNTRIES } from "@shared/fedapay-countries";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProviderCountry {
  code: string;
  name: string;
  flag: string;
  operators: { code: string; name: string }[];
}

interface ProviderInfo {
  name: string;
  color: string;
  countries: ProviderCountry[];
}

const PROVIDERS: Record<string, ProviderInfo> = {
  mbiyopay: {
    name: "MbiyoPay",
    color: "bg-teal-500",
    countries: MBIYOPAY_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      flag: c.flag,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  fedapay: {
    name: "FedaPay",
    color: "bg-green-500",
    countries: FEDAPAY_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      flag: c.flag,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  afribapay: {
    name: "AfribaPay",
    color: "bg-purple-500",
    countries: [
      { code: "BJ", name: "Bénin", flag: "🇧🇯", operators: [
        { code: "moov", name: "Moov Money" },
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "celtiis", name: "Celtiis" },
      ]},
      { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "wave", name: "Wave" },
      ]},
      { code: "SN", name: "Sénégal", flag: "🇸🇳", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "free", name: "Free Money" },
        { code: "expresso", name: "Expresso" },
        { code: "wave", name: "Wave" },
      ]},
      { code: "BF", name: "Burkina Faso", flag: "🇧🇫", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
        { code: "wave", name: "Wave" },
        { code: "coris", name: "Coris Money" },
      ]},
      { code: "TG", name: "Togo", flag: "🇹🇬", operators: [
        { code: "moov", name: "Moov Money" },
        { code: "tmoney", name: "Togocell" },
        { code: "togocom", name: "TogoCom (Togocel)" },
      ]},
      { code: "ML", name: "Mali", flag: "🇲🇱", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "GN", name: "Guinée", flag: "🇬🇳", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "mtn", name: "MTN Mobile Money" },
      ]},
      { code: "NE", name: "Niger", flag: "🇳🇪", operators: [
        { code: "airtel", name: "Airtel Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "CM", name: "Cameroun", flag: "🇨🇲", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "mtn", name: "MTN Mobile Money" },
      ]},
      { code: "GH", name: "Ghana", flag: "🇬🇭", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "vodafone", name: "Vodafone Cash" },
        { code: "airteltigo", name: "AirtelTigo Money" },
      ]},
      { code: "CD", name: "RD Congo", flag: "🇨🇩", operators: [
        { code: "mpesa", name: "M-Pesa" },
        { code: "airtel", name: "Airtel Money" },
        { code: "orange", name: "Orange Money" },
      ]},
      { code: "TD", name: "Tchad", flag: "🇹🇩", operators: [
        { code: "airtel", name: "Airtel Money" },
        { code: "tigo", name: "Tigo Pesa" },
      ]},
      { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "airtel", name: "Airtel Money" },
      ]},
      { code: "CF", name: "Centrafrique", flag: "🇨🇫", operators: [
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "GA", name: "Gabon", flag: "🇬🇦", operators: [
        { code: "airtel", name: "Airtel Money" },
        { code: "moov", name: "Moov Money" },
      ]},
    ],
  },
  paydunya: {
    name: "Paydunya",
    color: "bg-blue-500",
    countries: [
      { code: "BJ", name: "Bénin", flag: "🇧🇯", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "TG", name: "Togo", flag: "🇹🇬", operators: [
        { code: "moov", name: "Moov Money" },
        { code: "togocom", name: "TogoCom" },
      ]},
      { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "SN", name: "Sénégal", flag: "🇸🇳", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "free", name: "Free Money" },
        { code: "wave", name: "Wave" },
      ]},
      { code: "BF", name: "Burkina Faso", flag: "🇧🇫", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "ML", name: "Mali", flag: "🇲🇱", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
      ]},
    ],
  },
};

export default function FeeConfigPage() {
  const { toast } = useToast();
  const [activeProvider, setActiveProvider] = useState("mbiyopay");
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
        delete newState[key][type as keyof typeof newState[typeof key]];
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
          Configurez les frais de transaction par pays et operateur
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Les frais sont configures par pays et operateur. Les memes frais s'appliquent a tous les fournisseurs qui utilisent ce pays/operateur.
        </AlertDescription>
      </Alert>

      <Tabs value={activeProvider} onValueChange={setActiveProvider}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(PROVIDERS).map(([key, info]) => (
            <TabsTrigger key={key} value={key} className="gap-2" data-testid={`tab-fee-${key}`}>
              <span className={`w-2 h-2 rounded-full ${info.color}`} />
              {info.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(PROVIDERS).map(([provider, info]) => (
          <TabsContent key={provider} value={provider} className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${info.color} flex items-center justify-center`}>
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="w-5 h-5" />
                      Pays et Operateurs {info.name}
                    </CardTitle>
                    <CardDescription>
                      {info.countries.length} pays - {info.countries.reduce((acc, c) => acc + c.operators.length, 0)} operateurs
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {info.countries.map((country) => {
                    const isExpanded = expandedCountry === `${provider}-${country.code}`;

                    return (
                      <div key={`${provider}-${country.code}`} className="border rounded-lg">
                        <button
                          onClick={() => setExpandedCountry(isExpanded ? null : `${provider}-${country.code}`)}
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                          data-testid={`button-expand-${provider}-${country.code}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{country.flag}</span>
                            <span className="font-medium">{country.name}</span>
                            <Badge variant="outline">{country.code}</Badge>
                            <Badge variant="secondary">{country.operators.length} operateurs</Badge>
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

                              {country.operators.map((op) => {
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
