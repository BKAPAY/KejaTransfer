import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Network, Trash2, CheckCircle2, AlertCircle, ArrowLeft, Copy, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface IpLog {
  id: string;
  ip_address: string;
  error_message: string;
  country_code: string;
  operator_code: string;
  resolved: boolean;
  created_at: string;
}

export default function IpAddresses() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const { data: ipLogs, isLoading } = useQuery<IpLog[]>({
    queryKey: ["/api/admin/moneyfusion-ip-logs"],
  });

  const markResolvedMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/moneyfusion-ip-logs/${id}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moneyfusion-ip-logs"] });
      toast({ title: "IP marquee comme configuree" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/moneyfusion-ip-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moneyfusion-ip-logs"] });
      toast({ title: "Entree supprimee" });
    },
  });

  const deleteAllResolvedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/admin/moneyfusion-ip-logs/resolved");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moneyfusion-ip-logs"] });
      toast({ title: "Entrees resolues supprimees" });
    },
  });

  const copyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const uniqueIps = ipLogs ? Array.from(new Set(ipLogs.filter(l => !l.resolved).map(l => l.ip_address))) : [];
  const unresolvedCount = ipLogs?.filter(l => !l.resolved).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard/admin")} data-testid="button-back-admin">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Adresses IP - MoneyFusion</h1>
          <p className="text-sm text-muted-foreground">
            Adresses IP du serveur a configurer dans le tableau de bord MoneyFusion pour autoriser les retraits
          </p>
        </div>
      </div>

      {unresolvedCount > 0 && uniqueIps.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              IP a configurer chez MoneyFusion
            </CardTitle>
            <CardDescription>
              Copiez ces adresses IP et ajoutez-les dans la section Parametres de votre tableau de bord MoneyFusion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uniqueIps.map((ip) => (
                <div key={ip} className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <code className="text-base font-mono font-bold flex-1" data-testid={`text-ip-${ip}`}>{ip}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyIp(ip)}
                    data-testid={`button-copy-ip-${ip}`}
                  >
                    {copiedIp === ip ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Historique des erreurs IP</CardTitle>
            <CardDescription>{ipLogs?.length || 0} entrees au total</CardDescription>
          </div>
          {ipLogs && ipLogs.filter(l => l.resolved).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteAllResolvedMutation.mutate()}
              disabled={deleteAllResolvedMutation.isPending}
              data-testid="button-delete-all-resolved"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer resolues
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !ipLogs || ipLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Network className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Aucune erreur IP enregistree</p>
              <p className="text-xs mt-1">Les erreurs d'adresse IP MoneyFusion apparaitront ici automatiquement</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ipLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-center gap-3 p-3 rounded-md border ${log.resolved ? "opacity-60 bg-muted/30" : "bg-muted/50"}`}
                  data-testid={`row-ip-log-${log.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-sm">{log.ip_address}</code>
                      <Badge variant={log.resolved ? "secondary" : "destructive"}>
                        {log.resolved ? "Configuree" : "A configurer"}
                      </Badge>
                      {log.country_code && (
                        <Badge variant="outline">{log.country_code.toUpperCase()}/{log.operator_code}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.error_message} - {new Date(log.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyIp(log.ip_address)}
                      data-testid={`button-copy-${log.id}`}
                    >
                      {copiedIp === log.ip_address ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    {!log.resolved && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markResolvedMutation.mutate(log.id)}
                        disabled={markResolvedMutation.isPending}
                        data-testid={`button-resolve-${log.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(log.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${log.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
