import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Send, 
  Link2, 
  Store, 
  Code2, 
  HeadphonesIcon,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Activity,
  PieChart,
  BarChart3,
  CreditCard,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User, Transaction } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface DashboardStats {
  totalBalance: number;
  totalDeposits: number;
  totalTransfers: number;
  recentTransactions: Transaction[];
}

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
  "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"
];

const TYPE_NAMES: Record<string, string> = {
  payment_link: "Lien paiement",
  merchant_link: "Marchand",
  api_payment: "API",
  deposit: "Dépôt",
  transfer: "Transfert",
  withdrawal: "Retrait",
  crypto_payment: "Crypto",
};

const TYPE_ICONS: Record<string, any> = {
  payment_link: CreditCard,
  merchant_link: Store,
  api_payment: Zap,
  deposit: ArrowDownToLine,
  transfer: Send,
  withdrawal: ArrowUpFromLine,
  crypto_payment: Wallet,
};

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  BF: "Burkina Faso",
  CM: "Cameroun",
  CD: "RD Congo",
  CG: "Congo-Brazzaville",
  ML: "Mali",
  GN: "Guinée",
  NE: "Niger",
  GM: "Gambie",
  TD: "Tchad",
  CF: "Centrafrique",
  GA: "Gabon",
  RW: "Rwanda",
};

const COUNTRY_FLAGS: Record<string, string> = {
  BJ: "🇧🇯",
  TG: "🇹🇬",
  CI: "🇨🇮",
  SN: "🇸🇳",
  BF: "🇧🇫",
  CM: "🇨🇲",
  CD: "🇨🇩",
  CG: "🇨🇬",
  ML: "🇲🇱",
  GN: "🇬🇳",
  NE: "🇳🇪",
  GM: "🇬🇲",
  TD: "🇹🇩",
  CF: "🇨🇫",
  GA: "🇬🇦",
  RW: "🇷🇼",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
    >
      {new Intl.NumberFormat("fr-FR").format(value)}{suffix}
    </motion.span>
  );
}

function MiniStatCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  delay = 0 
}: { 
  title: string; 
  value: number; 
  icon: any;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="p-3 rounded-xl bg-card border hover-elevate"
    >
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ delay: delay + 0.1, type: "spring" }}
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-lg font-bold">
            <AnimatedCounter value={value} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function TypeBreakdownItem({ 
  type, 
  amount, 
  count, 
  total, 
  index 
}: { 
  type: string; 
  amount: number; 
  count: number; 
  total: number; 
  index: number;
}) {
  const Icon = TYPE_ICONS[type] || CreditCard;
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.3 }}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div 
        className="p-1.5 rounded-md"
        style={{ backgroundColor: `${COLORS[index % COLORS.length]}20` }}
      >
        <Icon 
          className="h-3.5 w-3.5" 
          style={{ color: COLORS[index % COLORS.length] }} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium truncate">{TYPE_NAMES[type] || type}</span>
          <span className="text-xs text-muted-foreground">{count}tx</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">{percentage.toFixed(0)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

