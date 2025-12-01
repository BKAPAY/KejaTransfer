import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
    // Build URL from queryKey - ensure it starts with / for absolute path
    let url = queryKey.join("/");
    if (!url.startsWith("/")) {
      url = "/" + url;
    }
    
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
