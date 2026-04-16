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
  Link as LinkIcon,
  Code,
  History,
  Settings,
  FileText,
  HelpCircle,
  LogOut,
  TrendingUp,
  Shield,
  Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const generalItems = [
  {
    title: "Tableau de bord",
    url: "/dashboard",
    icon: LayoutDashboard,
    testId: "nav-dashboard",
  },
  {
    title: "Profil",
    url: "/dashboard/profile",
    icon: User,
    testId: "nav-profile",
  },
  {
    title: "Lien de paiement",
    url: "/dashboard/payment-links",
    icon: LinkIcon,
    testId: "nav-payment-links",
  },
  {
    title: "Verification KYC",
    url: "/dashboard/kyc",
    icon: Shield,
    testId: "nav-kyc",
  },
  {
    title: "Historique",
    url: "/dashboard/history",
    icon: History,
    testId: "nav-history",
  },
  {
    title: "Paramètres",
    url: "/dashboard/settings",
    icon: Settings,
    testId: "nav-settings",
  },
  {
    title: "Documentation",
    url: "https://bkapay.com/docs",
    icon: FileText,
    testId: "nav-documentation",
  },
  {
    title: "Support",
    url: "/dashboard/support",
    icon: HelpCircle,
    testId: "nav-support",
  },
];

const businessItems = [
  {
    title: "API Payin",
    url: "/dashboard/api",
    icon: Code,
    testId: "nav-api",
  },
  {
    title: "API Payout",
    url: "/dashboard/api-payout",
    icon: Send,
    testId: "nav-api-payout",
  },
  {
    title: "Analytique",
    url: "/dashboard/analytics",
    icon: TrendingUp,
    testId: "nav-analytics",
  },
];

function SidebarMenuItems({
  items,
  location,
  onMenuClick,
}: {
  items: typeof generalItems;
  location: string;
  onMenuClick: () => void;
}) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={location === item.url}
            data-testid={item.testId}
          >
            {item.url.startsWith("http") ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={onMenuClick}>
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </a>
            ) : (
              <Link href={item.url} onClick={onMenuClick}>
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setOpenMobile, isMobile } = useSidebar();

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
  });

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const adminItems = user?.isAdmin
    ? [{ title: "Administration", url: "/dashboard/admin", icon: Shield, testId: "nav-admin" }]
    : [];

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      localStorage.removeItem("adminAccessCode");
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

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* General group */}
        <SidebarGroup>
          <SidebarGroupLabel>Général</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuItems
              items={[...generalItems, ...adminItems]}
              location={location}
              onMenuClick={handleMenuClick}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Outils — API et Analytique pour tous les comptes */}
        <SidebarGroup>
          <SidebarGroupLabel>Outils</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuItems
              items={businessItems}
              location={location}
              onMenuClick={handleMenuClick}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => { handleMenuClick(); logoutMutation.mutate(); }}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {logoutMutation.isPending ? "Déconnexion..." : "Déconnexion"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
