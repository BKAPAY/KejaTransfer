import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Clés dont les données sont persistées dans localStorage pour un affichage immédiat au rechargement
const PERSIST_KEYS = ["/api/auth/me"];
const STORAGE_PREFIX = "bkapay_cache_";

function getStorageKey(queryKey: string): string {
  return STORAGE_PREFIX + queryKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function loadCachedQueryData(queryKey: string): unknown | null {
  try {
    const raw = localStorage.getItem(getStorageKey(queryKey));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCachedQueryData(queryKey: string, data: unknown): void {
  try {
    localStorage.setItem(getStorageKey(queryKey), JSON.stringify(data));
  } catch {
    // Ignore les erreurs de quota localStorage
  }
}

/** Précharge le cache React Query depuis localStorage avant les requêtes réseau */
export function preloadCacheFromStorage(client: QueryClient): void {
  for (const key of PERSIST_KEYS) {
    const cached = loadCachedQueryData(key);
    if (cached !== null) {
      client.setQueryData([key], cached);
    }
  }
}

/** Efface toutes les données persistées (à appeler lors de la déconnexion) */
export function clearPersistedCache(): void {
  for (const key of PERSIST_KEYS) {
    try { localStorage.removeItem(getStorageKey(key)); } catch {}
  }
}

// Sanitize error messages - remove technical codes and special chars ()/:{}\ 
function sanitizeErrorMessage(message: string): string {
  if (!message) return "Une erreur est survenue";
  
  // Remove HTTP status codes at the start (e.g., "400: ", "500: ")
  let cleaned = message.replace(/^\d{3}:\s*/, '');
  
  // Remove technical patterns like "Error: ", "TypeError: ", etc.
  cleaned = cleaned.replace(/^(Error|TypeError|ReferenceError|SyntaxError):\s*/i, '');
  
  // Replace technical API terms with user-friendly messages
  if (cleaned.includes("EMAIL/CODE OTP") || cleaned.includes("EMAIL CODE OTP")) {
    cleaned = "Les informations de paiement sont incorrectes. Veuillez vérifier votre numéro de téléphone et réessayer.";
  }
  
  // Remove forbidden special characters ()/:{}\ 
  cleaned = cleaned.replace(/[(){}\\]/g, ' ');
  
  // Clean up multiple spaces created by character removal
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // If message is empty or too technical, use generic message
  if (!cleaned || cleaned.length < 3) {
    return "Une erreur est survenue";
  }
  
  return cleaned;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let errorMessage = "";
    
    // Try to parse JSON error message
    try {
      const json = JSON.parse(text);
      if (json.error) {
        // Extract and sanitize clean error message
        errorMessage = sanitizeErrorMessage(json.error);
      }
    } catch {
      // Not JSON, will use fallback
    }
    
    // Use parsed error message or fallback to sanitized text
    if (!errorMessage) {
      errorMessage = sanitizeErrorMessage(text || res.statusText);
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const keyStr = queryKey[0] as string;
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Effacer le cache localStorage si la session a expiré
      if (PERSIST_KEYS.includes(keyStr)) {
        try { localStorage.removeItem(getStorageKey(keyStr)); } catch {}
      }
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();

    // Persister dans localStorage pour affichage immédiat au prochain rechargement
    if (PERSIST_KEYS.includes(keyStr)) {
      saveCachedQueryData(keyStr, data);
    }

    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
