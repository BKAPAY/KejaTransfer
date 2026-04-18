import { Switch, Route, useLocation } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BusinessSidebar } from "@/components/business-sidebar";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Wallet, Loader2 } from "lucide-react";
import { EmaliChatButton } from "@/components/emali-chat";
import { CURRENT_VERSION } from "@/lib/doc-versions";
import { COUNTRIES } from "@shared/schema";
import type { User } from "@shared/schema";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";
import MaintenancePage from "@/pages/maintenance";
const Dashboard = lazy(() => import("@/pages/dashboard/index"));
const Profile = lazy(() => import("@/pages/dashboard/profile"));
const PaymentLinks = lazy(() => import("@/pages/dashboard/payment-links"));
const MerchantLinks = lazy(() => import("@/pages/dashboard/merchant-links"));
const ApiPage = lazy(() => import("@/pages/dashboard/api"));
const ApiPayoutPage = lazy(() => import("@/pages/dashboard/api-payout"));
const Analytics = lazy(() => import("@/pages/dashboard/analytics"));
const AnalyticsBusiness = lazy(() => import("@/pages/dashboard/analytics-business"));
const History = lazy(() => import("@/pages/dashboard/history"));
const Settings = lazy(() => import("@/pages/dashboard/settings"));
const Support = lazy(() => import("@/pages/dashboard/support"));
const Deposit = lazy(() => import("@/pages/dashboard/deposit"));
const Transfer = lazy(() => import("@/pages/dashboard/transfer"));
const Withdrawal = lazy(() => import("@/pages/dashboard/withdrawal"));
const Admin = lazy(() => import("@/pages/dashboard/admin"));
const AdminBusiness = lazy(() => import("@/pages/dashboard/admin-business"));
const AdminBusinessManagement = lazy(() => import("@/pages/dashboard/admin-business-management"));
const AdminBusinessKyc = lazy(() => import("@/pages/dashboard/admin-business-kyc"));
const AdminBusinessKycDetail = lazy(() => import("@/pages/dashboard/admin-business-kyc-detail"));
const AdminBusinessProviders = lazy(() => import("@/pages/dashboard/admin-business-providers"));
const AdminBusinessCountryOperator = lazy(() => import("@/pages/dashboard/admin-business-country-operator"));
const AdminBusinessFees = lazy(() => import("@/pages/dashboard/admin-business-fees"));
const AdminBusinessHistory = lazy(() => import("@/pages/dashboard/admin-business-history"));
const AdminBusinessWallets = lazy(() => import("@/pages/dashboard/admin-business-wallets"));
const ManagementWrapper = lazy(() => import("@/pages/dashboard/management-wrapper"));
const AdminAccessCode = lazy(() => import("@/pages/dashboard/admin-access-code"));
const KycVerification = lazy(() => import("@/pages/dashboard/kyc-verification"));
const KycHistory = lazy(() => import("@/pages/dashboard/kyc-history"));
const KYC = lazy(() => import("@/pages/dashboard/kyc"));
const CountryOperatorConfig = lazy(() => import("@/pages/dashboard/country-operator-config"));
const FeeConfig = lazy(() => import("@/pages/dashboard/fee-config"));
const Diagnostic = lazy(() => import("@/pages/dashboard/diagnostic"));
const Fournisseurs = lazy(() => import("@/pages/dashboard/fournisseurs"));
const SupportConfig = lazy(() => import("@/pages/dashboard/support-config"));
const DocumentationBusiness = lazy(() => import("@/pages/dashboard/documentation-business"));
const DocumentationLanding = lazy(() => import("@/pages/dashboard/documentation-landing"));
const IpAddresses = lazy(() => import("@/pages/dashboard/ip-addresses"));
const AdminUserProfile = lazy(() => import("@/pages/dashboard/admin-user-profile"));
const AdminUserHistory = lazy(() => import("@/pages/dashboard/admin-user-history"));
const AdminUserLinks = lazy(() => import("@/pages/dashboard/admin-user-links"));
const AdminUserMerchant = lazy(() => import("@/pages/dashboard/admin-user-merchant"));
const AdminUserApi = lazy(() => import("@/pages/dashboard/admin-user-api"));
const AdminUserConnections = lazy(() => import("@/pages/dashboard/admin-user-connections"));
const Pay = lazy(() => import("@/pages/pay"));
const Merchant = lazy(() => import("@/pages/merchant"));
const PaymentSuccessPage = lazy(() => import("@/pages/payment-success"));
const PaymentFailedPage = lazy(() => import("@/pages/payment-failed"));
const ApiPayment = lazy(() => import("@/pages/api-payment"));
const PaymentStatus = lazy(() => import("@/pages/payment-status"));
const ApiDemo = lazy(() => import("@/pages/api-demo"));
const ApiPay = lazy(() => import("@/pages/api-pay"));
const Checkout = lazy(() => import("@/pages/checkout"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Cookies = lazy(() => import("@/pages/cookies"));
const DocumentationVersion = lazy(() => import("@/pages/documentation-version"));
const DocumentationRedirect = lazy(() => import("@/pages/documentation-redirect"));
const DocumentationInline = lazy(() => import("@/pages/documentation-inline"));
const DocumentationPayout = lazy(() => import("@/pages/documentation-payout"));
const DocumentationSessions = lazy(() => import("@/pages/documentation-sessions"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const LoginVerify = lazy(() => import("@/pages/login-verify"));
const BusinessDashboard = lazy(() => import("@/pages/dashboard/business/index"));
const BusinessProfile = lazy(() => import("@/pages/dashboard/business/profile"));
const BusinessKyc = lazy(() => import("@/pages/dashboard/business/kyc"));
const BusinessApi = lazy(() => import("@/pages/dashboard/business/api"));
const BusinessHistory = lazy(() => import("@/pages/dashboard/business/history"));
const BusinessSettings = lazy(() => import("@/pages/dashboard/business/settings"));
const BusinessSettlements = lazy(() => import("@/pages/dashboard/business/settlements"));
const BusinessFees = lazy(() => import("@/pages/dashboard/business/fees"));

function PageLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

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
    staleTime: 30000,
    refetchInterval: 60000,
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
    <div className="h-screen w-full overflow-hidden">
      <SidebarProvider style={style as React.CSSProperties} className="h-full">
        <div className="flex h-full w-full overflow-hidden">
          {type === "business" ? <BusinessSidebar /> : <AppSidebar />}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <header className="flex items-center justify-between gap-4 p-4 border-b bg-card sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-0.5">
                  <SidebarTrigger size="lg" data-testid="button-sidebar-toggle" />
                  <span className="text-[10px] font-medium text-muted-foreground leading-none">MENU</span>
                </div>
                {type === "personal" && (
                  <div className="relative">
                    <EmaliChatButton />
                  </div>
                )}
              </div>
              {type === "personal" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg" data-testid="header-balance">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary" data-testid="text-balance">
                    {formatAmount(stats?.totalBalance ?? user?.balance ?? 0)}
                  </span>
                </div>
              )}
            </header>
            <main className="flex-1 overflow-y-auto">
              <Suspense fallback={<PageLoader />}>
                {children}
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
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
          <Route path="/dashboard/business/settlements" component={BusinessSettlements} />
          <Route path="/dashboard/business/fees" component={BusinessFees} />
          <Route path="/dashboard/business/documentation" component={DocumentationBusiness} />
          <Route path="/dashboard/business/support" component={Support} />
          <Route path="/dashboard/business/analytics" component={AnalyticsBusiness} />
          <Route path="/dashboard/docs" component={DocumentationLanding} />
          <Route path="/dashboard/documentation-business" component={DocumentationBusiness} />
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
          <Route path="/dashboard/docs" component={DocumentationLanding} />
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
          <Route path="/dashboard/admin/business/users/:userId/wallets" component={AdminBusinessWallets} />
          <Route path="/dashboard/admin/business/users/:userId/connections" component={AdminUserConnections} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/documentation" component={DocumentationLanding} />
        <Route path="/docs" component={DocumentationLanding} />
        <Route path="/documentation-business" component={DocumentationBusiness} />
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
    </Suspense>
  );
}

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await fetch("/api/platform-settings/maintenance");
        const data = await res.json();
        setMaintenanceEnabled(data.enabled === true);
      } catch {
        setMaintenanceEnabled(false);
      }
      setChecked(true);
    };

    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ne jamais renvoyer null : le contenu doit se charger dessous pendant que le splash est visible.
  // Quand la vérification est terminée, on affiche la page maintenance si besoin.
  if (checked && !authLoading && maintenanceEnabled && !(user?.isAdmin === true)) {
    if (location !== "/") {
      return <MaintenancePage />;
    }
  }

  return <>{children}</>;
}

// Retire le splash HTML (index.html #app-loading) seulement quand auth + maintenance sont prêts.
// Cela évite la page blanche : le contenu charge dessous, le splash part en fondu quand tout est prêt.
function AppSplashController() {
  const { isLoading: authLoading } = useAuth();
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    fetch("/api/platform-settings/maintenance")
      .then(() => setMaintenanceChecked(true))
      .catch(() => setMaintenanceChecked(true));
  }, []);

  useEffect(() => {
    if (!authLoading && maintenanceChecked) {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 700 - elapsed); // minimum 700ms d'affichage
      const timer = setTimeout(() => {
        const loader = document.getElementById("app-loading");
        if (loader) {
          loader.style.transition = "opacity 0.45s ease";
          loader.style.opacity = "0";
          setTimeout(() => loader.remove(), 500);
        }
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [authLoading, maintenanceChecked]);

  return null;
}

function AppInitializer() {
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      queryClient.prefetchQuery({
        queryKey: ["/api/auth/me"],
      });
      initRef.current = true;
    }
  }, []);

  return (
    <>
      <AppSplashController />
      <MaintenanceGuard>
        <Router />
      </MaintenanceGuard>
    </>
  );
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
