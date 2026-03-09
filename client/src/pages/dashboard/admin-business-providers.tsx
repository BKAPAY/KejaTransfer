import { useQuery, useMutation } from "@tanstack/react-query";
import { ProviderConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Save, Shield, Key, Eye, EyeOff, Globe, Server } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminBusinessProviders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const { data: configs = [], isLoading } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/admin/business/provider-configs"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ provider, updates }: { provider: string, updates: Partial<ProviderConfig> }) => {
      const res = await apiRequest("PUT", `/api/admin/business/provider-configs/${provider}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/provider-configs"] });
      toast({ title: "Succès", description: "Configuration mise à jour" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getProviderConfig = (provider: string): Partial<ProviderConfig> & { provider: string; isActive: boolean } => {
    const config = configs.find(c => c.provider === provider);
    if (config) return config;
    return { provider, isActive: false };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const pawapayConfig = getProviderConfig("pawapay");
  const paydunyaConfig = getProviderConfig("paydunya");
  const fedapayConfig = getProviderConfig("fedapay");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")} data-testid="button-back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Fournisseurs Business</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PawaPay */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>PawaPay</CardTitle>
                  <CardDescription>Paiements Afrique de l'Est & Nigeria</CardDescription>
                </div>
              </div>
              <Switch 
                checked={pawapayConfig.isActive} 
                onCheckedChange={(checked) => updateMutation.mutate({ provider: "pawapay", updates: { isActive: checked } })}
                data-testid="switch-pawapay-active"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key (payin - sessions)</Label>
              <div className="flex gap-2">
                <Input 
                  type={showKeys["pawapay-api"] ? "text" : "password"} 
                  defaultValue={pawapayConfig.apiKey || ""} 
                  onBlur={(e) => updateMutation.mutate({ provider: "pawapay", updates: { apiKey: e.target.value } })}
                  placeholder="Bearer ..."
                  data-testid="input-pawapay-apikey"
                />
                <Button variant="outline" size="icon" onClick={() => toggleShowKey("pawapay-api")}>
                  {showKeys["pawapay-api"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secret Key (payout)</Label>
              <Input 
                type="password"
                defaultValue={pawapayConfig.secretKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "pawapay", updates: { secretKey: e.target.value } })}
                placeholder="sk_..."
                data-testid="input-pawapay-secretkey"
              />
            </div>
            <div className="space-y-2">
              <Label>IPN Secret</Label>
              <Input 
                type="password"
                defaultValue={pawapayConfig.ipnSecret || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "pawapay", updates: { ipnSecret: e.target.value } })}
                data-testid="input-pawapay-ipnsecret"
              />
            </div>
          </CardContent>
        </Card>

        {/* Paydunya */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Paydunya</CardTitle>
                  <CardDescription>Afrique de l'Ouest (Business)</CardDescription>
                </div>
              </div>
              <Switch 
                checked={paydunyaConfig.isActive} 
                onCheckedChange={(checked) => updateMutation.mutate({ provider: "paydunya", updates: { isActive: checked } })}
                data-testid="switch-paydunya-active"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Master Key</Label>
                <Input 
                  type="password" 
                  defaultValue={paydunyaConfig.masterKey || ""} 
                  onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { masterKey: e.target.value } })}
                  data-testid="input-paydunya-masterkey"
                />
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
                <Input 
                  type="password" 
                  defaultValue={paydunyaConfig.token || ""} 
                  onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { token: e.target.value } })}
                  data-testid="input-paydunya-token"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Public Key</Label>
              <Input 
                defaultValue={paydunyaConfig.publicKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { publicKey: e.target.value } })}
                data-testid="input-paydunya-publickey"
              />
            </div>
            <div className="space-y-2">
              <Label>Private Key</Label>
              <Input 
                type="password" 
                defaultValue={paydunyaConfig.secretKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { secretKey: e.target.value } })}
                data-testid="input-paydunya-privatekey"
              />
            </div>
          </CardContent>
        </Card>

        {/* FedaPay */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>FedaPay</CardTitle>
                  <CardDescription>Paiements & Cartes Bancaires</CardDescription>
                </div>
              </div>
              <Switch 
                checked={fedapayConfig.isActive} 
                onCheckedChange={(checked) => updateMutation.mutate({ provider: "fedapay", updates: { isActive: checked } })}
                data-testid="switch-fedapay-active"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key (payin)</Label>
              <Input 
                type="password"
                defaultValue={fedapayConfig.apiKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "fedapay", updates: { apiKey: e.target.value } })}
                placeholder="sk_live_..."
                data-testid="input-fedapay-apikey"
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Key (payout)</Label>
              <Input 
                type="password"
                defaultValue={fedapayConfig.secretKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "fedapay", updates: { secretKey: e.target.value } })}
                placeholder="sk_live_..."
                data-testid="input-fedapay-secretkey"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
