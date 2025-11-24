import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const ADMIN_CODE = "19992025";

export function useAdminAccess() {
  const [, navigate] = useLocation();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedCode = localStorage.getItem("adminAccessCode");
    if (storedCode === ADMIN_CODE) {
      setHasAccess(true);
    } else {
      setHasAccess(false);
      navigate("/dashboard/admin-access-code");
    }
    setIsLoading(false);
  }, [navigate]);

  return { hasAccess, isLoading };
}
