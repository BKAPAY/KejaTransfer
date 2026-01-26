import { useState } from "react";
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
import { Mail, Lock, KeyRound, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const codeSchema = z.object({
  verificationCode: z.string().length(6, "Le code doit contenir 6 chiffres"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type CodeFormData = z.infer<typeof codeSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"credentials" | "verification">("credentials");
  const [credentials, setCredentials] = useState<LoginFormData | null>(null);

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
      return response;
    },
    onSuccess: (_, data) => {
      setCredentials(data);
      setStep("verification");
      toast({
        title: "Code envoyé",
        description: "Un code de connexion a été envoyé à votre email",
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
    onSuccess: () => {
      toast({
        title: "Code renvoyé",
        description: "Un nouveau code a été envoyé à votre email",
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
    codeForm.reset();
  };

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
                          placeholder="000000"
                          maxLength={6}
                          className="text-center text-lg tracking-widest font-mono"
                          data-testid="input-verification-code"
                          {...field}
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
                    onClick={() => resendCodeMutation.mutate()}
                    disabled={resendCodeMutation.isPending}
                    data-testid="button-resend-code"
                  >
                    {resendCodeMutation.isPending ? "Envoi en cours..." : "Renvoyer le code"}
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
