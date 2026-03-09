import { useQuery, useMutation } from "@tanstack/react-query";
import { CountryOperatorConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CountryFlag } from "@/components/country-flag";

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
              <TableHead>Pays</TableHead>
              <TableHead>Opérateur</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Dépôts (Payin)</TableHead>
              <TableHead>Retraits (Payout)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucune configuration trouvée
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CountryFlag countryCode={config.country} />
                      <span className="font-medium">{config.country}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{config.operator}</TableCell>
                  <TableCell className="capitalize">{config.provider}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={config.incomingEnabled} 
                      onCheckedChange={(checked) => updateMutation.mutate({ id: config.id, updates: { incomingEnabled: checked } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={config.outgoingEnabled} 
                      onCheckedChange={(checked) => updateMutation.mutate({ id: config.id, updates: { outgoingEnabled: checked } })}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
