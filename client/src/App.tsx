import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
import Announcements from "@/pages/dashboard/announcements";
import Documentation from "@/pages/dashboard/documentation";
import Support from "@/pages/dashboard/support";
import Pay from "@/pages/pay";
import Merchant from "@/pages/merchant";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-4 p-4 border-b bg-card sticky top-0 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
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
          <Route path="/dashboard/announcements" component={Announcements} />
          <Route path="/dashboard/documentation" component={Documentation} />
          <Route path="/dashboard/support" component={Support} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/pay/:token" component={Pay} />
      <Route path="/merchant/:token" component={Merchant} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
