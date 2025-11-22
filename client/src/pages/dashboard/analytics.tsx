import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface Analytics {
  revenueByDate: { date: string; amount: number }[];
  revenueByOperator: { operator: string; amount: number; count: number }[];
  revenueByCountry: { country: string; amount: number; count: number }[];
  revenueByType: { type: string; amount: number; count: number }[];
  totalRevenue: number;
  completedTransactions: number;
  pendingTransactions: number;
}

const COLORS = [
  "#228B22",
  "#FFD700",
  "#32CD32",
  "#DAA520",
  "#00CED1",
  "#FF6347",
  "#4169E1",
  "#FF8C00",
];

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  BF: "Burkina Faso",
  ML: "Mali",
  Unknown: "Inconnu",
};

const TYPE_NAMES: Record<string, string> = {
  payment_link: "Lien de paiement",
  merchant_link: "Lien marchand",
  api_payment: "Paiement API",
  deposit: "Dépôt",
  transfer: "Transfert",
};

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["/api/analytics"],
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
          <p className="text-muted-foreground">Rapports détaillés et analytics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
          <p className="text-muted-foreground">Rapports détaillés et analytics</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune donnée disponible pour le moment</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const revenueByCountryWithNames = analytics.revenueByCountry.map((item) => ({
    ...item,
    countryName: COUNTRY_NAMES[item.country] || item.country,
  }));

  const revenueByTypeWithNames = analytics.revenueByType.map((item) => ({
    ...item,
    typeName: TYPE_NAMES[item.type] || item.type,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">Rapports détaillés et insights sur vos transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenus Totaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatAmount(analytics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tous les paiements complétés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Transactions Complétées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {analytics.completedTransactions}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Paiements réussis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {analytics.pendingTransactions}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Paiements en cours
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenus par Date</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.revenueByDate.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.revenueByDate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatAmount(value as number)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#228B22"
                  name="Revenus (XOF)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              Aucune donnée disponible
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenus par Opérateur</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.revenueByOperator.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.revenueByOperator}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="operator" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatAmount(value as number)} />
                  <Legend />
                  <Bar dataKey="amount" fill="#228B22" name="Revenus (XOF)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenus par Pays</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByCountryWithNames.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenueByCountryWithNames}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ countryName, percent }) =>
                      `${countryName} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {revenueByCountryWithNames.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatAmount(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenus par Type de Paiement</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByTypeWithNames.length > 0 ? (
            <div className="space-y-3">
              {revenueByTypeWithNames.map((item, index) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                  data-testid={`revenue-type-${item.type}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <div>
                      <p className="font-medium text-sm">{item.typeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} transaction{item.count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatAmount(item.amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucune donnée disponible
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribution par Opérateur</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.revenueByOperator.length > 0 ? (
            <div className="space-y-3">
              {analytics.revenueByOperator.map((item, index) => (
                <div
                  key={item.operator}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                  data-testid={`revenue-operator-${item.operator}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <div>
                      <p className="font-medium text-sm capitalize">{item.operator}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} transaction{item.count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatAmount(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {(
                        (item.amount / analytics.totalRevenue) *
                        100
                      ).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucune donnée disponible
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
