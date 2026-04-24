import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Globe, Percent, Save, ChevronDown, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, Building2, RotateCcw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CountryFlag } from "@/components/country-flag";
import type { FeeConfig, User } from "@shared/schema";

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

const AFRIBAPAY_COUNTRIES: ProviderCountry[] = [
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
];

const PROVIDERS: ProviderInfo[] = [
  {
    id: "mbiyopay", name: "MbiyoPay", color: "bg-teal-500",
    countries: MBIYOPAY_COUNTRIES.map(c => ({ code: c.code, name: c.name, operators: c.operators.map(op => ({ code: op.code, name: op.name })) })),
  },
  {
    id: "fedapay", name: "FedaPay", color: "bg-green-500",
    countries: FEDAPAY_COUNTRIES.map(c => ({ code: c.code, name: c.name, operators: c.operators.map(op => ({ code: op.code, name: op.name })) })),
  },
  { id: "afribapay", name: "AfribaPay", color: "bg-purple-500", countries: AFRIBAPAY_COUNTRIES },
  {
    id: "moneyfusion", name: "MoneyFusion", color: "bg-rose-500",
    countries: MONEYFUSION_COUNTRIES.map(c => ({ code: c.code, name: c.name, operators: c.operators.map(op => ({ code: op.code, name: op.name })) })),
  },
  {
    id: "pawapay", name: "PawaPay", color: "bg-yellow-500",
    countries: PAWAPAY_COUNTRIES.map(c => ({ code: c.code, name: c.name, operators: c.operators.map(op => ({ code: op.code, name: op.name })) })),
  },
  {
    id: "paydunya", name: "Paydunya", color: "bg-blue-500",
    countries: PAYDUNYA_COUNTRIES.map(c => ({ code: c.code, name: c.name, operators: c.operators.map(op => ({ code: op.code, name: op.name })) })),
  },
  {
    id: "feexpay", name: "FeeXPay", color: "bg-emerald-500",
    countries: FEEXPAY_COUNTRIES.map(c => ({ code: c.code, name: c.name, operators: c.operators.map(op => ({ code: op.code, name: op.name })) })),
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

export function UserFeesDialog({ open, onClose, user }: Props) {
  const { toast } = useToast();
  const [activeProvider, setActiveProvider] = useState("mbiyopay");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<Record<string, { incoming?: string; outgoing?: string }>>({});

  const { data: userFees = [], isLoading: userFeesLoading } = useQuery<FeeConfig[]>({
    queryKey: [`/api/admin/users/${user?.id}/fee-configs`],
    enabled: open && !!user,
  });

  const { data: globalFees = [] } = useQuery<FeeConfig[]>({
    queryKey: ["/api/admin/business/fee-configs"],
    enabled: open,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: { provider: string; country: string; operator: string; incomingFeePercentage?: number; outgoingFeePercentage?: number }) => {
      return apiRequest("PUT", `/api/admin/users/${user!.id}/fee-configs/${payload.provider}/${payload.country}/${payload.operator}`, {
        incomingFeePercentage: payload.incomingFeePercentage,
        outgoingFeePercentage: payload.outgoingFeePercentage,
      });
    },
    onSuccess: () => {
      toast({ title: "Succes", description: "Frais personnalises enregistres" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${user?.id}/fee-configs`] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message || "Impossible d'enregistrer les frais", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { provider: string; country: string; operator: string }) => {
      return apiRequest("DELETE", `/api/admin/users/${user!.id}/fee-configs/${payload.provider}/${payload.country}/${payload.operator}`);
    },
    onSuccess: () => {
      toast({ title: "Reinitialise", description: "Frais reinitialises aux valeurs globales" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${user?.id}/fee-configs`] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message || "Impossible de reinitialiser", variant: "destructive" });
    },
  });

  const getUserFee = (provider: string, country: string, operator: string): FeeConfig | undefined =>
    userFees.find(f => f.provider === provider && f.country === country && f.operator === operator);

  const getGlobalFee = (provider: string, country: string, operator: string): FeeConfig | undefined =>
    globalFees.find(f => f.provider === provider && f.country === country && f.operator === operator)
    || globalFees.find(f => f.country === country && f.operator === operator);

  const DEFAULT_FEE = 60;

  const formatPct = (val: number | undefined) => val !== undefined ? `${(val / 10).toFixed(1)}%` : `${(DEFAULT_FEE / 10).toFixed(1)}%`;
  const toPct = (val: number | undefined) => val !== undefined ? (val / 10).toFixed(1) : (DEFAULT_FEE / 10).toFixed(1);

  const getEditing = (provider: string, country: string, operator: string) => {
    const key = `${provider}-${country}-${operator}`;
    return editingFees[key];
  };

  const setEditing = (provider: string, country: string, operator: string, type: "incoming" | "outgoing", value: string) => {
    const key = `${provider}-${country}-${operator}`;
    setEditingFees(prev => ({ ...prev, [key]: { ...prev[key], [type]: value } }));
  };

  const clearEditing = (provider: string, country: string, operator: string, type: "incoming" | "outgoing") => {
    const key = `${provider}-${country}-${operator}`;
    setEditingFees(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key][type as keyof (typeof next)[typeof key]];
        if (!next[key].incoming && !next[key].outgoing) delete next[key];
      }
      return next;
    });
  };

  const handleSave = (provider: string, country: string, operator: string, type: "incoming" | "outgoing") => {
    const editing = getEditing(provider, country, operator);
    const value = type === "incoming" ? editing?.incoming : editing?.outgoing;
    if (value === undefined || value === "") return;
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) {
      toast({ title: "Erreur", description: "Pourcentage entre 0 et 100", variant: "destructive" });
      return;
    }
    const percentage = Math.round(num * 10);
    const existing = getUserFee(provider, country, operator);
    const globalFee = getGlobalFee(provider, country, operator);
    upsertMutation.mutate({
      provider, country, operator,
      ...(type === "incoming"
        ? { incomingFeePercentage: percentage, outgoingFeePercentage: existing?.outgoingFeePercentage ?? globalFee?.outgoingFeePercentage ?? DEFAULT_FEE }
        : { outgoingFeePercentage: percentage, incomingFeePercentage: existing?.incomingFeePercentage ?? globalFee?.incomingFeePercentage ?? DEFAULT_FEE }),
    });
    clearEditing(provider, country, operator, type);
  };

  const handleReset = (provider: string, country: string, operator: string) => {
    const key = `${provider}-${country}-${operator}`;
    setEditingFees(prev => { const next = { ...prev }; delete next[key]; return next; });
    deleteMutation.mutate({ provider, country, operator });
  };

  if (!user) return null;

  const userName = user.businessName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Frais personnalises — {userName}
          </DialogTitle>
          <DialogDescription>
            Configurez des frais specifiques pour cet utilisateur. Si aucun frais personnalise n'est defini pour un operateur, les frais globaux business s'appliquent.
          </DialogDescription>
        </DialogHeader>

        {userFeesLoading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs value={activeProvider} onValueChange={(v) => { setActiveProvider(v); setExpandedCountry(null); }} className="mt-2">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              {PROVIDERS.map((info) => {
                const customCount = userFees.filter(f => f.provider === info.id).length;
                return (
                  <TabsTrigger key={info.id} value={info.id} className="gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid={`tab-user-fee-${info.id}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${info.color}`} />
                    <span className="truncate">{info.name}</span>
                    {customCount > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{customCount}</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {PROVIDERS.map((provider) => (
              <TabsContent key={provider.id} value={provider.id} className="mt-4">
                <div className="space-y-2">
                  {provider.countries.map((country) => {
                    const isExpanded = expandedCountry === `${provider.id}-${country.code}`;
                    const customInThisCountry = userFees.filter(f => f.provider === provider.id && f.country === country.code).length;

                    return (
                      <div key={`${provider.id}-${country.code}`} className="border rounded-md">
                        <button
                          onClick={() => setExpandedCountry(isExpanded ? null : `${provider.id}-${country.code}`)}
                          className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors"
                          data-testid={`button-expand-user-fee-${provider.id}-${country.code}`}
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <CountryFlag code={country.code} size="sm" />
                            <span className="font-medium text-sm">{country.name}</span>
                            <Badge variant="outline" className="text-xs">{country.code}</Badge>
                            <Badge variant="secondary" className="text-xs">{country.operators.length} op.</Badge>
                            {customInThisCountry > 0 && (
                              <Badge className="text-xs bg-amber-500 text-white">{customInThisCountry} perso.</Badge>
                            )}
                          </div>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </button>

                        {isExpanded && (
                          <div className="border-t p-3">
                            <div className="space-y-3">
                              <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                                <div>Operateur</div>
                                <div className="flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" /> Entrants</div>
                                <div className="flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3" /> Sortants</div>
                                <div>Global (ref.)</div>
                                <div>Action</div>
                              </div>

                              {country.operators.map((op) => {
                                const userFee = getUserFee(provider.id, country.code, op.code);
                                const globalFee = getGlobalFee(provider.id, country.code, op.code);
                                const isCustom = !!userFee;
                                const editing = getEditing(provider.id, country.code, op.code);

                                const incomingDisplay = editing?.incoming ?? toPct(userFee?.incomingFeePercentage ?? globalFee?.incomingFeePercentage);
                                const outgoingDisplay = editing?.outgoing ?? toPct(userFee?.outgoingFeePercentage ?? globalFee?.outgoingFeePercentage);

                                return (
                                  <div key={op.code} className="grid grid-cols-5 gap-2 items-center py-1">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-sm font-medium">{op.name}</span>
                                      {isCustom && <Badge className="text-xs bg-amber-500 text-white">perso.</Badge>}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <div className="relative flex-1 max-w-20">
                                        <Input
                                          type="number" min="0" max="100" step="0.1"
                                          value={incomingDisplay}
                                          onChange={(e) => setEditing(provider.id, country.code, op.code, "incoming", e.target.value)}
                                          className={`pr-5 text-center text-xs h-8 ${isCustom && !editing?.incoming ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                                          data-testid={`input-user-incoming-${provider.id}-${country.code}-${op.code}`}
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                      </div>
                                      {editing?.incoming && (
                                        <Button size="icon" variant="default" className="h-8 w-8 shrink-0"
                                          onClick={() => handleSave(provider.id, country.code, op.code, "incoming")}
                                          disabled={upsertMutation.isPending}
                                          data-testid={`button-save-user-incoming-${provider.id}-${country.code}-${op.code}`}
                                        >
                                          <Save className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <div className="relative flex-1 max-w-20">
                                        <Input
                                          type="number" min="0" max="100" step="0.1"
                                          value={outgoingDisplay}
                                          onChange={(e) => setEditing(provider.id, country.code, op.code, "outgoing", e.target.value)}
                                          className={`pr-5 text-center text-xs h-8 ${isCustom && !editing?.outgoing ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                                          data-testid={`input-user-outgoing-${provider.id}-${country.code}-${op.code}`}
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                      </div>
                                      {editing?.outgoing && (
                                        <Button size="icon" variant="default" className="h-8 w-8 shrink-0"
                                          onClick={() => handleSave(provider.id, country.code, op.code, "outgoing")}
                                          disabled={upsertMutation.isPending}
                                          data-testid={`button-save-user-outgoing-${provider.id}-${country.code}-${op.code}`}
                                        >
                                          <Save className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                      {formatPct(globalFee?.incomingFeePercentage)} / {formatPct(globalFee?.outgoingFeePercentage)}
                                    </div>

                                    <div>
                                      {isCustom && (
                                        <Button
                                          size="icon" variant="outline" className="h-8 w-8"
                                          onClick={() => handleReset(provider.id, country.code, op.code)}
                                          disabled={deleteMutation.isPending}
                                          title="Reinitialiser aux frais globaux"
                                          data-testid={`button-reset-user-fee-${provider.id}-${country.code}-${op.code}`}
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                        </Button>
                                      )}
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
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
