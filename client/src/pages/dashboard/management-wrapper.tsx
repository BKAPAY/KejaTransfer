import { useAdminAccess } from "@/hooks/use-admin-access";
import { useLocation } from "wouter";
import Management from "./management";

export default function ManagementWrapper() {
  const { hasAccess, isLoading: accessLoading } = useAdminAccess();
  const [, navigate] = useLocation();

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    navigate("/dashboard/admin-access-code");
    return null;
  }

  return <Management />;
}