function CountryItem({ 
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
  const flag = COUNTRY_FLAGS[country] || "🌍";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.3 }}
      className="flex items-center gap-2 p-1.5"
    >
      <motion.span 
        className="text-lg"
        whileHover={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        {flag}
      </motion.span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{COUNTRY_NAMES[country] || country}</span>
          <span className="text-xs font-semibold">{new Intl.NumberFormat("fr-FR").format(amount)} {currency}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ delay: 0.2 + index * 0.08, duration: 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-6 text-right">{percentage.toFixed(0)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    refetchInterval: 5000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 3000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/analytics"],
    refetchInterval: 10000,
  });

  // Get user's currency based on their country
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

  const totalTransactions = analytics ? analytics.completedTransactions + analytics.pendingTransactions : 0;
  const successRate = totalTransactions > 0 && analytics ? (analytics.completedTransactions / totalTransactions) * 100 : 0;

  return (
    <motion.div 
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Tableau de bord</h1>
      </motion.div>

      {/* Quick Access Buttons */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="grid grid-cols-4 gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/payment-links")}
            data-testid="button-quick-payment-link"
          >
            <Link2 className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">Paiement</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/merchant-links")}
            data-testid="button-quick-merchant-link"
          >
            <Store className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">Marchand</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/api")}
            data-testid="button-quick-api"
          >
            <Code2 className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">API</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center gap-0.5 h-auto py-2 px-1"
            onClick={() => setLocation("/dashboard/support")}
            data-testid="button-quick-support"
          >
            <HeadphonesIcon className="h-5 w-5 text-primary" />
            <span className="text-[10px] leading-tight text-center">Support</span>
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            data-testid="button-deposit"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => setLocation("/dashboard/deposit")}
          >
            <ArrowDownToLine className="h-4 w-4" />
            Dépôt
          </Button>
          <Button 
            data-testid="button-transfer"
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setLocation("/dashboard/transfer")}
          >
            <Send className="h-4 w-4" />
            Transfert
          </Button>
          <Button 
            data-testid="button-withdrawal"
            variant="accent"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => setLocation("/dashboard/withdrawal")}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Retrait
          </Button>
        </div>
      </motion.div>

      {/* Statistics Section - Replaces Recent Transactions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Statistiques
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation("/dashboard/analytics")}
                className="text-xs"
              >
                Voir plus
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading || analyticsLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-40 rounded-xl" />
              </div>
            ) : analytics ? (
              <>
                {/* Mini Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <MiniStatCard
                    title="Revenus totaux"
                    value={analytics.totalRevenue}
                    icon={Wallet}
                    color="#10B981"
                    delay={0}
                  />
                  <MiniStatCard
                    title="Transactions réussies"
                    value={analytics.completedTransactions}
                    icon={CheckCircle2}
                    color="#3B82F6"
                    delay={0.1}
                  />
                  <MiniStatCard
                    title="En attente"
                    value={analytics.pendingTransactions}
                    icon={Clock}
                    color="#F59E0B"
                    delay={0.2}
                  />
                  <MiniStatCard
                    title="Total transactions"
                    value={totalTransactions}
                    icon={BarChart3}
                    color="#8B5CF6"
                    delay={0.3}
                  />
                </div>

                {/* Success Rate Progress */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-3 rounded-xl bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium">Taux de réussite</span>
                    </div>
                    <motion.span
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6, type: "spring" }}
                      className="text-lg font-bold text-emerald-500"
                    >
                      {successRate.toFixed(1)}%
                    </motion.span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${successRate}%` }}
                      transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Transaction Types Breakdown */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-3 rounded-xl bg-card border"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Par type</span>
                    </div>
                    {analytics.revenueByType.length > 0 ? (
                      <div className="space-y-1">
                        {analytics.revenueByType.slice(0, 4).map((item, index) => (
                          <TypeBreakdownItem
                            key={item.type}
                            type={item.type}
                            amount={item.amount}
                            count={item.count}
                            total={analytics.totalRevenue}
                            index={index}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Aucune donnée
                      </div>
                    )}
                  </motion.div>

                  {/* Countries Breakdown */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-3 rounded-xl bg-card border"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🌍</span>
                      <span className="text-sm font-medium">Par pays</span>
                    </div>
                    {analytics.revenueByCountry.length > 0 ? (
                      <div className="space-y-1">
                        {analytics.revenueByCountry.slice(0, 4).map((item, index) => (
                          <CountryItem
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
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Aucune donnée
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Pie Chart for Visual Summary */}
                {analytics.revenueByType.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 }}
                    className="p-3 rounded-xl bg-card border"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <PieChart className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Distribution des revenus</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={analytics.revenueByType}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={50}
                              paddingAngle={2}
                              dataKey="amount"
                              animationBegin={700}
                              animationDuration={800}
                            >
                              {analytics.revenueByType.map((entry, index) => (
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
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1">
                        {analytics.revenueByType.slice(0, 4).map((item, index) => (
                          <motion.div
                            key={item.type}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + index * 0.1 }}
                            className="flex items-center gap-2"
                          >
                            <div 
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-xs text-muted-foreground flex-1">
                              {TYPE_NAMES[item.type] || item.type}
                            </span>
                            <span className="text-xs font-medium">
                              {((item.amount / analytics.totalRevenue) * 100).toFixed(0)}%
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                </motion.div>
                <p className="text-muted-foreground">Aucune statistique disponible</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vos statistiques apparaîtront après vos premières transactions
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
