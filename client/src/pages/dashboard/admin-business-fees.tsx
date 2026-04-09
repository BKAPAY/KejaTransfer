import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, Percent, Save, ChevronDown, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Building2, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { FeeConfig } from "@shared/schema";
import { MBIYOPAY_COUNTRIES } from "@shared/mbiyopay-countries";
import { FEDAPAY_COUNTRIES } from "@shared/fedapay-countries";
import { MONEYFUSION_COUNTRIES } from "@shared/moneyfusion-countries";
import { PAWAPAY_COUNTRIES } from "@shared/pawapay-countries";
import { PAYDUNYA_COUNTRIES } from "@shared/paydunya-countries";
import { FEEXPAY_COUNTRIES } from "@shared/feexpay-countries";

interface ProviderCountry {
  code: string;
  name: string;
  operators: { code: string; name: string }[];
}

interface ProviderInfo {
  id: string;
  name: string;
  color: string;
  countries: ProviderCountry[];
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "mbiyopay",
    name: "MbiyoPay",
    color: "bg-teal-500",
    countries: MBIYOPAY_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  {
    id: "fedapay",
    name: "FedaPay",
    color: "bg-green-500",
    countries: FEDAPAY_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  {
    id: "afribapay",
    name: "AfribaPay",
    color: "bg-purple-500",
    countries: [
      { code: "BJ", name: "Benin", operators: [
        { code: "moov", name: "Moov Money" },
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "celtiis", name: "Celtiis" },
      ]},
      { code: "CI", name: "Cote d'Ivoire", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "wave", name: "Wave" },
      ]},
      { code: "SN", name: "Senegal", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "free", name: "Free Money" },
        { code: "expresso", name: "Expresso" },
        { code: "wave", name: "Wave" },
      ]},
      { code: "BF", name: "Burkina Faso", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
        { code: "wave", name: "Wave" },
        { code: "coris", name: "Coris Money" },
      ]},
      { code: "TG", name: "Togo", operators: [
        { code: "moov", name: "Moov Money" },
        { code: "tmoney", name: "Togocell" },
        { code: "togocom", name: "TogoCom (Togocel)" },
      ]},
      { code: "ML", name: "Mali", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "moov", name: "Moov Money" },
        { code: "wave", name: "Wave" },
      ]},
      { code: "GN", name: "Guinee", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "mtn", name: "MTN Mobile Money" },
      ]},
      { code: "NE", name: "Niger", operators: [
        { code: "airtel", name: "Airtel Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "CM", name: "Cameroun", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "mtn", name: "MTN Mobile Money" },
      ]},
      { code: "GH", name: "Ghana", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "vodafone", name: "Vodafone Cash" },
        { code: "airteltigo", name: "AirtelTigo Money" },
      ]},
      { code: "CD", name: "RD Congo", operators: [
        { code: "orange", name: "Orange Money" },
        { code: "airtel", name: "Airtel Money" },
        { code: "mpesa", name: "M-Pesa" },
        { code: "africell", name: "Africell" },
        { code: "vodacom", name: "Vodacom" },
      ]},
      { code: "TD", name: "Tchad", operators: [
        { code: "airtel", name: "Airtel Money" },
        { code: "tigo", name: "Tigo Pesa" },
      ]},
      { code: "CG", name: "Congo-Brazzaville", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "airtel", name: "Airtel Money" },
      ]},
      { code: "CF", name: "Centrafrique", operators: [
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "GA", name: "Gabon", operators: [
        { code: "airtel", name: "Airtel Money" },
        { code: "moov", name: "Moov Money" },
      ]},
      { code: "RW", name: "Rwanda", operators: [
        { code: "mtn", name: "MTN Mobile Money" },
        { code: "airtel", name: "Airtel Money" },
      ]},
    ],
  },
  {
    id: "moneyfusion",
    name: "MoneyFusion",
    color: "bg-rose-500",
    countries: MONEYFUSION_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  {
    id: "pawapay",
    name: "PawaPay",
    color: "bg-yellow-500",
    countries: PAWAPAY_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  {
    id: "paydunya",
    name: "Paydunya",
    color: "bg-blue-500",
    countries: PAYDUNYA_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
  {
    id: "feexpay",
    name: "FeeXPay",
    color: "bg-emerald-500",
    countries: FEEXPAY_COUNTRIES.map(c => ({
      code: c.code,
      name: c.name,
      operators: c.operators.map(op => ({ code: op.code, name: op.name })),
    })),
  },
];

export default function AdminBusinessFees() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeProvider, setActiveProvider] = useState("mbiyopay");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<Record<string, { incoming: string; outgoing: string }>>({});

  const { data: feeConfigs, isLoading } = useQuery<FeeConfig[]>({
    queryKey: ["/api/admin/business/fee-configs"],
  });

  const updateFeeMutation = useMutation({
    mutationFn: async (payload: {
      provider: string;
      country: string;
      operator: string;
      incomingFeePercentage?: number;
      outgoingFeePercentage?: number;
    }) => {
      return apiRequest("PUT", `/api/admin/business/fee-configs/${payload.provider}/${payload.country}/${payload.operator}`, {
        incomingFeePercentage: payload.incomingFeePercentage,
        outgoingFeePercentage: payload.outgoingFeePercentage,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succes",
        description: "Frais business mis a jour avec succes",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/fee-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour les frais",
        variant: "destructive",
      });
    },
  });

  const getConfigForOperator = (provider: string, country: string, operator: string): FeeConfig | undefined => {
    return feeConfigs?.find(c => c.provider === provider && c.country === country && c.operator === operator);
  };

  const getEditingFee = (provider: string, country: string, operator: string) => {
    const key = `${provider}-${country}-${operator}`;
    return editingFees[key];
  };

  const setEditingFee = (provider: string, country: string, operator: string, type: "incoming" | "outgoing", value: string) => {
    const key = `${provider}-${country}-${operator}`;
    setEditingFees(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: value,
      },
    }));
  };

  const handleSaveFee = (provider: string, country: string, operator: string, type: "incoming" | "outgoing") => {
    const key = `${provider}-${country}-${operator}`;
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
      provider,
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")} data-testid="button-back-business">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")} data-testid="button-back-business">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-business-fees-title">Configuration des Frais Business par Fournisseur</h1>
          <p className="text-sm text-muted-foreground">
            Configurez les frais de transaction specifiques a chaque fournisseur, pays et operateur pour les comptes business
          </p>
        </div>
      </div>

      <Tabs value={activeProvider} onValueChange={setActiveProvider}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {PROVIDERS.map((info) => (
            <TabsTrigger key={info.id} value={info.id} className="gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid={`tab-business-fee-${info.id}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${info.color}`} />
              <span className="truncate">{info.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {PROVIDERS.map((provider) => (
          <TabsContent key={provider.id} value={provider.id} className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${provider.color} flex items-center justify-center`}>
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="w-5 h-5" />
                      Frais Business {provider.name}
                    </CardTitle>
                    <CardDescription>
                      {provider.countries.length} pays - {provider.countries.reduce((acc, c) => acc + c.operators.length, 0)} operateurs
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {provider.countries.map((country) => {
                    const isExpanded = expandedCountry === `${provider.id}-${country.code}`;

                    return (
                      <div key={`${provider.id}-${country.code}`} className="border rounded-md">
                        <button
                          onClick={() => setExpandedCountry(isExpanded ? null : `${provider.id}-${country.code}`)}
                          className="w-full flex items-center justify-between gap-2 p-4 hover:bg-muted/50 transition-colors"
                          data-testid={`button-expand-business-${provider.id}-${country.code}`}
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <Globe className="w-5 h-5 text-muted-foreground" />
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
                                <div>Actuel</div>
                              </div>

                              {country.operators.map((op) => {
                                const config = getConfigForOperator(provider.id, country.code, op.code);
                                const editing = getEditingFee(provider.id, country.code, op.code);
                                const incomingValue = editing?.incoming ?? formatFeeInput(config?.incomingFeePercentage);
                                const outgoingValue = editing?.outgoing ?? formatFeeInput(config?.outgoingFeePercentage);

                                return (
                                  <div key={op.code} className="grid grid-cols-4 gap-4 items-center py-2">
                                    <div className="flex items-center gap-2 flex-wrap">
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
                                          onChange={(e) => setEditingFee(provider.id, country.code, op.code, "incoming", e.target.value)}
                                          className="pr-6 text-center"
                                          data-testid={`input-business-incoming-${provider.id}-${country.code}-${op.code}`}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                                      </div>
                                      {editing?.incoming && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveFee(provider.id, country.code, op.code, "incoming")}
                                          disabled={updateFeeMutation.isPending}
                                          data-testid={`button-save-business-incoming-${provider.id}-${country.code}-${op.code}`}
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
                                          onChange={(e) => setEditingFee(provider.id, country.code, op.code, "outgoing", e.target.value)}
                                          className="pr-6 text-center"
                                          data-testid={`input-business-outgoing-${provider.id}-${country.code}-${op.code}`}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                                      </div>
                                      {editing?.outgoing && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveFee(provider.id, country.code, op.code, "outgoing")}
                                          disabled={updateFeeMutation.isPending}
                                          data-testid={`button-save-business-outgoing-${provider.id}-${country.code}-${op.code}`}
                                        >
                                          <Save className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>

                                    <div className="text-sm text-muted-foreground" data-testid={`text-business-current-fee-${provider.id}-${country.code}-${op.code}`}>
                                      {formatFeeDisplay(config?.incomingFeePercentage)} / {formatFeeDisplay(config?.outgoingFeePercentage)}
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
