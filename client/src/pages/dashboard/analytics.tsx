import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
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
  AreaChart,
  Area,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  CreditCard,
  Calendar,
  BarChart3,
  PieChartIcon,
  Activity,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { CRYPTO_LOGOS, CRYPTO_COLORS } from "@/components/crypto-icon";

import omImage from "@assets/om_1763835083036.png";
import mtnImage from "@assets/mtn (1)_1763835082904.png";
import moovImage from "@assets/moov (1)_1763835082986.png";
import waveImage from "@assets/wave (1)_1763835083242.png";
import freeImage from "@assets/mixxByYas-web-page_1763835083140.png";
import tmonyImage from "@assets/e-money_1763835083190.png";
import wizallImage from "@assets/wizall_1763835083090.png";
import airtelImage from "@assets/airtel-logo.png";
import mpesaImage from "@assets/mpesa-logo.png";
import celtiisImage from "@assets/celtiis-logo.png";
import expressoImage from "@assets/expresso-logo.png";
import corisImage from "@assets/coris-logo.png";
import afrimoneyImage from "@assets/afrimoney-logo.png";
import qmoneyImage from "@assets/qmoney-logo.png";
import telecelImage from "@assets/telecel-logo.png";

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
  qmoney: qmoneyImage,
  telecel: telecelImage,
  wizall: wizallImage,
};

interface Analytics {
  revenueByDate: { date: string; amount: number }[];
  revenueByOperator: { operator: string; amount: number; count: number }[];
  revenueByCountry: { country: string; amount: number; count: number }[];
  revenueByType: { type: string; amount: number; count: number }[];
  totalRevenue: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  totalTransactions: number;
  monthlyData?: { month: string; deposits: number; withdrawals: number; transfers: number; total: number }[];
  averageTransactionAmount?: number;
  successRate?: number;
}

const COLORS = [
  "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"
];

const GRADIENT_COLORS = {
  primary: ["#10B981", "#059669"],
  secondary: ["#3B82F6", "#2563EB"],
  accent: ["#F59E0B", "#D97706"],
  danger: ["#EF4444", "#DC2626"],
};

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  BF: "Burkina Faso",
  ML: "Mali",
  GN: "Guinée",
  NE: "Niger",
  Unknown: "Inconnu",
};

const TYPE_NAMES: Record<string, string> = {
  payment_link: "Lien de paiement",
  merchant_link: "Lien marchand",
  api_payment: "Paiement API",
  deposit: "Dépôt",
  transfer: "Transfert",
  withdrawal: "Retrait",
  crypto_payment: "Crypto",
};

const TYPE_ICONS: Record<string, any> = {
  payment_link: CreditCard,
  merchant_link: CreditCard,
  api_payment: Zap,
  deposit: ArrowDownToLine,
  transfer: Send,
  withdrawal: ArrowUpFromLine,
  crypto_payment: Wallet,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
};

const numberVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, type: "spring", stiffness: 100 } }
};

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
    >
      {prefix}{new Intl.NumberFormat("fr-FR").format(value)}{suffix}
    </motion.span>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = "primary",
  delay = 0,
  isCurrency = false,
  currency = "XOF",
}: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  icon: any; 
  color?: "primary" | "secondary" | "accent" | "danger";
  delay?: number;
  isCurrency?: boolean;
  currency?: string;
}) {
  const colorClasses = {
    primary: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    secondary: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    danger: "from-red-500/20 to-red-500/5 border-red-500/30",
  };
  
  const iconColors = {
    primary: "text-emerald-500 bg-emerald-500/20",
    secondary: "text-blue-500 bg-blue-500/20",
    accent: "text-amber-500 bg-amber-500/20",
    danger: "text-red-500 bg-red-500/20",
  };

  const formatValue = () => {
    if (typeof value === 'string') return value;
    if (isCurrency) {
      return new Intl.NumberFormat("fr-FR").format(value) + " " + currency;
    }
    return new Intl.NumberFormat("fr-FR").format(value);
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
    >
      <Card className={`relative overflow-hidden bg-gradient-to-br ${colorClasses[color]} border`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.2, duration: 0.5 }}
                className="text-2xl font-bold"
              >
                {formatValue()}
              </motion.div>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <motion.div
              initial={{ opacity: 0, rotate: -180, scale: 0 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
              className={`p-3 rounded-xl ${iconColors[color]}`}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
          </div>
        </CardContent>
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r"
          style={{ 
            background: `linear-gradient(to right, ${GRADIENT_COLORS[color][0]}, ${GRADIENT_COLORS[color][1]})` 
          }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: delay + 0.3, duration: 0.8, ease: "easeOut" }}
        />
      </Card>
    </motion.div>
  );
}

