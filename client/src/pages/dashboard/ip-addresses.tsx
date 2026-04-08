import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Network, Trash2, CheckCircle2, AlertCircle, ArrowLeft, Copy, Check, RefreshCw, Server } from "lucide-react";
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
  provider?: string;
}

interface ServerIp {
  ipv4: string | null;
  ipv6: string | null;
}

export default function IpAddresses() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const { data: ipLogs, isLoading } = useQuery<IpLog[]>({
    queryKey: ["/api/admin/moneyfusion-ip-logs"],
  });

  const { data: serverIp, isLoading: isLoadingServerIp, refetch: refetchServerIp, isFetching: isFetchingServerIp } = useQuery<ServerIp>({
    queryKey: ["/api/admin/server-ip"],
    staleTime: 60000,
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

  const unresolvedLogs = ipLogs?.filter(l => !l.resolved) || [];
  const afribapayUnresolved = unresolvedLogs.filter(l => l.provider === "afribapay");
  const moneyfusionUnresolved = unresolvedLogs.filter(l => !l.provider || l.provider === "moneyfusion");
  const uniqueAfribapayIps = Array.from(new Set(afribapayUnresolved.map(l => l.ip_address)));
  const uniqueMoneyfusionIps = Array.from(new Set(moneyfusionUnresolved.map(l => l.ip_address)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard/admin")} data-testid="button-back-admin">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Adresses IP</h1>
          <p className="text-sm text-muted-foreground">
            IP du serveur BKAPay et IPs a configurer chez les fournisseurs de paiement
          </p>
        </div>
      </div>

      {/* Bloc IP du serveur BKAPay — le plus important */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            Adresse IP du serveur BKAPay (production)
          </CardTitle>
          <CardDescription>
            C'est cette adresse IP que vous devez configurer dans les tableaux de bord de vos fournisseurs (AfribaPay, MoneyFusion, etc.). Elle correspond au serveur qui envoie les requetes de paiement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingServerIp ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {serverIp?.ipv6 && (
                <div className="rounded-md overflow-hidden border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">IPv6 — a utiliser pour AfribaPay</p>
                      <code className="text-base font-mono font-bold break-all" data-testid="text-server-ipv6">{serverIp.ipv6}</code>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyIp(serverIp.ipv6!)} data-testid="button-copy-server-ipv6">
                      {copiedIp === serverIp.ipv6 ? <><Check className="w-4 h-4 mr-1" />Copie</> : <><Copy className="w-4 h-4 mr-1" />Copier</>}
                    </Button>
                  </div>
                  {serverIp.ipv6.endsWith("::") && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/30">
                      Les "::" remplacent des zeros — c'est une IPv6 complete et valide. Copiez-la telle quelle.
                    </div>
                  )}
                </div>
              )}
              {serverIp?.ipv4 && (
                <div className="rounded-md overflow-hidden border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">IPv4 — a utiliser pour MoneyFusion et autres</p>
                      <code className="text-base font-mono font-bold" data-testid="text-server-ipv4">{serverIp.ipv4}</code>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyIp(serverIp.ipv4!)} data-testid="button-copy-server-ipv4">
                      {copiedIp === serverIp.ipv4 ? <><Check className="w-4 h-4 mr-1" />Copie</> : <><Copy className="w-4 h-4 mr-1" />Copier</>}
                    </Button>
                  </div>
                </div>
              )}
              {!serverIp?.ipv4 && !serverIp?.ipv6 && (
                <p className="text-sm text-muted-foreground py-2">Impossible de recuperer l'IP du serveur pour le moment.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <p className="text-xs text-muted-foreground">
              L'IP peut changer apres un redemarrage ou redeploiement du serveur. Verifiez regulierement.
            </p>
            <Button variant="ghost" size="sm" onClick={() => refetchServerIp()} disabled={isFetchingServerIp} data-testid="button-refresh-server-ip">
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetchingServerIp ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bloc AfribaPay erreurs en attente */}
      {uniqueAfribapayIps.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              AfribaPay — IPs detectees lors d'echecs
            </CardTitle>
            <CardDescription>
              Ces IPs ont ete rejetees par AfribaPay lors de retraits/transferts — verifiez qu'elles correspondent a l'IP du serveur ci-dessus et configurez-les
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {uniqueAfribapayIps.map((ip) => (
                <div key={ip} className="rounded-md bg-muted/50 overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <code className="text-base font-mono font-bold flex-1 break-all" data-testid={`text-ip-afribapay-${ip}`}>{ip}</code>
                    <Button variant="outline" size="sm" onClick={() => copyIp(ip)} data-testid={`button-copy-afribapay-${ip}`}>
                      {copiedIp === ip ? <><Check className="w-4 h-4 mr-1" />Copie</> : <><Copy className="w-4 h-4 mr-1" />Copier</>}
                    </Button>
                  </div>
                  {ip.endsWith("::") && (
                    <div className="px-3 pb-2 text-xs text-muted-foreground">
                      IPv6 complete — les "::" remplacent des zeros. Copiez-la telle quelle dans AfribaPay.
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-md bg-muted/40 p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground">Comment configurer dans AfribaPay :</p>
              <ol className="space-y-1 text-muted-foreground list-none">
                <li><span className="font-bold text-foreground">1.</span> Connectez-vous sur <span className="font-mono">cp.afribapay.com</span></li>
                <li><span className="font-bold text-foreground">2.</span> Allez dans <span className="font-semibold">Securite &amp; API</span> → <span className="font-semibold">Adresses IP autorisees</span></li>
                <li><span className="font-bold text-foreground">3.</span> Selectionnez le type : <span className="font-semibold">PAYOUT</span></li>
                <li><span className="font-bold text-foreground">4.</span> Donnez un nom (ex: <span className="font-mono">BKApay Production</span>)</li>
                <li><span className="font-bold text-foreground">5.</span> Collez l'adresse IP dans le champ prevu</li>
                <li><span className="font-bold text-foreground">6.</span> Cliquez sur <span className="font-semibold">Mettre a jour</span></li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bloc MoneyFusion erreurs en attente */}
      {uniqueMoneyfusionIps.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              MoneyFusion — IPs detectees lors d'echecs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {uniqueMoneyfusionIps.map((ip) => (
                <div key={ip} className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <code className="text-base font-mono font-bold flex-1" data-testid={`text-ip-${ip}`}>{ip}</code>
                  <Button variant="outline" size="sm" onClick={() => copyIp(ip)} data-testid={`button-copy-ip-${ip}`}>
                    {copiedIp === ip ? <><Check className="w-4 h-4 mr-1" />Copie</> : <><Copy className="w-4 h-4 mr-1" />Copier</>}
                  </Button>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-muted/40 p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground">Comment configurer dans MoneyFusion :</p>
              <ol className="space-y-1 text-muted-foreground list-none">
                <li><span className="font-bold text-foreground">1.</span> Connectez-vous sur votre tableau de bord MoneyFusion</li>
                <li><span className="font-bold text-foreground">2.</span> Allez dans <span className="font-semibold">Parametres</span> → <span className="font-semibold">Adresses IP autorisees</span></li>
                <li><span className="font-bold text-foreground">3.</span> Ajoutez l'adresse IP IPv4 du serveur ci-dessus</li>
                <li><span className="font-bold text-foreground">4.</span> Sauvegardez les modifications</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique complet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Historique des erreurs IP</CardTitle>
            <CardDescription>{ipLogs?.length || 0} entrees au total</CardDescription>
          </div>
          {ipLogs && ipLogs.filter(l => l.resolved).length > 0 && (
            <Button variant="outline" size="sm" onClick={() => deleteAllResolvedMutation.mutate()} disabled={deleteAllResolvedMutation.isPending} data-testid="button-delete-all-resolved">
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
              <p className="text-xs mt-1">Les erreurs d'adresse IP apparaitront ici automatiquement lors d'echecs de retraits</p>
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
                      <code className="font-mono font-bold text-sm break-all">{log.ip_address}</code>
                      <Badge variant={log.resolved ? "secondary" : "destructive"}>
                        {log.resolved ? "Configuree" : "A configurer"}
                      </Badge>
                      <Badge variant="outline">
                        {log.provider === "afribapay" ? "AfribaPay" : "MoneyFusion"}
                      </Badge>
                      {log.country_code && (
                        <Badge variant="outline">{log.country_code.toUpperCase()}/{log.operator_code}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.error_message} — {new Date(log.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyIp(log.ip_address)} data-testid={`button-copy-${log.id}`}>
                      {copiedIp === log.ip_address ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    {!log.resolved && (
                      <Button variant="ghost" size="icon" onClick={() => markResolvedMutation.mutate(log.id)} disabled={markResolvedMutation.isPending} data-testid={`button-resolve-${log.id}`}>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(log.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-${log.id}`}>
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
