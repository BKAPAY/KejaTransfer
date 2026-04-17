import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  User,
  Code,
  History,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Shield,
  FileText,
  Headphones,
  Banknote,
  BarChart2,
  Percent,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function BusinessSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setOpenMobile, isMobile } = useSidebar();
  const [historyOpen, setHistoryOpen] = useState(
    location.startsWith("/dashboard/business/history")
  );

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
  });

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt sur BKApay",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la déconnexion",
        variant: "destructive",
      });
    },
  });

  const isActive = (path: string) => location === path;

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
        </div>
        {user?.businessName && (
          <p className="text-xs text-muted-foreground mt-1 font-medium truncate">
            {user.businessName}
          </p>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business")}
                  data-testid="nav-business-dashboard"
                >
                  <Link href="/dashboard/business" onClick={handleMenuClick}>
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Tableau de bord</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/profile")}
                  data-testid="nav-business-profile"
                >
                  <Link href="/dashboard/business/profile" onClick={handleMenuClick}>
                    <User className="w-4 h-4" />
                    <span>Profil</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/dashboard/business/kyc")}
                  data-testid="nav-business-kyc"
                >
                  <Link href="/dashboard/business/kyc" onClick={handleMenuClick}>
                    <Shield className="w-4 h-4" />
                    <span>Vérification KYC</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/api")}
                  data-testid="nav-business-api"
                >
                  <Link href="/dashboard/business/api" onClick={handleMenuClick}>
                    <Code className="w-4 h-4" />
                    <span>API</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/analytics")}
                  data-testid="nav-business-analytics"
                >
                  <Link href="/dashboard/business/analytics" onClick={handleMenuClick}>
                    <BarChart2 className="w-4 h-4" />
                    <span>Analytique</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/fees")}
                  data-testid="nav-business-fees"
                >
                  <Link href="/dashboard/business/fees" onClick={handleMenuClick}>
                    <Percent className="w-4 h-4" />
                    <span>Frais</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.startsWith("/dashboard/business/history")}
                  onClick={() => setHistoryOpen(!historyOpen)}
                  data-testid="nav-business-history"
                >
                  <History className="w-4 h-4" />
                  <span>Historique</span>
                  {historyOpen
                    ? <ChevronDown className="w-4 h-4 ml-auto" />
                    : <ChevronRight className="w-4 h-4 ml-auto" />
                  }
                </SidebarMenuButton>
                {historyOpen && (
                  <SidebarMenu className="pl-6 mt-1">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/business/history/incoming")}
                        data-testid="nav-business-history-incoming"
                      >
                        <Link href="/dashboard/business/history/incoming" onClick={handleMenuClick}>
                          <ArrowDownCircle className="w-4 h-4 text-green-600" />
                          <span>Paiements entrants</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/business/history/outgoing")}
                        data-testid="nav-business-history-outgoing"
                      >
                        <Link href="/dashboard/business/history/outgoing" onClick={handleMenuClick}>
                          <ArrowUpCircle className="w-4 h-4 text-red-500" />
                          <span>Paiements sortants</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/settlements")}
                  data-testid="nav-business-settlements"
                >
                  <Link href="/dashboard/business/settlements" onClick={handleMenuClick}>
                    <Banknote className="w-4 h-4" />
                    <span>Règlement</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  data-testid="nav-business-documentation"
                >
                  <a href="https://bkapay.com/docs" target="_blank" rel="noopener noreferrer" onClick={handleMenuClick}>
                    <FileText className="w-4 h-4" />
                    <span>Documentation</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/support")}
                  data-testid="nav-business-support"
                >
                  <Link href="/dashboard/business/support" onClick={handleMenuClick}>
                    <Headphones className="w-4 h-4" />
                    <span>Support</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business/settings")}
                  data-testid="nav-business-settings"
                >
                  <Link href="/dashboard/business/settings" onClick={handleMenuClick}>
                    <Settings className="w-4 h-4" />
                    <span>Paramètres</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => { handleMenuClick(); logoutMutation.mutate(); }}
          disabled={logoutMutation.isPending}
          data-testid="button-business-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {logoutMutation.isPending ? "Déconnexion..." : "Déconnexion"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
