import { useQuery, useMutation } from "@tanstack/react-query";
import { CountryOperatorConfig, COUNTRIES } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CountryFlag } from "@/components/country-flag";
import { Fragment } from "react";

const OPERATOR_NAMES: Record<string, string> = {
  mtn: "MTN Mobile Money",
  orange: "Orange Money",
  moov: "Moov Money",
  wave: "Wave",
  togocom: "Togocom (TMoney)",
  airtel: "Airtel Money",
  vodacom: "Vodacom M-Pesa",
  tigo: "Tigo Cash",
  expresso: "Expresso (E-money)",
  free: "Free Money",
  wizall: "Wizall Money",
};

export default function AdminBusinessCountryOperator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: configs = [], isLoading } = useQuery<CountryOperatorConfig[]>({
    queryKey: ["/api/admin/business/country-operator"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<CountryOperatorConfig> }) => {
      const res = await apiRequest("PUT", `/api/admin/business/country-operator`, { id, ...updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-operator"] });
      toast({ title: "Succès", description: "Statut mis à jour" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ country, incomingEnabled, outgoingEnabled }: { country: string, incomingEnabled?: boolean, outgoingEnabled?: boolean }) => {
      const countryConfigs = configs.filter(c => c.country === country);
      await Promise.all(countryConfigs.map(config => 
        apiRequest("PUT", `/api/admin/business/country-operator`, { 
          id: config.id, 
          incomingEnabled: incomingEnabled ?? config.incomingEnabled,
          outgoingEnabled: outgoingEnabled ?? config.outgoingEnabled
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/country-operator"] });
      toast({ title: "Succès", description: "Mise à jour groupée terminée" });
    },
  });

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.country]) acc[config.country] = [];
    acc[config.country].push(config);
    return acc;
  }, {} as Record<string, CountryOperatorConfig[]>);

  const sortedCountries = Object.keys(groupedConfigs).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Pays & Opérateurs Business</h1>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opérateur</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-center w-[150px]">Dépôts (Payin)</TableHead>
              <TableHead className="text-center w-[150px]">Retraits (Payout)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Aucune configuration trouvée
                </TableCell>
              </TableRow>
            ) : (
              sortedCountries.map((countryCode) => {
                const country = COUNTRIES.find(c => c.code === countryCode);
                const countryConfigs = groupedConfigs[countryCode];
                const allIncomingEnabled = countryConfigs.every(c => c.incomingEnabled);
                const allOutgoingEnabled = countryConfigs.every(c => c.outgoingEnabled);

                return (
                  <Fragment key={countryCode}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="py-2">
                        <div className="flex items-center gap-2">
                          <CountryFlag code={countryCode} size="sm" />
                          <span className="font-bold">{country?.name || countryCode}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs"
                            onClick={() => bulkUpdateMutation.mutate({ country: countryCode, incomingEnabled: !allIncomingEnabled })}
                          >
                            {allIncomingEnabled ? (
                              <><XCircle className="h-3 w-3 mr-1" /> Désactiver tout</>
                            ) : (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Activer tout</>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs"
                            onClick={() => bulkUpdateMutation.mutate({ country: countryCode, outgoingEnabled: !allOutgoingEnabled })}
                          >
                            {allOutgoingEnabled ? (
                              <><XCircle className="h-3 w-3 mr-1" /> Désactiver tout</>
                            ) : (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Activer tout</>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {countryConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="pl-8">
                          <span className="capitalize">{OPERATOR_NAMES[config.operator] || config.operator}</span>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize text-muted-foreground">{config.provider}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch 
                            checked={config.incomingEnabled} 
                            onCheckedChange={(checked) => updateMutation.mutate({ id: config.id, updates: { incomingEnabled: checked } })}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch 
                            checked={config.outgoingEnabled} 
                            onCheckedChange={(checked) => updateMutation.mutate({ id: config.id, updates: { outgoingEnabled: checked } })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
