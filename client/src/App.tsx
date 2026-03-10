import { Switch, Route, useLocation } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BusinessSidebar } from "@/components/business-sidebar";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Wallet } from "lucide-react";
import { EmaliChatButton } from "@/components/emali-chat";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard/index";
import Profile from "@/pages/dashboard/profile";
import PaymentLinks from "@/pages/dashboard/payment-links";
import MerchantLinks from "@/pages/dashboard/merchant-links";
import ApiPage from "@/pages/dashboard/api";
import ApiPayoutPage from "@/pages/dashboard/api-payout";
import Analytics from "@/pages/dashboard/analytics";
import History from "@/pages/dashboard/history";
import Settings from "@/pages/dashboard/settings";
import Support from "@/pages/dashboard/support";
import Deposit from "@/pages/dashboard/deposit";
import Transfer from "@/pages/dashboard/transfer";
import Withdrawal from "@/pages/dashboard/withdrawal";
import Admin from "@/pages/dashboard/admin";
import AdminBusiness from "@/pages/dashboard/admin-business";
import AdminBusinessManagement from "@/pages/dashboard/admin-business-management";
import AdminBusinessKyc from "@/pages/dashboard/admin-business-kyc";
import AdminBusinessKycDetail from "@/pages/dashboard/admin-business-kyc-detail";
import AdminBusinessProviders from "@/pages/dashboard/admin-business-providers";
import AdminBusinessCountryOperator from "@/pages/dashboard/admin-business-country-operator";
import AdminBusinessFees from "@/pages/dashboard/admin-business-fees";
import AdminBusinessHistory from "@/pages/dashboard/admin-business-history";
import ManagementWrapper from "@/pages/dashboard/management-wrapper";
import AdminAccessCode from "@/pages/dashboard/admin-access-code";
import KycVerification from "@/pages/dashboard/kyc-verification";
import KycHistory from "@/pages/dashboard/kyc-history";
import KYC from "@/pages/dashboard/kyc";
import CountryOperatorConfig from "@/pages/dashboard/country-operator-config";
import FeeConfig from "@/pages/dashboard/fee-config";
import Diagnostic from "@/pages/dashboard/diagnostic";
import Fournisseurs from "@/pages/dashboard/fournisseurs";
import SupportConfig from "@/pages/dashboard/support-config";
import DocumentationBusiness from "@/pages/dashboard/documentation-business";
import IpAddresses from "@/pages/dashboard/ip-addresses";
import AdminUserProfile from "@/pages/dashboard/admin-user-profile";
import AdminUserHistory from "@/pages/dashboard/admin-user-history";
import AdminUserLinks from "@/pages/dashboard/admin-user-links";
import AdminUserMerchant from "@/pages/dashboard/admin-user-merchant";
import AdminUserApi from "@/pages/dashboard/admin-user-api";
import AdminUserConnections from "@/pages/dashboard/admin-user-connections";
import Pay from "@/pages/pay";
import Merchant from "@/pages/merchant";
import PaymentSuccessPage from "@/pages/payment-success";
import PaymentFailedPage from "@/pages/payment-failed";
import ApiPayment from "@/pages/api-payment";
import PaymentStatus from "@/pages/payment-status";
import ApiDemo from "@/pages/api-demo";
import ApiPay from "@/pages/api-pay";
import Checkout from "@/pages/checkout";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Cookies from "@/pages/cookies";
import DocumentationVersion from "@/pages/documentation-version";
import DocumentationRedirect from "@/pages/documentation-redirect";
import DocumentationInline from "@/pages/documentation-inline";
import DocumentationPayout from "@/pages/documentation-payout";
import DocumentationSessions from "@/pages/documentation-sessions";
import ForgotPassword from "@/pages/forgot-password";
import LoginVerify from "@/pages/login-verify";
import BusinessDashboard from "@/pages/dashboard/business/index";
import BusinessProfile from "@/pages/dashboard/business/profile";
import BusinessKyc from "@/pages/dashboard/business/kyc";
import BusinessApi from "@/pages/dashboard/business/api";
import BusinessHistory from "@/pages/dashboard/business/history";
import BusinessSettings from "@/pages/dashboard/business/settings";
import { CURRENT_VERSION } from "@/lib/doc-versions";
import { COUNTRIES } from "@shared/schema";
import type { User } from "@shared/schema";

