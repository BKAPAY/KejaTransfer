import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Bitcoin, CircleDollarSign, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CryptoCurrency {
  id: string | null;
  code: string;
  name: string;
  symbol: string;
  payinEnabled: boolean;
  payoutEnabled: boolean;
  minAmount: number | null;
}

interface CryptoStatus {
  available: boolean;
  message: string;
}

const CRYPTO_ICONS: Record<string, string> = {
  btc: "Bitcoin",
  eth: "Ethereum",
  usdttrc20: "USDT (TRC20)",
  usdterc20: "USDT (ERC20)",
  ltc: "Litecoin",
  xrp: "Ripple",
  trx: "Tron",
  bnbmainnet: "BNB",
  sol: "Solana",
  doge: "Dogecoin",
  matic: "Polygon",
  ada: "Cardano",
};

export default function CryptoConfigPage() {
  const { toast } = useToast();

  const { data: cryptoStatus, isLoading: statusLoading } = useQuery<CryptoStatus>({
    queryKey: ["/api/crypto/status"],
  });

  const { data: currencies, isLoading: currenciesLoading } = useQuery<CryptoCurrency[]>({
    queryKey: ["/api/admin/crypto-currencies"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ code, payinEnabled, payoutEnabled }: { code: string; payinEnabled?: boolean; payoutEnabled?: boolean }) => {
      return apiRequest("PUT", `/api/admin/crypto-currencies/${code}`, { payinEnabled, payoutEnabled });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Configuration mise à jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crypto-currencies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
  });

  if (statusLoading || currenciesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Configuration Crypto</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les cryptomonnaies acceptées pour les paiements
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Configuration Crypto</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les cryptomonnaies acceptées pour les paiements
        </p>
      </div>

      {!cryptoStatus?.available && (
        <Alert variant="destructive">
          <AlertDescription>
            NOWPayments n'est pas configuré ou inactif. Veuillez configurer la clé API dans la page Fournisseurs.
          </AlertDescription>
        </Alert>
      )}

      {cryptoStatus?.available && (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            NOWPayments est connecté et opérationnel
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Cryptomonnaies disponibles
          </CardTitle>
          <CardDescription>
            Activez ou désactivez les cryptomonnaies pour les paiements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currencies?.map((crypto) => (
              <div
                key={crypto.code}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    {crypto.symbol === "BTC" ? (
                      <Bitcoin className="h-5 w-5 text-orange-500" />
                    ) : crypto.symbol === "USDT" ? (
                      <CircleDollarSign className="h-5 w-5 text-green-500" />
                    ) : (
                      <Coins className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{crypto.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {crypto.symbol}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Entrant</span>
                    <Switch
                      checked={crypto.payinEnabled}
                      onCheckedChange={() => updateMutation.mutate({ code: crypto.code, payinEnabled: !crypto.payinEnabled })}
                      disabled={updateMutation.isPending}
                      data-testid={`switch-crypto-payin-${crypto.code}`}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Sortant</span>
                    <Switch
                      checked={crypto.payoutEnabled}
                      onCheckedChange={() => updateMutation.mutate({ code: crypto.code, payoutEnabled: !crypto.payoutEnabled })}
                      disabled={updateMutation.isPending}
                      data-testid={`switch-crypto-payout-${crypto.code}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(!currencies || currencies.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              Aucune cryptomonnaie configurée. Activez NOWPayments dans la page Fournisseurs.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
