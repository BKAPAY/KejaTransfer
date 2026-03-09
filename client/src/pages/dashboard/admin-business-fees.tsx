import { useQuery, useMutation } from "@tanstack/react-query";
import { FeeConfig, COUNTRIES } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Percent, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CountryFlag } from "@/components/country-flag";

export default function AdminBusinessFees() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: configs = [], isLoading } = useQuery<FeeConfig[]>({
    queryKey: ["/api/admin/business/fee-configs"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<FeeConfig> }) => {
      const res = await apiRequest("PUT", `/api/admin/business/fee-configs`, { id, ...updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/fee-configs"] });
      toast({ title: "Succès", description: "Frais mis à jour" });
    },
  });

  const getCountryName = (code: string) => {
    return COUNTRIES.find(c => c.code === code)?.name || code;
  };

  // Group by provider for better organization
  const groupedConfigs = configs.reduce((acc, config) => {
    const provider = config.provider || "default";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(config);
    return acc;
  }, {} as Record<string, FeeConfig[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Frais Business</h1>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">Chargement...</CardContent>
        </Card>
      ) : Object.keys(groupedConfigs).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune configuration de frais trouvée
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedConfigs).map(([provider, providerConfigs]) => (
          <Card key={provider} className="overflow-hidden">
            <CardHeader className="bg-muted/50 border-b py-3 px-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                  Fournisseur: {provider === "default" ? "Par défaut" : provider}
                </CardTitle>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Pays</TableHead>
                  <TableHead>Opérateur</TableHead>
                  <TableHead className="w-[180px]">Frais Dépôt (%)</TableHead>
                  <TableHead className="w-[180px]">Frais Retrait (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CountryFlag code={config.country} />
                        <span className="font-medium">{getCountryName(config.country)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{config.operator}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[120px]">
                        <Input 
                          type="number" 
                          defaultValue={config.incomingFeePercentage / 10} 
                          step="0.1"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) * 10;
                            if (val !== config.incomingFeePercentage) {
                              updateMutation.mutate({ id: config.id, updates: { incomingFeePercentage: Math.round(val) } });
                            }
                          }}
                        />
                        <span className="text-muted-foreground text-sm">%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[120px]">
                        <Input 
                          type="number" 
                          defaultValue={config.outgoingFeePercentage / 10} 
                          step="0.1"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) * 10;
                            if (val !== config.outgoingFeePercentage) {
                              updateMutation.mutate({ id: config.id, updates: { outgoingFeePercentage: Math.round(val) } });
                            }
                          }}
                        />
                        <span className="text-muted-foreground text-sm">%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  );
}
