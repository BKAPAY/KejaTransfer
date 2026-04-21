import { useQuery } from "@tanstack/react-query";
import { getQueryFn, loadCachedQueryData } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error, failureCount } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    placeholderData: () => loadCachedQueryData("/api/auth/me") as User | null,
    staleTime: 30000,
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
    },
    retryDelay: 1000,
  });

  const isUnauthenticated = !isLoading && user === null && !error;
  const isServerError = !isLoading && !!error;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isUnauthenticated,
    isServerError,
    error,
    failureCount,
    accountType: user?.accountType,
  };
}
