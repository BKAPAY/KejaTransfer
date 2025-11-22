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
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  User,
  Link as LinkIcon,
  Store,
  Code,
  History,
  Settings,
  Megaphone,
  FileText,
  HelpCircle,
  LogOut,
  TrendingUp,
} from "lucide-react";
import logoImage from "@assets/bkapay-logo.png";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
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
    title: "Lien marchand",
    url: "/dashboard/merchant-links",
    icon: Store,
    testId: "nav-merchant-links",
  },
  {
    title: "API",
    url: "/dashboard/api",
    icon: Code,
    testId: "nav-api",
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: TrendingUp,
    testId: "nav-analytics",
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
    title: "Annonces",
    url: "/dashboard/announcements",
    icon: Megaphone,
    testId: "nav-announcements",
  },
  {
    title: "Documentation",
    url: "/dashboard/documentation",
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

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt sur BKApay",
      });
      setLocation("/login");
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la déconnexion",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="BKApay" className="h-10 w-auto" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleLogout}
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
