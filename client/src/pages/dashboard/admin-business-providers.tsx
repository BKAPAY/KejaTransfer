import { useQuery, useMutation } from "@tanstack/react-query";
import { ProviderConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Save, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminBusinessProviders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: configs = [], isLoading } = useQuery<ProviderConfig[]>({
    queryKey: ["/api/admin/business/provider-configs"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ provider, updates }: { provider: string, updates: Partial<ProviderConfig> }) => {
      const res = await apiRequest("PUT", `/api/admin/business/provider-configs`, { provider, ...updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/provider-configs"] });
      toast({ title: "Succès", description: "Configuration mise à jour" });
    },
  });

  const pawapayConfig = configs.find(c => c.provider === "pawapay") || { provider: "pawapay", isActive: false, apiKey: "" };
  const paydunyaConfig = configs.find(c => c.provider === "paydunya") || { provider: "paydunya", isActive: false, apiKey: "", publicKey: "", privateKey: "", token: "" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Fournisseurs Business</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PawaPay */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>PawaPay</CardTitle>
                <CardDescription>Paiements Afrique de l'Est & Nigeria</CardDescription>
              </div>
              <Switch 
                checked={pawapayConfig.isActive} 
                onCheckedChange={(checked) => updateMutation.mutate({ provider: "pawapay", updates: { isActive: checked } })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Clé API (PawaPay)</label>
              <Input 
                type="password" 
                defaultValue={pawapayConfig.apiKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "pawapay", updates: { apiKey: e.target.value } })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Paydunya */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Paydunya</CardTitle>
                <CardDescription>Paiements Afrique de l'Ouest (Business)</CardDescription>
              </div>
              <Switch 
                checked={paydunyaConfig.isActive} 
                onCheckedChange={(checked) => updateMutation.mutate({ provider: "paydunya", updates: { isActive: checked } })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Master Key</label>
              <Input 
                type="password" 
                defaultValue={paydunyaConfig.masterKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { masterKey: e.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Public Key</label>
              <Input 
                defaultValue={paydunyaConfig.publicKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { publicKey: e.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Private Key</label>
              <Input 
                type="password" 
                defaultValue={paydunyaConfig.privateKey || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { privateKey: e.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Token</label>
              <Input 
                type="password" 
                defaultValue={paydunyaConfig.token || ""} 
                onBlur={(e) => updateMutation.mutate({ provider: "paydunya", updates: { token: e.target.value } })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
