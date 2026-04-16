import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Activity,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  BarChart3,
  Globe,
  ArrowDownToLine,
} from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";

import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";
import airtelImage from "@assets/image_search_1771486869310_1771487355059.png";
import mpesaImage from "@assets/image_search_1771486907537_1771487355101.png";
import celtiisImage from "@assets/image_search_1771486943445_1771487355123.jpg";
import expressoImage from "@assets/image_search_1771487048520_1771487355151.png";
import corisImage from "@assets/image_search_1771487069905_1771487355176.png";
import afrimoneyImage from "@assets/image_search_1771487089985_1771487355198.png";
import qmoneyImage from "@assets/image_search_1771487154605_1771487355255.jpg";
import telecelImage from "@assets/image_search_1771487186999_1771487355289.jpg";

const OPERATOR_LOGOS: Record<string, string> = {
  orange: omImage,
  mtn: mtnImage,
  moov: moovImage,
  wave: waveImage,
  free: freeImage,
  airtel: airtelImage,
  mpesa: mpesaImage,
  celtiis: celtiisImage,
  tmoney: tmonyImage,
  togocom: tmonyImage,
  expresso: expressoImage,
  coris: corisImage,
  afrimoney: afrimoneyImage,
  africell: airtelImage,
  qmoney: qmoneyImage,
  telecel: telecelImage,
  wizall: wizallImage,
};

const COLORS = [
  "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16",
];

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin", TG: "Togo", CI: "Côte d'Ivoire", SN: "Sénégal",
  BF: "Burkina Faso", ML: "Mali", GN: "Guinée", NE: "Niger",
  CM: "Cameroun", TD: "Tchad", CG: "Congo-Brazzaville", CF: "Centrafrique",
  GA: "Gabon", CD: "RD Congo", RW: "Rwanda", GM: "Gambie",
};

interface AnalyticsData {
  revenueByDate: { date: string; amount: number }[];
  revenueByOperator: { operator: string; amount: number; count: number }[];
  revenueByCountry: { country: string; amount: number; count: number }[];
  revenueByType: { type: string; amount: number; count: number }[];
  totalRevenue: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  totalTransactions: number;
  averageTransactionAmount?: number;
  successRate?: number;
}

interface BusinessWallet {
  id: string;
  userId: string;
  country: string;
  currency: string;
  balance: number;
  createdAt: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " " + currency;
}

