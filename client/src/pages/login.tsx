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
import { Mail, Lock, KeyRound, ArrowLeft, AlertTriangle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const codeSchema = z.object({
  verificationCode: z.string().length(6, "Le code doit contenir 6 chiffres"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type CodeFormData = z.infer<typeof codeSchema>;

const RESEND_COOLDOWN = 5 * 60; // 5 minutes in seconds
const MAX_RESENDS = 3; // 3 resends allowed (separate from initial send)
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
  const [resendsUsed, setResendsUsed] = useState(0);
  const [suspendedUntil, setSuspendedUntil] = useState<number | null>(null);
  const [suspendedTimeRemaining, setSuspendedTimeRemaining] = useState<string>("");

  // Load persisted state when credentials change
  useEffect(() => {
    if (!credentials?.email) return;
    
    const email = credentials.email;
    const storedSuspendedUntil = getFromStorage(email, "suspendedUntil");
    const storedCooldownEnd = getFromStorage(email, "cooldownEnd");
    const storedResendCount = getFromStorage(email, "resendsUsed");
    
    if (storedSuspendedUntil) {
      const suspendTime = parseInt(storedSuspendedUntil, 10);
      if (suspendTime > Date.now()) {
        setSuspendedUntil(suspendTime);
      } else {
        localStorage.removeItem(getStorageKey(email, "suspendedUntil"));
      }
    }
    
    if (storedCooldownEnd) {
      const cooldownEnd = parseInt(storedCooldownEnd, 10);
      const remainingCooldown = Math.ceil((cooldownEnd - Date.now()) / 1000);
      if (remainingCooldown > 0) {
        setResendCooldown(remainingCooldown);
      } else {
        localStorage.removeItem(getStorageKey(email, "cooldownEnd"));
      }
    }
    
    if (storedResendCount) {
      setResendsUsed(parseInt(storedResendCount, 10));
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

  // Countdown timer for suspension
  useEffect(() => {
    if (!suspendedUntil) return;
    
    const updateSuspensionTime = () => {
      const now = Date.now();
      const remaining = suspendedUntil - now;
      
      if (remaining <= 0) {
        setSuspendedUntil(null);
        setSuspendedTimeRemaining("");
        setResendsUsed(0);
        if (credentials?.email) {
          clearStorage(credentials.email);
        }
        return;
      }
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setSuspendedTimeRemaining(`${hours}h ${minutes}min ${seconds}s`);
      } else if (minutes > 0) {
        setSuspendedTimeRemaining(`${minutes}min ${seconds}s`);
      } else {
        setSuspendedTimeRemaining(`${seconds}s`);
      }
    };
    
    updateSuspensionTime();
    const timer = setInterval(updateSuspensionTime, 1000);
    return () => clearInterval(timer);
  }, [suspendedUntil, credentials?.email]);

  const formatCooldownTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

  const handleSuspension = (email: string, suspendedUntilTime?: number) => {
    const suspendTime = suspendedUntilTime || (Date.now() + 3 * 60 * 60 * 1000);
    setSuspendedUntil(suspendTime);
    saveToStorage(email, "suspendedUntil", suspendTime);
    setStep("credentials");
    setCredentials(null);
    setResendsUsed(0);
    setResendCooldown(0);
  };

  const sendCodeMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login/send-code", data);
      return response;
    },
    onSuccess: (response: any, data) => {
      setCredentials(data);
      setStep("verification");
      
      // Set cooldown timer
      const cooldownEnd = Date.now() + RESEND_COOLDOWN * 1000;
      setResendCooldown(RESEND_COOLDOWN);
      saveToStorage(data.email, "cooldownEnd", cooldownEnd);
      
      // Update resend count from server (0 for initial send is valid)
      const serverResendsUsed = response.resendsUsed ?? 0;
      setResendsUsed(serverResendsUsed);
      saveToStorage(data.email, "resendsUsed", serverResendsUsed);
      
      // Check if this was the last attempt
      if (response.isLastAttempt && response.suspendedUntil) {
        saveToStorage(data.email, "suspendedUntil", response.suspendedUntil);
        toast({
          title: "Attention",
          description: "C'est votre dernier code. Votre compte sera suspendu si vous n'entrez pas le bon code.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Code envoyé",
          description: "Un code de connexion a été envoyé à votre email",
        });
      }
    },
    onError: (error: any) => {
      const email = loginForm.getValues("email");
      
      // Check for suspension from server
      if (error.suspendedUntil) {
        handleSuspension(email, error.suspendedUntil);
      } else if (error.isSuspension || error.message?.includes("suspendu")) {
        handleSuspension(email);
      }
      
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
      // Clear all login state on successful login
      if (credentials?.email) {
        clearStorage(credentials.email);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur BKApay",
      });
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
    onSuccess: (response: any) => {
      const email = credentials?.email || "";
      
      // Set cooldown timer
      const cooldownEnd = Date.now() + RESEND_COOLDOWN * 1000;
      setResendCooldown(RESEND_COOLDOWN);
      saveToStorage(email, "cooldownEnd", cooldownEnd);
      
      // Update resend count from server
      const serverResendsUsed = response.resendsUsed ?? resendsUsed + 1;
      setResendsUsed(serverResendsUsed);
      saveToStorage(email, "resendsUsed", serverResendsUsed);
      
      // Reset code field
      codeForm.reset({ verificationCode: "" });
      
      // Check if this was the last attempt
      if (response.isLastAttempt && response.suspendedUntil) {
        saveToStorage(email, "suspendedUntil", response.suspendedUntil);
        toast({
          title: "Dernier code envoyé",
          description: "C'est votre dernier code. Votre compte sera suspendu si vous n'entrez pas le bon code.",
          variant: "destructive",
        });
      } else {
        // Use server-provided remaining count
        const remaining = response.resendsRemaining ?? (MAX_RESENDS - serverResendsUsed);
        toast({
          title: "Code renvoyé",
          description: `Un nouveau code a été envoyé.${remaining > 0 ? ` Il vous reste ${remaining} renvoi(s).` : ""}`,
        });
      }
    },
    onError: (error: any) => {
      const email = credentials?.email || "";
      
      // Check for suspension from server
      if (error.suspendedUntil) {
        handleSuspension(email, error.suspendedUntil);
      } else if (error.isSuspension || error.message?.includes("suspendu")) {
        handleSuspension(email);
      }
      
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'envoi du code",
        variant: "destructive",
      });
    },
  });

  const onSubmitCredentials = (data: LoginFormData) => {
    // Check for persisted suspension
    const storedSuspendedUntil = getFromStorage(data.email, "suspendedUntil");
    if (storedSuspendedUntil) {
      const suspendTime = parseInt(storedSuspendedUntil, 10);
      if (suspendTime > Date.now()) {
        setSuspendedUntil(suspendTime);
        toast({
          title: "Compte suspendu",
          description: "Veuillez attendre que la suspension soit levée.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (suspendedUntil && Date.now() < suspendedUntil) {
      toast({
        title: "Compte suspendu",
        description: `Veuillez attendre ${suspendedTimeRemaining} avant de réessayer.`,
        variant: "destructive",
      });
      return;
    }
    sendCodeMutation.mutate(data);
  };

  const onSubmitCode = (data: CodeFormData) => {
    if (!credentials) return;
    loginMutation.mutate({
      ...credentials,
      verificationCode: data.verificationCode,
    });
  };

  const handleBack = () => {
    setStep("credentials");
    setCredentials(null);
    codeForm.reset({ verificationCode: "" });
    setResendCooldown(0);
  };

  const handleResendCode = () => {
    if (resendCooldown > 0) return;
    if (resendsUsed >= MAX_RESENDS) {
      toast({
        title: "Limite atteinte",
        description: "Vous avez utilisé tous vos renvois de code.",
        variant: "destructive",
      });
      return;
    }
    resendCodeMutation.mutate();
  };

  const canResend = resendCooldown === 0 && resendsUsed < MAX_RESENDS;
  const isSuspended = suspendedUntil && Date.now() < suspendedUntil;

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
          {isSuspended && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Compte suspendu temporairement</p>
                  <p className="text-muted-foreground mt-1">
                    Tentative de connexion suspecte détectée. 
                    Veuillez réessayer dans <span className="font-medium text-foreground">{suspendedTimeRemaining}</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                          disabled={!!isSuspended}
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
                          disabled={!!isSuspended}
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
                  disabled={sendCodeMutation.isPending || !!isSuspended}
                  data-testid="button-submit"
                >
                  {sendCodeMutation.isPending ? "Vérification..." : "Continuer"}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...codeForm}>
              <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="space-y-2 sm:space-y-3 lg:space-y-4">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Un code à 6 chiffres a été envoyé à<br />
                    <span className="font-medium text-foreground">{credentials?.email}</span>
                  </p>
                </div>

                <FormField
                  control={codeForm.control}
                  name="verificationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code de connexion</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="one-time-code"
                          autoFocus
                          className="text-center text-lg tracking-widest font-mono"
                          data-testid="input-verification-code"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="text-xs text-muted-foreground text-center">
                  Ce code est valable pendant 10 minutes
                </p>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
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
                    ) : resendsUsed >= MAX_RESENDS ? (
                      "Limite de renvois atteinte"
                    ) : (
                      `Renvoyer le code (${MAX_RESENDS - resendsUsed} restant${MAX_RESENDS - resendsUsed > 1 ? "s" : ""})`
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
            </Form>
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
