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
  Store,
  Code,
  History,
  Settings,
  FileText,
  HelpCircle,
  LogOut,
  TrendingUp,
  Shield,
  Send,
  Banknote,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, clearPersistedCache } from "@/lib/queryClient";
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
    title: "Lien marchand",
    url: "/dashboard/merchant-links",
    icon: Store,
    testId: "nav-merchant-links",
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
  items: (typeof generalItems[0] & { color?: string })[];
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
                <item.icon className="w-4 h-4" style={item.color ? { color: item.color } : undefined} />
                <span style={item.color ? { color: item.color, fontWeight: 600 } : undefined}>{item.title}</span>
              </a>
            ) : (
              <Link href={item.url} onClick={onMenuClick}>
                <item.icon className="w-4 h-4" style={item.color ? { color: item.color } : undefined} />
                <span style={item.color ? { color: item.color, fontWeight: 600 } : undefined}>{item.title}</span>
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
  const { setOpenMobile, isMobile, open } = useSidebar();
  const [logoWhiteBg, setLogoWhiteBg] = useState(true);
  const [logoSpinKey, setLogoSpinKey] = useState(0);
  const prevOpenRef = useState(() => open);

  useEffect(() => {
    if (prevOpenRef[0] !== open) {
      prevOpenRef[0] = open;
      setLogoSpinKey(k => k + 1);
      setLogoWhiteBg(b => !b);
    }
  }, [open]);

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

  const salaryItems = user?.isSalary
    ? [{ title: "Salaire", url: "/dashboard/salary", icon: Banknote, testId: "nav-salary", color: "#16a34a" }]
    : [];

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      localStorage.removeItem("adminAccessCode");
      clearPersistedCache();
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
          <div
            key={logoSpinKey}
            className={`logo-spin-once rounded-md px-2 py-1 flex-shrink-0 transition-colors duration-500 ${logoWhiteBg ? "bg-white" : "bg-transparent"}`}
          >
            <img src={logoImage} alt="BKApay" className="h-8 w-auto" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* General group */}
        <SidebarGroup>
          <SidebarGroupLabel>Général</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuItems
              items={[...generalItems, ...salaryItems, ...adminItems]}
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