function WalletRevenueCard({
  wallet,
  revenue,
  txCount,
  index,
}: {
  wallet: BusinessWallet;
  revenue: number;
  txCount: number;
  index: number;
}) {
  const countryInfo = COUNTRIES.find((c) => c.code === wallet.country);
  const countryName = COUNTRY_NAMES[wallet.country] || countryInfo?.name || wallet.country;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <CountryFlag code={wallet.country} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{countryName}</p>
              <p className="text-xs text-muted-foreground">{wallet.currency}</p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {txCount} tx
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Solde actuel</span>
              <span className="font-bold text-base" style={{ color: COLORS[index % COLORS.length] }}>
                {fmt(wallet.balance, wallet.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowDownToLine className="w-3 h-3" />
                Revenus reçus
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {fmt(revenue, wallet.currency)}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-muted mt-1"
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                initial={{ width: 0 }}
                animate={{ width: revenue > 0 ? "100%" : "0%" }}
                transition={{ delay: 0.3 + index * 0.06, duration: 0.6 }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatMini({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className="p-2 rounded-lg" style={{ backgroundColor: color + "22" }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function AnalyticsBusiness() {
  const { data: analytics, isLoading: loadingAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  const { data: wallets, isLoading: loadingWallets } = useQuery<BusinessWallet[]>({
    queryKey: ["/api/business/wallets"],
  });

  const isLoading = loadingAnalytics || loadingWallets;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!analytics || !wallets) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Analytique</h1>
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Aucune donnée disponible</p>
            <p className="text-muted-foreground text-sm">
              Vos statistiques apparaîtront ici après vos premières transactions API
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTransactions = analytics.totalTransactions;
  const successRate = totalTransactions > 0
    ? (analytics.completedTransactions / totalTransactions) * 100
    : 0;

  // For each wallet, find matching revenue from analytics
  const walletsWithRevenue = wallets.map((wallet, index) => {
    const countryStats = analytics.revenueByCountry.find(
      (c) => c.country === wallet.country
    );
    return {
      wallet,
      revenue: countryStats?.amount ?? 0,
      txCount: countryStats?.count ?? 0,
      index,
    };
  });

  // Active wallets (those with transactions OR a balance > 0)
  const activeWallets = walletsWithRevenue.filter(
    (w) => w.revenue > 0 || w.wallet.balance > 0
  );
  const displayWallets = activeWallets.length > 0 ? activeWallets : walletsWithRevenue.slice(0, 6);

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold mb-1">Analytique</h1>
        <p className="text-sm text-muted-foreground">
          Revenus et statistiques par wallet — compte entreprise
        </p>
      </motion.div>

      {/* Wallets par pays */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Revenus par wallet</h2>
          <Badge variant="outline" className="text-xs">{displayWallets.length} wallets</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayWallets.map(({ wallet, revenue, txCount, index }) => (
            <WalletRevenueCard
              key={wallet.id}
              wallet={wallet}
              revenue={revenue}
              txCount={txCount}
              index={index}
            />
          ))}
        </div>
      </motion.div>

      {/* Stats globales transactions */}
      <motion.div variants={itemVariants}>
        <h2 className="font-semibold mb-3">Statistiques globales</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatMini
            label="Total transactions"
            value={new Intl.NumberFormat("fr-FR").format(totalTransactions)}
            icon={Activity}
            color="#3B82F6"
          />
          <StatMini
            label="Réussies"
            value={analytics.completedTransactions}
            icon={CheckCircle2}
            color="#10B981"
          />
          <StatMini
            label="En attente"
            value={analytics.pendingTransactions}
            icon={Clock}
            color="#F59E0B"
          />
          <StatMini
            label="Échouées"
            value={analytics.failedTransactions}
            icon={XCircle}
            color="#EF4444"
          />
        </div>
      </motion.div>

      {/* Taux de réussite */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="font-medium">Taux de réussite global</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {successRate.toFixed(1)}%
              </span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${successRate}%` }}
                transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {analytics.completedTransactions} réussies
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                {analytics.pendingTransactions} en attente
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {analytics.failedTransactions} échouées
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-blue-500" />
                {totalTransactions} total
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Graphiques */}
      <Tabs defaultValue="evolution" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="evolution" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Évolution
          </TabsTrigger>
          <TabsTrigger value="operateurs" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Opérateurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evolution">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                Évolution des paiements reçus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.revenueByDate.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={analytics.revenueByDate}>
                    <defs>
                      <linearGradient id="colorRevBiz" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v) => [
                        new Intl.NumberFormat("fr-FR").format(v as number),
                        "Montant",
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevBiz)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operateurs">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Revenus par opérateur mobile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.revenueByOperator.length > 0 ? (
                <div className="space-y-3">
                  {analytics.revenueByOperator.map((op, index) => {
                    const logo = OPERATOR_LOGOS[op.operator.toLowerCase()];
                    const total = analytics.revenueByOperator.reduce((s, o) => s + o.amount, 0);
                    const pct = total > 0 ? (op.amount / total) * 100 : 0;
                    return (
                      <motion.div
                        key={op.operator}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.07 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border bg-white dark:bg-gray-800 shrink-0">
                          {logo ? (
                            <img src={logo} alt={op.operator} className="w-6 h-6 object-contain" />
                          ) : (
                            <span
                              className="text-white font-bold text-xs w-full h-full flex items-center justify-center rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            >
                              {op.operator.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <p className="text-sm font-medium capitalize">{op.operator}</p>
                            <p className="text-xs text-muted-foreground">{op.count} tx</p>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.4 + index * 0.07, duration: 0.6 }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {new Intl.NumberFormat("fr-FR").format(op.amount)}
                          </p>
                          <Badge variant="outline" className="text-xs mt-0.5">
                            {pct.toFixed(1)}%
                          </Badge>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
