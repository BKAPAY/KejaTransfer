import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Lock, KeyRound, ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const codeSchema = z.object({
  verificationCode: z.string().length(6, "Le code doit contenir 6 chiffres"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type CodeFormData = z.infer<typeof codeSchema>;

const RESEND_COOLDOWN = 60; // 1 minute in seconds
const STORAGE_KEY_PREFIX = "bkapay_login_";

function getStorageKey(email: string, suffix: string): string {
  return `${STORAGE_KEY_PREFIX}${email.toLowerCase()}_${suffix}`;
}

function saveToStorage(email: string, key: string, value: string | number): void {
  try {
    localStorage.setItem(getStorageKey(email, key), String(value));
  } catch (e) {
    // Storage not available
  }
}

function getFromStorage(email: string, key: string): string | null {
  try {
    return localStorage.getItem(getStorageKey(email, key));
  } catch (e) {
    return null;
  }
}

function clearStorage(email: string): void {
  try {
    localStorage.removeItem(getStorageKey(email, "cooldownEnd"));
    localStorage.removeItem(getStorageKey(email, "resendsUsed"));
    localStorage.removeItem(getStorageKey(email, "suspendedUntil"));
  } catch (e) {
    // Storage not available
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"credentials" | "verification">("credentials");
  const [credentials, setCredentials] = useState<LoginFormData | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationCode, setVerificationCode] = useState("");

  // Load persisted cooldown state when credentials change
  useEffect(() => {
    if (!credentials?.email) return;
    
    const email = credentials.email;
    const storedCooldownEnd = getFromStorage(email, "cooldownEnd");
    
    if (storedCooldownEnd) {
      const cooldownEnd = parseInt(storedCooldownEnd, 10);
      const remainingCooldown = Math.ceil((cooldownEnd - Date.now()) / 1000);
      if (remainingCooldown > 0) {
        setResendCooldown(remainingCooldown);
      } else {
        localStorage.removeItem(getStorageKey(email, "cooldownEnd"));
      }
    }
  }, [credentials?.email]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatCooldownTime = useCallback((seconds: number) => {
    const secs = seconds % 60;
    return `${secs}s`;
  }, []);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const codeForm = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      verificationCode: "",
    },
  });

  const sendCodeMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login/send-code", data);
      return await response.json();
    },
    onSuccess: async (response: any, data) => {
      console.log("[Login] Response received:", JSON.stringify(response));
      
      if (response.requiresCode === false || !response.requiresCode) {
        console.log("[Login] Direct login - redirecting to dashboard");
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setLocation("/dashboard");
        return;
      }
      
      setCredentials(data);
      setStep("verification");
      
      // Set cooldown timer (1 minute)
      const cooldownEnd = Date.now() + RESEND_COOLDOWN * 1000;
      setResendCooldown(RESEND_COOLDOWN);
      saveToStorage(data.email, "cooldownEnd", cooldownEnd);
      
      toast({
        title: "Code envoye",
        description: "Un code de connexion a ete envoye a votre email",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Email ou mot de passe incorrect",
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; verificationCode: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response;
    },
    onSuccess: async () => {
      if (credentials?.email) {
        clearStorage(credentials.email);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Code de connexion invalide ou expiré",
        variant: "destructive",
      });
    },
  });

  const resendCodeMutation = useMutation({
    mutationFn: async () => {
      if (!credentials) throw new Error("Données de connexion manquantes");
      const response = await apiRequest("POST", "/api/auth/login/send-code", credentials);
      return response;
    },
    onSuccess: () => {
      const email = credentials?.email || "";
      
      // Set cooldown timer (1 minute)
      const cooldownEnd = Date.now() + RESEND_COOLDOWN * 1000;
      setResendCooldown(RESEND_COOLDOWN);
      saveToStorage(email, "cooldownEnd", cooldownEnd);
      
      // Reset code field
      setVerificationCode("");
      
      toast({
        title: "Code renvoye",
        description: "Un nouveau code a ete envoye a votre email",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'envoi du code",
        variant: "destructive",
      });
    },
  });

  const onSubmitCredentials = (data: LoginFormData) => {
    sendCodeMutation.mutate(data);
  };

  const onSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials) return;
    if (verificationCode.length !== 6) {
      toast({
        title: "Code invalide",
        description: "Le code doit contenir 6 chiffres",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({
      ...credentials,
      verificationCode,
    });
  };

  const handleBack = () => {
    setStep("credentials");
    setCredentials(null);
    setVerificationCode("");
    setResendCooldown(0);
  };

  const handleResendCode = () => {
    if (resendCooldown > 0) return;
    resendCodeMutation.mutate();
  };

  const canResend = resendCooldown === 0;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
      <Card className="w-full max-w-xs sm:max-w-sm">
        <CardHeader className="space-y-2 sm:space-y-3 lg:space-y-4 text-center p-3 sm:p-4 lg:p-6">
          <Link href="/">
            <div className="flex justify-center mb-1 sm:mb-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logoImage} alt="BKApay" className="h-10 sm:h-12 lg:h-16 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold">Se connecter</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {step === "credentials" 
              ? "Accédez à votre tableau de bord" 
              : "Entrez le code envoyé à votre email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          {step === "credentials" ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onSubmitCredentials)} className="space-y-2 sm:space-y-3 lg:space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="jean.dupont@example.com"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" />
                        Mot de passe
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-sm">
                  <Link href="/forgot-password">
                    <span 
                      className="text-primary hover:underline cursor-pointer" 
                      data-testid="link-forgot-password"
                    >
                      Mot de passe oublié ?
                    </span>
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendCodeMutation.isPending}
                  data-testid="button-submit"
                >
                  {sendCodeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : "Continuer"}
                </Button>
              </form>
            </Form>
          ) : (
            <form onSubmit={onSubmitCode} className="space-y-2 sm:space-y-3 lg:space-y-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Un code à 6 chiffres a été envoyé à<br />
                  <span className="font-medium text-foreground">{credentials?.email}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="verification-code" className="text-sm font-medium">
                  Code de connexion
                </label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder=""
                  className="text-center text-lg tracking-widest font-mono"
                  data-testid="input-verification-code"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                    setVerificationCode(value);
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Ce code est valable pendant 10 minutes
              </p>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending || verificationCode.length !== 6}
                data-testid="button-verify"
              >
                {loginMutation.isPending ? "Connexion..." : "Se connecter"}
                </Button>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={handleResendCode}
                    disabled={resendCodeMutation.isPending || !canResend}
                    data-testid="button-resend-code"
                  >
                    {resendCodeMutation.isPending ? (
                      "Envoi en cours..."
                    ) : resendCooldown > 0 ? (
                      `Renvoyer le code (${formatCooldownTime(resendCooldown)})`
                    ) : (
                      "Renvoyer le code"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={handleBack}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Pas encore de compte ? </span>
            <Link href="/signup">
              <span className="text-primary hover:underline font-medium" data-testid="link-signup">
                S'inscrire
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