function DashboardLayout({ children, type = "personal" }: { children: React.ReactNode, type?: "personal" | "business" }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, isUnauthenticated, isServerError } = useAuth();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.accountType !== type) {
      if (user?.accountType === "business" && type === "personal") {
        setLocation("/dashboard/business");
      } else if (user?.accountType === "personal" && type === "business") {
        setLocation("/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, user?.accountType, type, setLocation]);

  const { data: stats } = useQuery<{
    totalBalance: number;
  } | null>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 15000,
    refetchInterval: 30000,
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

  const { data: verifyStatus } = useQuery<{ verified: boolean } | null>({
    queryKey: ["/api/auth/login-verify-status"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return await res.json();
    },
    enabled: !isLoading && isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && isUnauthenticated && location.startsWith("/dashboard") && !redirectedRef.current) {
      redirectedRef.current = true;
      setLocation("/login");
    }
  }, [isLoading, isUnauthenticated, location, setLocation]);

  

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
        {type === "business" ? <BusinessSidebar /> : <AppSidebar />}
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-card sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <SidebarTrigger size="lg" data-testid="button-sidebar-toggle" />
              {type === "personal" && (
                <div className="relative">
                  <EmaliChatButton />
                </div>
              )}
            </div>
            {type === "personal" && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg" data-testid="header-balance">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {formatAmount(stats?.totalBalance || 0)}
                </span>
              </div>
            )}
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
  const isBusiness = location.startsWith("/dashboard/business");

  if (isBusiness) {
    return (
      <DashboardLayout type="business">
        <Switch>
          <Route path="/dashboard/business" component={BusinessDashboard} />
          <Route path="/dashboard/business/profile" component={BusinessProfile} />
          <Route path="/dashboard/business/kyc" component={BusinessKyc} />
          <Route path="/dashboard/business/api" component={BusinessApi} />
          <Route path="/dashboard/business/history" component={BusinessHistory} />
          <Route path="/dashboard/business/history/incoming" component={BusinessHistory} />
          <Route path="/dashboard/business/history/outgoing" component={BusinessHistory} />
          <Route path="/dashboard/business/settings" component={BusinessSettings} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    );
  }

  if (isDashboard) {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/dashboard/profile" component={Profile} />
          <Route path="/dashboard/payment-links" component={PaymentLinks} />
          <Route path="/dashboard/merchant-links" component={MerchantLinks} />
          <Route path="/dashboard/api" component={ApiPage} />
          <Route path="/dashboard/api-payout" component={ApiPayoutPage} />
          <Route path="/dashboard/analytics" component={Analytics} />
          <Route path="/dashboard/history" component={History} />
          <Route path="/dashboard/settings" component={Settings} />
          <Route path="/dashboard/documentation/redirect/:version">
            {(params) => <DocumentationRedirect version={params.version} />}
          </Route>
          <Route path="/dashboard/documentation/inline/:version">
            {(params) => <DocumentationInline version={params.version} />}
          </Route>
          <Route path="/dashboard/documentation/payout/:version">
            {(params) => <DocumentationPayout version={params.version} />}
          </Route>
          <Route path="/dashboard/documentation/sessions/:version">
            {(params) => <DocumentationSessions version={params.version} />}
          </Route>
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
          <Route path="/dashboard/admin/business" component={AdminBusiness} />
          <Route path="/dashboard/admin/business/management" component={AdminBusinessManagement} />
          <Route path="/dashboard/admin/business/users/:userId/history" component={AdminBusinessHistory} />
          <Route path="/dashboard/admin/business/kyc" component={AdminBusinessKyc} />
          <Route path="/dashboard/admin/business/kyc/:userId" component={AdminBusinessKycDetail} />
          <Route path="/dashboard/admin/business/providers" component={AdminBusinessProviders} />
          <Route path="/dashboard/admin/business/country-operator" component={AdminBusinessCountryOperator} />
          <Route path="/dashboard/admin/business/fees" component={AdminBusinessFees} />
          <Route path="/dashboard/admin-access-code" component={AdminAccessCode} />
          <Route path="/dashboard/management" component={ManagementWrapper} />
          <Route path="/dashboard/kyc" component={KYC} />
          <Route path="/dashboard/kyc-verification" component={KycVerification} />
          <Route path="/dashboard/kyc-history" component={KycHistory} />
          <Route path="/dashboard/country-operator-config" component={CountryOperatorConfig} />
          <Route path="/dashboard/fee-config" component={FeeConfig} />
          <Route path="/dashboard/diagnostic" component={Diagnostic} />
          <Route path="/dashboard/fournisseurs" component={Fournisseurs} />
          <Route path="/dashboard/support-config" component={SupportConfig} />
          <Route path="/dashboard/ip-addresses" component={IpAddresses} />
          <Route path="/dashboard/admin/user/:userId/profile" component={AdminUserProfile} />
          <Route path="/dashboard/admin/user/:userId/history" component={AdminUserHistory} />
          <Route path="/dashboard/admin/user/:userId/links" component={AdminUserLinks} />
          <Route path="/dashboard/admin/user/:userId/merchant" component={AdminUserMerchant} />
          <Route path="/dashboard/admin/user/:userId/api" component={AdminUserApi} />
          <Route path="/dashboard/admin/user/:userId/connections" component={AdminUserConnections} />
          <Route path="/dashboard/documentation-business" component={DocumentationBusiness} />
          <Route path="/dashboard/admin/business/users/:userId/profile" component={AdminUserProfile} />
          <Route path="/dashboard/admin/business/users/:userId/history" component={AdminUserHistory} />
          <Route path="/dashboard/admin/business/users/:userId/transactions" component={AdminUserHistory} />
          <Route path="/dashboard/admin/business/users/:userId/api" component={AdminUserApi} />
          <Route path="/dashboard/admin/business/users/:userId/connections" component={AdminUserConnections} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/documentation/redirect/:version">
        {(params) => <DocumentationRedirect version={params.version} />}
      </Route>
      <Route path="/documentation/inline/:version">
        {(params) => <DocumentationInline version={params.version} />}
      </Route>
      <Route path="/documentation/payout/:version">
        {(params) => <DocumentationPayout version={params.version} />}
      </Route>
      <Route path="/documentation/sessions/:version">
        {(params) => <DocumentationSessions version={params.version} />}
      </Route>
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
      <Route path="/login-verify" component={LoginVerify} />
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
      <Route path="/checkout/:sessionId" component={Checkout} />
      <Route path="/payment-success" component={PaymentSuccessPage} />
      <Route path="/payment-failed" component={PaymentFailedPage} />
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
