import { useQuery, useMutation } from "@tanstack/react-query";
import { FeeConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Percent } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Frais Business</h1>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pays</TableHead>
              <TableHead>Opérateur</TableHead>
              <TableHead>Frais Dépôt (%)</TableHead>
              <TableHead>Frais Retrait (%)</TableHead>
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
                  Aucune configuration de frais trouvée
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
                      <span className="text-muted-foreground">%</span>
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
                      <span className="text-muted-foreground">%</span>
                    </div>
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
