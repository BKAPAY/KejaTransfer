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
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur BKApay",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Email ou mot de passe incorrect",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
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
          <CardDescription className="text-xs sm:text-sm">Accédez à votre tableau de bord</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
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
                  <span className="text-primary hover:underline" data-testid="link-forgot-password">
                    Mot de passe oublié ?
                  </span>
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-submit"
              >
                {loginMutation.isPending ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </Form>

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