function TransactionTypeCard({ 
  type, 
  amount, 
  count, 
  total,
  index,
  currency = "XOF"
}: { 
  type: string; 
  amount: number; 
  count: number; 
  total: number;
  index: number;
  currency?: string;
}) {
  const Icon = TYPE_ICONS[type] || CreditCard;
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <div className="p-4 rounded-xl bg-card border hover-elevate transition-all duration-300">
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: `${COLORS[index % COLORS.length]}20` }}
          >
            <Icon className="h-4 w-4" style={{ color: COLORS[index % COLORS.length] }} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{TYPE_NAMES[type] || type}</p>
            <p className="text-xs text-muted-foreground">{count} transaction{count > 1 ? 's' : ''}</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {percentage.toFixed(1)}%
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Montant</span>
            <span className="font-semibold">{new Intl.NumberFormat("fr-FR").format(amount)} {currency}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CountryCard({ 
  country, 
  amount, 
  count, 
  total,
  index,
  currency = "XOF"
}: { 
  country: string; 
  amount: number; 
  count: number; 
  total: number;
  index: number;
  currency?: string;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ scale: 1.02, x: 5 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
    >
      <motion.span 
        whileHover={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <CountryFlag code={country} size="md" />
      </motion.span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium text-sm">{COUNTRY_NAMES[country] || country}</p>
          <span className="text-xs text-muted-foreground">{count} tx</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ delay: 0.3 + index * 0.08, duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground w-12 text-right">
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{new Intl.NumberFormat("fr-FR").format(amount)}</p>
        <p className="text-xs text-muted-foreground">{currency}</p>
      </div>
    </motion.div>
  );
}

function OperatorCard({ 
  operator, 
  amount, 
  count, 
  total,
  index,
  currency = "XOF"
}: { 
  operator: string; 
  amount: number; 
  count: number; 
  total: number;
  index: number;
  currency?: string;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate transition-all"
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border bg-white dark:bg-gray-800">
        {OPERATOR_LOGOS[operator.toLowerCase()] ? (
          <img 
            src={OPERATOR_LOGOS[operator.toLowerCase()]} 
            alt={operator} 
            className="w-7 h-7 object-contain"
          />
        ) : CRYPTO_LOGOS[operator.toLowerCase()] ? (
          <img 
            src={CRYPTO_LOGOS[operator.toLowerCase()]} 
            alt={operator} 
            className="w-7 h-7 object-contain"
          />
        ) : (
          <span 
            className="text-white font-bold text-sm w-full h-full flex items-center justify-center rounded-full"
            style={{ backgroundColor: CRYPTO_COLORS[operator.toLowerCase()] || COLORS[index % COLORS.length] }}
          >
            {operator.substring(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm capitalize">{operator}</p>
        <p className="text-xs text-muted-foreground">{count} transaction{count > 1 ? 's' : ''}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{new Intl.NumberFormat("fr-FR").format(amount)} {currency}</p>
        <Badge 
          variant="outline" 
          className="text-xs mt-1"
          style={{ borderColor: COLORS[index % COLORS.length], color: COLORS[index % COLORS.length] }}
        >
          {percentage.toFixed(1)}%
        </Badge>
      </div>
    </motion.div>
  );
}

export default function Analytics() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["/api/analytics"],
  });
  
  const userCurrency = user?.country 
    ? COUNTRIES.find(c => c.code === user.country)?.currency || "XOF"
    : "XOF";

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: userCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold mb-1">Analytics</h1>
          <p className="text-muted-foreground">Analyses détaillées de vos transactions</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            </motion.div>
            <p className="text-lg font-medium mb-2">Aucune donnée disponible</p>
            <p className="text-muted-foreground">Vos statistiques apparaîtront ici après vos premières transactions</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const totalTransactions = analytics.totalTransactions;
  const successRate = totalTransactions > 0 ? (analytics.completedTransactions / totalTransactions) * 100 : 0;
  const avgTransaction = analytics.completedTransactions > 0 ? analytics.totalRevenue / analytics.completedTransactions : 0;

  const revenueByCountryWithNames = analytics.revenueByCountry.map((item) => ({
    ...item,
    countryName: COUNTRY_NAMES[item.country] || item.country,
    flag: item.country,
  }));

  const revenueByTypeWithNames = analytics.revenueByType.map((item) => ({
    ...item,
    typeName: TYPE_NAMES[item.type] || item.type,
  }));

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold mb-1">Analytics</h1>
        <p className="text-muted-foreground">Analyses détaillées et insights de vos transactions</p>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Revenus Totaux"
          value={analytics.totalRevenue}
          subtitle="Total des transactions entrantes"
          icon={Wallet}
          color="primary"
          delay={0}
          isCurrency={true}
          currency={userCurrency}
        />
        <StatCard
          title="Total Transactions"
          value={analytics.totalTransactions}
          subtitle="Transactions entrantes"
          icon={Activity}
          color="secondary"
          delay={0.1}
        />
        <StatCard
          title="Montant Moyen"
          value={Math.round(avgTransaction)}
          subtitle="Par transaction"
          icon={Target}
          color="primary"
          delay={0.2}
          isCurrency={true}
          currency={userCurrency}
        />
      </div>

      {/* Transaction Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Réussies"
          value={analytics.completedTransactions}
          subtitle={`Taux: ${successRate.toFixed(1)}%`}
          icon={CheckCircle2}
          color="primary"
          delay={0.3}
        />
        <StatCard
          title="En Attente"
          value={analytics.pendingTransactions}
          subtitle="Transactions en cours"
          icon={Clock}
          color="accent"
          delay={0.4}
        />
        <StatCard
          title="Échouées"
          value={analytics.failedTransactions}
          subtitle="Transactions échouées"
          icon={XCircle}
          color="danger"
          delay={0.5}
        />
      </div>

      {/* Success Rate Indicator */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="font-medium">Taux de réussite global</span>
              </div>
              <motion.span 
                className="text-2xl font-bold text-primary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {successRate.toFixed(1)}%
              </motion.span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${successRate}%` }}
                transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
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
                {analytics.totalTransactions} total
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Section */}
      <Tabs defaultValue="evolution" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="evolution" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Évolution
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparaison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evolution" className="space-y-4">
          <motion.div variants={cardVariants}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Évolution des revenus
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {analytics.revenueByDate.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analytics.revenueByDate}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => [formatAmount(value as number), "Revenus"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div variants={cardVariants}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-primary" />
                    Par pays
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueByCountryWithNames.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={revenueByCountryWithNames}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="amount"
                          animationBegin={200}
                          animationDuration={1000}
                        >
                          {revenueByCountryWithNames.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatAmount(value as number)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-72 flex items-center justify-center text-muted-foreground">
                      Aucune donnée
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Par type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueByTypeWithNames.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={revenueByTypeWithNames}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="amount"
                          animationBegin={400}
                          animationDuration={1000}
                        >
                          {revenueByTypeWithNames.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatAmount(value as number)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-72 flex items-center justify-center text-muted-foreground">
                      Aucune donnée
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <motion.div variants={cardVariants}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Revenus par opérateur
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.revenueByOperator.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.revenueByOperator} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <YAxis 
                        type="category"
                        dataKey="operator"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        width={80}
                      />
                      <Tooltip 
                        formatter={(value) => [formatAmount(value as number), "Revenus"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar 
                        dataKey="amount" 
                        fill="#10B981"
                        radius={[0, 4, 4, 0]}
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Transaction Type */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Par type de transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {revenueByTypeWithNames.map((item, index) => (
                  <TransactionTypeCard
                    key={item.type}
                    type={item.type}
                    amount={item.amount}
                    count={item.count}
                    total={analytics.totalRevenue}
                    index={index}
                    currency={userCurrency}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* By Country */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" /> Par pays
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {revenueByCountryWithNames.map((item, index) => (
                  <CountryCard
                    key={item.country}
                    country={item.country}
                    amount={item.amount}
                    count={item.count}
                    total={analytics.totalRevenue}
                    index={index}
                    currency={userCurrency}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* By Operator */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              Par opérateur mobile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {analytics.revenueByOperator.map((item, index) => (
                <OperatorCard
                  key={item.operator}
                  operator={item.operator}
                  amount={item.amount}
                  count={item.count}
                  total={analytics.totalRevenue}
                  index={index}
                  currency={userCurrency}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
