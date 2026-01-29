import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Wallet } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard/index";
import Profile from "@/pages/dashboard/profile";
import PaymentLinks from "@/pages/dashboard/payment-links";
import MerchantLinks from "@/pages/dashboard/merchant-links";
import ApiPage from "@/pages/dashboard/api";
import Analytics from "@/pages/dashboard/analytics";
import History from "@/pages/dashboard/history";
import Settings from "@/pages/dashboard/settings";
import Support from "@/pages/dashboard/support";
import Deposit from "@/pages/dashboard/deposit";
import Transfer from "@/pages/dashboard/transfer";
import Withdrawal from "@/pages/dashboard/withdrawal";
import Admin from "@/pages/dashboard/admin";
import ManagementWrapper from "@/pages/dashboard/management-wrapper";
import AdminAccessCode from "@/pages/dashboard/admin-access-code";
import KycVerification from "@/pages/dashboard/kyc-verification";
import KycHistory from "@/pages/dashboard/kyc-history";
import KYC from "@/pages/dashboard/kyc";
import CountryOperatorConfig from "@/pages/dashboard/country-operator-config";
import FeeConfig from "@/pages/dashboard/fee-config";
import Diagnostic from "@/pages/dashboard/diagnostic";
import Fournisseurs from "@/pages/dashboard/fournisseurs";
import AdminUserProfile from "@/pages/dashboard/admin-user-profile";
import AdminUserHistory from "@/pages/dashboard/admin-user-history";
import AdminUserLinks from "@/pages/dashboard/admin-user-links";
import AdminUserMerchant from "@/pages/dashboard/admin-user-merchant";
import AdminUserApi from "@/pages/dashboard/admin-user-api";
import Pay from "@/pages/pay";
import Merchant from "@/pages/merchant";
import ApiPayment from "@/pages/api-payment";
import PaymentStatus from "@/pages/payment-status";
import ApiDemo from "@/pages/api-demo";
import ApiPay from "@/pages/api-pay";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Cookies from "@/pages/cookies";
import DocumentationVersion from "@/pages/documentation-version";
import ForgotPassword from "@/pages/forgot-password";
import { CURRENT_VERSION } from "@/lib/doc-versions";
import { COUNTRIES } from "@shared/schema";
import type { User } from "@shared/schema";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isLoading, error } = useAuth();

  const { data: stats } = useQuery<{
    totalBalance: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 5000,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
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

  // Si pas authentifié, rediriger vers login
  useEffect(() => {
    if (!isLoading && error && location.startsWith("/dashboard")) {
      setLocation("/login");
    }
  }, [isLoading, error, location, setLocation]);

  // En attente de vérification d'auth
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-card sticky top-0 z-10">
            <SidebarTrigger size="lg" data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg" data-testid="header-balance">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {formatAmount(stats?.totalBalance || 0)}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl mx-auto px-4 md:px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const isDashboard = location.startsWith("/dashboard");

  if (isDashboard) {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/dashboard/profile" component={Profile} />
          <Route path="/dashboard/payment-links" component={PaymentLinks} />
          <Route path="/dashboard/merchant-links" component={MerchantLinks} />
          <Route path="/dashboard/api" component={ApiPage} />
          <Route path="/dashboard/analytics" component={Analytics} />
          <Route path="/dashboard/history" component={History} />
          <Route path="/dashboard/settings" component={Settings} />
          <Route path="/dashboard/documentation/:version">
            {(params) => <DocumentationVersion version={params.version} />}
          </Route>
          <Route path="/dashboard/documentation">
            {() => {
              window.location.replace(`/dashboard/documentation/${CURRENT_VERSION}`);
              return null;
            }}
          </Route>
          <Route path="/dashboard/support" component={Support} />
          <Route path="/dashboard/deposit" component={Deposit} />
          <Route path="/dashboard/transfer" component={Transfer} />
          <Route path="/dashboard/withdrawal" component={Withdrawal} />
          <Route path="/dashboard/admin" component={Admin} />
          <Route path="/dashboard/admin-access-code" component={AdminAccessCode} />
          <Route path="/dashboard/management" component={ManagementWrapper} />
          <Route path="/dashboard/kyc" component={KYC} />
          <Route path="/dashboard/kyc-verification" component={KycVerification} />
          <Route path="/dashboard/kyc-history" component={KycHistory} />
          <Route path="/dashboard/country-operator-config" component={CountryOperatorConfig} />
          <Route path="/dashboard/fee-config" component={FeeConfig} />
          <Route path="/dashboard/diagnostic" component={Diagnostic} />
          <Route path="/dashboard/fournisseurs" component={Fournisseurs} />
          <Route path="/dashboard/admin/user/:userId/profile" component={AdminUserProfile} />
          <Route path="/dashboard/admin/user/:userId/history" component={AdminUserHistory} />
          <Route path="/dashboard/admin/user/:userId/links" component={AdminUserLinks} />
          <Route path="/dashboard/admin/user/:userId/merchant" component={AdminUserMerchant} />
          <Route path="/dashboard/admin/user/:userId/api" component={AdminUserApi} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/documentation/:version">
        {(params) => <DocumentationVersion version={params.version} />}
      </Route>
      <Route path="/documentation">
        {() => {
          window.location.replace(`/documentation/${CURRENT_VERSION}`);
          return null;
        }}
      </Route>
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/cookies" component={Cookies} />
      <Route path="/pay/:token" component={Pay} />
      <Route path="/merchant/:token" component={Merchant} />
      <Route path="/api-payment/:transactionId" component={ApiPayment} />
      <Route path="/payment-status/:transactionId" component={PaymentStatus} />
      <Route path="/demo/api-payment" component={ApiDemo} />
      <Route path="/api-pay/:key" component={ApiPay} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInitializer() {
  const { isLoading } = useAuth();
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      // Prefetch auth data on app init to maintain session persistence
      queryClient.prefetchQuery({
        queryKey: ["/api/auth/me"],
      });
      initRef.current = true;
    }
  }, []);

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppInitializer />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
