import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error, failureCount } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      return await res.json();
    },
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
  };
}
